// Deterministic task-graph planner. Model output can propose steps, but
// execution order and dependency checks stay in code.
/**
 * Create a dependency-aware planner over a goal store.
 */
export function createPlanner({ goalStore } = {}) {
  if (!goalStore) throw new Error('goalStore required');

  function planGoal(goalId) {
    const goal = goalStore.getGoal(goalId);
    if (!goal) throw new Error('goal not found');
    const tasks = goalStore.listTasks({ goalId });
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const done = new Set(tasks.filter((t) => t.status === 'done').map((t) => t.id));
    const ordered = [];
    const visiting = new Set();
    const visited = new Set();
    const missing = [];
    function visit(id, trail = []) {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error(`task cycle: ${[...trail, id].join(' -> ')}`);
      const task = byId.get(id);
      if (!task) { missing.push(id); return; }
      visiting.add(id);
      for (const dep of task.dependsOn || []) {
        if (!byId.has(dep)) missing.push(dep);
        else visit(dep, [...trail, id]);
      }
      visiting.delete(id);
      visited.add(id);
      ordered.push(task);
    }
    for (const task of tasks) visit(task.id);
    return {
      goalId,
      title: goal.title,
      tasks: ordered,
      done: [...done],
      missing: [...new Set(missing)],
      next: ordered.find((t) => t.status === 'pending' && (t.dependsOn || []).every((d) => done.has(d))) || null,
      ready: ordered.filter((t) => t.status === 'pending' && (t.dependsOn || []).every((d) => done.has(d))),
      blocked: ordered.filter((t) => ['pending', 'running'].includes(t.status) && (t.dependsOn || []).some((d) => !done.has(d))),
    };
  }

  function nextRunnable(goalId) {
    return planGoal(goalId).next;
  }

  function planFromSteps(steps = []) {
    // Used by tests / future model-proposed plans. Steps: {title, dependsOn:[index]}
    return (Array.isArray(steps) ? steps : []).map((step, i) => ({
      tempId: `s${i + 1}`,
      title: String(step.title || `step ${i + 1}`),
      dependsOn: (Array.isArray(step.dependsOn) ? step.dependsOn : []).map((n) => `s${Number(n) + 1}`),
    }));
  }

  return { planGoal, nextRunnable, planFromSteps };
}
