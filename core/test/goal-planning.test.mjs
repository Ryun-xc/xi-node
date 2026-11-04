#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGoalStore } from '../src/goal-store.mjs';
import { createPlanner } from '../src/planner.mjs';
import { createVerifier } from '../src/verifier.mjs';
import { createTaskExecutor } from '../src/executor.mjs';
import { createGoalRunner } from '../src/goal-runner.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-p2-'));
try {
  const goals = createGoalStore({ file: path.join(root, 'goals.json'), tasksFile: path.join(root, 'tasks.json') });
  const goal = goals.createGoal({ title: 'P2 test', successCriteria: ['done'] });
  const a = goals.addTask({ goalId: goal.id, title: 'A', idempotencyKey: 'A' });
  const b = goals.addTask({ goalId: goal.id, title: 'B', dependsOn: [a.id], idempotencyKey: 'B' });
  const planner = createPlanner({ goalStore: goals });
  const plan = planner.planGoal(goal.id);
  assert.equal(plan.tasks[0].id, a.id);
  assert.equal(plan.next.id, a.id);
  assert.equal(plan.blocked.some((t) => t.id === b.id), true);

  const verifier = createVerifier();
  const executor = createTaskExecutor({ goalStore: goals, verifier, file: path.join(root, 'idem.json') });
  const first = await executor.execute(a.id, async () => ({ ok: true, value: 42 }), { verify: { kind: 'result' } });
  assert.equal(first.ok, true);
  assert.equal(first.task.status, 'done');
  const again = await executor.execute(a.id, async () => ({ ok: true, value: 99 }), { verify: { kind: 'result' } });
  assert.equal(again.cached, true);
  assert.equal(again.result.value, 42);

  const second = await executor.execute(b.id, async () => ({ ok: true, value: 7 }), { verify: { kind: 'result' } });
  assert.equal(second.ok, true);
  assert.equal(goals.getGoal(goal.id).status, 'done');

  const failing = goals.createGoal({ title: 'fail test' });
  const t = goals.addTask({ goalId: failing.id, title: 'bad', maxAttempts: 1, idempotencyKey: 'bad' });
  const bad = await executor.execute(t.id, async () => ({ ok: false, error: 'nope' }), { verify: { kind: 'result' } });
  assert.equal(bad.ok, false);
  assert.equal(goals.getTask(t.id).status, 'failed');

  const cycleGoal = goals.createGoal({ title: 'cycle' });
  const c1 = goals.addTask({ goalId: cycleGoal.id, title: 'c1' });
  const c2 = goals.addTask({ goalId: cycleGoal.id, title: 'c2', dependsOn: [c1.id] });
  goals.updateTask(c1.id, { status: 'pending' });
  // Inject a cycle through direct data to ensure planner rejects it.
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'tasks.json'), 'utf8'));
  raw.find((x) => x.id === c1.id).dependsOn = [c2.id];
  fs.writeFileSync(path.join(root, 'tasks.json'), JSON.stringify(raw, null, 2));
  goals.reload();
  assert.throws(() => planner.planGoal(cycleGoal.id), /cycle/);

  const runnerGoal = goals.createGoal({ title: 'runner' });
  const r1 = goals.addTask({ goalId: runnerGoal.id, title: 'r1', idempotencyKey: 'r1' });
  const r2 = goals.addTask({ goalId: runnerGoal.id, title: 'r2', dependsOn: [r1.id], idempotencyKey: 'r2' });
  const runner = createGoalRunner({ planner, executor, goalStore: goals });
  const ran = await runner.runGoal(runnerGoal.id, { r1: async () => ({ ok: true }), r2: async () => ({ ok: true }) });
  assert.equal(ran.ok, true);
  assert.equal(ran.done, true);
  assert.equal(goals.getGoal(runnerGoal.id).status, 'done');
  assert.deepEqual(ran.steps.map((s) => s.ok), [true, true]);

  console.log(JSON.stringify({ ok: true, test: 'cognitive-p2', plan: plan.tasks.length, idempotent: again.cached, verifier: first.verification.kind, runner: ran.steps.length }));
} finally {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
}
