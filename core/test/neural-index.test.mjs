#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createNeuralIndex } from '../src/neural-index.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-neural-'));
try {
  const file = path.join(root, 'graph.json');
  fs.writeFileSync(file, JSON.stringify({ nodes: [{ id: 'old', type: 'fact', text: 'old' }], edges: [] }));
  const index = createNeuralIndex({ file });
  const pending = index.upsert({ id: 'm1', kind: 'semantic', scope: 'private:1', text: 'pending', status: 'pending', provenance: { epistemic: 'inferred' } });
  assert.equal(pending, null);
  const active = index.upsert({ id: 'm2', kind: 'semantic', scope: 'private:1', text: 'observed', status: 'active', provenance: { epistemic: 'observed', confidence: 0.9, evidence: ['evt'] } });
  assert.equal(active.id, 'memory:m2');
  assert.equal(index.list().length, 1);
  index.upsert({ id: 'm2', kind: 'semantic', scope: 'private:1', text: 'updated', status: 'active', provenance: { epistemic: 'observed', confidence: 0.9, evidence: ['evt'] } });
  assert.equal(index.list().length, 1);
  assert.equal(index.list()[0].text, 'updated');
  assert.equal(index.remove('m2'), true);
  assert.equal(index.list().length, 0);
  const graph = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(graph.nodes.some((n) => n.id === 'old'), true);
  console.log(JSON.stringify({ ok: true, test: 'cognitive-p3-neural', nodes: graph.nodes.length }));
} finally {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
}
