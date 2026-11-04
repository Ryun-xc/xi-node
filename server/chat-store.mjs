import crypto from 'node:crypto';
import fs from 'node:fs';
import { readJson, atomicJson } from '../core/src/storage.mjs';

export function createChatStore({ file, limit = 500 } = {}) {
  let items = file ? readJson(file, []) : [];
  if (!Array.isArray(items)) items = [];
  items = items.slice(-limit);
  const save = () => { if (file) atomicJson(file, items); };
  function append(message) {
    const entry = {
      id: `msg_${crypto.randomUUID()}`,
      role: message.role === 'assistant' ? 'assistant' : 'user',
      text: String(message.text || '').slice(0, 12000),
      at: Number(message.at) || Date.now(),
      provider: String(message.provider || ''),
      model: String(message.model || ''),
    };
    if (!entry.text.trim()) return null;
    items.push(entry);
    items = items.slice(-limit);
    save();
    return entry;
  }
  return {
    append,
    list: ({ limit: count = 100 } = {}) => items.slice(-Math.max(1, Math.min(limit, Number(count) || 100))),
    clear: () => { items = []; save(); },
    count: () => items.length,
  };
}