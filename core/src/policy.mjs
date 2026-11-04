// Code-level policy gate. The model cannot grant itself permission.
/**
 * Create an application-level policy gate returning allow, confirm, or deny.
 */
export function createPolicy({ rules = {} } = {}) {
  function evaluate(skill, context = {}) {
    if (!skill) return { decision: 'deny', reason: 'unknown skill' };
    const mode = String(context.mode || 'normal');
    const approved = context.approved === true;
    if (mode === 'readonly' && skill.sideEffect && skill.sideEffect !== 'none') {
      return { decision: 'deny', reason: 'readonly mode' };
    }
    if (skill.scopes && context.scope && !skill.scopes.includes(String(context.scope))) {
      return { decision: 'deny', reason: 'scope not allowed' };
    }
    const rule = rules[skill.name];
    if (rule === 'deny') return { decision: 'deny', reason: 'policy deny' };
    if (rule === 'allow') return { decision: 'allow', reason: 'policy allow' };
    if (skill.requiresConfirmation || skill.risk === 'high') {
      return approved ? { decision: 'allow', reason: 'approved' } : { decision: 'confirm', reason: 'confirmation required' };
    }
    if (skill.risk === 'medium' && skill.sideEffect === 'external') {
      return approved ? { decision: 'allow', reason: 'approved' } : { decision: 'confirm', reason: 'external side effect' };
    }
    return { decision: 'allow', reason: 'low risk' };
  }
  return { evaluate };
}
