import { initI18n, setLanguage, translateDom, t } from './i18n.js';
const state = { status: null, view: 'overview', goals: [], tasks: [], memory: [], memoryStats: {}, timeline: [], approvals: [], knowledge: [], settings: {}, chat: [], chatLoaded: false, proposal: null, selectedGoal: null, memoryTab: 'pending', timelineFilter: 'all', wizardStep: 1, busy: false };
const $ = (id) => document.getElementById(id);
const root = $('viewRoot');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const formatReply = (v) => esc(String(v).replace(/<\/?[^>]+>/g, '')).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
const titles = { overview: ['LOCAL COGNITIVE HOST', '总览'], chat: ['ARCHITECT WORKSPACE', '对话'], goals: ['GOALS & TASKS', '目标与任务'], memory: ['MEMORY OS', '记忆'], approvals: ['NEEDS YOUR CALL', '审批'], knowledge: ['KNOWLEDGE BASE', '知识'], timeline: ['EVENT STREAM', '时间线'], settings: ['SYSTEM', '设置'] };

function toast(text, type = '') { const box = $('toasts'); const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = t(text); box.appendChild(el); setTimeout(() => el.remove(), 3800); while (box.children.length > 4) box.firstChild.remove(); }
async function api(path, options = {}) { const res = await fetch(path, { headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options, body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body }); let data = {}; try { data = await res.json(); } catch {} if (res.status === 401) { openLogin(); throw new Error(t('需要本机访问令牌')); } if (!res.ok || data.ok === false) throw new Error(data.error || `请求失败 (${res.status})`); return data; }
function openLogin() { const el = $('login'); if (el) { el.hidden = false; setTimeout(() => $('loginToken')?.focus(), 50); } }
async function login() { const token = $('loginToken').value.trim(); const error = $('loginError'); error.textContent = ''; if (!token) { error.textContent = t('请输入 access-token'); return; } const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) }); if (!res.ok) { error.textContent = t('令牌不正确'); return; } location.reload(); }
function setHost(ok) { const dot = $('hostDot'); const text = $('hostState'); if (!dot || !text) return; dot.classList.toggle('is-bad', !ok); text.textContent = ok ? t('本地主机在线') : t('本地主机未连接'); }
function ago(ts) { if (!ts) return '—'; const s = Math.max(0, Math.round((Date.now() - Number(ts)) / 1000)); if (s < 60) return `${s} ${t('秒前')}`; if (s < 3600) return `${Math.floor(s / 60)} ${t('分钟前')}`; if (s < 86400) return `${Math.floor(s / 3600)} ${t('小时前')}`; return `${Math.floor(s / 86400)} ${t('天前')}`; }
function time(ts) { try { const locale = { 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', en: 'en-US', es: 'es-ES' }[document.documentElement.lang] || 'zh-CN'; return new Date(Number(ts)).toLocaleString(locale, { hour12: false }); } catch { return '—'; } }
function animateNumber(el, value) { const target = Number(value) || 0; if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = String(target); return; } const start = performance.now(); const step = (now) => { const p = Math.min(1, (now - start) / 420); el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
function showConfirm(title, text, label = '确认') { return new Promise((resolve) => { $('confirmTitle').textContent = title || '确认操作'; $('confirmText').textContent = text || ''; $('confirmOk').textContent = label; $('confirm').hidden = false; $('confirmCancel').onclick = () => { $('confirm').hidden = true; resolve(false); }; $('confirmOk').onclick = () => { $('confirm').hidden = true; resolve(true); }; }); }
function openWizard() { state.wizardStep = 1; renderWizard(); $('wizard').hidden = false; }
function closeWizard() { $('wizard').hidden = true; }
function hydrateWizard(settings = {}) { const model = settings.model || {}; const memory = settings.memory || {}; $('wizardProvider').value = model.provider || 'mock'; $('wizardModel').value = model.model || 'mock-architect'; $('wizardBaseUrl').value = model.baseUrl || ''; $('wizardApiKey').value = ''; $('wizardMemory').checked = memory.enabled !== false; $('wizardReview').checked = memory.requireReview !== false; }
function renderWizard() { for (const page of document.querySelectorAll('[data-wizard-page]')) page.hidden = Number(page.dataset.wizardPage) !== state.wizardStep; for (const dot of document.querySelectorAll('[data-step-dot]')) dot.classList.toggle('is-active', Number(dot.dataset.stepDot) <= state.wizardStep); $('wizardBack').style.visibility = state.wizardStep === 1 ? 'hidden' : 'visible'; $('wizardNext').textContent = state.wizardStep === 3 ? '进入 XI Node' : '下一步'; }
async function finishWizard() { const body = { initialized: true, model: { provider: $('wizardProvider').value, model: $('wizardModel').value.trim() || 'mock-architect', baseUrl: $('wizardBaseUrl').value.trim(), apiKey: $('wizardApiKey').value.trim() || undefined }, memory: { enabled: $('wizardMemory').checked, requireReview: $('wizardReview').checked } }; await api('/api/settings', { method: 'PUT', body }); closeWizard(); await refreshStatus(); toast('主机已初始化', 'ok'); navigate('overview'); }
async function advanceWizard() { if (state.wizardStep < 3) { state.wizardStep += 1; renderWizard(); return; } await finishWizard(); }
function setViewChrome(view) { const meta = titles[view] || titles.overview; $('viewKicker').textContent = meta[0]; $('viewTitle').textContent = meta[1]; for (const btn of document.querySelectorAll('.nav-item')) { const active = btn.dataset.view === view; btn.classList.toggle('is-active', active); if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current'); } document.body.classList.remove('nav-open'); }
async function refreshStatus() { const data = await api('/api/status'); state.status = data; state.settings = data.settings || {}; $('version').textContent = `v${data.version || '0.1'}`; setHost(true); return data; }
function skeleton() { root.innerHTML = `<div class="skeleton-grid"><div class="skeleton" style="height:180px"></div><div class="skeleton"></div><div class="skeleton"></div></div>`; }
function viewError(error) { setHost(false); root.innerHTML = `<div class="empty"><b>${t('本地主机没有回应')}</b>${esc(error?.message || error)}<div style="margin-top:14px"><button class="primary-btn" onclick="location.reload()">${t('重新连接')}</button></div></div>`; }
async function navigate(view, { keepScroll = false } = {}) { state.view = view; setViewChrome(view); if (location.hash.slice(1) !== view) history.replaceState(null, '', '#' + view); skeleton(); try { if (view === 'overview') await renderOverview(); else if (view === 'chat') await renderChat(); else if (view === 'goals') await renderGoals(); else if (view === 'memory') await renderMemory(); else if (view === 'approvals') await renderApprovals(); else if (view === 'knowledge') await renderKnowledge(); else if (view === 'timeline') await renderTimeline(); else if (view === 'settings') await renderSettings(); translateDom(document); if (!keepScroll) window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (error) { viewError(error); } }

async function renderOverview() {
  const data = await refreshStatus(); const counts = data.counts || {};
  const [goalsData, tasksData, timelineData] = await Promise.all([api('/api/goals'), api('/api/tasks'), api('/api/timeline?limit=12')]);
  state.goals = goalsData.items || [];
  state.tasks = tasksData.items || [];
  state.timeline = timelineData.items || [];
  root.innerHTML = `<div class="hero"><section class="hero-main"><div class="eyebrow">SYSTEM READY · ${esc(data.health?.enabled ? 'MEMORY LOOP ACTIVE' : 'MEMORY LOOP IDLE')}</div><h2>把你的想法，<br>变成有证据的动作。</h2><p>XI Node 是本地的认知主机。它记住来源，拆分目标，等待你的批准，再把结果写回时间线。</p><div class="hero-actions"><button class="primary-btn" data-action="new-goal">开始一个目标</button><button class="ghost-btn" data-action="open-chat">进入对话</button><button class="ghost-btn" data-action="open-memory">查看待审核</button></div></section><div class="hero-side"><div class="metric-card"><div><b data-count="${counts.goals || 0}">0</b><span>目标总数</span></div><div class="metric-icon">◎</div></div><div class="metric-card"><div><b data-count="${counts.openTasks || 0}">0</b><span>开放任务</span></div><div class="metric-icon">⌁</div></div><div class="metric-card"><div><b data-count="${counts.pendingMemory || 0}">0</b><span>待审核记忆</span></div><div class="metric-icon">▤</div></div></div></div>
  <div class="stat-grid"><div class="stat accent"><b data-count="${counts.activeGoals || 0}">0</b><span>活跃目标</span></div><div class="stat"><b data-count="${counts.tasks || 0}">0</b><span>任务总数</span></div><div class="stat warn"><b data-count="${counts.approvals || 0}">0</b><span>等待你的审批</span></div><div class="stat"><b data-count="${counts.events || 0}">0</b><span>事件总数</span></div></div>
  <div class="grid-2"><section class="card"><div class="card-head"><h3>最近目标</h3><button class="ghost-btn small-btn" data-action="all-goals">全部目标</button></div><div class="list">${state.goals.length ? state.goals.slice(0, 5).map((g) => `<div class="list-item"><span class="bullet"></span><div><b>${esc(g.title || '未命名目标')}</b><small>${esc(g.status || 'active')} · ${ago(g.updatedAt || g.createdAt)}</small></div></div>`).join('') : `<div class="empty"><b>还没有目标</b>从一个很小的目标开始，比如“整理今天的工作”。</div>`}</div></section><section class="card"><div class="card-head"><h3>最近事件</h3><button class="ghost-btn small-btn" data-action="all-timeline">时间线</button></div><div class="list">${state.timeline.length ? state.timeline.slice(0, 5).map((e) => `<div class="list-item"><span class="bullet"></span><div><b>${esc(e.type || 'event')}</b><small>${esc(e.summary || '')} · ${ago(e.ts)}</small></div></div>`).join('') : `<div class="empty"><b>时间线是空的</b>当主机开始记录、执行或审核，这里会出现证据。</div>`}</div></section></div>`;
  for (const el of root.querySelectorAll('[data-count]')) animateNumber(el, Number(el.dataset.count)); bindRootActions();
}

async function renderChat() {
  if (!state.chatLoaded) {
    try { const data = await api('/api/chat/history?limit=100'); state.chat = (data.items || []).map((m) => ({ role: m.role, text: m.text, at: m.at })); } catch {}
    state.chatLoaded = true;
  }
  if (!state.chat.length) state.chat = [{ role: 'assistant', text: '我是 XI Architect。这里不是客服窗口。把还没整理好的想法丢进来，我会先把它变成结构，再告诉你第一步该怎么验证。', at: Date.now() }];
  root.innerHTML = `<div class="chat-layout"><section class="card chat-panel"><div class="chat-head"><div><div class="eyebrow">ARCHITECT SESSION</div><b style="font-size:13px">对话会留下记忆；整理后可创建目标和任务</b></div><span class="tag cyan">${esc((state.settings.model?.provider || 'mock').toUpperCase())} MODEL</span></div><div class="chat-log" id="chatLog">${state.chat.map((m) => `<div class="msg ${m.role === 'user' ? 'user' : ''}"><div class="who">${m.role === 'user' ? 'YOU' : 'XI ARCHITECT'}</div><div class="bubble">${m.role === 'assistant' ? formatReply(m.text) : esc(m.text)}</div><div class="meta">${m.role === 'assistant' ? '<span class="tag">LOCAL</span><span class="tag">NO SECRETS</span>' : ''}</div></div>`).join('')}</div><form class="chat-compose" id="chatForm"><input class="chat-input" id="chatInput" placeholder="比如：我想做一个能记住我作息的本地 AI，但不知道该先做什么。" autocomplete="off"><button class="primary-btn" id="chatSend" type="submit">发送</button></form><div class="chat-proposal-area"><div class="row between"><button class="ghost-btn small-btn" id="proposeBtn" type="button">整理成目标</button><span class="tiny dim" id="proposeState"></span></div>${state.proposal ? `<div class="proposal-card"><div class="eyebrow">${t('建议目标')}</div><h3>${esc(state.proposal.title)}</h3><p>${esc(state.proposal.why || '')}</p><div class="proposal-tasks">${state.proposal.tasks.map((task) => `<span class="tag cyan">${esc(task.skill)}</span><span>${esc(task.title)}</span>`).join('')}</div><div class="row" style="margin-top:12px"><button class="primary-btn small-btn" id="acceptProposal">${t('接受并创建')}</button><button class="ghost-btn small-btn" id="cancelProposal">${t('取消建议')}</button></div></div>` : ''}</div></section><aside class="chat-side"><div class="card"><div class="card-head"><h3>当前模式</h3><span class="tag lime">READY</span></div><div class="stack"><div class="status-line"><span>模型</span><b>${esc((state.settings.model?.provider || 'mock').toUpperCase())}</b></div><div class="status-line"><span>记忆</span><b>LOCAL</b></div><div class="status-line"><span>执行</span><b>APPROVAL</b></div></div></div><div class="rule"><b>对话边界</b><br>这个原型不会发送消息、不会控制设备。高风险动作只会在审批中心出现。</div></aside></div>`;
  $('chatForm').addEventListener('submit', sendChat); $('proposeBtn')?.addEventListener('click', proposeFromChat); $('acceptProposal')?.addEventListener('click', acceptProposal); $('cancelProposal')?.addEventListener('click', () => { state.proposal = null; renderChat(); }); $('chatInput').focus(); scrollChat(); bindRootActions();
}
function scrollChat() { const log = $('chatLog'); if (log) log.scrollTop = log.scrollHeight; }
async function sendChat(event) {
  event.preventDefault(); const input = $('chatInput'); const text = input.value.trim(); if (!text || state.busy) return;
  state.busy = true; input.value = ''; state.chat.push({ role: 'user', text, at: Date.now() }); state.chat.push({ role: 'assistant', text: '正在整理意图…', at: Date.now(), typing: true }); renderChat();
  let full = '';
  try {
    const res = await fetch('/api/chat/stream', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: text }) });
    if (res.status === 401) { openLogin(); throw new Error(t('需要本机访问令牌')); }
    if (!res.ok || !res.body) throw new Error(`请求失败 (${res.status})`);
    const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim(); if (!payload) continue;
        const data = JSON.parse(payload);
        if (data.error) throw new Error(data.error);
        if (typeof data.delta === 'string') {
          full += data.delta;
          const bubbles = root.querySelectorAll('.bubble');
          const last = bubbles[bubbles.length - 1];
          if (last) last.innerHTML = formatReply(full);
          scrollChat();
        }
        if (data.done) { full = String(data.reply || full); break; }
      }
    }
    if (!full.trim()) throw new Error(t('模型返回为空'));
  } catch (error) {
    state.chat = state.chat.filter((m) => !m.typing);
    state.chat.push({ role: 'assistant', text: `${t('整理失败：')}${error.message}`, at: Date.now() });
    toast(error.message, 'err');
  } finally {
    state.busy = false;
    if (full.trim()) {
      state.chat = state.chat.filter((m) => !m.typing);
      state.chat.push({ role: 'assistant', text: full, at: Date.now() });
    }
    renderChat();
  }
}
async function proposeFromChat() {
  const lastUser = [...state.chat].reverse().find((m) => m.role === 'user');
  if (!lastUser || state.busy) { toast(t('先发一句话，再整理成目标'), 'err'); return; }
  state.busy = true; const status = $('proposeState'); if (status) status.textContent = t('正在整理目标…');
  try {
    const data = await api('/api/chat/propose', { method: 'POST', body: { message: lastUser.text } });
    state.proposal = data.proposal;
    toast(t('目标建议已生成'), 'ok');
  } catch (error) {
    toast(`${t('目标建议失败')}${error.message}`, 'err');
  } finally {
    state.busy = false; renderChat();
  }
}
async function acceptProposal() {
  const proposal = state.proposal;
  if (!proposal || state.busy) return;
  state.busy = true;
  try {
    const goal = await api('/api/goals', { method: 'POST', body: { title: proposal.title, why: proposal.why } });
    const goalId = goal.item.id;
    for (const task of proposal.tasks) {
      await api('/api/tasks', { method: 'POST', body: { goalId, title: task.title, skill: task.skill } });
    }
    state.proposal = null;
    state.chat.push({ role: 'assistant', text: t('已创建目标和 {n} 个任务。你可以去目标页运行只读任务。', { n: proposal.tasks.length }), at: Date.now() });
    await loadGoals();
    state.selectedGoal = goalId;
    toast(t('目标和任务已创建'), 'ok');
    navigate('goals');
  } catch (error) {
    toast(error.message, 'err');
  } finally {
    state.busy = false;
  }
}
async function loadGoals() { const [goals, tasks] = await Promise.all([api('/api/goals'), api('/api/tasks')]); state.goals = goals.items || []; state.tasks = tasks.items || []; if (!state.selectedGoal || !state.goals.some((g) => g.id === state.selectedGoal)) state.selectedGoal = state.goals[0]?.id || null; }
async function renderGoals() {
  await loadGoals(); const selected = state.goals.find((g) => g.id === state.selectedGoal) || null; const tasks = state.tasks.filter((t) => !selected || t.goalId === selected.id);
  root.innerHTML = `<div class="grid-2"><section class="card"><div class="card-head"><h3>新建目标</h3><span class="tag">LOCAL</span></div><form id="goalForm"><label class="field"><span>你想要什么结果</span><input id="goalTitle" placeholder="例如：整理这周的项目状态" required maxlength="240"></label><label class="field"><span>为什么现在要做（可选）</span><textarea id="goalWhy" placeholder="写一句就够，不用完整。" maxlength="1200"></textarea></label><div class="form-actions"><button class="primary-btn" type="submit">创建目标</button></div></form></section><section class="card"><div class="card-head"><h3>执行规则</h3><span class="tag amber">APPROVAL</span></div><div class="rule"><b>v1 只执行只读任务。</b><br>可以读取时间线、记忆、目标和 eval。不会发送消息、不会控制设备、不会执行 shell。</div><div class="rule" style="margin-top:8px"><b>目标不是一句话。</b><br>它会被拆成任务，再通过验证器写入证据。</div></section></div><div style="height:16px"></div>
  <div class="grid-2"><section class="card"><div class="card-head"><h3>目标</h3><span class="tag">${state.goals.length} TOTAL</span></div><div class="stack">${state.goals.length ? state.goals.map((g) => { const gt = state.tasks.filter((t) => t.goalId === g.id); const done = gt.filter((t) => t.status === 'done').length; return `<div class="goal-card ${g.id === state.selectedGoal ? 'is-selected' : ''}" data-goal-id="${esc(g.id)}"><div class="row between"><span class="tag cyan">${esc(g.status || 'active')}</span><span class="tiny dim">${done}/${gt.length} 任务</span></div><h3>${esc(g.title || '未命名目标')}</h3><p>${esc(g.why || '没有写原因。')}</p><div class="progress" style="margin-top:12px"><i style="width:${gt.length ? Math.round(done / gt.length * 100) : 0}%"></i></div></div>`; }).join('') : `<div class="empty"><b>还没有目标</b>先写一个你真正想完成的结果。</div>`}</div></section>
  <section class="card" id="goalDetail">${selected ? `<div class="card-head"><div><div class="eyebrow">SELECTED GOAL</div><h3 style="margin-top:6px">${esc(selected.title)}</h3></div><button class="primary-btn small-btn" data-run-goal="${esc(selected.id)}">运行只读任务</button></div><div class="task-list">${tasks.length ? tasks.map((t) => `<div class="task-row ${esc(t.status)}"><span class="task-mark"></span><span class="task-title">${esc(t.title)}</span><span class="tag ${t.status === 'done' ? 'lime' : 'cyan'}">${esc(t.status)}</span></div>`).join('') : `<div class="empty"><b>还没有任务</b>添加一个只读任务，让目标开始动。</div>`}</div><form id="taskForm" style="margin-top:16px"><div class="form-grid"><label class="field"><span>任务名</span><input id="taskTitle" placeholder="读取最近时间线" required maxlength="240"></label><label class="field"><span>只读技能</span><select id="taskSkill"><option value="timeline.read">timeline.read</option><option value="memory.query">memory.query</option><option value="goal.list">goal.list</option><option value="task.list">task.list</option><option value="eval.read">eval.read</option></select></label></div><div class="form-actions"><button class="ghost-btn" type="submit">添加任务</button></div></form>` : `<div class="empty"><b>选择一个目标</b>右侧会出现任务和运行按钮。</div>`}</section></div>`;
  $('goalForm').addEventListener('submit', createGoal); if (selected) $('taskForm').addEventListener('submit', (event) => createTask(event, selected.id));
  for (const card of root.querySelectorAll('[data-goal-id]')) card.addEventListener('click', () => { state.selectedGoal = card.dataset.goalId; renderGoals(); });
  const run = root.querySelector('[data-run-goal]'); if (run) run.addEventListener('click', () => runGoal(run.dataset.runGoal)); bindRootActions();
}
async function createGoal(event) { event.preventDefault(); const title = $('goalTitle').value.trim(); if (!title) return; try { await api('/api/goals', { method: 'POST', body: { title, why: $('goalWhy').value.trim(), scope: 'local' } }); toast('目标已创建', 'ok'); await renderGoals(); } catch (error) { toast(error.message, 'err'); } }
async function createTask(event, goalId) { event.preventDefault(); const title = $('taskTitle').value.trim(); if (!title) return; try { await api('/api/tasks', { method: 'POST', body: { goalId, title, skill: $('taskSkill').value } }); toast('任务已添加', 'ok'); await renderGoals(); } catch (error) { toast(error.message, 'err'); } }
async function runGoal(goalId) { const button = root.querySelector(`[data-run-goal="${goalId}"]`); if (button) { button.disabled = true; button.textContent = '运行中…'; } try { const result = await api(`/api/goals/${encodeURIComponent(goalId)}/run`, { method: 'POST' }); toast(result.ok ? '目标执行完成，证据已写入时间线' : result.error || '目标没有完成', result.ok ? 'ok' : 'err'); await renderGoals(); } catch (error) { toast(error.message, 'err'); if (button) { button.disabled = false; button.textContent = '运行只读任务'; } } }

async function loadMemory() { const data = await api('/api/memory?limit=200'); state.memory = data.items || []; state.memoryStats = data.stats || {}; }
async function renderMemory() {
  await loadMemory(); const tabs = [['pending', '待审核'], ['active', '已启用'], ['all', '全部']]; const items = state.memory.filter((m) => state.memoryTab === 'all' || m.status === state.memoryTab);
  root.innerHTML = `<div class="grid-2"><section class="card"><div class="card-head"><h3>记忆状态</h3><span class="tag cyan">${state.memoryStats.total || 0} TOTAL</span></div><div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin:0"><div class="stat warn"><b>${state.memoryStats.pending || 0}</b><span>待审核</span></div><div class="stat accent"><b>${state.memoryStats.active || 0}</b><span>已启用</span></div><div class="stat"><b>${state.memoryStats.inferred || 0}</b><span>推断</span></div></div></section><section class="card"><div class="card-head"><h3>手动记一条</h3><span class="tag">LOCAL</span></div><form id="memoryForm"><label class="field"><span>内容</span><textarea id="memoryText" placeholder="例如：用户说他周三可能去海边。" maxlength="4000" required></textarea></label><label class="check-row"><input type="checkbox" id="memoryInferred"><span><b>模拟模型推断</b><small>会进入待审核，不会直接注入上下文</small></span></label><div class="form-actions"><button class="primary-btn" type="submit">写入记忆</button></div></form></section></div><div style="height:16px"></div>
  <section class="card"><div class="card-head"><h3>记忆账本</h3><span class="tag">PROVENANCE FIRST</span></div><div class="tabs">${tabs.map(([key, label]) => `<button class="tab ${state.memoryTab === key ? 'is-active' : ''}" data-memory-tab="${key}">${label}</button>`).join('')}</div><div class="memory-grid">${items.length ? items.map((m) => `<article class="memory-card ${m.status === 'pending' ? 'is-pending' : ''} ${m.status === 'rejected' ? 'is-rejected' : ''}"><div class="memory-top"><span class="tag ${m.provenance?.epistemic === 'inferred' ? 'violet' : 'cyan'}">${esc(m.provenance?.epistemic || 'unknown')}</span><span class="tag">${esc(m.kind || 'memory')}</span></div><h3>${esc(m.text)}</h3><div class="memory-provenance"><span class="tag">${esc(m.provenance?.source || 'unknown')}</span><span class="tag">${esc(m.status)}</span><span class="tag">confidence ${Math.round((m.provenance?.confidence || 0) * 100)}%</span></div><div class="row between" style="margin-top:9px"><small class="dim">${esc(m.scope || 'global')} · ${ago(m.createdAt)}</small><small class="dim mono">${esc(m.id.slice(0, 12))}</small></div><div class="memory-actions">${m.status === 'pending' ? `<button class="primary-btn small-btn" data-memory-action="approve" data-memory-id="${esc(m.id)}">批准</button><button class="ghost-btn small-btn" data-memory-action="reject" data-memory-id="${esc(m.id)}">拒绝</button>` : m.status === 'active' ? `<button class="ghost-btn small-btn" data-memory-action="retract" data-memory-id="${esc(m.id)}">撤回</button>` : ''}</div></article>`).join('') : `<div class="empty"><b>这个分组是空的</b>当主机记录、推断或你手动写入时，记忆会出现在这里。</div>`}</div></section>`;
  $('memoryForm').addEventListener('submit', createMemory); for (const tab of root.querySelectorAll('[data-memory-tab]')) tab.addEventListener('click', () => { state.memoryTab = tab.dataset.memoryTab; renderMemory(); }); for (const button of root.querySelectorAll('[data-memory-action]')) button.addEventListener('click', () => memoryAction(button.dataset.memoryId, button.dataset.memoryAction)); bindRootActions();
}
async function createMemory(event) { event.preventDefault(); const text = $('memoryText').value.trim(); if (!text) return; try { await api('/api/memory', { method: 'POST', body: { text, scope: 'local', epistemic: $('memoryInferred').checked ? 'inferred' : 'observed' } }); toast('记忆已写入', 'ok'); await renderMemory(); } catch (error) { toast(error.message, 'err'); } }
async function memoryAction(id, action) { try { await api(`/api/memory/${encodeURIComponent(id)}/${action}`, { method: 'POST' }); toast(action === 'approve' ? '记忆已批准' : action === 'reject' ? '记忆已拒绝' : '记忆已撤回', 'ok'); await renderMemory(); } catch (error) { toast(error.message, 'err'); } }

async function loadApprovals() { const data = await api('/api/approvals'); state.approvals = data.items || []; }
async function renderApprovals() {
  await loadApprovals(); const pending = state.approvals.filter((x) => x.status === 'pending'); const history = state.approvals.filter((x) => x.status !== 'pending');
  root.innerHTML = `<div class="grid-2"><section class="card"><div class="card-head"><h3>审批原则</h3><span class="tag amber">HUMAN IN THE LOOP</span></div><div class="rule"><b>高风险动作必须停下来。</b><br>v1 不执行外部动作。审批中心展示的是流程：谁提出、影响什么、谁批准、留下什么证据。</div><div class="rule" style="margin-top:8px"><b>没有默认同意。</b><br>不会因为超时自动执行，也不会把拒绝当成重试。</div></section><section class="card"><div class="card-head"><h3>演示审批</h3><span class="tag">SAFE</span></div><p class="muted tiny">创建一个不连接真实执行器的审批请求，用来验证交互和审计链路。</p><button class="primary-btn" id="createApproval">创建一个演示审批</button> <button class="ghost-btn" id="createFileApproval">创建文件审批</button></section></div><div style="height:16px"></div>
  <section class="card"><div class="card-head"><h3>等待你决定</h3><span class="tag ${pending.length ? 'amber' : ''}">${pending.length} PENDING</span></div><div class="approval-box">${pending.length ? pending.map((a) => `<article class="approval-card"><div class="row between"><span class="tag ${a.risk === 'high' ? 'danger' : 'amber'}">${esc(a.risk)}</span><span class="tag">${ago(a.createdAt)}</span></div><h3>${esc(a.title)}</h3><p>${esc(a.detail || '没有附加说明。')}</p><div class="approval-actions"><button class="primary-btn small-btn" data-approval-action="approve" data-approval-id="${esc(a.id)}">批准</button><button class="ghost-btn small-btn" data-approval-action="reject" data-approval-id="${esc(a.id)}">拒绝</button></div></article>`).join('') : `<div class="empty"><b>没有待审批动作</b>这是好事。高风险动作会先停在这里。</div>`}</div></section><div style="height:16px"></div><section class="card"><div class="card-head"><h3>历史</h3><span class="tag">${history.length}</span></div><div class="list">${history.length ? history.slice().reverse().map((a) => `<div class="list-item"><span class="bullet"></span><div><b>${esc(a.title)}</b><small>${esc(a.status)} · ${ago(a.resolvedAt)}</small></div></div>`).join('') : `<div class="empty">还没有已处理的审批。</div>`}</div></section>`;
  $('createApproval').addEventListener('click', createDemoApproval); $('createFileApproval')?.addEventListener('click', createFileApproval); for (const button of root.querySelectorAll('[data-approval-action]')) button.addEventListener('click', () => resolveApproval(button.dataset.approvalId, button.dataset.approvalAction)); bindRootActions();
}
async function createDemoApproval() { try { await api('/api/approvals', { method: 'POST', body: { title: '演示：读取一次时间线', detail: '只读操作，会真实执行 timeline.read，不改变任何外部状态。', risk: 'medium', skill: 'timeline.read' } }); toast('演示审批已创建', 'ok'); await renderApprovals(); } catch (error) { toast(error.message, 'err'); } }
async function createFileApproval() { try { const name = `xi-note-${Date.now()}.md`; await api('/api/approvals', { method: 'POST', body: { title: '演示：写入工作区文件', detail: '这是一次真实的本机工作区写入，必须由你批准。', risk: 'medium', skill: 'workspace.write', input: { name, content: `XI Node approved workspace write at ${new Date().toISOString()}\n` } } }); toast('文件审批已创建', 'ok'); await renderApprovals(); } catch (error) { toast(error.message, 'err'); } }
async function resolveApproval(id, action) { if (action === 'approve') { const yes = await showConfirm('批准这个动作？', '这会留下审计记录，并执行一次只读 timeline.read。', '批准'); if (!yes) return; } try { await api(`/api/approvals/${encodeURIComponent(id)}/${action}`, { method: 'POST' }); toast(action === 'approve' ? '已批准' : '已拒绝', 'ok'); await renderApprovals(); } catch (error) { toast(error.message, 'err'); } }

async function renderKnowledge() {
  const data = await api('/api/knowledge');
  state.knowledge = data.items || [];
  root.innerHTML = `<div class="grid-2"><section class="card"><div class="card-head"><h3>本地知识库</h3><span class="tag cyan">${state.knowledge.length} DOCS</span></div><form id="knowledgeForm"><label class="field"><span>标题</span><input id="knowledgeTitle" maxlength="200" placeholder="例如：我的作息规则"></label><label class="field"><span>内容</span><textarea id="knowledgeText" maxlength="20000" required placeholder="粘贴一段资料、规则或项目说明。"></textarea></label><div class="rule">知识片段会参与聊天召回，并作为来源注入提示词。</div><div class="form-actions"><button class="primary-btn" type="submit">写入知识库</button></div></form></section><section class="card"><div class="card-head"><h3>已索引片段</h3><span class="tag">LOCAL ONLY</span></div><div class="knowledge-list">${state.knowledge.length ? state.knowledge.slice().reverse().map((doc) => `<article class="knowledge-card"><div class="row between"><b>${esc(doc.title)}</b><button class="ghost-btn small-btn" data-delete-knowledge="${esc(doc.id)}">删除</button></div><p>${esc(doc.text.slice(0, 500))}</p><small class="dim">${esc(doc.source)} · ${ago(doc.createdAt)}</small></article>`).join('') : `<div class="empty"><b>还没有知识片段</b>写入一段资料，聊天时会用它做本地召回。</div>`}</div></section></div>`;
  $('knowledgeForm').addEventListener('submit', createKnowledge);
  for (const button of root.querySelectorAll('[data-delete-knowledge]')) button.addEventListener('click', () => deleteKnowledge(button.dataset.deleteKnowledge));
}
async function createKnowledge(event) {
  event.preventDefault();
  const title = $('knowledgeTitle').value.trim(); const text = $('knowledgeText').value.trim();
  if (!text) return;
  try { await api('/api/knowledge', { method: 'POST', body: { title, text } }); toast('知识已写入', 'ok'); await renderKnowledge(); } catch (error) { toast(error.message, 'err'); }
}
async function deleteKnowledge(id) {
  if (!await showConfirm('删除这条知识？', '删除后不再参与聊天召回。', '删除')) return;
  try { await api(`/api/knowledge/${encodeURIComponent(id)}`, { method: 'DELETE' }); toast('知识已删除', 'ok'); await renderKnowledge(); } catch (error) { toast(error.message, 'err'); }
}
async function renderTimeline() {
  const data = await api('/api/timeline?limit=120'); state.timeline = data.items || []; const filters = [['all', '全部'], ['memory', '记忆'], ['goal', '目标'], ['task', '任务']]; const events = state.timeline.filter((e) => state.timelineFilter === 'all' || String(e.type || '').includes(state.timelineFilter));
  root.innerHTML = `<section class="card"><div class="card-head"><h3>事件流</h3><div class="row"><span class="tag">${state.timeline.length} EVENTS</span><button class="ghost-btn small-btn" id="refreshTimeline">刷新</button></div></div><div class="tabs">${filters.map(([key, label]) => `<button class="tab ${state.timelineFilter === key ? 'is-active' : ''}" data-timeline-filter="${key}">${label}</button>`).join('')}</div><div class="timeline">${events.length ? events.map((e) => `<div class="timeline-item"><b>${esc(e.type || 'event')}</b><p>${esc(e.summary || '')}</p><time>${time(e.ts)}</time></div>`).join('') : `<div class="empty"><b>没有匹配的事件</b>执行目标、审核记忆或刷新后，这里会出现记录。</div>`}</div></section>`;
  $('refreshTimeline').addEventListener('click', () => renderTimeline()); for (const tab of root.querySelectorAll('[data-timeline-filter]')) tab.addEventListener('click', () => { state.timelineFilter = tab.dataset.timelineFilter; renderTimeline(); }); bindRootActions();
}

async function loadBackups() {
  const box = $('backupHistory');
  if (!box) return;
  try {
    const data = await api('/api/backups');
    const items = data.items || [];
    box.innerHTML = items.length ? `<div class="backup-title">${t('备份历史')}</div>${items.slice(0, 5).map((item) => `<div class="backup-row"><span>${esc(time(item.createdAt))}</span><button class="ghost-btn small-btn" data-restore="${esc(item.id)}">${t('恢复')}</button></div>`).join('')}` : `<div class="tiny dim">${t('还没有备份')}</div>`;
    translateDom(box); box.querySelectorAll('[data-restore]').forEach((button) => button.addEventListener('click', () => restoreBackup(button.dataset.restore)));
  } catch { box.innerHTML = ''; }
}
async function restoreBackup(id) {
  if (!await showConfirm('恢复备份', '恢复后需要重启 XI Node 才会使用旧状态。当前状态会先自动备份。', '恢复')) return;
  try { await api('/api/restore', { method: 'POST', body: { id } }); toast('恢复完成，请重启 XI Node', 'ok'); await loadBackups(); } catch (error) { toast(error.message, 'err'); }
}
async function renderSettings() {
  const data = await refreshStatus(); const settings = data.settings || {}; const model = settings.model || {}; const memory = settings.memory || {};
  root.innerHTML = `<div class="settings-grid"><section class="card"><div class="card-head"><h3>模型连接</h3><span class="tag cyan">${esc((model.provider || 'mock').toUpperCase())} / READY</span></div><form id="settingsForm"><label class="field"><span>Provider</span><select id="settingProvider"><option value="mock">Mock · 本地演示</option><option value="openai">OpenAI-compatible</option><option value="ollama">Ollama</option></select></label><label class="field"><span>模型名</span><input id="settingModel" value="${esc(model.model || 'mock-architect')}"></label><label class="field"><span>服务地址</span><input id="settingBaseUrl" value="${esc(model.baseUrl || '')}" placeholder="https://api.deepseek.com/v1"></label><label class="field"><span>API Key</span><input id="settingApiKey" type="password" placeholder="${model.apiKeySet ? '已保存；留空表示不修改' : '未设置'}" autocomplete="new-password"></label><div class="row" style="margin-top:8px"><button class="ghost-btn small-btn" id="testModelBtn" type="button">测试连接</button><span class="tiny dim" id="testModelState"></span></div><div class="rule">真实 Provider 通过服务端请求，Key 只保存在本机数据目录，不回传给浏览器。<br>OpenAI-compatible 示例：https://api.deepseek.com/v1 · Ollama：http://127.0.0.1:11434</div><div class="form-actions"><button class="primary-btn" type="submit">保存设置</button></div></form></section><section class="card"><div class="card-head"><h3>记忆与数据</h3><span class="tag lime">LOCAL ONLY</span></div><div class="stack"><div class="status-line"><span>记忆闭环</span><b>${memory.enabled !== false ? 'ON' : 'OFF'}</b></div><div class="status-line"><span>推断审核</span><b>${memory.requireReview !== false ? 'ON' : 'OFF'}</b></div><div class="status-line"><span>事件</span><b>${data.counts?.events || 0}</b></div><div class="status-line"><span>待审核记忆</span><b>${data.counts?.pendingMemory || 0}</b></div></div><div class="hero-actions" style="margin-top:16px"><button class="ghost-btn" id="backupBtn">立即备份</button><button class="ghost-btn" id="runWizard">重新运行向导</button></div><div class="backup-history" id="backupHistory"></div><div class="rule" style="margin-top:12px"><b>数据位置</b><br>主机只监听 127.0.0.1。数据目录由启动参数决定，不通过浏览器暴露。</div></section></div>`;
  $('settingProvider').value = model.provider || 'mock'; $('settingsForm').addEventListener('submit', saveSettings); $('testModelBtn').addEventListener('click', () => testModel('testModelState')); $('backupBtn').addEventListener('click', backup); $('runWizard').addEventListener('click', openWizard); bindRootActions(); loadBackups();
}
async function saveSettings(event) { event.preventDefault(); try { await api('/api/settings', { method: 'PUT', body: { initialized: true, model: { provider: $('settingProvider').value, model: $('settingModel').value.trim(), baseUrl: $('settingBaseUrl').value.trim(), apiKey: $('settingApiKey').value.trim() || undefined } } }); toast('设置已保存', 'ok'); await renderSettings(); } catch (error) { toast(error.message, 'err'); } }
async function testModel(statusId) {
  const status = $(statusId);
  if (status) status.textContent = '测试中…';
  const wizard = statusId === 'wizardTestState';
  const provider = wizard ? $('wizardProvider')?.value : $('settingProvider')?.value;
  const model = wizard ? $('wizardModel')?.value : $('settingModel')?.value;
  const baseUrl = wizard ? $('wizardBaseUrl')?.value : $('settingBaseUrl')?.value;
  const apiKey = wizard ? $('wizardApiKey')?.value : $('settingApiKey')?.value;
  try {
    const data = await api('/api/model/test', { method: 'POST', body: { model: { provider: provider || 'mock', model: model || 'mock-architect', baseUrl: baseUrl || '', apiKey: apiKey || '' } } });
    if (status) status.textContent = `连接成功 · ${data.result.latencyMs || 0}ms`;
    toast('模型连接成功', 'ok');
  } catch (error) { if (status) status.textContent = error.message; toast(error.message, 'err'); }
}
async function backup() { try { const data = await api('/api/backup', { method: 'POST' }); toast('备份完成', 'ok'); console.info('backup', data.path); await loadBackups(); } catch (error) { toast(error.message, 'err'); } }

function bindRootActions() { root.querySelectorAll('[data-action]').forEach((button) => { button.addEventListener('click', () => { const action = button.dataset.action; if (action === 'new-goal') navigate('goals'); else if (action === 'open-chat') navigate('chat'); else if (action === 'open-memory') { state.memoryTab = 'pending'; navigate('memory'); } else if (action === 'all-goals') navigate('goals'); else if (action === 'all-timeline') navigate('timeline'); }); }); }
window.addEventListener('xi:lang', () => { if (state.view) navigate(state.view); });
function bindShell() {
  for (const btn of document.querySelectorAll('.nav-item')) btn.addEventListener('click', () => navigate(btn.dataset.view));
  $('refreshBtn').addEventListener('click', () => navigate(state.view)); $('quickGoalBtn').addEventListener('click', () => navigate('goals')); $('wizardBtn').addEventListener('click', () => { hydrateWizard(state.settings); openWizard(); }); $('menuBtn')?.addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('wizardBack').addEventListener('click', () => { if (state.wizardStep > 1) { state.wizardStep -= 1; renderWizard(); } }); $('wizardNext').addEventListener('click', () => advanceWizard().catch((error) => toast(error.message, 'err'))); $('wizardTest').addEventListener('click', () => testModel('wizardTestState'));
  $('loginBtn')?.addEventListener('click', login); $('loginToken')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') login(); });
  $('confirm')?.addEventListener('click', (event) => { if (event.target.id === 'confirm') $('confirm').hidden = true; });
  document.addEventListener('keydown', (event) => { if (event.target.matches('input, textarea, select')) return; if (event.key === 'Escape') { closeWizard(); $('confirm').hidden = true; document.body.classList.remove('nav-open'); } const n = Number(event.key); if (n >= 1 && n <= 8) navigate(['overview', 'chat', 'goals', 'memory', 'approvals', 'knowledge', 'timeline', 'settings'][n - 1]); });
}
async function boot() { initI18n(); bindShell(); try { const data = await refreshStatus(); hydrateWizard(data.settings || {}); if (!data.settings?.initialized) openWizard(); const start = location.hash.slice(1); await navigate(titles[start] ? start : 'overview'); } catch (error) { setHost(false); viewError(error); if (String(error.message).includes('令牌')) openLogin(); else openWizard(); } }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
boot();
