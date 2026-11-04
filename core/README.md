# xi-core

A small, portable cognitive runtime for long-lived agents.

It is **not** a chatbot, a model, an OS, or a QQ bot.

It provides four layers:

```text
memory   structured memory + provenance + review + beliefs
policy   skill risk, confirmation, budget, timeout, verifier
runtime  append-only events, goals, tasks, planner, executor, replay
eval     verifiable runtime facts and regression history
```

## Install

```bash
npm install
npm test
```

Requires Node.js >= 20. No runtime dependencies.

## Quick start

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCognitiveRuntime } from 'xi-core';

const runtime = createCognitiveRuntime({
  stateDir: fs.mkdtempSync(path.join(os.tmpdir(), 'xi-')),
});

const goal = runtime.createGoal({ title: 'Inspect state', successCriteria: ['read timeline'] });
runtime.addTask({ goalId: goal.id, title: 'read timeline', skill: 'timeline.read' });
const result = await runtime.runReadonlyGoal(goal.id);
console.log(result);
```

Run the included examples:

```bash
npm run example:goal
npm run example:policy
npm run example:memory
npm run example:eval
npm run example:council
npm run example:device
```

## Subpath API

```js
import { createMemoryStore, createBeliefStore } from 'xi-core/memory';
import { createSkillRegistry, createPolicy, createBudget, createSkillRuntime, createVerifier } from 'xi-core/policy';
import { createCognitiveRuntime } from 'xi-core/runtime';
import { evaluateRuntime, runSuite } from 'xi-core/eval';
import { createModelAdapter, createMockModel } from 'xi-core/model';
import { createDeviceAdapter, createMockDevice } from 'xi-core/device';
```

## Design boundaries

```text
xi-core never calls a model.
xi-core never sends a message.
xi-core never touches a private config.
xi-core never controls a device.
```

Adapters provide those capabilities. The core only owns:

```text
what happened
what is remembered
what is allowed
what was verified
what can be replayed
```

## Status

v0.1 draft extracted from a larger private project. It is intentionally small.
The public surface is still allowed to change before v1.0.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.