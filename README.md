# XI Node

一个本地优先、可自托管的 AI 主机。

[![CI](https://github.com/Ryun-xc/xi-node/actions/workflows/ci.yml/badge.svg)](https://github.com/Ryun-xc/xi-node/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/release-v0.1.0-green.svg)](https://github.com/Ryun-xc/xi-node/releases/tag/v0.1.0)

[English README](README.en.md)

---

## 为什么会有这个项目

小汐（Xiaoxi）是我之前做的一个运行在 QQ 上的 AI 同伴 / 朋友型机器人项目。它通过 QQ 消息、群聊、人格设定和语音与用户互动。

做小汐的时候，我反复遇到同一类问题：

```text
聊完就忘
记忆没有来源
目标和任务只存在于对话里
模型给出的下一步没有被验证
高风险动作没有明确的批准边界
数据散落在聊天、日志、脚本和数据库里
```

大部分 AI 应用解决的是“怎么生成一句话”。

XI Node 想解决的是：

```text
怎么让 AI 的上下文、目标、动作和证据
留在同一个可追溯的地方。
```

所以它不是一个更大的聊天框，而是一个本地 AI 主机：

```text
模型负责理解和生成
XI Node 负责记忆、目标、审批、证据和时间线
```

---

## 它是什么

XI Node 提供：

```text
本地 HTTP 主机
浏览器 UI
持久对话
有来源的记忆账本
目标 / 只读任务
审批中心和真实只读技能执行
事件时间线
备份与恢复
本地知识库召回
MCP 只读工具
可选多用户隔离
PWA 安装
```

它不是：

```text
模型本身
云端 SaaS
QQ / 微信机器人
设备控制器
多租户平台
签名 Windows 安装器
```

---

## 设计原则

### 1. Local-first

默认只监听：

```text
127.0.0.1
```

数据、记忆、Key 和审批默认都在本机。

### 2. 人必须在环里

模型可以提出目标、任务和下一步，但不能：

```text
自动创建目标
自动执行高风险动作
自己给自己授权
```

### 3. 记忆必须有来源

每条记忆都有：

```text
source
epistemic
confidence
review status
createdAt
```

推断和观察分开，推断需要审核。

### 4. 模型可替换

适配：

```text
Mock
OpenAI-compatible（DeepSeek 等）
Ollama
```

### 5. 尽量少依赖

运行时使用 Node 内置模块。

没有 Electron，没有前端框架，没有 SQLite 依赖。

---

## 现在能做什么

### 对话

```text
流式输出
聊天历史持久化
相关记忆召回
相关本地知识片段召回
```

### 聊天到目标

```text
用户发一句想法
→ 点击“整理成目标”
→ 模型返回结构化提案
→ 用户确认
→ 创建目标和只读任务
```

模型只提案，不能直接写入。

### 目标与任务

```text
创建目标
添加只读任务
运行任务
验证
写入时间线
```

### 记忆

```text
写入
批准
拒绝
撤回
```

### 审批

审批可以绑定只读技能：

```text
timeline.read
workspace.write
```

批准后真实执行，并保存结果。

高风险外部动作仍然没有执行器。

### 知识库

本地知识片段会参与聊天召回。

当前是词项匹配，不是向量检索。

### 其他

```text
MCP 只读工具
可选多用户
PWA
中 / 繁 / 英 / 西 四种界面
备份恢复
```

---

## 架构

```text
浏览器 / PWA / MCP 客户端 / 外部 AI
                 │
                 ▼
        XI Node HTTP Server
        ├─ 认证
        ├─ 聊天 / 流式
        ├─ 模型 Provider
        ├─ 目标 / 任务
        ├─ 记忆审核
        ├─ 审批
        ├─ 知识库
        ├─ 备份 / 恢复
        └─ MCP
                 │
                 ▼
             XI Core
        ├─ 事件存储
        ├─ 目标存储
        ├─ 任务执行
        ├─ 记忆记录
        ├─ 策略 / 审批
        ├─ 验证器
        └─ 时间线
                 │
                 ▼
     OpenAI-compatible / Ollama / Mock
```

`core/` 是内嵌的 XI Core，避免部署时依赖同级目录。

---

## 快速开始

### 推荐：Docker

```bash
docker compose up -d --build
```

首次启动生成访问令牌：

```bash
docker compose exec xi-node cat /data/access-token
```

打开：

```text
http://127.0.0.1:8787/?token=<token>
```

数据在 Docker named volume：

```text
xi-node-data
```

### 源码运行

需要 Node.js 20+。

```bash
node server.mjs
```

默认数据目录：

```text
./data
```

令牌：

```text
data/access-token
```

---

## 第一次使用

```text
1. 用 access-token 登录
2. 完成首启向导
3. 在设置页配置模型
4. 在对话页发一句话
5. 点击“整理成目标”
6. 接受提案，生成目标和任务
7. 在目标页运行只读任务
8. 在时间线查看证据
```

DeepSeek 示例：

```text
Provider:  openai
Base URL:  https://api.deepseek.com/v1
Model:     deepseek-chat
```

---

## API

完整接口：

```text
docs/WHITEPAPER.md
docs/openapi.yaml
```

主要接口：

```text
POST /api/chat
POST /api/chat/stream
POST /api/chat/propose
GET  /api/chat/history

GET  /api/goals
POST /api/goals
POST /api/goals/:id/run

GET  /api/memory
POST /api/memory
POST /api/memory/:id/approve

GET  /api/approvals
POST /api/approvals
POST /api/approvals/:id/approve

GET  /api/knowledge
POST /api/knowledge

POST /api/backup
GET  /api/backups
POST /api/restore
```

除 `/api/health` 外，所有 API 都需要本地访问令牌。

---

## MCP

```bash
npm run mcp
```

只读工具：

```text
xi_memory_query
xi_goal_list
xi_task_list
xi_timeline_read
xi_knowledge_search
```

详见 [docs/MCP.md](docs/MCP.md)。

---

## 多用户（可选）

默认单用户。

需要本地多用户时：

```bash
npm run start:multi
```

新增用户：

```bash
npm run user -- --data data add "Alice"
```

每个用户有独立的数据目录、聊天、记忆、目标和 API Key。

详见 [docs/MULTIUSER.md](docs/MULTIUSER.md)。

---

## 安全模型

```text
默认只监听 127.0.0.1
除 /api/health 外所有 API 需要 access-token
Docker 只发布 127.0.0.1:8787
API Key 不通过 /api/settings 回传
Windows 使用 DPAPI；Docker/Linux 使用本机文件
审批只执行明确允许的只读/工作区技能
```

不要把 8787 直接暴露到公网。

没有 TLS 终结、公开注册或密码体系。

---

## 数据目录

```text
data/
  access-token
  model-secret.json
  settings.json
  conversations.json
  approvals.json
  knowledge.json
  cognitive/
    events/
    goals.json
    tasks.json
    memory-records.json
    neural-graph.json
  workspace/
  backups/
```

这些文件不会进入 Git。

---

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

CI：

```text
https://github.com/Ryun-xc/xi-node/actions
```

---

## 当前状态

```text
版本: v0.1.0
许可证: Apache-2.0
CI: test + docker 通过
Release: v0.1.0
```

仍缺：

```text
干净 Windows VM 验收
高风险外部执行器
向量检索
完整无障碍验收
24 小时 soak
```

---

## 和小汐、XI Core 的关系

小汐（Xiaoxi）是我之前做的一个 QQ AI 同伴 / 朋友型项目，不是 XI Node 的前身仓库，也不是公开的云服务。

它的形态是：

```text
QQ 私聊 / 群聊
AI 人格
消息、图片、语音
长期陪伴
```

XI Node 是从这类项目里抽出来的通用部分：

```text
XI Node = 本地 AI 主机和产品壳
XI Core = 认知运行时
小汐 = 更早的 QQ AI 项目，提供了产品经验和架构来源
QQ Bridge Plus = 独立的 QQ 接入桥，不是本项目
```

它不包含：

```text
QQ 接入
小汐的人格
设备控制
```

如果你没有听说过小汐，不需要了解它才能使用 XI Node。它只是解释了这套设计和产品问题意识的来源。

---

## 适合谁

```text
想自托管 AI 的开发者
做 AI 同伴 / AI 助手 / 角色型 AI 的开发者
需要本地记忆、审批和证据的人
想把其他 AI 接入一个本地认知后端的人
```

不适合：

```text
完全不想装 Docker / Node 的普通消费者
需要 SaaS 多租户的团队
需要 QQ 开箱即用的人
需要真实设备控制的场景
```

---

## 文档

```text
docs/openapi.yaml
docs/DEPLOY.md
docs/MULTIUSER.md
docs/MCP.md
PRIVACY.md
docs/VERIFY.md
docs/DOCKER-VERIFY.md
docs/ACCESSIBILITY.md
docs/PRODUCT-CONTRACT.md
```

---

## License

Apache-2.0

Copyright 2026 Runcheng Zhou

See [LICENSE](LICENSE) and [NOTICE](NOTICE).