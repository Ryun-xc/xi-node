#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tests = fs.readdirSync(here).filter((name) => name.endsWith('.test.mjs')).sort();
let failed = 0;
for (const name of tests) {
  const result = spawnSync(process.execPath, [path.join(here, name)], { stdio: 'inherit' });
  if (result.status !== 0) { failed += 1; console.error(`FAIL ${name}`); }
  else console.log(`PASS ${name}`);
}
console.log(JSON.stringify({ ok: failed === 0, total: tests.length, failed }));
process.exit(failed ? 1 : 0);