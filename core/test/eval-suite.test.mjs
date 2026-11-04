import assert from 'node:assert/strict';
import { runSuite } from '../src/suite.mjs';

const result = await runSuite([
  { name: 'pass', run: () => { assert.equal(1, 1); } },
  { name: 'fail', run: () => { throw new Error('expected failure'); } },
  { name: 'timeout', run: () => new Promise((resolve) => setTimeout(resolve, 250)) },
], { timeoutMs: 10 });
assert.equal(result.ok, false);
assert.equal(result.total, 3);
assert.equal(result.passed, 1);
assert.equal(result.failed, 2);
assert.match(result.results.find((r) => r.name === 'timeout').error, /timeout/);
console.log(JSON.stringify({ ok: true, test: 'eval-suite', result }));