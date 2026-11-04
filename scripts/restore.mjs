import path from 'node:path';
import { listBackups, restoreBackup } from '../server/backup.mjs';

const args = process.argv.slice(2);
const get = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : ''; };
const dataDir = path.resolve(get('--data') || 'data');
const id = get('--id') || '';
if (!id) {
  console.log(JSON.stringify({ ok: true, dataDir, backups: listBackups(dataDir) }, null, 2));
  process.exit(0);
}
try {
  const result = restoreBackup(dataDir, id);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  console.log('Restart XI Node before using the restored state.');
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }));
  process.exit(1);
}