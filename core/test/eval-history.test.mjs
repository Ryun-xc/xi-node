#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCognitiveRuntime } from '../src/index.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-p10-'));
try {
  const runtime = createCognitiveRuntime({ stateDir: path.join(root, 'state') });
  const first = runtime.snapshotEval();
  const second = runtime.snapshotEval();
  assert.equal(first.score, 1);
  assert.equal(second.score, 1);
  const hist = runtime.readEvalHistory(10);
  assert.equal(hist.length, 2);
  assert.equal(hist[0].score, 1);
  console.log(JSON.stringify({ ok: true, test: 'cognitive-p10', history: hist.length, score: hist.at(-1).score }));
} finally {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
}
