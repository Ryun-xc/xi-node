// Per-turn / per-goal budget accounting.
/**
 * Create a per-turn or per-goal token/tool-call/wall-time budget.
 */
export function createBudget({ tokens = 12000, toolCalls = 8, wallMs = 90000, now = () => Date.now() } = {}) {
  const startedAt = now();
  const used = { tokens: 0, toolCalls: 0 };
  function elapsed() { return now() - startedAt; }
  function remaining() {
    return {
      tokens: Math.max(0, Number(tokens) - used.tokens),
      toolCalls: Math.max(0, Number(toolCalls) - used.toolCalls),
      wallMs: Math.max(0, Number(wallMs) - elapsed()),
    };
  }
  function can(kind = 'toolCalls', amount = 1) {
    const left = remaining();
    if (kind === 'tokens') return left.tokens >= amount;
    if (kind === 'wallMs') return left.wallMs >= amount;
    return left.toolCalls >= amount;
  }
  function consume(kind = 'toolCalls', amount = 1) {
    const n = Math.max(0, Number(amount) || 0);
    if (!can(kind, n)) return { ok: false, error: `budget exceeded: ${kind}`, remaining: remaining() };
    if (kind === 'tokens') used.tokens += n;
    else if (kind === 'toolCalls') used.toolCalls += n;
    return { ok: true, remaining: remaining() };
  }
  function snapshot() { return { tokens, toolCalls, wallMs, used: { ...used }, elapsedMs: elapsed(), remaining: remaining() }; }
  return { can, consume, remaining, snapshot };
}
