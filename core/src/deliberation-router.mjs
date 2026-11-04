// Choose direct / deliberate / council. Deterministic; no model self-routing.
/**
 * Choose direct, deliberate, or council mode from deterministic signals.
 */
export function routeDeliberation({ text = '', toolsNeeded = [], risk = 'low', uncertainty = 0, multiStep = false, explicitCouncil = false } = {}) {
  const reasons = [];
  if (explicitCouncil) reasons.push('explicit');
  if (risk === 'high') reasons.push('high-risk');
  if (Number(uncertainty) >= 0.75) reasons.push('high-uncertainty');
  if (multiStep) reasons.push('multi-step');
  if (reasons.length >= 2) return { mode: 'council', reasons };
  if (explicitCouncil || risk === 'high') return { mode: 'council', reasons };
  if (reasons.length || (Array.isArray(toolsNeeded) && toolsNeeded.length)) return { mode: 'deliberate', reasons: reasons.length ? reasons : ['tools-needed'] };
  if (String(text).length > 500) return { mode: 'deliberate', reasons: ['long-input'] };
  return { mode: 'direct', reasons: [] };
}
