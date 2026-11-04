#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMemoryStore } from '../src/memory-records.mjs';
import { createBeliefStore } from '../src/belief-store.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-p3-'));
try {
  const mem = createMemoryStore({ file: path.join(root, 'memory.json') });
  const observed = mem.write({ kind: 'semantic', scope: 'private:1', text: '他喜欢港片', source: 'user_message', evidence: ['evt_1'], confidence: 0.9, epistemic: 'observed' });
  const inferred = mem.write({ kind: 'semantic', scope: 'private:1', text: '他可能喜欢火锅', source: 'model_inference', evidence: ['evt_2'], confidence: 0.8, epistemic: 'inferred' });
  assert.equal(observed.status, 'active');
  assert.equal(inferred.status, 'pending');
  assert.equal(inferred.review.required, true);
  assert.equal(mem.list({ status: 'pending' }).length, 1);
  mem.approve(inferred.id, 'human');
  assert.equal(mem.get(inferred.id).status, 'active');
  const retracted = mem.retract(observed.id, 'human');
  assert.equal(retracted.status, 'retracted');
  assert.ok(retracted.tombstone);
  assert.equal(mem.stats().retracted, 1);

  const beliefs = createBeliefStore({ file: path.join(root, 'beliefs.json') });
  const b1 = beliefs.upsert({ subject: '周润程', predicate: '喜欢', object: '港片', confidence: 0.9, evidence: ['evt_1'], scope: 'private:1' });
  assert.equal(b1.status, 'supported');
  const b2 = beliefs.upsert({ subject: '周润程', predicate: '喜欢', object: '火锅', confidence: 0.6, evidence: ['evt_2'], scope: 'private:1' });
  assert.equal(b2.status, 'contested');
  assert.equal(beliefs.list({ subject: '周润程', scope: 'private:1' }).length, 2);
  const resolved = beliefs.resolve(b2.id, 'refuted', 'human');
  assert.equal(resolved.status, 'refuted');
  const scopeB = beliefs.upsert({ subject: '周润程', predicate: '喜欢', object: '港片', confidence: 0.9, scope: 'group:1' });
  assert.equal(scopeB.status, 'supported');
  assert.equal(beliefs.stats().total, 3);

  const mem2 = createMemoryStore({ file: path.join(root, 'memory.json') });
  assert.equal(mem2.get(inferred.id).status, 'active');
  assert.equal(mem2.get(observed.id).status, 'retracted');

  console.log(JSON.stringify({ ok: true, test: 'cognitive-p3', memory: mem.stats(), beliefs: beliefs.stats() }));
} finally {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
}
