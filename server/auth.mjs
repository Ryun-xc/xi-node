import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const COOKIE = 'xi_node_token';

function parseCookies(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createAuth({ dataDir, enabled = false, token = '' } = {}) {
  const tokenFile = path.join(dataDir, 'access-token');
  let value = String(token || process.env.XI_NODE_TOKEN || '');
  if (!enabled) return { enabled: false, token: '', tokenFile, authorized: () => true, validToken: () => false, setCookie: () => {}, clearCookie: () => {} };
  if (!value) {
    if (fs.existsSync(tokenFile)) value = fs.readFileSync(tokenFile, 'utf8').trim();
    if (!value) {
      value = crypto.randomBytes(32).toString('base64url');
      fs.writeFileSync(tokenFile, value + '\n', { encoding: 'utf8', mode: 0o600 });
    }
  }
  if (enabled && !fs.existsSync(tokenFile)) fs.writeFileSync(tokenFile, value + '\n', { encoding: 'utf8', mode: 0o600 });
  const fromRequest = (req) => {
    const header = String(req.headers.authorization || '');
    if (header.startsWith('Bearer ')) return header.slice(7).trim();
    return parseCookies(req.headers.cookie || '')[COOKIE] || '';
  };
  return {
    enabled: true,
    token: value,
    tokenFile,
    validToken(candidate) { return safeEqual(candidate, value); },
    authorized(req) { return safeEqual(fromRequest(req), value); },
    setCookie(res) { res.setHeader('set-cookie', `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict`); },
    clearCookie(res) { res.setHeader('set-cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`); },
  };
}