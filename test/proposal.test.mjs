import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-proposal-'));
const app = await startServer({ port: 0, dataDir });
const call = async (p, body, method) => {
  const res = await fetch(app.url + p, { method: method || (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
};
try {
  let r = await call('/api/chat/propose', { message: '我想做一个能记住我作息的本地 AI' });
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  assert.ok(r.data.proposal.title);
  assert.ok(r.data.proposal.tasks.length >= 1);
  const proposal = r.data.proposal;

  r = await call('/api/goals');
  assert.equal(r.data.items.length, 0, 'proposal must not create a goal without confirmation');
  r = await call('/api/goals', { title: proposal.title, why: proposal.why });
  assert.equal(r.status, 201);
  const goalId = r.data.item.id;
  for (const task of proposal.tasks) {
    r = await call('/api/tasks', { goalId, title: task.title, skill: task.skill });
    assert.equal(r.status, 201);
  }
  r = await call('/api/goals/' + goalId + '/run', {});
  assert.equal(r.status, 200);
  r = await call('/api/timeline');
  assert.ok(r.data.items.length > 0);
  console.log(JSON.stringify({ ok: true, test: 'proposal' }));
} finally {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}