// In-memory read-only device adapter. No control/actuator surface.
import { createDeviceAdapter } from './device-api.mjs';

/**
 * Create an in-memory read-only device mock for tests and examples.
 */
export function createMockDevice({ devices = [], readings = {} } = {}) {
  const state = structuredClone(devices);
  return createDeviceAdapter({
    name: 'mock-device',
    discover: async () => state.map((device) => ({ ...device })),
    read: async (deviceId, capability) => {
      const device = state.find((item) => String(item.id) === String(deviceId));
      if (!device) return { ok: false, error: 'device not found' };
      const key = `${deviceId}:${capability}`;
      if (!Object.hasOwn(readings, key)) return { ok: false, error: 'capability not available' };
      return { ok: true, deviceId, capability, value: structuredClone(readings[key]), readOnly: true };
    },
  });
}