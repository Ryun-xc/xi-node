import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const base = String(process.env.XI_NODE_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const dataDir = process.env.XI_NODE_DATA ? path.resolve(process.env.XI_NODE_DATA) : path.resolve('data');
let token = String(process.env.XI_NODE_TOKEN || '');
if (!token) {
  try { token = fs.readFileSync(path.join(dataDir, 'access-token'), 'utf8').trim(); } catch {}
}
const headers = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) };
async function api(pathname, options = {}) {
  const res = await fetch(base + pathname, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(15000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
const tools = [
  { name: 'xi_memory_query', description: 'Search local XI Node memory records', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'xi_goal_list', description: 'List XI Node goals and tasks', inputSchema: { type: 'object', properties: {} } },
  { name: 'xi_task_list', description: 'List XI Node tasks', inputSchema: { type: 'object', properties: {} } },
  { name: 'xi_timeline_read', description: 'Read recent XI Node timeline events', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'xi_knowledge_search', description: 'Search the local XI Node knowledge base', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } } },
];
function textResult(value) { return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }; }
function matches(item, query) {
  if (!query) return true;
  const q = String(query).toLowerCase();
  return JSON.stringify(item).toLowerCase().includes(q);
}
async function callTool(name, args = {}) {
  if (name === 'xi_memory_query') {
    const data = await api('/api/memory?limit=200');
    const items = (data.items || []).filter((item) => matches(item, args.query)).slice(0, Math.max(1, Math.min(50, Number(args.limit) || 10)));
    return textResult({ ok: true, items });
  }
  if (name === 'xi_goal_list') {
    const data = await api('/api/goals');
    return textResult({ ok: true, items: data.items || [] });
  }
  if (name === 'xi_task_list') {
    const data = await api('/api/tasks');
    return textResult({ ok: true, items: data.items || [] });
  }
  if (name === 'xi_timeline_read') {
    const limit = Math.max(1, Math.min(100, Number(args.limit) || 20));
    const data = await api(`/api/timeline?limit=${limit}`);
    return textResult({ ok: true, items: data.items || [] });
  }
  if (name === 'xi_knowledge_search') {
    const data = await api('/api/knowledge');
    const items = (data.items || []).filter((item) => matches(item, args.query)).slice(0, Math.max(1, Math.min(20, Number(args.limit) || 5)));
    return textResult({ ok: true, items });
  }
  throw new Error(`unknown tool: ${name}`);
}
function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }
function fail(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n'); }
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', async (line) => {
  let request;
  try { request = JSON.parse(line); } catch { fail(null, -32700, 'parse error'); return; }
  if (!request || request.jsonrpc !== '2.0' || request.id == null) return;
  try {
    if (request.method === 'initialize') return reply(request.id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'xi-node', version: '0.1.0' },
    });
    if (request.method === 'tools/list') return reply(request.id, { tools });
    if (request.method === 'tools/call') {
      const name = String(request.params?.name || '');
      const args = request.params?.arguments && typeof request.params.arguments === 'object' ? request.params.arguments : {};
      return reply(request.id, await callTool(name, args));
    }
    return fail(request.id, -32601, 'method not found');
  } catch (error) {
    return reply(request.id, { ...textResult({ ok: false, error: String(error?.message || error) }), isError: true });
  }
});