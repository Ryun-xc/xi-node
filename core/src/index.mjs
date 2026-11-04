// XI Cognitive Runtime — P1 in-process core.
// Shadow mode: observation must never change the existing adapter reply path.
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createEventStore } from './event-store.mjs';
import { createGoalStore } from './goal-store.mjs';
import { createWorkspace, addAttention, setActiveGoals } from './workspace.mjs';
import { replayTurn as replayFromStore, buildTimeline } from './replay.mjs';
import { createPlanner } from './planner.mjs';
import { createVerifier } from './verifier.mjs';
import { createTaskExecutor } from './executor.mjs';
import { createMemoryStore } from './memory-records.mjs';
import { createBeliefStore } from './belief-store.mjs';
import { createSkillRegistry } from './skill-registry.mjs';
import { createPolicy } from './policy.mjs';
import { createSkillRuntime } from './skill-runtime.mjs';
import { routeDeliberation } from './deliberation-router.mjs';
import { createCouncil } from './council.mjs';
import { evaluateRuntime } from './eval.mjs';
import { createGoalRunner } from './goal-runner.mjs';
import { createNeuralIndex } from './neural-index.mjs';

/**
 * Create an isolated cognitive runtime rooted at `stateDir`. The runtime owns event, goal, memory, policy, and eval stores.
 */
export function createCognitiveRuntime({
  stateDir,
  logger = () => {},
  now = () => Date.now(),
  enabled = true,
  maxActiveTurns = 500,
  syncGraph = false,
} = {}) {
  if (!stateDir) throw new Error('cognitive stateDir required');
  const dir = path.join(stateDir, 'cognitive');
  const store = createEventStore({ dir, now, logger });
  const goals = createGoalStore({
    file: path.join(dir, 'goals.json'),
    tasksFile: path.join(dir, 'tasks.json'),
    now,
    logger,
  });
  const planner = createPlanner({ goalStore: goals });
  const verifier = createVerifier();
  const executor = createTaskExecutor({
    goalStore: goals, verifier,
    file: path.join(dir, 'idempotency.json'),
    now,
    onEvent: (event) => { try { store.append({ ...event, source: 'cognitive' }); } catch (error) { logger(`executor event failed: ${error?.message || error}`); } },
  });
  const memory = createMemoryStore({ file: path.join(dir, 'memory-records.json'), now, logger });
  const beliefs = createBeliefStore({ file: path.join(dir, 'beliefs.json'), now, logger });
  const neuralIndex = createNeuralIndex({ file: path.join(stateDir, 'neural-graph.json'), logger });
  const goalRunner = createGoalRunner({ planner, executor, goalStore: goals, logger });
  const skills = createSkillRegistry();
  skills.register({
    name: 'memory.write', description: 'write a structured memory record', risk: 'low', sideEffect: 'local',
    handler: (input) => {
      const record = memory.write(input);
      if (syncGraph && record.status === 'active' && record.provenance.epistemic === 'observed') {
        try { neuralIndex.upsert(record); } catch (error) { logger(`neural index failed: ${error?.message || error}`); }
      }
      return { ok: true, record };
    },
  });
  skills.register({
    name: 'belief.upsert', description: 'upsert a belief with evidence', risk: 'low', sideEffect: 'local',
    handler: (input) => ({ ok: true, belief: beliefs.upsert(input) }),
  });
  skills.register({
    name: 'goal.create', description: 'create a persistent goal', risk: 'medium', sideEffect: 'local',
    handler: (input) => ({ ok: true, goal: goals.createGoal(input) }),
  });
  skills.register({
    name: 'memory.query', description: 'read structured memory records', risk: 'low', sideEffect: 'none',
    handler: (input = {}) => ({ ok: true, items: memory.list(input), stats: memory.stats() }),
  });
  skills.register({
    name: 'goal.list', description: 'read goals', risk: 'low', sideEffect: 'none',
    handler: (input = {}) => ({ ok: true, items: goals.listGoals(input) }),
  });
  skills.register({
    name: 'task.list', description: 'read tasks', risk: 'low', sideEffect: 'none',
    handler: (input = {}) => ({ ok: true, items: goals.listTasks(input) }),
  });
  skills.register({
    name: 'timeline.read', description: 'read recent cognitive events', risk: 'low', sideEffect: 'none',
    handler: (input = {}) => ({ ok: true, items: store.recent({ limit: Number(input.limit) || 50, scope: input.scope || null }) }),
  });
  skills.register({
    name: 'eval.read', description: 'read runtime evaluation', risk: 'low', sideEffect: 'none',
    handler: () => ({ ok: true, evaluation: evaluate() }),
  });
  const policy = createPolicy();
  const skillRuntime = createSkillRuntime({ registry: skills, policy, logger });
  const active = new Map();
  const lastTurnByScope = new Map();
  const pendingEvents = [];
  let flushScheduled = false;

  function flushEvents() {
    flushScheduled = false;
    while (pendingEvents.length) {
      const event = pendingEvents.shift();
      try { store.append(event); } catch (error) { logger(`event flush failed: ${error?.message || error}`); }
    }
  }
  function scheduleEvent(event) {
    pendingEvents.push(event);
    while (pendingEvents.length > 2000) pendingEvents.shift();
    if (!flushScheduled) {
      flushScheduled = true;
      setImmediate(() => { try { flushEvents(); } catch (error) { logger(`event flush failed: ${error?.message || error}`); } });
    }
    return event;
  }

  function trimActive() {
    while (active.size > maxActiveTurns) {
      const oldest = active.keys().next().value;
      active.delete(oldest);
    }
  }

  function observeIncoming({ key, scope = null, kind = 'message', sender = '', userId = '', text = '', messageId = null } = {}) {
    if (!enabled) return null;
    const turnId = `turn_${now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
    const event = scheduleEvent({
      id: `evt_${crypto.randomUUID()}`,
      ts: now(),
      type: 'message.received',
      source: 'adapter',
      scope: scope || key || null,
      actor: userId || sender || null,
      correlationId: turnId,
      payload: { key: key || null, kind, sender, userId, messageId, text: String(text ?? '').slice(0, 4000) },
    });
    const workspace = createWorkspace({ turnId, scope: scope || key || null });
    addAttention(workspace, { kind: 'message', ref: event.id, salience: kind === 'group' ? 0.55 : 0.8 });
    setActiveGoals(workspace, goals.listGoals({ status: 'active', scope: scope || key || null }).slice(0, 8));
    active.set(turnId, { turnId, key, scope: scope || key || null, startedAt: event.ts, workspace });
    if (key) lastTurnByScope.set(String(key), turnId);
    trimActive();
    return { turnId, workspace, eventId: event.id };
  }

  function observeDelivered({ turnId = null, key = null, ok = true, text = '', error = null } = {}) {
    if (!enabled) return null;
    const resolved = turnId || (key ? lastTurnByScope.get(String(key)) : null);
    if (!resolved) return null;
    const turn = active.get(resolved);
    const event = scheduleEvent({
      type: 'turn.completed',
      source: 'adapter',
      scope: turn?.scope || (key ? String(key) : null),
      correlationId: resolved,
      payload: { ok: Boolean(ok), error: error ? String(error).slice(0, 1000) : null, text: String(text || '').slice(0, 4000) },
    });
    if (text) {
      scheduleEvent({
        type: 'message.sent',
        source: 'adapter',
        scope: turn?.scope || (key ? String(key) : null),
        correlationId: resolved,
        payload: { text: String(text).slice(0, 4000) },
      });
    }
    active.delete(resolved);
    return event;
  }

  function recordStage({ turnId, type, payload = {} } = {}) {
    if (!enabled || !turnId || !type) return null;
    const turn = active.get(String(turnId));
    return scheduleEvent({
      type: String(type),
      source: 'cognitive',
      scope: turn?.scope || null,
      correlationId: String(turnId),
      payload,
    });
  }

  function createGoal(input = {}) {
    const goal = goals.createGoal(input);
    store.append({
      type: 'goal.created',
      source: 'cognitive',
      scope: goal.scope,
      payload: { goalId: goal.id, title: goal.title, priority: goal.priority, successCriteria: goal.successCriteria },
    });
    return goal;
  }

  function updateGoal(goalId, patch = {}) {
    const goal = goals.updateGoal(goalId, patch);
    if (goal) store.append({ type: 'goal.updated', source: 'cognitive', scope: goal.scope, payload: { goalId: goal.id, status: goal.status, title: goal.title } });
    return goal;
  }

  function addTask(input = {}) {
    const task = goals.addTask(input);
    store.append({ type: 'task.created', source: 'cognitive', scope: null, payload: { taskId: task.id, goalId: task.goalId, title: task.title, status: task.status } });
    return task;
  }

  function updateTask(taskId, patch = {}) {
    const task = goals.updateTask(taskId, patch);
    if (task) store.append({ type: 'task.updated', source: 'cognitive', payload: { taskId: task.id, goalId: task.goalId, status: task.status, result: task.result } });
    return task;
  }

  function timeline(opts = {}) { return buildTimeline(store, opts); }
  function replay(turnId) { return replayFromStore(store, turnId); }
  function route(input = {}) { return routeDeliberation(input); }
  const evalHistoryFile = path.join(dir, 'eval-history.jsonl');
  function readEvalHistory(limit = 60) {
    try {
      const lines = fs.readFileSync(evalHistoryFile, 'utf8').split(/\r?\n/).filter(Boolean).slice(-Math.max(1, Math.min(500, Number(limit) || 60)));
      return lines.map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
  }
  function snapshotEval() {
    const value = evaluate();
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(evalHistoryFile, JSON.stringify({ at: value.at, score: value.score, goals: value.goals, tasks: value.tasks, memory: value.memory, beliefs: value.beliefs }) + '\n', 'utf8');
    } catch (error) { logger(`eval snapshot failed: ${error?.message || error}`); }
    return value;
  }
  let modelCall = null;
  function setModelCall(fn) { modelCall = typeof fn === 'function' ? fn : null; return Boolean(modelCall); }
  function runCouncilWithModel({ goal = null, context = '', maxRounds = 2, budget = null } = {}) {
    if (!modelCall) throw new Error('model adapter not bound');
    return runCouncil({ callModel: modelCall, goal, context, maxRounds, budget });
  }
  const READONLY_SKILLS = new Set(['memory.query', 'goal.list', 'task.list', 'timeline.read', 'eval.read']);
  async function runReadonlyGoal(goalId, { maxSteps = 10 } = {}) {
    const tasks = goals.listTasks({ goalId });
    const handlers = {};
    for (const task of tasks) {
      if (!task.skill || !READONLY_SKILLS.has(task.skill)) continue;
      handlers[task.id] = () => skillRuntime.execute(task.skill, task.input || {}, { mode: 'readonly', scope: task.scope || null });
    }
    if (!Object.keys(handlers).length) return { ok: false, goalId, error: 'no approved readonly task handlers' };
    return goalRunner.runGoal(goalId, handlers, { maxSteps });
  }
  function evaluate() {
    return evaluateRuntime({
      health,
      listGoals: goals.listGoals,
      listTasks: goals.listTasks,
      memory,
      beliefs,
    });
  }
  function runCouncil({ callModel, maxRounds = 2, maxModelCalls = 8, goal = null, context = '', budget = null } = {}) {
    if (typeof callModel !== 'function') throw new Error('callModel required for council');
    return createCouncil({ callModel, maxRounds, maxModelCalls, logger }).run({ goal, context, budget });
  }

  function health() {
    return {
      ok: true,
      enabled,
      dir: store.dir,
      events: store.stats(),
      goals: goals.stats(),
      activeTurns: active.size,
      idempotency: executor.ledgerStats(),
      memory: memory.stats(),
      beliefs: beliefs.stats(),
      skills: skills.list().length,
      modelCall: Boolean(modelCall),
    };
  }

  return {
    enabled, dir, store, goals,
    planner, verifier, executor, memory, beliefs, skills, policy, skillRuntime,
    neuralIndex, syncGraph,
    observeIncoming, observeDelivered, recordStage,
    createGoal, updateGoal, addTask, updateTask,
    listGoals: goals.listGoals, getGoal: goals.getGoal,
    listTasks: goals.listTasks, getTask: goals.getTask,
    startTask: goals.startTask, completeTask: goals.completeTask, failTask: goals.failTask,
    planGoal: planner.planGoal, executeTask: executor.execute,
    runGoal: goalRunner.runGoal, tickGoals: goalRunner.tick,
    route, runCouncil, runCouncilWithModel, setModelCall, evaluate, runReadonlyGoal,
    snapshotEval, readEvalHistory,
    timeline, replay, health, flushEvents,
  };
}
