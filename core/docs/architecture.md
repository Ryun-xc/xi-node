# Architecture

```text
event-store
  append-only JSONL source of truth

memory
  curated records with provenance and review
  beliefs with evidence and conflicts

goal-store
  persistent goals and tasks

planner
  dependency graph + next runnable task

executor
  attempts, idempotency, verifier, evidence

goal-runner
  bounded loop

eval
  runtime score + history
```

The runtime never calls a model directly. A `ModelAdapter` is supplied by the host
application. The runtime never sends a message directly. A skill handler is supplied by
an adapter.

## Non-goals

```text
not a vector database
not an operating system
not a sandbox
not an autonomous agent
not a UI
```

## Safety model

Policy is an application-level gate, not an OS sandbox.

High-risk skills require explicit confirmation from the host.

Raw events stay append-only. Memory interpretation can change; source evidence cannot.