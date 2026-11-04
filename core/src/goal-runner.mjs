// Bounded goal loop. Handlers are explicit code, never model-chosen shell.
/**
 * Create a bounded goal loop over a planner and executor.
 */
export function createGoalRunner({ planner, executor, goalStore, logger = () => {} } = {}) {
  if (!planner || !executor || !goalStore) throw new Error('planner/executor/goalStore required');

  async function runGoal(goalId, handlers = {}, { maxSteps = 20, stopOnFailure = true } = {}) {
    const steps = [];
    for (let i = 0; i < Math.max(1, Math.min(100, Number(maxSteps) || 20)); i += 1) {
      const plan = planner.planGoal(goalId);
      if (plan.tasks.length && plan.tasks.every((t) => t.status === 'done')) {
        goalStore.completeGoalIfDone(goalId);
        return { ok: true, goalId, done: true, steps };
      }
      const next = plan.next;
      if (!next) return { ok: false, goalId, done: false, error: plan.blocked.length ? 'all remaining tasks blocked' : 'no runnable task', steps };
      const handler = handlers[next.id] || handlers[next.title];
      if (typeof handler !== 'function') return { ok: false, goalId, done: false, error: `no handler: ${next.title}`, steps };
      const result = await executor.execute(next.id, handler, { verify: next.verify || { kind: 'generic' }, criteria: next.criteria || [] });
      steps.push({ taskId: next.id, title: next.title, ok: result.ok, error: result.error || null });
      logger(`[goal-runner] ${goalId} ${next.title} -> ${result.ok ? 'ok' : 'fail'}`);
      if (!result.ok && stopOnFailure) return { ok: false, goalId, done: false, error: result.error || 'task failed', steps };
    }
    return { ok: false, goalId, done: false, error: 'max steps reached', steps };
  }

  async function tick({ handlers = {}, maxGoals = 1 } = {}) {
    const goals = goalStore.listGoals({ status: 'active' }).slice(0, Math.max(1, Number(maxGoals) || 1));
    const results = [];
    for (const goal of goals) results.push(await runGoal(goal.id, handlers, { maxSteps: 4 }));
    return results;
  }

  return { runGoal, tick };
}
