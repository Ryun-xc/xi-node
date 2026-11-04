// Rebuild a turn trace from the event log.
export function replayTurn(store, turnId) {
  const events = store?.replayTurn?.(turnId) || [];
  return {
    turnId: String(turnId),
    eventCount: events.length,
    startedAt: events[0]?.ts || null,
    endedAt: events.at(-1)?.ts || null,
    events,
    stages: events.map((e) => ({ type: e.type, ts: e.ts, payload: e.payload || {} })),
  };
}

/**
 * Build a chronological timeline from an event store.
 */
export function buildTimeline(store, { limit = 100, since = 0, scope = null } = {}) {
  return (store?.recent?.({ limit, since, scope }) || []).map((e) => ({
    id: e.id,
    ts: e.ts,
    type: e.type,
    source: e.source,
    scope: e.scope,
    correlationId: e.correlationId,
    summary: summarizeEvent(e),
  }));
}

export function summarizeEvent(event) {
  const p = event?.payload || {};
  switch (String(event?.type || '')) {
    case 'message.received': return `${p.sender || '?'}：${String(p.text || '').slice(0, 80)}`;
    case 'message.sent': return `回复：${String(p.text || '').slice(0, 80)}`;
    case 'turn.completed': return `turn completed (${p.ok ? 'ok' : 'fail'})`;
    case 'goal.created': return `目标：${String(p.title || '').slice(0, 80)}`;
    case 'task.updated': return `任务 ${p.taskId || ''} → ${p.status || ''}`;
    case 'memory.written': return `记忆写入：${String(p.text || '').slice(0, 60)}`;
    default: return String(event?.type || 'event');
  }
}
