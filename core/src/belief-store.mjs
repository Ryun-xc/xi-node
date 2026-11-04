// Beliefs are claims with evidence, not facts.
import { readJson, atomicJson } from './storage.mjs';
import crypto from 'node:crypto';

/**
 * Create a belief store with evidence, conflict detection, and export.
 */
export function createBeliefStore({ file, now = () => Date.now(), logger = () => {} } = {}) {
  if (!file) throw new Error('belief store file required');
  let items = readJson(file, []);
  if (!Array.isArray(items)) items = [];
  function save() { try { atomicJson(file, items); } catch (error) { logger(`belief save failed: ${error?.message || error}`); throw error; } }

  function list({ subject = null, scope = null, status = null } = {}) {
    return items.filter((b) => (!subject || b.subject === subject) && (!scope || b.scope === scope) && (!status || b.status === status));
  }

  function upsert({ subject, predicate, object, confidence = 0.5, evidence = [], scope = 'global', source = 'manual' } = {}) {
    const s = String(subject || '').trim();
    const p = String(predicate || '').trim();
    const o = String(object || '').trim();
    if (!s || !p || !o) throw new Error('subject/predicate/object required');
    const conf = Math.max(0, Math.min(1, Number(confidence) || 0));
    let belief = items.find((b) => b.subject === s && b.predicate === p && b.scope === String(scope) && b.object === o);
    if (!belief) {
      belief = {
        id: `belief_${crypto.randomUUID()}`,
        subject: s, predicate: p, object: o, scope: String(scope),
        confidence: conf,
        evidence: (Array.isArray(evidence) ? evidence : []).map(String).slice(0, 50),
        status: 'supported',
        source: String(source),
        createdAt: now(), updatedAt: now(),
      };
      items.push(belief);
      // Contradictory object for same subject/predicate in same scope => contested.
      for (const other of items) {
        if (other === belief) continue;
        if (other.subject === s && other.predicate === p && other.scope === belief.scope && other.object !== o) {
          other.status = 'contested'; other.updatedAt = now();
          belief.status = 'contested';
        }
      }
    } else {
      belief.evidence = [...new Set([...(belief.evidence || []), ...(Array.isArray(evidence) ? evidence : []).map(String)])].slice(-50);
      belief.confidence = Math.max(belief.confidence, conf);
      belief.updatedAt = now();
    }
    save();
    return belief;
  }

  function resolve(id, status = 'supported', by = 'human') {
    const belief = items.find((b) => b.id === String(id));
    if (!belief) return null;
    if (!['supported', 'contested', 'refuted', 'unknown'].includes(status)) throw new Error('invalid belief status');
    belief.status = status;
    belief.resolvedBy = String(by);
    belief.updatedAt = now();
    save();
    return belief;
  }

  function stats() {
    return {
      total: items.length,
      supported: items.filter((b) => b.status === 'supported').length,
      contested: items.filter((b) => b.status === 'contested').length,
      refuted: items.filter((b) => b.status === 'refuted').length,
      unknown: items.filter((b) => b.status === 'unknown').length,
    };
  }

  function exportAll() {
    return items.map((belief) => structuredClone(belief));
  }

  return { upsert, list, resolve, stats, exportAll };
}
