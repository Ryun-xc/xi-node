// Deterministic mock model for examples and tests.
import { createModelAdapter } from './model-api.mjs';

/**
 * Create a deterministic model mock that records every call.
 */
export function createMockModel({ responses = {}, fallback = null } = {}) {
  const calls = [];
  const adapter = createModelAdapter({
    name: 'mock',
    callModel: async (role, prompt, context = {}) => {
      calls.push({ role, prompt, context, at: Date.now() });
      const value = Object.hasOwn(responses, role) ? responses[role] : fallback;
      return typeof value === 'function' ? value({ role, prompt, context }) : structuredClone(value ?? null);
    },
  });
  return { ...adapter, calls };
}