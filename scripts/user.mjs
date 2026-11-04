import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.argv[2] === '--data' ? process.argv[3] : 'data');
const command = process.argv[2] === '--data' ? process.argv[4] : process.argv[2];
const name = process.argv[2] === '--data' ? process.argv.slice(5).join(' ') : process.argv.slice(3).join(' ');
const file = path.join(dataDir, 'users.json');
function read() { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { version: 1, users: [] }; } }
function write(value) { fs.mkdirSync(dataDir, { recursive: true }); const temp = file + '.tmp'; fs.writeFileSync(temp, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 }); fs.renameSync(temp, file); }
const db = read();
if (!Array.isArray(db.users)) db.users = [];
if (command === 'add' && !db.users.some((user) => user.dir === '.')) {
  let ownerToken = '';
  const ownerFile = path.join(dataDir, 'access-token');
  if (fs.existsSync(ownerFile)) ownerToken = fs.readFileSync(ownerFile, 'utf8').trim();
  if (!ownerToken) { ownerToken = crypto.randomBytes(32).toString('base64url'); fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(ownerFile, ownerToken + '\n', { encoding: 'utf8', mode: 0o600 }); }
  db.users.unshift({ id: 'owner', name: 'Owner', token: ownerToken, dir: '.' });
}
if (command === 'list') {
  console.log(JSON.stringify(db.users.map((u) => ({ id: u.id, name: u.name, dir: u.dir })), null, 2));
  process.exit(0);
}
if (command !== 'add') {
  console.error('usage: node scripts/user.mjs --data data add "Name" | list');
  process.exit(1);
}
if (!name.trim()) { console.error('name required'); process.exit(1); }
const id = 'u_' + crypto.randomBytes(6).toString('hex');
const token = crypto.randomBytes(32).toString('base64url');
const dir = path.join('users', id);
fs.mkdirSync(path.join(dataDir, dir), { recursive: true });
fs.writeFileSync(path.join(dataDir, dir, 'access-token'), token + '\n', { encoding: 'utf8', mode: 0o600 });
db.users.push({ id, name: name.trim(), token, dir });
write(db);
console.log(JSON.stringify({ ok: true, id, name: name.trim(), dataDir: path.join(dataDir, dir), token }, null, 2));
console.log('Restart the multi-user gateway to load this user.');