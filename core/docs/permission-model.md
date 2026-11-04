# Permission Model

A skill declares its own risk:

```js
{
  name: 'memory.query',
  risk: 'low',
  sideEffect: 'none',
  requiresConfirmation: false,
  handler: async () => ({ ok: true })
}
```

Policy decides:

```text
allow    low risk / explicitly allowed
confirm  requires human approval
deny     readonly violation / scope / explicit deny
```

The runtime enforces:

```text
timeout
tool-call budget
policy decision
verifier
idempotency
```

## Important boundary

This is not a sandbox.

It does not stop a malicious handler from doing damage.
The host must place adapters in an OS/container sandbox and provide a physical or
process-level kill switch for dangerous capabilities.

## High-risk rule

```text
high risk + external side effect
=> requires explicit approval, never auto-run
```