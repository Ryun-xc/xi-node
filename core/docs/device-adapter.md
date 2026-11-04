# Device Adapter

The v0.1 device surface is **read-only**.

```js
const adapter = createDeviceAdapter({
  name: 'home',
  discover: async () => [{ id: 'sensor-1', kind: 'temperature' }],
  read: async (deviceId, capability) => ({ ok: true, value: 23.5 }),
});
```

`createMockDevice` provides an in-memory read-only implementation for tests.

## Deliberately absent

```text
no actuator method
no shell execution
no network scanning
no camera stream
no robot motion
```

Device control, when added, must be a separate package with explicit approval,
rate limits, and a physical/process-level kill switch.

## Safety

A read-only adapter can still leak sensitive data. The host must decide what may be
discovered and retained.