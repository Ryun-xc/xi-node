import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readJson, atomicJson, clampText } from '../src/storage.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-storage-'));
const file = path.join(dir, 'state.json');
atomicJson(file, { a: 1 });
assert.deepEqual(readJson(file, null), { a: 1 });
fs.writeFileSync(file, '\uFEFF{"b":2}', 'utf8');
assert.deepEqual(readJson(file, null), { b: 2 });
fs.writeFileSync(file, '{ broken', 'utf8');
assert.deepEqual(readJson(file, { fallback: true }), { fallback: true });
assert.equal(clampText('abcdef', 3), 'abc…');
assert.equal(clampText('abc', 3), 'abc');
assert.equal(fs.readdirSync(dir).filter((name) => name.endsWith('.tmp')).length, 0);
console.log(JSON.stringify({ ok: true, test: 'storage' }));