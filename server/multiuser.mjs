import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const get = (name, fallback = '') => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const dataDir = path.resolve(get('--data', path.join(__dirname, '..', 'data')));
const port = Number(get('--port', process.env.XI_NODE_PORT || 8787));
const host = String(get('--host', process.env.XI_NODE_HOST || '127.0.0.1'));
const usersFile = path.join(dataDir, 'users.json');

fs.mkdirSync(dataDir, { recursive: true });
function readUsers() {
  try { const parsed = JSON.parse(fs.readFileSync(usersFile, 'utf8')); return Array.isArray(parsed.users) ? parsed.users : []; }
  catch { return []; }
}
function writeUsers(users) {
  const temp = usersFile + '.tmp';
  fs.writeFileSync(temp, JSON.stringify({ version: 1, users }, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, usersFile);
}
function ensureOwner() {
  let users = readUsers();
  if (!users.some((user) => user.dir === '.')) {
    let token = '';
    const tokenFile = path.join(dataDir, 'access-token');
    if (fs.existsSync(tokenFile)) token = fs.readFileSync(tokenFile, 'utf8').trim();
    if (!token) { token = crypto.randomBytes(32).toString('base64url'); fs.writeFileSync(tokenFile, token + '\n', { encoding: 'utf8', mode: 0o600 }); }
    users.unshift({ id: 'owner', name: 'Owner', token, dir: '.' });
    writeUsers(users);
  }
  for (const user of users) if (!fs.existsSync(path.join(dataDir, user.dir === '.' ? '' : user.dir))) fs.mkdirSync(path.join(dataDir, user.dir), { recursive: true });
  return users;
}
function tokens(users) {
  const map = new Map();
  for (const user of users) if (user.token) map.set(String(user.token), user);
  return map;
}
function readToken(req) {
  const header = String(req.headers.authorization || '');
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  const cookies = String(req.headers.cookie || '');
  for (const part of cookies.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === 'xi_node_token') return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}
const users = ensureOwner();
const byToken = tokens(users);
const apps = [];
for (const user of users) {
  const app = await startServer({ port: 0, host: '127.0.0.1', dataDir: path.resolve(dataDir, user.dir), auth: false });
  const target = new URL(app.url);
  apps.push({ user, app, port: Number(target.port) });
}
const defaultApp = apps[0];
function proxy(req, res, target) {
  const proxyReq = http.request({ hostname: '127.0.0.1', port: target.port, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${target.port}`, connection: 'close' } }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'upstream unavailable' })); });
  req.pipe(proxyReq);
}
function send(res, status, body) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); }
function readBody(req) { return new Promise((resolve, reject) => { let text = ''; req.on('data', (chunk) => { text += chunk; if (text.length > 1024 * 1024) reject(new Error('request too large')); }); req.on('end', () => { try { resolve(text ? JSON.parse(text) : {}); } catch { reject(new Error('invalid json')); } }); req.on('error', reject); }); }
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;
  const token = readToken(req);
  if (pathname === '/' && url.searchParams.get('token') && byToken.has(url.searchParams.get('token'))) {
    res.writeHead(302, { 'set-cookie': `xi_node_token=${encodeURIComponent(url.searchParams.get('token'))}; Path=/; HttpOnly; SameSite=Strict`, location: '/' });
    res.end();
    return;
  }
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (!byToken.has(String(body.token || ''))) return send(res, 401, { ok: false, error: 'invalid token' });
      res.setHeader('set-cookie', `xi_node_token=${encodeURIComponent(body.token)}; Path=/; HttpOnly; SameSite=Strict`);
      return send(res, 200, { ok: true });
    } catch { return send(res, 400, { ok: false, error: 'invalid json' }); }
  }
  if (pathname === '/api/auth/status') return send(res, 200, { ok: true, enabled: true, authenticated: Boolean(byToken.get(token)) });
  if (pathname === '/api/health') return proxy(req, res, defaultApp);
  if (pathname.startsWith('/api/') && !byToken.get(token)) return send(res, 401, { ok: false, error: 'authentication required' });
  const current = byToken.get(token) || defaultApp.user;
  const target = apps.find((x) => x.user.id === current.id) || defaultApp;
  return proxy(req, res, target);
});
server.listen(port, host, () => {
  console.log(`XI Node multi-user gateway: http://${host}:${port}`);
  console.log(`users: ${users.map((u) => u.name).join(', ')}`);
  for (const user of users) console.log(`token file: ${path.join(dataDir, user.dir === '.' ? '' : user.dir, 'access-token')}`);
});
const stop = async () => { await Promise.all(apps.map((x) => x.app.close())); server.close(() => process.exit(0)); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);