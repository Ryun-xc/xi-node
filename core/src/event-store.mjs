// Append-only cognitive event store.
// Events are the source of truth for replay; this module never mutates history.
import fs from 'node:fs';
import { clampText } from './storage.mjs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_PAYLOAD_BYTES = 32 * 1024;

function safePayload(value) {
  if (value == null) return {};
  let json;
  try { json = JSON.stringify(value); } catch { return { _unserializable: true }; }
  if (Buffer.byteLength(json, 'utf8') <= MAX_PAYLOAD_BYTES) return value;
  return { _truncated: true, preview: clampText(json, 8000) };
}

/**
 * Create an append-only JSONL event store. Events are never mutated after append.
 */
export function createEventStore({ dir, now = () => Date.now(), idFactory = () => `evt_${crypto.randomUUID()}`, logger = () => {} } = {}) {
  if (!dir) throw new Error('event store dir required');
  const eventsDir = path.join(dir, 'events');
  fs.mkdirSync(eventsDir, { recursive: true });

  function dayFile(ts = now()) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return path.join(eventsDir, `${y}-${m}-${day}.jsonl`);
  }

  function append(input = {}) {
    const ts = Number.isFinite(Number(input.ts)) ? Number(input.ts) : now();
    const event = {
      id: String(input.id || idFactory()),
      ts,
      type: String(input.type || 'unknown'),
      source: String(input.source || 'unknown'),
      scope: input.scope ? String(input.scope) : null,
      actor: input.actor ? String(input.actor) : null,
      payload: safePayload(input.payload),
      causationId: input.causationId ? String(input.causationId) : null,
      correlationId: input.correlationId ? String(input.correlationId) : null,
      schema: Number(input.schema) || 1,
    };
    const line = JSON.stringify(event) + '\n';
    try {
      fs.appendFileSync(dayFile(ts), line, 'utf8');
    } catch (error) {
      logger(`event append failed: ${error?.message || error}`);
      throw error;
    }
    return event;
  }

  function files() {
    try { return fs.readdirSync(eventsDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort(); }
    catch { return []; }
  }

  function readAll({ limit = 0, since = 0, types = null, scope = null, correlationId = null } = {}) {
    const wanted = Array.isArray(types) && types.length ? new Set(types.map(String)) : null;
    const out = [];
    for (const name of files()) {
      let raw;
      try { raw = fs.readFileSync(path.join(eventsDir, name), 'utf8'); } catch { continue; }
      for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); } catch { continue; }
        if (Number(event.ts) < Number(since)) continue;
        if (wanted && !wanted.has(String(event.type))) continue;
        if (scope && String(event.scope || '') !== String(scope)) continue;
        if (correlationId && String(event.correlationId || '') !== String(correlationId)) continue;
        out.push(event);
      }
    }
    out.sort((a, b) => Number(a.ts) - Number(b.ts));
    return limit > 0 ? out.slice(-limit) : out;
  }

  function recent({ limit = 100, ...rest } = {}) {
    return readAll({ ...rest, limit: Math.max(1, Math.min(2000, Number(limit) || 100)) });
  }

  function replayTurn(turnId) {
    return readAll({ correlationId: String(turnId) });
  }

  function stats() {
    let events = 0;
    let bytes = 0;
    for (const name of files()) {
      try {
        const st = fs.statSync(path.join(eventsDir, name));
        bytes += st.size;
        const raw = fs.readFileSync(path.join(eventsDir, name), 'utf8');
        events += raw.split(/\r?\n/).filter((x) => x.trim()).length;
      } catch { /* ignore */ }
    }
    return { dir: eventsDir, files: files().length, events, bytes, lastDay: files().at(-1) || null };
  }

  return { dir, eventsDir, append, readAll, recent, replayTurn, stats, files };
}
