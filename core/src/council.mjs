// Bounded multi-role deliberation. Critic can veto; archivist only commits
// after critic passes. No role can execute or grant permissions itself.
/**
 * Create a bounded multi-role council. Roles cannot grant permission or execute skills.
 */
export function createCouncil({ callModel, maxRounds = 2, maxModelCalls = 8, logger = () => {} } = {}) {
  if (typeof callModel !== 'function') throw new Error('callModel required');

  async function run({ goal = null, context = '', budget = null } = {}) {
    const rounds = Math.max(1, Math.min(3, Number(maxRounds) || 2));
    let calls = 0;
    const trace = [];
    const call = async (role, prompt) => {
      if (calls >= maxModelCalls) throw new Error('council model call limit exceeded');
      if (budget?.consume) {
        const c = budget.consume('tokens', 1);
        if (!c.ok) throw new Error(c.error);
      }
      calls += 1;
      trace.push({ role, at: Date.now(), prompt: String(prompt).slice(0, 500) });
      const out = await callModel(role, prompt, { goal, context, round: trace.length });
      return out;
    };

    let plan = await call('planner', `目标：${goal?.title || context}\n给出最多 6 步计划。`);
    let critique = null;
    for (let round = 0; round < rounds; round += 1) {
      const actor = await call('actor', `按计划执行并给出结果：${JSON.stringify(plan)}`);
      critique = await call('critic', `审查计划和结果，只找未验证声明/风险/错误。计划：${JSON.stringify(plan)}\n结果：${JSON.stringify(actor)}`);
      const issues = Array.isArray(critique?.issues) ? critique.issues : [];
      if (critique?.ok !== false && issues.length === 0) {
        let committed = null;
        try { committed = await call('archivist', `只把已通过审查的结果写成结构化记忆/目标。结果：${JSON.stringify(actor)}`); }
        catch (error) { logger(`archivist failed: ${error?.message || error}`); }
        return { ok: true, plan, actor, critique, committed, rounds: round + 1, calls, trace };
      }
      if (round + 1 >= rounds) break;
      plan = await call('planner', `根据审查意见修订计划。问题：${JSON.stringify(issues)}\n原计划：${JSON.stringify(plan)}`);
    }
    return { ok: false, plan, critique, rounds, calls, trace, error: 'critic veto / rounds exhausted' };
  }

  return { run };
}
