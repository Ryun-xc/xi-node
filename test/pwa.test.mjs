import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-pwa-'));
const app = await startServer({ port: 0, dataDir });
try {
  for (const [file, type] of [['/manifest.webmanifest', /manifest\+json/], ['/sw.js', /javascript/], ['/icon.svg', /svg/]]) {
    const res = await fetch(app.url + file);
    assert.equal(res.status, 200, file);
    assert.match(res.headers.get('content-type') || '', type, file);
  }
  console.log(JSON.stringify({ ok: true, test: 'pwa' }));
} finally {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}