#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCognitiveRuntime } from '../src/index.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-p11-'));
try {
  const runtime = createCognitiveRuntime({ stateDir: path.join(root, 'state') });
  const goal = runtime.createGoal({ title: 'P11 closed loop', scope: 'private:test', successCriteria: ['read-only tasks done'] });
  const a = runtime.addTask({ goalId: goal.id, title: 'read timeline', skill: 'timeline.read', input: { limit: 5 }, idempotencyKey: 'p11:t' });
  const b = runtime.addTask({ goalId: goal.id, title: 'read eval', skill: 'eval.read', input: {}, dependsOn: [a.id], idempotencyKey: 'p11:e' });
  const result = await runtime.runReadonlyGoal(goal.id, { maxSteps: 5 });
  assert.equal(result.ok, true);
  assert.equal(result.done, true);
  assert.equal(runtime.getGoal(goal.id).status, 'done');
  assert.equal(runtime.getTask(a.id).status, 'done');
  assert.equal(runtime.getTask(b.id).status, 'done');
  assert.equal(runtime.getTask(b.id).result.ok, true);
  const blocked = runtime.addTask({ goalId: goal.id, title: 'bad skill', skill: 'message.send' });
  const result2 = await runtime.runReadonlyGoal(goal.id, { maxSteps: 2 });
  assert.equal(result2.ok, false);
  assert.equal(runtime.getTask(blocked.id).status, 'pending');
  console.log(JSON.stringify({ ok: true, test: 'cognitive-p11', goal: goal.id, steps: result.steps.length }));
} finally {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
}
