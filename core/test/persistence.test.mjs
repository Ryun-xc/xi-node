import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCognitiveRuntime } from '../src/index.mjs';
import { createMemoryStore } from '../src/memory-api.mjs';

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-persist-'));
const first = createCognitiveRuntime({ stateDir });
const goal = first.createGoal({ title: 'persist me', scope: 'test' });
first.addTask({ goalId: goal.id, title: 'read events', skill: 'timeline.read' });
first.memory.write({ kind: 'episodic', scope: 'test', text: 'remember me', source: 'user_message' });
first.flushEvents();

const second = createCognitiveRuntime({ stateDir });
assert.equal(second.getGoal(goal.id).title, 'persist me');
assert.equal(second.listTasks({ goalId: goal.id }).length, 1);
assert.equal(second.memory.list({ scope: 'test' }).length, 1);
assert.ok(second.timeline({ limit: 10 }).length >= 1);
const direct = createMemoryStore({ file: path.join(stateDir, 'memory.json') });
assert.equal(direct.list().length, 0);
console.log(JSON.stringify({ ok: true, test: 'persistence', events: second.timeline({ limit: 10 }).length }));