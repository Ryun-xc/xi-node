import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.mjs';

let captured = null;
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    captured = JSON.parse(body);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'recall reply' } }] }));
  });
});
await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-recall-'));
const app = await startServer({ port: 0, dataDir });
try {
  let res = await fetch(app.url + '/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: { provider: 'openai', model: 'fake', apiKey: 'fake-key', baseUrl: `http://127.0.0.1:${fake.address().port}/v1` } }) });
  assert.equal(res.status, 200);
  res = await fetch(app.url + '/api/memory', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: '用户喜欢在晚上十点写代码' }) });
  assert.equal(res.status, 201);
  res = await fetch(app.url + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '我晚上什么时候适合写代码' }) });
  if (res.status !== 200) console.log(await res.text());
  assert.equal(res.status, 200);
  const system = captured?.messages?.find((m) => m.role === 'system')?.content || '';
  assert.match(system, /用户喜欢在晚上十点写代码/);
  console.log(JSON.stringify({ ok: true, test: 'memory-recall' }));
} finally {
  await app.close();
  await new Promise((resolve) => fake.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
}