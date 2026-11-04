// Structured memory records with provenance and review state.
// Existing neural graph remains the semantic index; this is the audit layer.
import { readJson, atomicJson, clampText } from './storage.mjs';
import crypto from 'node:crypto';

const KINDS = new Set(['episodic', 'semantic', 'procedural']);
const EPISTEMIC = new Set(['observed', 'transcribed', 'inferred', 'unresolved']);
const SOURCES = new Set(['user_message', 'tool_result', 'media_asr', 'model_inference', 'manual']);
const STATUS = new Set(['active', 'pending', 'rejected', 'retracted']);

/**
 * Create a structured memory store with provenance, review state, and export.
 */
export function createMemoryStore({ file, now = () => Date.now(), logger = () => {} } = {}) {
  if (!file) throw new Error('memory store file required');
  let items = readJson(file, []);
  if (!Array.isArray(items)) items = [];
  function save() { try { atomicJson(file, items); } catch (error) { logger(`memory save failed: ${error?.message || error}`); throw error; } }

  function write({
    kind = 'episodic', scope = 'global', text = '', source = 'manual',
    evidence = [], confidence = 0.5, epistemic = 'observed', reviewRequired = null,
  } = {}) {
    const k = KINDS.has(String(kind)) ? String(kind) : 'episodic';
    const ep = EPISTEMIC.has(String(epistemic)) ? String(epistemic) : 'unresolved';
    const src = SOURCES.has(String(source)) ? String(source) : 'manual';
    const conf = Math.max(0, Math.min(1, Number(confidence) || 0));
    const required = reviewRequired == null ? (src === 'model_inference' || ep === 'inferred' || ep === 'unresolved') : Boolean(reviewRequired);
    const record = {
      id: `mem_${crypto.randomUUID()}`,
      kind: k,
      scope: String(scope || 'global'),
      text: clampText(text),
      provenance: { source: src, evidence: (Array.isArray(evidence) ? evidence : []).map(String).slice(0, 50), confidence: conf, epistemic: ep },
      status: required ? 'pending' : (ep === 'observed' && src !== 'model_inference' ? 'active' : 'pending'),
      review: { required, by: null, at: null },
      createdAt: now(),
      lastUsedAt: null,
      tombstone: null,
    };
    items.push(record);
    save();
    return record;
  }

  function get(id) { return items.find((x) => x.id === String(id)) || null; }
  function list({ kind = null, scope = null, status = null, epistemic = null, limit = 200 } = {}) {
    return items.filter((x) => (!kind || x.kind === kind) && (!scope || x.scope === scope) && (!status || x.status === status) && (!epistemic || x.provenance.epistemic === epistemic))
      .slice(-Math.max(1, Math.min(2000, Number(limit) || 200)));
  }

  function setStatus(id, status, by = null) {
    if (!STATUS.has(String(status))) throw new Error(`invalid status: ${status}`);
    const record = get(id);
    if (!record) return null;
    record.status = String(status);
    record.review = { ...(record.review || {}), required: record.review?.required ?? false, by: by ? String(by) : record.review?.by || null, at: now() };
    if (status === 'retracted') record.tombstone = { at: now(), by: by ? String(by) : null };
    save();
    return record;
  }

  function approve(id, by = 'human') { return setStatus(id, 'active', by); }
  function reject(id, by = 'human') { return setStatus(id, 'rejected', by); }
  function retract(id, by = 'human') { return setStatus(id, 'retracted', by); }

  function markUsed(id) {
    const record = get(id);
    if (!record) return null;
    record.lastUsedAt = now();
    save();
    return record;
  }

  function stats() {
    return {
      total: items.length,
      active: items.filter((x) => x.status === 'active').length,
      pending: items.filter((x) => x.status === 'pending').length,
      rejected: items.filter((x) => x.status === 'rejected').length,
      retracted: items.filter((x) => x.status === 'retracted').length,
      inferred: items.filter((x) => x.provenance.epistemic === 'inferred').length,
    };
  }

  function exportAll({ includeRetracted = true } = {}) {
    return items
      .filter((record) => includeRetracted || record.status !== 'retracted')
      .map((record) => structuredClone(record));
  }

  return { write, get, list, approve, reject, retract, setStatus, markUsed, stats, exportAll };
}
