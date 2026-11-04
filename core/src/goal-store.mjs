// Persistent goals and tasks. JSON atomic writes, single writer.
import { readJson, atomicJson, clampText, nowDefault } from './storage.mjs';
import path from 'node:path';
import crypto from 'node:crypto';

const GOAL_STATUS = new Set(['active', 'paused', 'done', 'failed', 'cancelled']);
const TASK_STATUS = new Set(['pending', 'running', 'blocked', 'done', 'failed', 'cancelled']);

function id(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
/**
 * Create a persistent goal/task store with atomic JSON writes.
 */
export function createGoalStore({
  file,
  tasksFile = file ? path.join(path.dirname(file), 'tasks.json') : null,
  now = nowDefault,
  idFactory = id,
  logger = () => {},
} = {}) {
  if (!file || !tasksFile) throw new Error('goal store files required');
  let goals = readJson(file, []);
  let tasks = readJson(tasksFile, []);
  if (!Array.isArray(goals)) goals = [];
  if (!Array.isArray(tasks)) tasks = [];

  function saveGoals() { try { atomicJson(file, goals); } catch (error) { logger(`goal save failed: ${error?.message || error}`); throw error; } }
  function saveTasks() { try { atomicJson(tasksFile, tasks); } catch (error) { logger(`task save failed: ${error?.message || error}`); throw error; } }

  function listGoals({ status = null, scope = null } = {}) {
    return goals.filter((g) => (!status || g.status === status) && (!scope || g.scope === scope)).slice();
  }
  function getGoal(goalId) { return goals.find((g) => String(g.id) === String(goalId)) || null; }
  function getTask(taskId) { return tasks.find((t) => String(t.id) === String(taskId)) || null; }
  function listTasks({ goalId = null, status = null } = {}) {
    return tasks.filter((t) => (!goalId || t.goalId === goalId) && (!status || t.status === status)).slice();
  }

  function createGoal({ title, why = '', scope = null, priority = 0.5, successCriteria = [], deadline = null } = {}) {
    const goal = {
      id: idFactory('goal'),
      title: clampText(title, 240) || '未命名目标',
      why: clampText(why, 1200),
      scope: scope ? String(scope) : null,
      status: 'active',
      priority: Math.max(0, Math.min(1, Number(priority) || 0)),
      successCriteria: (Array.isArray(successCriteria) ? successCriteria : []).map((x) => clampText(x, 500)).slice(0, 20),
      tasks: [],
      deadline: deadline ? Number(deadline) : null,
      createdAt: now(),
      updatedAt: now(),
    };
    goals.push(goal);
    saveGoals();
    return goal;
  }

  function updateGoal(goalId, patch = {}) {
    const goal = getGoal(goalId);
    if (!goal) return null;
    if (patch.title != null) goal.title = clampText(patch.title, 240);
    if (patch.why != null) goal.why = clampText(patch.why, 1200);
    if (patch.priority != null) goal.priority = Math.max(0, Math.min(1, Number(patch.priority) || 0));
    if (patch.status != null) {
      if (!GOAL_STATUS.has(String(patch.status))) throw new Error(`invalid goal status: ${patch.status}`);
      goal.status = String(patch.status);
    }
    if (patch.successCriteria != null) goal.successCriteria = (Array.isArray(patch.successCriteria) ? patch.successCriteria : []).map((x) => clampText(x, 500)).slice(0, 20);
    goal.updatedAt = now();
    saveGoals();
    return goal;
  }

  function addTask({ goalId, title, dependsOn = [], maxAttempts = 2, idempotencyKey = null, skill = null, input = null } = {}) {
    const goal = getGoal(goalId);
    if (!goal) throw new Error('goal not found');
    if (idempotencyKey) {
      const existing = tasks.find((t) => t.idempotencyKey === String(idempotencyKey));
      if (existing) return existing;
    }
    const task = {
      id: idFactory('task'),
      goalId: goal.id,
      title: clampText(title, 240) || '未命名任务',
      status: 'pending',
      dependsOn: (Array.isArray(dependsOn) ? dependsOn : []).map(String),
      attempts: 0,
      maxAttempts: Math.max(1, Number(maxAttempts) || 2),
      idempotencyKey: idempotencyKey ? String(idempotencyKey) : null,
      skill: skill && /^[a-z0-9_.-]+$/i.test(String(skill)) ? String(skill) : null,
      input: input && typeof input === 'object' && !Array.isArray(input) ? input : null,
      result: null,
      evidence: [],
      createdAt: now(),
      updatedAt: now(),
    };
    tasks.push(task);
    goal.tasks.push(task.id);
    goal.updatedAt = now();
    saveGoals();
    saveTasks();
    return task;
  }

  function updateTask(taskId, patch = {}) {
    const task = getTask(taskId);
    if (!task) return null;
    if (patch.status != null) {
      if (!TASK_STATUS.has(String(patch.status))) throw new Error(`invalid task status: ${patch.status}`);
      task.status = String(patch.status);
    }
    if (patch.result !== undefined) task.result = patch.result;
    if (patch.evidence != null) task.evidence = (Array.isArray(patch.evidence) ? patch.evidence : []).map(String).slice(0, 50);
    if (patch.attempts != null) task.attempts = Math.max(0, Number(patch.attempts) || 0);
    task.updatedAt = now();
    saveTasks();
    return task;
  }

  function startTask(taskId) {
    const task = getTask(taskId);
    if (!task) return null;
    if (task.attempts >= task.maxAttempts) throw new Error('task attempts exceeded');
    task.status = 'running';
    task.attempts += 1;
    task.updatedAt = now();
    saveTasks();
    return task;
  }

  function completeTask(taskId, { result = null, evidence = [] } = {}) {
    return updateTask(taskId, { status: 'done', result, evidence });
  }

  function failTask(taskId, { error = null } = {}) {
    const task = getTask(taskId);
    if (!task) return null;
    const exhausted = task.attempts >= task.maxAttempts;
    return updateTask(taskId, { status: exhausted ? 'failed' : 'pending', result: error ? { error: String(error) } : task.result });
  }

  function completeGoalIfDone(goalId) {
    const goal = getGoal(goalId);
    if (!goal) return null;
    const list = listTasks({ goalId });
    if (list.length && list.every((t) => t.status === 'done')) return updateGoal(goalId, { status: 'done' });
    return goal;
  }

  function stats() {
    return {
      goals: goals.length,
      activeGoals: goals.filter((g) => g.status === 'active').length,
      tasks: tasks.length,
      openTasks: tasks.filter((t) => ['pending', 'running', 'blocked'].includes(t.status)).length,
      failedTasks: tasks.filter((t) => t.status === 'failed').length,
    };
  }

  return {
    listGoals, getGoal, listTasks, getTask, createGoal, updateGoal,
    addTask, updateTask, startTask, completeTask, failTask, completeGoalIfDone, stats,
    reload() { goals = readJson(file, []); tasks = readJson(tasksFile, []); },
  };
}
