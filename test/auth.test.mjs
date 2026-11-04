import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-auth-'));
const app = await startServer({ port: 0, dataDir, auth: true, authToken: 'test-token' });
try {
  let res = await fetch(app.url + '/api/status');
  assert.equal(res.status, 401);
  assert.equal(fs.readFileSync(path.join(dataDir, 'access-token'), 'utf8').trim(), 'test-token');

  res = await fetch(app.url + '/api/health');
  assert.equal(res.status, 200, 'health must stay public for container healthcheck');

  res = await fetch(app.url + '/api/auth/status');
  assert.equal((await res.json()).authenticated, false);

  res = await fetch(app.url + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'wrong' }) });
  assert.equal(res.status, 401);

  res = await fetch(app.url + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'test-token' }) });
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie').split(';')[0];

  res = await fetch(app.url + '/api/status', { headers: { authorization: 'Bearer test-token' } });
  assert.equal(res.status, 200);

  res = await fetch(app.url + '/api/status', { headers: { cookie } });
  assert.equal(res.status, 200);

  res = await fetch(app.url + '/?token=test-token', { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('set-cookie') || '', /xi_node_token=/);
  console.log(JSON.stringify({ ok: true, test: 'auth' }));
} finally {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}