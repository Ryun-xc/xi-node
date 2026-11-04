import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.mjs';

const seconds = Math.max(5, Number(process.env.XI_SOAK_SECONDS) || 15);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-soak-'));
const app = await startServer({ port: 0, dataDir });
const start = Date.now();
const latencies = [];
let failures = 0;
let count = 0;
try {
  while (Date.now() - start < seconds * 1000) {
    const t0 = performance.now();
    try {
      const res = await fetch(app.url + '/api/status');
      if (!res.ok) failures += 1;
      await res.text();
    } catch { failures += 1; }
    latencies.push(performance.now() - t0);
    count += 1;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  console.log(JSON.stringify({ ok: failures === 0, requests: count, failures, p95Ms: Number(p95.toFixed(1)), seconds }));
  if (failures) process.exitCode = 1;
} finally {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}