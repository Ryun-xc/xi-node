// XI Node v1 prototype: local HTTP + xi-core, no external dependencies.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createCognitiveRuntime } from './core/src/index.mjs';
import { readJson, atomicJson } from './core/src/storage.mjs';
import { createModelClient } from './server/model.mjs';
import { createBackup, listBackups, restoreBackup, resolveBackup } from './server/backup.mjs';
import { createAuth } from './server/auth.mjs';
import { createSecretStore } from './server/secret-store.mjs';
import { createChatStore } from './server/chat-store.mjs';
import { createKnowledgeStore } from './server/knowledge-store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(__dirname, 'web');
const VERSION = '0.1.0';
const READONLY_SKILLS = new Set(['memory.query', 'goal.list', 'task.list', 'timeline.read', 'eval.read']);
const APPROVABLE_SKILLS = new Set([...READONLY_SKILLS, 'workspace.write']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(text);
}

function sendText(res, status, text) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error('request too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

function normalizeSettings(input = {}) {
  const model = input.model && typeof input.model === 'object' ? input.model : {};
  const memory = input.memory && typeof input.memory === 'object' ? input.memory : {};
  const privacy = input.privacy && typeof input.privacy === 'object' ? input.privacy : {};
  return {
    initialized: input.initialized === true,
    model: {
      provider: String(model.provider || 'mock'),
      model: String(model.model || 'mock-architect'),
      baseUrl: String(model.baseUrl || '').slice(0, 500),
    },
    memory: {
      enabled: memory.enabled !== false,
      requireReview: memory.requireReview !== false,
    },
    privacy: { telemetry: privacy.telemetry === true },
    updatedAt: Date.now(),
  };
}

function safeName(value, max = 200) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
}

function createApprovalStore({ file = null } = {}) {
  let items = file ? readJson(file, []) : [];
  if (!Array.isArray(items)) items = [];
  const save = () => { if (file) atomicJson(file, items); };
  return {
    list: () => items.slice(),
    create({ title, detail = '', risk = 'medium', skill = '', input = {} } = {}) {
      const item = {
        id: `ap_${crypto.randomUUID()}`,
        title: safeName(title, 160) || '等待确认的动作',
        detail: safeName(detail, 1000),
        skill: APPROVABLE_SKILLS.has(String(skill)) ? String(skill) : '',
        input: input && typeof input === 'object' ? input : {},
        risk: ['low', 'medium', 'high'].includes(risk) ? risk : 'medium',
        status: 'pending',
        createdAt: Date.now(),
      };
      items.push(item);
      save();
      return item;
    },
    resolve(id, status, { result = null } = {}) {
      const item = items.find((x) => x.id === id);
      if (!item || item.status !== 'pending') return null;
      item.status = status;
      item.resolvedAt = Date.now();
      if (result != null) item.result = result;
      save();
      return item;
    },
  };
}

export async function startServer({ port = 8787, host = '127.0.0.1', dataDir = path.join(__dirname, 'data'), auth = false, authToken = '' } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const authState = createAuth({ dataDir, enabled: auth, token: authToken });
  const settingsFile = path.join(dataDir, 'settings.json');
  const secretStore = createSecretStore({ dataDir });
  let settings = normalizeSettings(readJson(settingsFile, {}));
  const getApiKey = () => String(process.env.XI_MODEL_API_KEY || secretStore.get());
  const modelClient = createModelClient({ getSettings: () => settings, getApiKey });
  const runtime = createCognitiveRuntime({ stateDir: dataDir, syncGraph: false });
  runtime.skills.register({
    name: 'workspace.write',
    description: 'write a file inside the local workspace after explicit approval',
    risk: 'medium',
    sideEffect: 'local',
    requiresConfirmation: true,
    handler: (input = {}) => {
      const name = String(input.name || '').trim();
      if (!/^[a-zA-Z0-9._-]{1,120}$/.test(name)) return { ok: false, error: 'invalid workspace file name' };
      const content = String(input.content || '').slice(0, 100000);
      const dir = path.join(dataDir, 'workspace');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, name);
      fs.writeFileSync(file, content, 'utf8');
      return { ok: true, path: file, bytes: Buffer.byteLength(content) };
    },
  });
  const chatStore = createChatStore({ file: path.join(dataDir, 'conversations.json') });
  const knowledgeStore = createKnowledgeStore({ file: path.join(dataDir, 'knowledge.json') });
  if (chatStore.count() === 0) {
    const recovered = runtime.memory.list({ limit: 200, status: 'active' })
      .filter((m) => m.provenance?.source === 'user_message')
      .slice(-100);
    for (const memory of recovered) chatStore.append({ role: 'user', text: memory.text, at: memory.createdAt });
  }
  const approvals = createApprovalStore({ file: path.join(dataDir, 'approvals.json') });
  const viewSettings = () => ({ ...settings, model: { ...settings.model, apiKeySet: Boolean(getApiKey()) } });

  function recallMemories(message, limit = 4) {
    const text = String(message || '').toLowerCase();
    const terms = new Set(text.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length >= 2));
    for (const run of text.match(/[\u4e00-\u9fff]+/g) || []) {
      for (let i = 0; i < run.length - 1; i += 1) terms.add(run.slice(i, i + 2));
    }
    return runtime.memory.list({ limit: 500, status: 'active' })
      .map((item) => {
        const body = String(item.text || '').toLowerCase();
        let score = 0;
        for (const term of terms) if (body.includes(term)) score += Math.min(4, term.length);
        return { item, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.item);
  }

  function buildChatMessages(message) {
    const recalled = recallMemories(message);
    const memoryBlock = recalled.length
      ? '\n\n相关记忆（只作参考，不要编造，也不要声称已执行）：\n' + recalled.map((m) => `- [${m.provenance?.source || 'memory'}] ${m.text}`).join('\n')
      : '';
    const knowledge = knowledgeStore.search(message, { limit: 3 });
    const knowledgeBlock = knowledge.length
      ? '\n\n本地知识库片段（只作参考，引用时说明来源标题）：\n' + knowledge.map((x) => `- [${x.item.title}] ${x.item.text.slice(0, 1200)}`).join('\n')
      : '';
    return [
      { role: 'system', content: '你是 XI Architect。先理解意图，再给出可验证的下一步。不要声称执行了没有执行的动作。' + memoryBlock + knowledgeBlock },
      { role: 'user', content: message },
    ];
  }

  function saveSettings(next) {
    settings = normalizeSettings({ ...settings, ...next });
    atomicJson(settingsFile, settings);
    return settings;
  }

  function overview() {
    const health = runtime.health();
    const goals = runtime.listGoals({});
    const tasks = runtime.listTasks({});
    return {
      ok: true,
      version: VERSION,
      settings: viewSettings(),
      health,
      counts: {
        goals: goals.length,
        activeGoals: goals.filter((g) => g.status === 'active').length,
        tasks: tasks.length,
        openTasks: tasks.filter((t) => ['pending', 'running', 'blocked'].includes(t.status)).length,
        pendingMemory: runtime.memory.stats().pending,
        events: health.events?.events || 0,
      },
      approvals: approvals.list().filter((x) => x.status === 'pending').length,
    };
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
      const pathname = decodeURIComponent(url.pathname);
      const method = req.method || 'GET';

      if (authState.enabled && pathname === '/' && url.searchParams.get('token') && authState.validToken(url.searchParams.get('token'))) {
        authState.setCookie(res);
        res.writeHead(302, { location: '/' });
        return res.end();
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        try {
          const body = await readBody(req);
          if (!authState.validToken(String(body.token || ''))) return sendJson(res, 401, { ok: false, error: 'invalid token' });
          authState.setCookie(res);
          return sendJson(res, 200, { ok: true });
        } catch (error) { return sendJson(res, 400, { ok: false, error: String(error?.message || error) }); }
      }
      if (pathname === '/api/auth/status' && method === 'GET') return sendJson(res, 200, { ok: true, enabled: authState.enabled, authenticated: authState.authorized(req) });

      if (authState.enabled && pathname.startsWith('/api/') && pathname !== '/api/health' && !authState.authorized(req)) {
        return sendJson(res, 401, { ok: false, error: 'authentication required' });
      }

      if (pathname === '/api/status' && method === 'GET') return sendJson(res, 200, overview());
      if (pathname === '/api/health' && method === 'GET') return sendJson(res, 200, { ok: true, health: runtime.health() });

      if (pathname === '/api/goals' && method === 'GET') return sendJson(res, 200, { ok: true, items: runtime.listGoals({}) });
      if (pathname === '/api/goals' && method === 'POST') {
        const body = await readBody(req);
        const goal = runtime.createGoal({
          title: safeName(body.title, 240) || '未命名目标',
          why: safeName(body.why, 1200),
          scope: body.scope ? safeName(body.scope, 120) : null,
          successCriteria: Array.isArray(body.successCriteria) ? body.successCriteria.map((x) => safeName(x, 300)) : [],
        });
        return sendJson(res, 201, { ok: true, item: goal });
      }
      const goalRun = pathname.match(/^\/api\/goals\/([^/]+)\/run$/);
      if (goalRun && method === 'POST') {
        const result = await runtime.runReadonlyGoal(goalRun[1], { maxSteps: 20 });
        return sendJson(res, result.ok ? 200 : 400, result);
      }

      if (pathname === '/api/tasks' && method === 'GET') return sendJson(res, 200, { ok: true, items: runtime.listTasks({}) });
      if (pathname === '/api/tasks' && method === 'POST') {
        const body = await readBody(req);
        if (!body.goalId) return sendJson(res, 400, { ok: false, error: 'goalId required' });
        if (!runtime.getGoal(String(body.goalId))) return sendJson(res, 400, { ok: false, error: 'goal not found' });
        if (!READONLY_SKILLS.has(String(body.skill || ''))) return sendJson(res, 400, { ok: false, error: 'only readonly skills are available in v1' });
        const task = runtime.addTask({
          goalId: String(body.goalId),
          title: safeName(body.title, 240) || '未命名任务',
          skill: String(body.skill),
          input: body.input && typeof body.input === 'object' ? body.input : {},
          dependsOn: Array.isArray(body.dependsOn) ? body.dependsOn.map(String) : [],
        });
        return sendJson(res, 201, { ok: true, item: task });
      }

      if (pathname === '/api/memory' && method === 'GET') {
        const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit')) || 100));
        return sendJson(res, 200, { ok: true, items: runtime.memory.list({ limit }), stats: runtime.memory.stats() });
      }
      if (pathname === '/api/memory' && method === 'POST') {
        const body = await readBody(req);
        const inferred = body.epistemic === 'inferred';
        const record = runtime.memory.write({
          kind: body.kind || 'episodic',
          scope: body.scope || 'local',
          text: safeName(body.text, 4000),
          source: inferred ? 'model_inference' : 'user_message',
          epistemic: inferred ? 'inferred' : 'observed',
          reviewRequired: inferred ? true : null,
          confidence: inferred ? 0.55 : 1,
        });
        return sendJson(res, 201, { ok: true, item: record });
      }
      const memoryReview = pathname.match(/^\/api\/memory\/([^/]+)\/(approve|reject|retract)$/);
      if (memoryReview && method === 'POST') {
        const [, id, action] = memoryReview;
        const item = action === 'approve' ? runtime.memory.approve(id, 'local-user')
          : action === 'reject' ? runtime.memory.reject(id, 'local-user')
            : runtime.memory.retract(id, 'local-user');
        if (!item) return sendJson(res, 404, { ok: false, error: 'memory not found' });
        return sendJson(res, 200, { ok: true, item });
      }

      if (pathname === '/api/timeline' && method === 'GET') {
        const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit')) || 80));
        return sendJson(res, 200, { ok: true, items: runtime.timeline({ limit }) });
      }
      if (pathname === '/api/eval' && method === 'GET') return sendJson(res, 200, { ok: true, evaluation: runtime.evaluate() });
      if (pathname === '/api/eval/history' && method === 'GET') return sendJson(res, 200, { ok: true, items: runtime.readEvalHistory(30) });

      if (pathname === '/api/approvals' && method === 'GET') return sendJson(res, 200, { ok: true, items: approvals.list() });
      if (pathname === '/api/approvals' && method === 'POST') {
        const body = await readBody(req);
        if (body.skill && !APPROVABLE_SKILLS.has(String(body.skill))) return sendJson(res, 400, { ok: false, error: 'skill cannot be approved' });
        const item = approvals.create({ title: body.title, detail: body.detail, risk: body.risk, skill: body.skill, input: body.input });
        return sendJson(res, 201, { ok: true, item });
      }
      const approvalResolve = pathname.match(/^\/api\/approvals\/([^/]+)\/(approve|reject)$/);
      if (approvalResolve && method === 'POST') {
        const existing = approvals.list().find((x) => x.id === approvalResolve[1]);
        if (!existing || existing.status !== 'pending') return sendJson(res, 404, { ok: false, error: 'approval not found' });
        let result = null;
        if (approvalResolve[2] === 'approve' && existing.skill) {
          result = await runtime.skillRuntime.execute(existing.skill, existing.input || {}, existing.skill === 'workspace.write' ? { mode: 'approved', approved: true, scope: 'local' } : { mode: 'readonly', scope: 'local' });
        }
        const item = approvals.resolve(approvalResolve[1], approvalResolve[2] === 'approve' ? 'approved' : 'rejected', { result });
        return sendJson(res, 200, { ok: true, item, result });
      }

      if (pathname === '/api/settings' && method === 'GET') return sendJson(res, 200, { ok: true, settings: viewSettings() });
      if (pathname === '/api/settings' && method === 'PUT') {
        const body = await readBody(req);
        const model = body.model && typeof body.model === 'object' ? body.model : {};
        if (model.clearApiKey === true) { secretStore.clear(); }
        if (typeof model.apiKey === 'string' && model.apiKey.trim()) { secretStore.set(model.apiKey.trim()); }
        if (model.apiKey != null || model.clearApiKey != null) { delete model.apiKey; delete model.clearApiKey; }
        saveSettings({ ...body, model });
        return sendJson(res, 200, { ok: true, settings: viewSettings() });
      }
      if (pathname === '/api/model/test' && method === 'POST') {
        try {
          const body = await readBody(req);
          const model = body.model && typeof body.model === 'object' ? body.model : {};
          const testClient = createModelClient({
            getSettings: () => ({ ...settings, model: { ...settings.model, ...model } }),
            getApiKey: () => String(model.apiKey || getApiKey()),
          });
          return sendJson(res, 200, { ok: true, result: await testClient.test() });
        } catch (error) { return sendJson(res, 502, { ok: false, error: String(error?.message || error) }); }
      }

      if (pathname === '/api/knowledge' && method === 'GET') return sendJson(res, 200, { ok: true, items: knowledgeStore.list({ limit: 200 }), count: knowledgeStore.count() });
      if (pathname === '/api/knowledge' && method === 'POST') {
        const body = await readBody(req);
        try { return sendJson(res, 201, { ok: true, item: knowledgeStore.add({ title: body.title, text: body.text, source: body.source }) }); }
        catch (error) { return sendJson(res, 400, { ok: false, error: String(error?.message || error) }); }
      }
      const knowledgeDelete = pathname.match(/^\/api\/knowledge\/([^/]+)$/);
      if (knowledgeDelete && method === 'DELETE') {
        const removed = knowledgeStore.remove(knowledgeDelete[1]);
        return sendJson(res, removed ? 200 : 404, { ok: removed });
      }

      if (pathname === '/api/chat/history' && method === 'GET') {
        const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit')) || 100));
        return sendJson(res, 200, { ok: true, items: chatStore.list({ limit }) });
      }
      if (pathname === '/api/chat/history' && method === 'DELETE') {
        chatStore.clear();
        return sendJson(res, 200, { ok: true });
      }

      if (pathname === '/api/chat/propose' && method === 'POST') {
        const body = await readBody(req);
        const message = safeName(body.message, 6000);
        if (!message) return sendJson(res, 400, { ok: false, error: 'message required' });
        try { return sendJson(res, 200, await modelClient.propose({ message })); }
        catch (error) { return sendJson(res, 502, { ok: false, error: String(error?.message || error) }); }
      }

      if (pathname === '/api/chat/stream' && method === 'POST') {
        const body = await readBody(req);
        const message = safeName(body.message, 6000);
        if (!message) return sendJson(res, 400, { ok: false, error: 'message required' });
        if (settings.memory?.enabled !== false) {
          try { runtime.memory.write({ kind: 'episodic', scope: 'local', text: message, source: 'user_message', epistemic: 'observed', confidence: 1 }); }
          catch (error) { console.error('[memory] auto capture failed', error?.message || error); }
        }
        chatStore.append({ role: 'user', text: message });
        res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
        const sendEvent = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
        let full = '';
        try {
          const cfg = modelClient.current();
          for await (const chunk of modelClient.streamChat(buildChatMessages(message))) {
            full += chunk;
            sendEvent({ delta: chunk });
          }
          if (!full.trim()) throw new Error('模型返回为空');
          const reply = full.replace(/<\/?[^>]+>/g, '');
          chatStore.append({ role: 'assistant', text: reply, provider: cfg.provider, model: cfg.model });
          sendEvent({ done: true, reply, provider: cfg.provider, model: cfg.model });
        } catch (error) {
          sendEvent({ error: String(error?.message || error) });
        } finally {
          res.end();
        }
        return;
      }

      if (pathname === '/api/chat' && method === 'POST') {
        const body = await readBody(req);
        const message = safeName(body.message, 6000);
        if (!message) return sendJson(res, 400, { ok: false, error: 'message required' });
        if (settings.memory?.enabled !== false) {
          try {
            runtime.memory.write({ kind: 'episodic', scope: 'local', text: message, source: 'user_message', epistemic: 'observed', confidence: 1 });
          } catch (error) { console.error('[memory] auto capture failed', error?.message || error); }
        }
        chatStore.append({ role: 'user', text: message });
        try {
          const result = await modelClient.chat(buildChatMessages(message));
          const reply = String(result.reply || '').replace(/<\/?[^>]+>/g, '');
          chatStore.append({ role: 'assistant', text: reply, provider: result.provider, model: result.model });
          return sendJson(res, 200, { ...result, reply, suggestions: ['创建一个目标', '看看记忆', '打开审批中心'] });
        } catch (error) {
          return sendJson(res, 502, { ok: false, error: String(error?.message || error) });
        }
      }

      if (pathname === '/api/backup' && method === 'POST') {
        const backup = createBackup(dataDir);
        return sendJson(res, 200, { ok: true, path: backup.path, id: backup.id });
      }

      if (pathname === '/api/backups' && method === 'GET') {
        return sendJson(res, 200, { ok: true, items: listBackups(dataDir) });
      }

      if (pathname === '/api/restore' && method === 'POST') {
        const body = await readBody(req);
        try {
          resolveBackup(dataDir, body.id);
          const result = restoreBackup(dataDir, body.id);
          return sendJson(res, 200, { ok: true, ...result });
        } catch (error) {
          return sendJson(res, 400, { ok: false, error: String(error?.message || error) });
        }
      }

      if (pathname.startsWith('/api/')) return sendJson(res, 404, { ok: false, error: 'not found' });

      let filePath = path.resolve(WEB_DIR, '.' + pathname);
      if (filePath !== WEB_DIR && !filePath.startsWith(WEB_DIR + path.sep)) return sendText(res, 403, 'forbidden');
      if (pathname === '/' || pathname === '') filePath = path.join(WEB_DIR, 'index.html');
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(WEB_DIR, 'index.html');
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-cache' });
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      const status = /json|required|too large/.test(String(error?.message)) ? 400 : 500;
      sendJson(res, status, { ok: false, error: status === 400 ? String(error.message) : 'internal error' });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
  const address = server.address();
  return {
    server,
    runtime,
    settings,
    dataDir,
    authEnabled: authState.enabled,
    authTokenFile: authState.tokenFile,
    url: `http://${host}:${address.port}`,
    async close() { await new Promise((resolve) => server.close(resolve)); },
  };
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  const port = Number(process.env.XI_NODE_PORT || 8787);
  const host = String(process.env.XI_NODE_HOST || '127.0.0.1');
  const dataDir = process.env.XI_NODE_DATA ? path.resolve(process.env.XI_NODE_DATA) : path.join(__dirname, 'data');
  const auth = String(process.env.XI_NODE_AUTH || 'on') !== 'off';
  const app = await startServer({ port, host, dataDir, auth });
  if (app.authEnabled) console.log(`access token file: ${app.authTokenFile}`);
  console.log(`XI Node listening on ${app.url}`);
  console.log(`data: ${app.dataDir}`);
  const stop = async () => { await app.close(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}