import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-security-'));
const app = await startServer({ port: 0, dataDir });
try {
  const base = app.url;
  let res = await fetch(base + '/%2e%2e/server.mjs');
  const traversalBody = await res.text();
  assert.equal(traversalBody.includes('createCognitiveRuntime'), false, 'path traversal must not return server source');

  res = await fetch(base + '/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{broken' });
  assert.equal(res.status, 400, 'invalid json must be 400');

  res = await fetch(base + '/api/approvals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: '', risk: 'nonsense' }) });
  const approval = await res.json();
  assert.equal(approval.item.risk, 'medium', 'invalid risk must fall back to medium');

  res = await fetch(base + '/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ goalId: 'missing', title: 'x', skill: 'timeline.read' }) });
  assert.equal(res.status, 400, 'missing goal must fail');

  res = await fetch(base + '/api/unknown');
  assert.equal(res.status, 404, 'unknown api must be 404');

  console.log(JSON.stringify({ ok: true, test: 'security' }));
} finally {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}