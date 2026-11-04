// Shared persistence helpers. Keep atomic JSON writes in one place.
import fs from 'node:fs';
import path from 'node:path';

let writeSequence = 0;

/** Read JSON, returning fallback on missing/corrupt/BOM-prefixed files. */
export function readJson(file, fallback) {
  try {
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/** Atomically replace a JSON file using a same-directory temp file + rename. */
export function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeSequence += 1;
  const tmp = `${file}.${process.pid}.${Date.now()}.${writeSequence}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

/** Truncate text to a maximum length, appending an ellipsis when needed. */
export function clampText(value, max = 4000) {
  const text = String(value ?? '');
  return text.length > max ? text.slice(0, max) + '…' : text;
}

/** Default clock, kept injectable in every store. */
export function nowDefault() {
  return Date.now();
}