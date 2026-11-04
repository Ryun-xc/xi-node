// Task executor with dependency checks, attempts, verifier and idempotency.
import { readJson, atomicJson } from './storage.mjs';

/**
 * Create a task executor with dependency checks, idempotency, verification, and evidence.
 */
export function createTaskExecutor({ goalStore, verifier, file, now = () => Date.now(), onEvent = () => {} } = {}) {
  if (!goalStore) throw new Error('goalStore required');
  if (!verifier) throw new Error('verifier required');
  if (!file) throw new Error('idempotency file required');
  let ledger = readJson(file, {});
  if (!ledger || typeof ledger !== 'object') ledger = {};

  function save() { atomicJson(file, ledger); }

  function depsDone(task) {
    return (task.dependsOn || []).every((id) => goalStore.getTask(id)?.status === 'done');
  }

  async function execute(taskId, handler, { verify = { kind: 'generic' }, criteria = [] } = {}) {
    const task = goalStore.getTask(taskId);
    if (!task) return { ok: false, error: 'task not found' };
    const key = task.idempotencyKey || task.id;
    if (task.status === 'done' && ledger[key]) return { ok: true, cached: true, task, verification: ledger[key].verification || null, result: ledger[key].result ?? task.result };
    if (task.status === 'done') return { ok: true, cached: true, task, result: task.result };
    if (!depsDone(task)) return { ok: false, error: 'dependencies not done', task };
    if (task.attempts >= task.maxAttempts) return { ok: false, error: 'attempts exceeded', task };

    goalStore.startTask(task.id);
    onEvent({ type: 'task.started', taskId: task.id, goalId: task.goalId });
    try {
      const result = await handler({ task, goal: goalStore.getGoal(task.goalId) });
      const verification = verifier.verify(verify.kind, { ...verify, ...(result && typeof result === 'object' ? result : {}), result }, criteria);
      if (!verification.ok) {
        const failed = goalStore.failTask(task.id, { error: verification.failures.join('; ') });
        onEvent({ type: 'verification.failed', taskId: task.id, goalId: task.goalId, failures: verification.failures });
        return { ok: false, error: verification.failures.join('; ') || 'verification failed', task: failed, verification };
      }
      const done = goalStore.completeTask(task.id, { result: result ?? null, evidence: verification.evidence });
      ledger[key] = { taskId: task.id, goalId: task.goalId, at: now(), result: result ?? null, verification };
      save();
      onEvent({ type: 'verification.passed', taskId: task.id, goalId: task.goalId, evidence: verification.evidence });
      onEvent({ type: 'task.completed', taskId: task.id, goalId: task.goalId });
      goalStore.completeGoalIfDone(task.goalId);
      return { ok: true, task: done, verification, result };
    } catch (error) {
      const failed = goalStore.failTask(task.id, { error: error?.message || error });
      onEvent({ type: 'task.failed', taskId: task.id, goalId: task.goalId, error: String(error?.message || error) });
      return { ok: false, error: String(error?.message || error), task: failed };
    }
  }

  async function runNext(goalId, handlers = {}) {
    const tasks = goalStore.listTasks({ goalId });
    const next = tasks.find((t) => t.status === 'pending' && depsDone(t));
    if (!next) return { ok: true, done: tasks.every((t) => t.status === 'done'), task: null };
    const handler = handlers[next.id] || handlers[next.title];
    if (typeof handler !== 'function') return { ok: false, error: 'no handler for task', task: next };
    return execute(next.id, handler);
  }

  function ledgerStats() {
    const values = Object.values(ledger);
    return { entries: values.length, at: values.at(-1)?.at || null };
  }

  return { execute, runNext, ledgerStats, ledgerFile: file };
}
