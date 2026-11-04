import assert from 'node:assert/strict';
import { createMockModel } from '../src/model-mock.mjs';
import { createCouncil } from '../src/council.mjs';

const model = createMockModel({
  responses: {
    planner: { steps: ['one'] },
    actor: { result: 'done' },
    critic: { ok: true, issues: [] },
    archivist: { memory: 'approved' },
  },
});
const council = createCouncil({ callModel: model.callModel, maxRounds: 1, maxModelCalls: 6 });
const result = await council.run({ context: 'test' });
assert.equal(result.ok, true);
assert.equal(model.calls.length, 4);
assert.equal(model.calls[0].role, 'planner');
console.log(JSON.stringify({ ok: true, test: 'model-mock', calls: model.calls.length }));