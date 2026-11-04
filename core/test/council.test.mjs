#!/usr/bin/env node
import assert from 'node:assert/strict';
import { routeDeliberation } from '../src/deliberation-router.mjs';
import { createCouncil } from '../src/council.mjs';
import { createBudget } from '../src/budget.mjs';

assert.equal(routeDeliberation({ text: '在吗' }).mode, 'direct');
assert.equal(routeDeliberation({ text: '查一下记忆', toolsNeeded: ['memory.search'] }).mode, 'deliberate');
assert.equal(routeDeliberation({ text: '重构整个系统', risk: 'high' }).mode, 'council');
assert.equal(routeDeliberation({ explicitCouncil: true }).mode, 'council');
assert.equal(routeDeliberation({ text: '多步', multiStep: true }).mode, 'deliberate');

let calls = 0;
let criticCount = 0;
const council = createCouncil({
  maxRounds: 2,
  callModel: async (role) => {
    calls += 1;
    if (role === 'planner') return { steps: ['one'] };
    if (role === 'actor') return { ok: true, output: 'done' };
    if (role === 'critic') {
      criticCount += 1;
      return criticCount === 1 ? { ok: false, issues: ['missing evidence'] } : { ok: true, issues: [] };
    }
    if (role === 'archivist') return { committed: true };
    return {};
  },
});
const result = await council.run({ goal: { title: 'test' }, budget: createBudget({ tokens: 100 }) });
assert.equal(result.ok, true);
assert.equal(result.rounds, 2);
assert.equal(result.committed.committed, true);
assert.ok(calls <= 8);
assert.equal(result.trace.filter((x) => x.role === 'critic').length, 2);

let blockedCalls = 0;
const blocked = createCouncil({
  maxRounds: 1,
  callModel: async (role) => {
    blockedCalls += 1;
    if (role === 'critic') return { ok: false, issues: ['unverified'] };
    if (role === 'archivist') throw new Error('archivist must not run');
    return { steps: ['x'] };
  },
});
const blockedResult = await blocked.run({ goal: { title: 'bad' } });
assert.equal(blockedResult.ok, false);
assert.match(blockedResult.error, /critic veto/);
assert.ok(blockedCalls <= 4);

console.log(JSON.stringify({ ok: true, test: 'cognitive-p5', rounds: result.rounds, calls: result.calls, blockedCalls }));
