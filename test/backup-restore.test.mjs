import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-backup-'));
const call = async (base, p, body, method) => {
  const res = await fetch(base + p, { method: method || (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
};
let app = await startServer({ port: 0, dataDir });
try {
  let r = await call(app.url, '/api/goals', { title: 'before backup' });
  assert.equal(r.status, 201);
  r = await call(app.url, '/api/approvals', { title: 'persisted approval', risk: 'high' });
  assert.equal(r.status, 201);
  const backup = await call(app.url, '/api/backup', {}, 'POST');
  assert.equal(backup.status, 200);
  const id = backup.data.id;
  assert.ok(fs.existsSync(path.join(dataDir, 'backups', id, 'approvals.json')));

  r = await call(app.url, '/api/goals', { title: 'after backup' });
  assert.equal(r.status, 201);
  r = await call(app.url, '/api/restore', { id: 'not-a-backup' });
  assert.equal(r.status, 400);

  r = await call(app.url, '/api/restore', { id });
  assert.equal(r.status, 200);
  assert.equal(r.data.restartRequired, true);
  await app.close();
  app = await startServer({ port: 0, dataDir });
  r = await call(app.url, '/api/goals');
  const titles = r.data.items.map((x) => x.title);
  assert.equal(titles.includes('before backup'), true);
  assert.equal(titles.includes('after backup'), false);
  r = await call(app.url, '/api/approvals');
  assert.equal(r.data.items.some((x) => x.title === 'persisted approval'), true);
  r = await call(app.url, '/api/backups');
  assert.ok(r.data.items.length >= 2);
  console.log(JSON.stringify({ ok: true, test: 'backup-restore' }));
} finally {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}