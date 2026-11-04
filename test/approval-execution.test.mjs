import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-approval-exec-'));
const app = await startServer({ port: 0, dataDir });
const call = async (p, body, method) => {
  const res = await fetch(app.url + p, { method: method || (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
};
try {
  let r = await call('/api/approvals', { title: 'read timeline', skill: 'timeline.read' });
  assert.equal(r.status, 201);
  const id = r.data.item.id;
  assert.equal(r.data.item.skill, 'timeline.read');
  r = await call(`/api/approvals/${id}/approve`, {});
  assert.equal(r.status, 200);
  assert.equal(r.data.item.status, 'approved');
  assert.equal(r.data.result.ok, true);

  r = await call('/api/approvals', { title: 'write file', skill: 'workspace.write', input: { name: 'approved.txt', content: 'approved content' } });
  assert.equal(r.status, 201);
  const writeId = r.data.item.id;
  r = await call(`/api/approvals/${writeId}/approve`, {});
  assert.equal(r.status, 200);
  assert.equal(r.data.result.ok, true);
  assert.equal(fs.readFileSync(path.join(dataDir, 'workspace', 'approved.txt'), 'utf8'), 'approved content');

  r = await call('/api/approvals', { title: 'bad', skill: 'shell.exec' });
  assert.equal(r.status, 400);
  console.log(JSON.stringify({ ok: true, test: 'approval-execution' }));
} finally {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}