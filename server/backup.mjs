import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ITEMS = ['cognitive', 'settings.json', 'approvals.json'];
const SAFE_ID = /^[0-9TZ.\-]+$/;

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function hashTree(target) {
  const hash = crypto.createHash('sha256');
  const walk = (dir, prefix = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = path.join(prefix, entry.name);
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.isFile()) hash.update(rel).update('\0').update(fs.readFileSync(full)).update('\0');
    }
  };
  if (fs.statSync(target).isDirectory()) walk(target);
  else hash.update(fs.readFileSync(target));
  return hash.digest('hex');
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function createBackup(dataDir) {
  const id = stamp();
  const target = path.join(dataDir, 'backups', id);
  fs.mkdirSync(target, { recursive: true });
  const items = [];
  for (const name of ITEMS) {
    const source = path.join(dataDir, name);
    if (!fs.existsSync(source)) continue;
    const dest = path.join(target, name);
    fs.cpSync(source, dest, { recursive: true });
    items.push({ name, sha256: hashTree(dest) });
  }
  const manifest = { version: 1, id, createdAt: new Date().toISOString(), items };
  fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return { id, path: target, items };
}

export function listBackups(dataDir) {
  const root = path.join(dataDir, 'backups');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && SAFE_ID.test(entry.name))
    .map((entry) => {
      const manifestFile = path.join(root, entry.name, 'manifest.json');
      if (!fs.existsSync(manifestFile)) return null;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        return { id: manifest.id, createdAt: manifest.createdAt, items: (manifest.items || []).map((x) => x.name) };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function resolveBackup(dataDir, id) {
  if (!SAFE_ID.test(String(id || ''))) throw new Error('invalid backup id');
  const root = path.resolve(dataDir, 'backups');
  const target = path.resolve(root, String(id));
  if (target !== root && !target.startsWith(root + path.sep)) throw new Error('invalid backup path');
  if (!fs.existsSync(path.join(target, 'manifest.json'))) throw new Error('backup not found');
  return target;
}

export function restoreBackup(dataDir, id) {
  const target = resolveBackup(dataDir, id);
  const manifest = JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8'));
  const safety = createBackup(dataDir);
  const staging = path.join(dataDir, '.restore-' + id);
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  try {
    for (const item of manifest.items || []) {
      if (!ITEMS.includes(item.name)) continue;
      const source = path.join(target, item.name);
      if (!fs.existsSync(source)) continue;
      fs.cpSync(source, path.join(staging, item.name), { recursive: true });
    }
    for (const name of ITEMS) {
      const source = path.join(staging, name);
      if (!fs.existsSync(source)) continue;
      const dest = path.join(dataDir, name);
      fs.rmSync(dest, { recursive: true, force: true });
      fs.renameSync(source, dest);
    }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  return { restored: id, safetyBackup: safety.id, restartRequired: true };
}