// Skill registry: every capability declares side effects and risk.
const RISKS = new Set(['low', 'medium', 'high']);

/**
 * Create a skill registry. Skill metadata declares risk and side effects.
 */
export function createSkillRegistry() {
  const skills = new Map();

  function register(skill = {}) {
    const name = String(skill.name || '').trim();
    if (!name || !/^[a-z0-9_.-]+$/i.test(name)) throw new Error(`invalid skill name: ${name}`);
    if (typeof skill.handler !== 'function') throw new Error(`skill handler required: ${name}`);
    const risk = RISKS.has(String(skill.risk)) ? String(skill.risk) : 'medium';
    const entry = {
      name,
      description: String(skill.description || '').slice(0, 500),
      sideEffect: String(skill.sideEffect || 'none'),
      risk,
      requiresConfirmation: skill.requiresConfirmation ?? risk === 'high',
      timeoutMs: Math.max(100, Math.min(300000, Number(skill.timeoutMs) || 15000)),
      idempotent: Boolean(skill.idempotent),
      scopes: Array.isArray(skill.scopes) ? skill.scopes.map(String) : null,
      handler: skill.handler,
    };
    skills.set(name, entry);
    return publicView(entry);
  }

  function publicView(entry) {
    const { handler, ...rest } = entry;
    return rest;
  }

  function get(name) { return skills.get(String(name)) || null; }
  function list() { return [...skills.values()].map(publicView).sort((a, b) => a.name.localeCompare(b.name)); }
  function has(name) { return skills.has(String(name)); }

  return { register, get, list, has };
}
