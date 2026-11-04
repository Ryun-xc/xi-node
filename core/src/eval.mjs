// Lightweight internal eval. Not a model judge: counts verifiable runtime facts.
/**
 * Compute a verifiable runtime score from goals, tasks, memory, beliefs, and events.
 */
export function evaluateRuntime(runtime) {
  const health = runtime?.health?.() || {};
  const goals = runtime?.listGoals?.({}) || [];
  const tasks = runtime?.listTasks?.({}) || [];
  const memory = runtime?.memory?.stats?.() || {};
  const beliefs = runtime?.beliefs?.stats?.() || {};
  const doneGoals = goals.filter((g) => g.status === 'done').length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const failedTasks = tasks.filter((t) => t.status === 'failed').length;
  const activeGoals = goals.filter((g) => g.status === 'active').length;
  const openTasks = tasks.filter((t) => ['pending', 'running', 'blocked'].includes(t.status)).length;
  const goalRate = goals.length ? doneGoals / goals.length : 1;
  const taskRate = tasks.length ? doneTasks / tasks.length : 1;
  const failureRate = tasks.length ? failedTasks / tasks.length : 0;
  const memoryPendingRate = memory.total ? (memory.pending || 0) / memory.total : 0;
  const contestedRate = beliefs.total ? (beliefs.contested || 0) / beliefs.total : 0;
  const score = Math.max(0, Math.min(1,
    0.30 * goalRate + 0.30 * taskRate + 0.20 * (1 - failureRate) +
    0.10 * (1 - memoryPendingRate) + 0.10 * (1 - contestedRate)
  ));
  return {
    at: Date.now(),
    score: Number(score.toFixed(3)),
    goals: { total: goals.length, active: activeGoals, done: doneGoals, rate: Number(goalRate.toFixed(3)) },
    tasks: { total: tasks.length, done: doneTasks, open: openTasks, failed: failedTasks, rate: Number(taskRate.toFixed(3)), failureRate: Number(failureRate.toFixed(3)) },
    memory: { ...memory, pendingRate: Number(memoryPendingRate.toFixed(3)) },
    beliefs: { ...beliefs, contestedRate: Number(contestedRate.toFixed(3)) },
    events: health.events || null,
  };
}
