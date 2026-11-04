# Model Adapter

`xi-core` never imports a provider SDK and never calls a model by itself.

The host supplies a function:

```js
const adapter = createModelAdapter({
  name: 'my-provider',
  callModel: async (role, prompt, context) => {
    return await provider.complete({ role, prompt, context });
  },
});
```

The runtime consumes `adapter.callModel` only where a model is explicitly requested, such
as `council`.

## Mock

`createMockModel({ responses })` is deterministic and records calls. It is intended for
examples and tests, not production.

```js
const model = createMockModel({
  responses: {
    planner: { steps: ['one'] },
    actor: { result: 'done' },
    critic: { ok: true, issues: [] },
    archivist: { memory: 'recorded' },
  },
});
```

## Boundary

```text
core does not choose a provider
core does not store API keys
core does not retry provider errors by itself
```