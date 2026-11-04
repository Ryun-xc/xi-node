// Executes declared skills behind policy + budget + timeout.
/**
 * Create a skill executor that applies policy, budget, timeout, and result wrapping.
 */
export function createSkillRuntime({ registry, policy, budget = null, logger = () => {} } = {}) {
  if (!registry) throw new Error('registry required');
  if (!policy) throw new Error('policy required');

  async function execute(name, input = {}, context = {}) {
    const skill = registry.get(name);
    if (!skill) return { ok: false, decision: 'deny', error: 'unknown skill' };
    const decision = policy.evaluate(skill, context);
    if (decision.decision === 'deny') return { ok: false, decision: 'deny', error: decision.reason, skill: name };
    if (decision.decision === 'confirm') return { ok: false, decision: 'confirm', error: decision.reason, skill: name };
    if (budget) {
      const slot = budget.consume('toolCalls', 1);
      if (!slot.ok) return { ok: false, decision: 'deny', error: slot.error, skill: name };
    }
    const timeoutMs = Math.max(100, Math.min(300000, Number(context.timeoutMs) || skill.timeoutMs));
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => skill.handler(input, context)),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`skill timeout: ${name}`)), timeoutMs)),
      ]);
      return { ok: result?.ok !== false, decision: 'allow', skill: name, result };
    } catch (error) {
      logger(`skill failed: ${name}: ${error?.message || error}`);
      return { ok: false, decision: 'allow', skill: name, error: String(error?.message || error) };
    }
  }

  return { execute };
}
