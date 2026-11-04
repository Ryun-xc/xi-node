import assert from 'node:assert/strict';
import http from 'node:http';
import { createModelClient } from '../server/model.mjs';

const server = http.createServer((req, res) => {
  if (req.url === '/v1/models') {
    assert.equal(req.headers.authorization, 'Bearer local-key');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'local-model' }] }));
    return;
  }
  if (req.url === '/v1/chat/completions') {
    assert.equal(req.headers.authorization, 'Bearer local-key');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'http model reply' } }] }));
    return;
  }
  res.writeHead(404); res.end('not found');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
try {
  const client = createModelClient({
    getSettings: () => ({ model: { provider: 'openai', model: 'local-model', baseUrl: `http://127.0.0.1:${port}/v1` } }),
    getApiKey: () => 'local-key',
  });
  const test = await client.test();
  assert.equal(test.ok, true);
  const chat = await client.chat([{ role: 'user', content: 'hello' }]);
  assert.equal(chat.reply, 'http model reply');
  console.log(JSON.stringify({ ok: true, test: 'model-http' }));
} finally {
  await new Promise((resolve) => server.close(resolve));
}