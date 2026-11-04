#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCognitiveRuntime } from '../src/index.mjs';
import { createEventStore } from '../src/event-store.mjs';
import { createWorkspace, addAttention } from '../src/workspace.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-cognitive-'));
try {
  const store = createEventStore({ dir: path.join(root, 'events') });
  const a = store.append({ type: 'test.one', source: 'test', correlationId: 'turn_t1', payload: { text: 'hello' } });
  const b = store.append({ type: 'test.two', source: 'test', correlationId: 'turn_t1', payload: { text: 'world' } });
  assert.ok(a.id && b.id);
  assert.equal(store.recent({ limit: 10 }).length, 2);
  assert.equal(store.replayTurn('turn_t1').length, 2);
  assert.equal(store.stats().events, 2);

  const ws = createWorkspace({ turnId: 'turn_t1', scope: 'private:1' });
  addAttention(ws, { kind: 'message', ref: a.id, salience: 0.9 });
  assert.equal(ws.attention[0].salience, 0.9);
  assert.equal(ws.turnId, 'turn_t1');

  const runtime = createCognitiveRuntime({ stateDir: path.join(root, 'state') });
  const incoming = runtime.observeIncoming({ key: 'private:1', scope: 'private:1', kind: 'private', sender: 'tester', text: '你好' });
  assert.ok(incoming.turnId);
  runtime.flushEvents();
  assert.equal(runtime.timeline({ limit: 10 }).length, 1);
  runtime.observeDelivered({ turnId: incoming.turnId, key: 'private:1', ok: true, text: '嗯' });
  runtime.flushEvents();
  const replay = runtime.replay(incoming.turnId);
  assert.equal(replay.eventCount, 3);
  assert.deepEqual(replay.events.map((e) => e.type), ['message.received', 'turn.completed', 'message.sent']);

  const goal = runtime.createGoal({ title: 'P1 test', scope: 'private:1', successCriteria: ['ok'] });
  const task = runtime.addTask({ goalId: goal.id, title: 'task', idempotencyKey: 'idem-1' });
  const same = runtime.addTask({ goalId: goal.id, title: 'duplicate', idempotencyKey: 'idem-1' });
  assert.equal(task.id, same.id);
  runtime.startTask(task.id);
  runtime.completeTask(task.id, { result: { ok: true }, evidence: ['test'] });
  runtime.updateGoal(goal.id, { status: 'done' });
  assert.equal(runtime.getGoal(goal.id).status, 'done');
  assert.equal(runtime.goals.stats().tasks, 1);
  const health = runtime.health();
  assert.equal(health.ok, true);
  assert.ok(health.events.events >= 5);

  // Restart persistence.
  const runtime2 = createCognitiveRuntime({ stateDir: path.join(root, 'state') });
  assert.equal(runtime2.getGoal(goal.id).title, 'P1 test');
  assert.equal(runtime2.getTask(task.id).status, 'done');

  console.log(JSON.stringify({ ok: true, test: 'cognitive-core', events: health.events.events, goals: health.goals.goals, tasks: health.goals.tasks }));
} finally {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
}
