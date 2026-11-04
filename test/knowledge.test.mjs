import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.mjs';

let captured = null;
const fake = http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => { body += c; }); req.on('end', () => {
    captured = JSON.parse(body);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'kb reply' } }] }));
  });
});
await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-kb-'));
const app = await startServer({ port: 0, dataDir });
try {
  let res = await fetch(app.url + '/api/knowledge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: '作息规则', text: '用户通常在晚上十一点前睡觉。' }) });
  assert.equal(res.status, 201);
  const item = (await res.json()).item;
  res = await fetch(app.url + '/api/knowledge');
  assert.equal((await res.json()).items.length, 1);

  await fetch(app.url + '/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: { provider: 'openai', model: 'fake', apiKey: 'fake-key', baseUrl: `http://127.0.0.1:${fake.address().port}/v1` } }) });
  res = await fetch(app.url + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '我通常什么时候睡觉' }) });
  assert.equal(res.status, 200);
  const system = captured.messages.find((m) => m.role === 'system')?.content || '';
  assert.match(system, /作息规则/);
  assert.match(system, /晚上十一点前睡觉/);

  res = await fetch(app.url + '/api/knowledge/' + item.id, { method: 'DELETE' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
  console.log(JSON.stringify({ ok: true, test: 'knowledge' }));
} finally {
  await app.close();
  await new Promise((resolve) => fake.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
}