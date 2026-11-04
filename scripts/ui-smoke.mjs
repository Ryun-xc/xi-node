// Minimal CDP smoke test. Requires Edge/Chrome listening on 9223.
import fs from 'node:fs';
import path from 'node:path';

const DEBUG = process.env.XI_CDP || 'http://127.0.0.1:9223';
const APP = process.env.XI_APP || 'http://127.0.0.1:8799';
const OUT = process.env.XI_OUT || path.join(process.cwd(), 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const list = await fetch(`${DEBUG}/json/list`).then((r) => r.json());
const page = list.find((x) => x.type === 'page');
if (!page) throw new Error('no page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params?.exceptionDetails?.exception?.description || 'exception');
};
function send(method, params = {}) { const id = ++nextId; ws.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); }
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(name) { const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }); fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64')); }
async function nav(view) { await evaluate(`document.querySelector('[data-view="${view}"]').click()`); await sleep(700); }
async function submit(selector) { await evaluate(`document.querySelector('${selector}').requestSubmit()`); await sleep(800); }

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
if (process.env.XI_SMOKE_TOKEN) {
  await send('Page.navigate', { url: `${APP}/?token=${encodeURIComponent(process.env.XI_SMOKE_TOKEN)}` });
  await sleep(1200);
}
await send('Page.navigate', { url: `${APP}/?smoke=${Date.now()}#overview` });
await sleep(2200);
if (process.env.XI_SMOKE_LOGIN_TOKEN) {
  const loginVisible = await evaluate(`!document.querySelector('#login').hidden`);
  if (!loginVisible) throw new Error('login overlay not visible');
  await evaluate(`document.querySelector('#loginToken').value=${JSON.stringify(process.env.XI_SMOKE_LOGIN_TOKEN)}; document.querySelector('#loginBtn').click()`);
  await sleep(1800);
}
await evaluate(`if (localStorage.getItem('xi.lang') !== 'zh-CN') { localStorage.setItem('xi.lang','zh-CN'); location.reload(); }`);
await sleep(1200);
console.log('url', await evaluate('location.href'));
const title = await evaluate(`document.querySelector('#viewTitle').textContent`);
if (title !== '总览') throw new Error(`overview title: ${title}`);
await shot('overview');
for (const [lang, expected] of [['en', 'Overview'], ['es', 'Resumen'], ['zh-TW', '總覽']]) {
  await evaluate(`(() => { const el=document.querySelector('#langSelect'); el.value='${lang}'; el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await sleep(900);
  const changed = await evaluate(`document.querySelector('#viewTitle').textContent`);
  if (changed !== expected) throw new Error(`i18n ${lang}: ${changed}`);
  if (lang === 'en') await shot('overview-en');
  if (lang === 'es') await shot('overview-es');
}
await evaluate(`(() => { const el=document.querySelector('#langSelect'); el.value='zh-CN'; el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
await sleep(900);

await nav('chat');
await evaluate(`document.querySelector('#chatInput').value='我想整理一个本地 AI 计划'; document.querySelector('#chatForm').requestSubmit()`);
await sleep(900);
const chatText = await evaluate(`document.querySelector('#chatLog').innerText`);
if (!chatText.includes('我听到了')) throw new Error('chat response missing');
await evaluate(`document.querySelector('#proposeBtn').click()`);
await sleep(900);
const proposalVisible = await evaluate(`!!document.querySelector('.proposal-card')`);
if (!proposalVisible) throw new Error('proposal card missing');
await shot('proposal');
await evaluate(`document.querySelector('#acceptProposal').click()`);
await sleep(1200);
const afterProposal = await evaluate(`document.querySelector('#viewTitle').textContent`);
if (afterProposal !== '目标与任务') throw new Error(`proposal accept: ${afterProposal}`);
await shot('chat');

await nav('goals');
await evaluate(`document.querySelector('#goalTitle').value='UI smoke goal'; document.querySelector('#goalForm').requestSubmit()`);
await sleep(900);
const goalCount = await evaluate(`document.querySelectorAll('.goal-card').length`);
if (goalCount < 1) throw new Error('goal not created');
await shot('goals');

await nav('memory');
await shot('memory');
await nav('settings');
await evaluate(`document.querySelector('#testModelBtn').click()`);
await sleep(900);
const modelState = await evaluate(`document.querySelector('#testModelState').textContent`);
if (!modelState.includes('连接成功')) throw new Error(`model test UI: ${modelState}`);
await shot('settings');

if (errors.length) throw new Error(`runtime exceptions: ${errors.join(' | ')}`);
console.log(JSON.stringify({ ok: true, test: 'ui-smoke', title, goalCount, screenshots: OUT }));
ws.close();