import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-chat-'));
let app = await startServer({ port: 0, dataDir });
const post = async (url, body) => fetch(app.url + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
try {
  let res = await post('/api/chat', { message: 'history test' });
  assert.equal(res.status, 200);
  res = await fetch(app.url + '/api/chat/history?limit=20');
  let data = await res.json();
  assert.equal(data.items.length, 2);
  assert.equal(data.items[0].role, 'user');
  assert.equal(data.items[1].role, 'assistant');
  await app.close();
  app = await startServer({ port: 0, dataDir });
  res = await fetch(app.url + '/api/chat/history?limit=20');
  data = await res.json();
  assert.equal(data.items.length, 2, 'history survives restart');
  assert.equal(data.items[0].text, 'history test');
  console.log(JSON.stringify({ ok: true, test: 'chat-history' }));
} finally {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}