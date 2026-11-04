// Per-turn working memory. This is not long-term memory.
import crypto from 'node:crypto';

/**
 * Create a per-turn workspace with attention items and active goals.
 */
export function createWorkspace({ turnId = `turn_${crypto.randomUUID()}`, scope = null, budget = {} } = {}) {
  return {
    turnId,
    scope,
    createdAt: Date.now(),
    attention: [],
    activeGoals: [],
    retrieved: [],
    constraints: [],
    budget: {
      tokens: Number(budget.tokens) || 12000,
      toolCalls: Number(budget.toolCalls) || 8,
      wallMs: Number(budget.wallMs) || 90000,
    },
  };
}

export function addAttention(workspace, item = {}) {
  if (!workspace || !item) return workspace;
  const entry = {
    kind: String(item.kind || 'message'),
    ref: item.ref ? String(item.ref) : null,
    salience: Math.max(0, Math.min(1, Number(item.salience) || 0)),
    at: Date.now(),
  };
  workspace.attention.push(entry);
  workspace.attention.sort((a, b) => b.salience - a.salience);
  workspace.attention = workspace.attention.slice(0, 24);
  return workspace;
}

export function setActiveGoals(workspace, goals = []) {
  if (!workspace) return workspace;
  workspace.activeGoals = (Array.isArray(goals) ? goals : []).map((g) => ({
    id: String(g.id || ''),
    title: String(g.title || ''),
    priority: Number(g.priority) || 0,
  })).slice(0, 8);
  return workspace;
}

export function addConstraint(workspace, text) {
  if (!workspace || !text) return workspace;
  workspace.constraints.push(String(text).slice(0, 500));
  workspace.constraints = [...new Set(workspace.constraints)].slice(-20);
  return workspace;
}

export function budgetLeft(workspace) {
  if (!workspace) return { tokens: 0, toolCalls: 0, wallMs: 0 };
  const elapsed = Date.now() - workspace.createdAt;
  return {
    tokens: workspace.budget.tokens,
    toolCalls: workspace.budget.toolCalls,
    wallMs: Math.max(0, workspace.budget.wallMs - elapsed),
  };
}
