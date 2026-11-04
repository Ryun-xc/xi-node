import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSecretStore } from '../server/secret-store.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-secret-'));
try {
  const store = createSecretStore({ dataDir });
  store.set('test-only-secret');
  assert.equal(store.get(), 'test-only-secret');
  const raw = fs.readFileSync(path.join(dataDir, 'model-secret.json'), 'utf8');
  if (process.platform === 'win32') assert.equal(raw.includes('test-only-secret'), false, 'secret must not be stored as plaintext');
  else assert.equal(JSON.parse(raw).protection, 'file');
  const reloaded = createSecretStore({ dataDir });
  assert.equal(reloaded.get(), 'test-only-secret');
  store.clear();
  assert.equal(store.get(), '');
  console.log(JSON.stringify({ ok: true, test: 'secret-store' }));
} finally {
  fs.rmSync(dataDir, { recursive: true, force: true });
}