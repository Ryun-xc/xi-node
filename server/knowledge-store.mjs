import crypto from 'node:crypto';
import { readJson, atomicJson } from '../core/src/storage.mjs';

function terms(text) {
  const value = String(text || '').toLowerCase();
  const out = new Set(value.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length >= 2));
  for (const run of value.match(/[\u4e00-\u9fff]+/g) || []) {
    for (let i = 0; i < run.length - 1; i += 1) out.add(run.slice(i, i + 2));
  }
  return out;
}

export function createKnowledgeStore({ file, logger = () => {} } = {}) {
  let items = [];
  try { const parsed = readJson(file, []); if (Array.isArray(parsed)) items = parsed; } catch {}
  const save = () => { if (file) atomicJson(file, items); };
  function add({ title = '', text = '', source = 'manual' } = {}) {
    const body = String(text || '').trim().slice(0, 20000);
    if (!body) throw new Error('knowledge text required');
    const item = {
      id: `kb_${crypto.randomUUID()}`,
      title: String(title || '').trim().slice(0, 200) || body.slice(0, 60),
      text: body,
      source: String(source || 'manual').slice(0, 80),
      createdAt: Date.now(),
    };
    items.push(item);
    items = items.slice(-200);
    save();
    return item;
  }
  function list({ limit = 100 } = {}) { return items.slice(-Math.max(1, Math.min(200, Number(limit) || 100))); }
  function remove(id) { const before = items.length; items = items.filter((x) => x.id !== id); if (items.length !== before) save(); return items.length !== before; }
  function search(query, { limit = 3 } = {}) {
    const queryTerms = terms(query);
    return items.map((item) => {
      const body = String(item.title + ' ' + item.text).toLowerCase();
      let score = 0;
      for (const term of queryTerms) if (body.includes(term)) score += Math.min(4, term.length);
      return { item, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(10, Number(limit) || 3)));
  }
  return { add, list, remove, search, count: () => items.length };
}