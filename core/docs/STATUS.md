# xi-core v0.1 status

Created from the private XI Agent cognitive runtime, without QQ/SnowLuma/DSH/HUD
dependencies.

## What works

```text
event store          append-only JSONL
workspace            per-turn attention and active goals
goal store           persistent goals and tasks
planner              dependency graph + next runnable
executor             attempts, idempotency, verifier, evidence
goal runner          bounded loop
memory records       provenance, review, retract, export
belief store         evidence, conflicts, export
skill registry       risk/side-effect/confirmation metadata
policy               allow/confirm/deny
budget               tool-call limit
skill runtime        policy + timeout + execution
verifier             file/http/exit/result/generic checks
council              multi-role deliberation
eval                 runtime score + history
replay/timeline      rebuild a turn or event list
```

## Tests

```text
npm test
17 tests / 17 pass
```

## Public API

```text
xi-core
xi-core/memory
xi-core/policy
xi-core/runtime
xi-core/eval
xi-core/model
xi-core/device
```

## Examples

```text
examples/basic-goal.mjs
examples/policy-gate.mjs
examples/memory-review.mjs
examples/eval-suite.mjs
examples/council-mock.mjs
examples/device-readonly.mjs
```

## Deliberately absent

```text
QQ
SnowLuma
DSH
HUD
real prompts / persona
real memory
real model providers
actuator / device control
OS / kernel
```

## Known limits

```text
policy is an application gate, not an OS sandbox
event store is local JSONL, not a distributed log
eval is runtime facts, not an AGI benchmark
public API is v0.1 and may change
```

## Verification

```text
npm test                 17/17
npm pack --dry-run       48 files
examples                 pass
```

## Next

```text
1. Publish a clean repository (new history).
2. Add an English README badge and a 60-second quickstart.
3. Freeze the public API for v0.2.
4. Add a real ModelAdapter example (not a provider dependency).
5. Add a read-only discovery example; no actuators.
```