import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-stream-'));
const app = await startServer({ port: 0, dataDir });
try {
  const res = await fetch(app.url + '/api/chat/stream', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'stream test' }) });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
  const text = await res.text();
  assert.match(text, /"delta"/);
  assert.match(text, /"done":true/);
  const history = await (await fetch(app.url + '/api/chat/history?limit=10')).json();
  assert.equal(history.items.length, 2);
  assert.equal(history.items[0].role, 'user');
  assert.equal(history.items[1].role, 'assistant');
  console.log(JSON.stringify({ ok: true, test: 'stream' }));
} finally {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}