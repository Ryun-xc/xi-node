// Model adapter boundary. The core never imports a provider SDK.
/**
 * Create a provider-neutral model adapter. The core never imports a provider SDK.
 */
export function createModelAdapter({ name = 'model', callModel } = {}) {
  if (typeof callModel !== 'function') throw new Error('callModel required');
  return {
    name: String(name),
    callModel: (role, prompt, context = {}) => callModel(String(role), String(prompt), context),
  };
}