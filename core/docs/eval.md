# Eval

`xi-core/eval` has two levels.

## Runtime score

`evaluateRuntime(runtime)` counts verifiable facts:

```text
goals done / total
tasks done / total
failed tasks
open tasks
pending memory
contested beliefs
event count
```

It does not call a model and does not claim to measure intelligence.

## Behavior suite

`runSuite(tests, { timeoutMs })` runs named async checks:

```js
import { runSuite } from 'xi-core/eval';

const result = await runSuite([
  { name: 'policy blocks high risk', run: async () => { ... } },
  { name: 'verifier catches missing file', run: async () => { ... } },
]);
```

Each test gets a timeout. The result is machine readable:

```json
{
  "ok": false,
  "total": 2,
  "passed": 1,
  "failed": 1,
  "results": []
}
```

## Boundary

```text
eval measures behavior
eval does not prove safety
eval does not prove AGI
eval does not replace human acceptance
```