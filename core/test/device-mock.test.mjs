import assert from 'node:assert/strict';
import { createMockDevice } from '../src/device-mock.mjs';

const adapter = createMockDevice({
  devices: [{ id: 'lamp-1', kind: 'light', room: 'lab' }],
  readings: { 'lamp-1:power': 'on' },
});
const list = await adapter.discover();
assert.equal(list.length, 1);
assert.equal(list[0].id, 'lamp-1');
const reading = await adapter.read('lamp-1', 'power');
assert.equal(reading.ok, true);
assert.equal(reading.value, 'on');
assert.equal(reading.readOnly, true);
const missing = await adapter.read('lamp-1', 'temperature');
assert.equal(missing.ok, false);
console.log(JSON.stringify({ ok: true, test: 'device-mock', devices: list.length }));