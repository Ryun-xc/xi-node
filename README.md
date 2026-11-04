# XI Node v0.1

一个本地优先、可自托管的 AI 主机。

English: [README.en.md](README.en.md)

```text
浏览器 UI
+ xi-core 认知运行时
+ 记忆审核
+ 目标 / 任务
+ 审批
+ 时间线
+ 备份
```

## 推荐：Docker

单仓自包含，直接：

```bash
docker compose up -d --build
```

打开：

```text
http://127.0.0.1:8787
```

首次启动会生成访问令牌。读取：

```bash
docker compose exec xi-node cat /data/access-token
```

然后打开：

```text
http://127.0.0.1:8787/?token=<token>
```

数据保存在 Docker named volume `xi-node-data`。

`docker compose build` 与 `docker compose up -d` 已在本机验证。

## 开发者：源码运行

需要 Node.js >= 20。

```bash
node server.mjs
```

默认数据目录：

```text
./data
```

可以通过环境变量修改：

```bash
XI_NODE_DATA=D:\xi-data node server.mjs
```

首次启动会生成：

```text
data/access-token
```

打开：

```text
http://127.0.0.1:8787/?token=<token>
```

也可以手动在登录框粘贴令牌。

## 备份与恢复

```bash
npm run restore -- --data data
```

列出备份；指定备份恢复：

```bash
npm run restore -- --data data --id 2026-11-04T...
```

恢复需要重启主机。恢复前会自动保留当前状态的一份安全备份。

## Windows 便携 zip（可选，未签名）

构建：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-portable.ps1
```

产物：

```text
dist/xi-node-win-x64-v0.1.0.zip
```

解压后双击 `START.vbs`。不需要安装 Node，但 Windows 可能提示来源不明。

## 不提供 exe 安装器

v0.1 不发布签名 Windows 安装器，原因：

```text
代码签名证书成本高
未签名 exe 会触发 SmartScreen
当前阶段优先验证真实使用，而不是安装体验
```

安装器构建脚本已移除。

## 模型 Provider

支持：

```text
mock
OpenAI-compatible（DeepSeek 等）
Ollama
```

设置页可以测试连接。

API Key 支持：

```text
data/model-secret.json
XI_MODEL_API_KEY
```

Key 不会通过 `/api/settings` 回传。

Windows 本地运行使用 DPAPI 加密保存；Docker / Linux 环境降级为本机文件存储。

## 边界

```text
只监听 127.0.0.1
不会发送 QQ / 消息
不会控制设备
只执行只读任务
审批是演示审批，不连接真实执行器
```

## 页面

```text
总览
对话 / 架构工作台
目标与任务
记忆
审批
时间线
设置
```

## 测试

```bash
npm test
npm run soak
```

本地发布门禁：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ci-local.ps1
```

UI smoke 需要本机 Edge/Chrome 的 CDP：

```bash
npm run test:ui
```

## Languages

界面支持：

```text
简体中文
繁體中文
English
Español
```

右上角语言选择器切换，选择会保存在浏览器。

## 多用户（可选）

默认是单用户。需要本地多用户时：

```bash
npm run start:multi
```

新增用户：

```bash
npm run user -- --data data add "Alice"
```

每个用户有独立的数据目录、聊天、记忆、目标、审批和 API Key。

详见 [docs/MULTIUSER.md](docs/MULTIUSER.md)。

## 对话到目标

聊天不会自动替用户做决定。流程是：

```text
发一句想法
→ 点击“整理成目标”
→ 模型返回结构化提案
→ 你点击“接受并创建”
→ 生成目标和只读任务
→ 在目标页运行并写入时间线
```

对应 API：

```text
POST /api/chat/propose
```

它只生成提案，不创建目标；创建必须由用户确认。

## MCP

本机 MCP 服务：

```bash
npm run mcp
```

只读工具：记忆查询、目标、任务、时间线、知识库搜索。详见 [docs/MCP.md](docs/MCP.md)。

## 本地知识库

设置页之外的“知识”页可以写入本地资料。聊天时会按词项匹配召回相关片段，并把标题作为来源注入提示词。

这不是向量检索，是轻量本地 RAG 的第一版。

## 流式对话

聊天使用 SSE 流式返回：

```text
POST /api/chat/stream
```

用户消息和助手回复都会写入 `conversations.json`，刷新后仍可加载。

## 审批执行

审批可以绑定只读技能，例如：

```text
timeline.read
```

批准后服务端真实执行该只读技能，并把结果写入审批记录。

高风险外部动作仍然没有执行器。

## 当前限制

```text
Docker 已在本机构建并运行验证
没有干净 Windows VM 验收
没有可信代码签名
真实外部模型仍需用户自己的 Key
```

## 文档

```text
docs/openapi.yaml
docs/ACCESSIBILITY.md
docs/PRODUCT-CONTRACT.md
docs/DEPLOY.md
PRIVACY.md
docs/UI.md
```