import assert from 'node:assert/strict';
import { createModelClient } from '../server/model.mjs';

const settings = { model: { provider: 'mock', model: 'mock-architect' } };
const mock = createModelClient({ getSettings: () => settings, getApiKey: () => '' });
assert.equal((await mock.test()).ok, true);
const mockChat = await mock.chat([{ role: 'user', content: 'hello' }]);
assert.equal(mockChat.ok, true);
assert.match(mockChat.reply, /hello/);

const openai = createModelClient({
  getSettings: () => ({ model: { provider: 'openai', model: 'test-model', baseUrl: 'http://model.local/v1' } }),
  getApiKey: () => 'secret',
  fetchImpl: async (url, init) => {
    assert.equal(url, 'http://model.local/v1/chat/completions');
    assert.equal(init.headers.authorization, 'Bearer secret');
    return new Response(JSON.stringify({ choices: [{ message: { content: 'real reply' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
});
const openaiChat = await openai.chat([{ role: 'user', content: 'hello' }]);
assert.equal(openaiChat.reply, 'real reply');

const ollama = createModelClient({
  getSettings: () => ({ model: { provider: 'ollama', model: 'qwen', baseUrl: 'http://127.0.0.1:11434' } }),
  getApiKey: () => '',
  fetchImpl: async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    return new Response(JSON.stringify({ message: { content: 'ollama reply' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
});
const ollamaChat = await ollama.chat([{ role: 'user', content: 'hello' }]);
assert.equal(ollamaChat.reply, 'ollama reply');
console.log(JSON.stringify({ ok: true, test: 'model-client' }));