#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createSkillRegistry } from '../src/skill-registry.mjs';
import { createPolicy } from '../src/policy.mjs';
import { createBudget } from '../src/budget.mjs';
import { createSkillRuntime } from '../src/skill-runtime.mjs';

const registry = createSkillRegistry();
registry.register({ name: 'read.note', risk: 'low', sideEffect: 'none', handler: async () => ({ ok: true, text: 'note' }) });
registry.register({ name: 'message.send', risk: 'high', sideEffect: 'external', requiresConfirmation: true, handler: async () => ({ ok: true }) });
registry.register({ name: 'slow.skill', risk: 'low', sideEffect: 'none', timeoutMs: 100, handler: () => new Promise((r) => setTimeout(() => r({ ok: true }), 500)) });
assert.equal(registry.list().length, 3);
assert.equal(registry.get('message.send').requiresConfirmation, true);

const policy = createPolicy();
assert.equal(policy.evaluate(registry.get('read.note'), {}).decision, 'allow');
assert.equal(policy.evaluate(registry.get('message.send'), {}).decision, 'confirm');
assert.equal(policy.evaluate(registry.get('message.send'), { approved: true }).decision, 'allow');
assert.equal(policy.evaluate(registry.get('message.send'), { mode: 'readonly' }).decision, 'deny');

const budget = createBudget({ toolCalls: 1, wallMs: 1000 });
const runtime = createSkillRuntime({ registry, policy, budget });
const note = await runtime.execute('read.note');
assert.equal(note.ok, true);
const noBudget = await runtime.execute('read.note');
assert.equal(noBudget.ok, false);
assert.match(noBudget.error, /budget/);

const budget2 = createBudget({ toolCalls: 5 });
const runtime2 = createSkillRuntime({ registry, policy, budget: budget2 });
const sent = await runtime2.execute('message.send', {});
assert.equal(sent.decision, 'confirm');
assert.equal(sent.ok, false);
const approved = await runtime2.execute('message.send', {}, { approved: true });
assert.equal(approved.ok, true);
const slow = await runtime2.execute('slow.skill');
assert.equal(slow.ok, false);
assert.match(slow.error, /timeout/);

console.log(JSON.stringify({ ok: true, test: 'cognitive-p4', skills: registry.list().length, budget: budget2.snapshot() }));
