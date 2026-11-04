import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { startServer } from '../server.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-mcp-'));
const app = await startServer({ port: 0, dataDir, auth: true, authToken: 'mcp-token' });
const child = spawn(process.execPath, ['server/mcp-server.mjs'], {
  cwd: path.resolve('.'),
  env: { ...process.env, XI_NODE_URL: app.url, XI_NODE_TOKEN: 'mcp-token', XI_NODE_DATA: dataDir },
  stdio: ['pipe', 'pipe', 'pipe'],
});
const lines = readline.createInterface({ input: child.stdout });
const responses = new Map();
lines.on('line', (line) => { const data = JSON.parse(line); responses.set(data.id, data); });
const wait = (id) => new Promise((resolve, reject) => {
  const started = Date.now();
  const timer = setInterval(() => {
    if (responses.has(id)) { clearInterval(timer); resolve(responses.get(id)); }
    else if (Date.now() - started > 5000) { clearInterval(timer); reject(new Error(`timeout ${id}`)); }
  }, 20);
});
const send = (message) => child.stdin.write(JSON.stringify(message) + '\n');
try {
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  const init = await wait(1);
  assert.equal(init.result.serverInfo.name, 'xi-node');
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const list = await wait(2);
  assert.ok(list.result.tools.some((tool) => tool.name === 'xi_memory_query'));
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'xi_memory_query', arguments: {} } });
  const call = await wait(3);
  assert.ok(call.result.content[0].text.includes('"ok": true'));
  console.log(JSON.stringify({ ok: true, test: 'mcp' }));
} finally {
  child.kill();
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}