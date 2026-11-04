// Provider-neutral model client. No SDK; fetch only.
const DEFAULT_OPENAI_BASE = 'https://api.openai.com/v1';
const DEFAULT_OLLAMA_BASE = 'http://127.0.0.1:11434';

function trimBase(value, fallback) {
  return String(value || fallback).replace(/\/+$/, '');
}

function openAiEndpoint(baseUrl) {
  const base = trimBase(baseUrl, DEFAULT_OPENAI_BASE);
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}

function ollamaEndpoint(baseUrl) {
  const base = trimBase(baseUrl, DEFAULT_OLLAMA_BASE);
  return /\/api\/chat$/i.test(base) ? base : `${base}/api/chat`;
}

function cleanError(value, fallback = '模型请求失败') {
  const text = String(value || fallback).replace(/\s+/g, ' ').trim();
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

async function readError(res) {
  const text = await res.text().catch(() => '');
  try {
    const body = JSON.parse(text);
    return cleanError(body?.error?.message || body?.error || body?.message || text || `HTTP ${res.status}`);
  } catch {
    return cleanError(text || `HTTP ${res.status}`);
  }
}

export function createModelClient({ getSettings, getApiKey, fetchImpl = fetch } = {}) {
  if (typeof getSettings !== 'function') throw new Error('getSettings required');

  function current() {
    const settings = getSettings() || {};
    const model = settings.model || {};
    return {
      provider: String(model.provider || 'mock'),
      model: String(model.model || 'mock-architect'),
      baseUrl: String(model.baseUrl || ''),
      apiKey: String(getApiKey?.() || ''),
      timeoutMs: Math.max(3000, Math.min(60000, Number(model.timeoutMs) || 20000)),
    };
  }

  async function test() {
    const cfg = current();
    const started = Date.now();
    if (cfg.provider === 'mock') return { ok: true, provider: 'mock', model: cfg.model, latencyMs: Date.now() - started };
    if (!cfg.apiKey && cfg.provider === 'openai') throw new Error('缺少 API Key');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      if (cfg.provider === 'ollama') {
        const res = await fetchImpl(`${trimBase(cfg.baseUrl, DEFAULT_OLLAMA_BASE)}/api/tags`, { signal: controller.signal });
        if (!res.ok) throw new Error(await readError(res));
        return { ok: true, provider: 'ollama', model: cfg.model, latencyMs: Date.now() - started };
      }
      const base = trimBase(cfg.baseUrl, DEFAULT_OPENAI_BASE);
      const res = await fetchImpl(`${base}/models`, {
        headers: cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {},
        signal: controller.signal,
      });
      if (res.ok) return { ok: true, provider: 'openai', model: cfg.model, latencyMs: Date.now() - started };
      if (res.status !== 404 && res.status !== 405) throw new Error(await readError(res));
      // Some compatible servers do not expose /models; try a tiny chat call.
      await chat([{ role: 'user', content: 'ping' }], { maxTokens: 1 });
      return { ok: true, provider: 'openai', model: cfg.model, latencyMs: Date.now() - started };
    } finally { clearTimeout(timer); }
  }

  async function chat(messages = [], { maxTokens = 800, temperature = 0.4 } = {}) {
    const cfg = current();
    if (cfg.provider === 'mock') {
      const last = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
      return { ok: true, provider: 'mock', model: cfg.model, reply: `我听到了。\n\n你刚才说：${String(last).slice(0, 1200)}\n\n当前是 Mock 模式。配置真实 Provider 后，这里会交给模型处理，但目标和审批仍由 XI Core 控制。` };
    }
    if (cfg.provider === 'openai' && !cfg.apiKey) throw new Error('缺少 API Key：请在设置中填写，或设置 XI_MODEL_API_KEY');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const isOllama = cfg.provider === 'ollama';
      const endpoint = isOllama ? ollamaEndpoint(cfg.baseUrl) : openAiEndpoint(cfg.baseUrl);
      const body = isOllama
        ? { model: cfg.model, messages, stream: false, options: { temperature } }
        : { model: cfg.model, messages, stream: false, temperature, max_tokens: Math.max(1, Number(maxTokens) || 800) };
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}) },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      const reply = isOllama ? data?.message?.content : data?.choices?.[0]?.message?.content;
      if (!reply || typeof reply !== 'string') throw new Error('模型返回为空');
      return { ok: true, provider: cfg.provider, model: cfg.model, reply };
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('模型请求超时');
      throw error;
    } finally { clearTimeout(timer); }
  }

  async function* streamChat(messages = [], { maxTokens = 800, temperature = 0.4 } = {}) {
    const cfg = current();
    if (cfg.provider === 'mock') {
      const result = await chat(messages, { maxTokens, temperature });
      const text = String(result.reply || '');
      for (let i = 0; i < text.length; i += 80) {
        yield text.slice(i, i + 80);
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
      return;
    }
    if (cfg.provider === 'openai' && !cfg.apiKey) throw new Error('缺少 API Key：请在设置中填写，或设置 XI_MODEL_API_KEY');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const isOllama = cfg.provider === 'ollama';
      const endpoint = isOllama ? ollamaEndpoint(cfg.baseUrl) : openAiEndpoint(cfg.baseUrl);
      const body = isOllama
        ? { model: cfg.model, messages, stream: true, options: { temperature } }
        : { model: cfg.model, messages, stream: true, temperature, max_tokens: Math.max(1, Number(maxTokens) || 800) };
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}) },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await readError(res));
      if (!res.body) throw new Error('模型没有返回流');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const emit = function* (line) {
        const value = String(line || '').trim();
        if (!value) return;
        if (isOllama) {
          try {
            const data = JSON.parse(value);
            if (data?.message?.content) yield data.message.content;
          } catch {}
          return;
        }
        if (!value.startsWith('data:')) return;
        const payload = value.slice(5).trim();
        if (!payload || payload === '[DONE]') return;
        try {
          const data = JSON.parse(payload);
          const delta = data?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) yield delta;
        } catch {}
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) yield* emit(line);
      }
      buffer += decoder.decode();
      for (const line of buffer.split(/\r?\n/)) yield* emit(line);
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('模型请求超时');
      throw error;
    } finally { clearTimeout(timer); }
  }
  async function propose({ message = '' } = {}) {
    const cfg = current();
    const text = String(message || '').trim();
    if (!text) throw new Error('缺少要整理的内容');
    if (cfg.provider === 'mock') {
      return {
        ok: true,
        provider: 'mock',
        model: cfg.model,
        proposal: {
          title: '把一个想法整理成可执行计划',
          why: '把模糊想法拆成可验证的只读步骤，先留下证据，再决定下一步。',
          tasks: [
            { title: '读取最近时间线', skill: 'timeline.read' },
            { title: '查看已有目标', skill: 'goal.list' },
          ],
        },
      };
    }
    const prompt = [
      '你是 XI Node 的目标规划器。',
      '只返回一个 JSON 对象，不要 Markdown，不要解释，不要代码围栏。',
      'JSON 结构：{"title":"目标标题","why":"为什么现在做","tasks":[{"title":"任务名","skill":"timeline.read"}]}。',
      'tasks 最多 5 个；skill 只能是 timeline.read、memory.query、goal.list、task.list、eval.read。',
      '只提出只读任务，不要声称已经执行。',
      `用户原话：${text.slice(0, 4000)}`,
    ].join('\n');
    const result = await chat([{ role: 'system', content: prompt }], { maxTokens: 700, temperature: 0.2 });
    const reply = String(result.reply || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = reply.indexOf('{');
    const end = reply.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('模型返回的提案不是有效 JSON');
    let parsed;
    try { parsed = JSON.parse(reply.slice(start, end + 1)); } catch { throw new Error('模型返回的提案无法解析'); }
    const allowed = new Set(['timeline.read', 'memory.query', 'goal.list', 'task.list', 'eval.read']);
    const tasks = (Array.isArray(parsed.tasks) ? parsed.tasks : [])
      .map((task) => ({ title: String(task?.title || '').trim().slice(0, 240), skill: String(task?.skill || '') }))
      .filter((task) => task.title && allowed.has(task.skill))
      .slice(0, 5);
    const proposal = {
      title: String(parsed.title || '').trim().slice(0, 160),
      why: String(parsed.why || '').trim().slice(0, 1200),
      tasks: tasks.length ? tasks : [{ title: '读取最近时间线', skill: 'timeline.read' }],
    };
    if (!proposal.title) throw new Error('模型没有返回目标标题');
    return { ok: true, provider: cfg.provider, model: cfg.model, proposal };
  }
  return { test, chat, streamChat, propose, current };
}