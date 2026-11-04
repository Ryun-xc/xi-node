#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCognitiveRuntime } from '../src/index.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-p7-'));
try {
  const runtime = createCognitiveRuntime({ stateDir: path.join(root, 'state') });
  const names = runtime.skills.list().map((x) => x.name);
  for (const name of ['memory.write', 'memory.query', 'goal.list', 'task.list', 'timeline.read', 'eval.read']) assert.ok(names.includes(name), name);
  const mem = await runtime.skillRuntime.execute('memory.query', { limit: 10 });
  assert.equal(mem.ok, true);
  const goals = await runtime.skillRuntime.execute('goal.list', {});
  assert.equal(goals.ok, true);
  const evalRead = await runtime.skillRuntime.execute('eval.read', {});
  assert.equal(evalRead.ok, true);
  assert.ok(typeof evalRead.result.evaluation.score === 'number');

  let calls = 0;
  runtime.setModelCall(async (role) => {
    calls += 1;
    if (role === 'planner') return 'plan';
    if (role === 'actor') return 'actor';
    if (role === 'critic') return { ok: true, issues: [] };
    if (role === 'archivist') return 'committed';
    return 'x';
  });
  const council = await runtime.runCouncilWithModel({ goal: { title: 'p7' }, maxRounds: 1 });
  assert.equal(council.ok, true);
  assert.ok(calls >= 4);
  assert.equal(runtime.health().skills, names.length);
  console.log(JSON.stringify({ ok: true, test: 'cognitive-p7', skills: names.length, councilCalls: calls }));
} finally {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
}
