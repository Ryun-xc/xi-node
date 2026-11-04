#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCognitiveRuntime } from '../src/index.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-p9-'));
try {
  const state = path.join(root, 'state');
  fs.mkdirSync(state, { recursive: true });
  const graphFile = path.join(state, 'neural-graph.json');
  fs.writeFileSync(graphFile, JSON.stringify({ nodes: [{ id: 'old', type: 'fact', text: 'old' }], edges: [] }));
  const runtime = createCognitiveRuntime({ stateDir: state, syncGraph: true });
  const observed = await runtime.skillRuntime.execute('memory.write', {
    kind: 'semantic', scope: 'private:1', text: 'observed fact', source: 'user_message', evidence: ['evt_1'], confidence: 0.9, epistemic: 'observed',
  });
  assert.equal(observed.ok, true);
  assert.equal(observed.result.record.status, 'active');
  const graph = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
  assert.equal(graph.nodes.some((n) => n.id === `memory:${observed.result.record.id}`), true);
  const inferred = await runtime.skillRuntime.execute('memory.write', {
    kind: 'semantic', scope: 'private:1', text: 'inferred', source: 'model_inference', evidence: ['evt_2'], confidence: 0.8, epistemic: 'inferred',
  });
  assert.equal(inferred.result.record.status, 'pending');
  const graph2 = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
  assert.equal(graph2.nodes.some((n) => String(n.text).includes('inferred')), false);
  assert.equal(runtime.neuralIndex.remove(observed.result.record.id), true);
  const graph3 = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
  assert.equal(graph3.nodes.some((n) => n.id === 'old'), true);
  console.log(JSON.stringify({ ok: true, test: 'cognitive-p9', nodes: graph3.nodes.length }));
} finally {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
}
