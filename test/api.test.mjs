import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-node-test-'));
const app = await startServer({ port: 0, dataDir });
const base = app.url;

async function call(pathname, options = {}) {
  const res = await fetch(base + pathname, {
    headers: { 'content-type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

try {
  let r = await call('/api/status');
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  assert.equal(r.data.version, '0.1.0');

  r = await call('/api/goals', { method: 'POST', body: { title: 'API test goal', why: 'test' } });
  assert.equal(r.status, 201);
  const goalId = r.data.item.id;

  r = await call('/api/tasks', { method: 'POST', body: { goalId, title: 'read timeline', skill: 'timeline.read' } });
  assert.equal(r.status, 201);
  const taskId = r.data.item.id;

  r = await call(`/api/goals/${goalId}/run`, { method: 'POST' });
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);

  r = await call('/api/tasks');
  assert.equal(r.data.items.find((t) => t.id === taskId).status, 'done');

  r = await call('/api/memory', { method: 'POST', body: { text: 'The user prefers local-first tools.' } });
  assert.equal(r.status, 201);
  const memoryId = r.data.item.id;

  r = await call(`/api/memory/${memoryId}/approve`, { method: 'POST' });
  assert.equal(r.status, 200);
  assert.equal(r.data.item.status, 'active');

  r = await call('/api/timeline');
  assert.equal(r.status, 200);
  assert.ok(r.data.items.length > 0);

  r = await call('/api/approvals', { method: 'POST', body: { title: 'demo approval', risk: 'medium' } });
  assert.equal(r.status, 201);
  const approvalId = r.data.item.id;
  r = await call(`/api/approvals/${approvalId}/approve`, { method: 'POST' });
  assert.equal(r.status, 200);
  assert.equal(r.data.item.status, 'approved');

  r = await call('/api/settings', { method: 'PUT', body: { initialized: true, model: { provider: 'mock', apiKey: 'test-only-key' } } });
  assert.equal(r.status, 200);
  assert.equal(r.data.settings.initialized, true);
  assert.equal(Object.hasOwn(r.data.settings.model, 'apiKey'), false);
  assert.equal(r.data.settings.model.apiKeySet, true);

  r = await call('/api/backup', { method: 'POST' });
  assert.equal(r.status, 200);
  assert.ok(fs.existsSync(r.data.path));

  r = await call('/api/chat', { method: 'POST', body: { message: 'hello' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  r = await call('/api/memory');
  assert.ok(r.data.items.some((m) => m.text === 'hello'), 'chat message should be captured as memory');

  console.log(JSON.stringify({ ok: true, test: 'api', goalId, memoryId, approvalId }));
} finally {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}