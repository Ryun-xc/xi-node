// Read-only device adapter boundary. No actuator methods are provided by default.
/**
 * Create a read-only device adapter boundary. No actuator method is exposed.
 */
export function createDeviceAdapter({ name = 'device', discover, read } = {}) {
  if (typeof discover !== 'function') throw new Error('discover required');
  if (typeof read !== 'function') throw new Error('read required');
  return {
    name: String(name),
    discover: () => discover(),
    read: (deviceId, capability, input = {}) => read(String(deviceId), String(capability), input),
  };
}