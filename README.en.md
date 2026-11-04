# XI Node

A local-first, self-hosted AI host.

[![CI](https://github.com/Ryun-xc/xi-node/actions/workflows/ci.yml/badge.svg)](https://github.com/Ryun-xc/xi-node/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

[中文 README](README.md)

## Why this exists

Most AI chat applications optimize for generating a better sentence.

XI Node optimizes for keeping the context, goals, actions, and evidence around that sentence:

```text
persistent conversation
memory with provenance and review
goals and read-only tasks
human approval
evidence and timeline
local data
```

It is the local host layer, not the model.

## What it is

```text
Local HTTP host + browser UI
Persistent chat with SSE streaming
Memory ledger with provenance
Goals and read-only tasks
Approval center with real read-only/workspace execution
Timeline and backup/restore
Local knowledge recall
Read-only MCP tools
Optional isolated multi-user mode
PWA shell
```

It is not:

```text
a model
a cloud SaaS
a QQ/WeChat bot
a device controller
a multi-tenant platform
```

## Design principles

```text
local-first by default
human approval before actions
memory must have provenance
model providers are replaceable
small dependency surface
```

## Architecture

```text
Browser / PWA / MCP / external AI
            │
            ▼
      XI Node HTTP server
      ├─ auth
      ├─ chat / SSE
      ├─ model providers
      ├─ goals / tasks
      ├─ memory review
      ├─ approvals
      ├─ knowledge
      ├─ backup / restore
      └─ MCP
            │
            ▼
         XI Core
      ├─ event store
      ├─ goal store
      ├─ executor / verifier
      ├─ memory records
      ├─ policy / approvals
      └─ timeline
            │
            ▼
   OpenAI-compatible / Ollama / Mock
```

`core/` is an embedded copy of XI Core.

## Quick start

### Docker

```bash
docker compose up -d --build
docker compose exec xi-node cat /data/access-token
```

Open:

```text
http://127.0.0.1:8787/?token=<token>
```

### Source

```bash
node server.mjs
```

Token:

```text
data/access-token
```

### First flow

```text
login
→ wizard
→ configure a model
→ send a message
→ “Structure into goal”
→ accept the proposal
→ run read-only tasks
→ inspect the timeline
```

DeepSeek example:

```text
provider: openai
base URL: https://api.deepseek.com/v1
model: deepseek-chat
```

## API and MCP

API map:

```text
docs/openapi.yaml
```

Read-only MCP:

```bash
npm run mcp
```

Tools:

```text
xi_memory_query
xi_goal_list
xi_task_list
xi_timeline_read
xi_knowledge_search
```

See [docs/MCP.md](docs/MCP.md).

## Multi-user

Default is single-user. Optional local multi-user:

```bash
npm run start:multi
npm run user -- --data data add "Alice"
```

Each user gets a separate data directory.

See [docs/MULTIUSER.md](docs/MULTIUSER.md).

## Security defaults

```text
binds 127.0.0.1 by default
all API routes except /api/health require an access token
Docker publishes only 127.0.0.1:8787
API keys are never returned by /api/settings
Windows uses DPAPI; Docker/Linux uses a local file fallback
approvals only execute explicitly allowed read-only/workspace skills
```

Do not expose this directly to the public internet.

## Testing

```bash
npm test
npm run soak
npm run test:ui
powershell -ExecutionPolicy Bypass -File scripts/ci-local.ps1
```

## Current status

```text
v0.1.0
Apache-2.0
CI: test + Docker passing
Release: v0.1.0
```

Known gaps:

```text
no clean Windows VM acceptance
no high-risk external executor
no vector retrieval
no full accessibility audit
no 24h soak
```

## Relationship to Xiaoxi and XI Core

```text
XI Node = local AI host and product shell
XI Core = cognitive runtime
Xiaoxi = earlier QQ AI project, source of product/architecture experience
QQ Bridge Plus = separate QQ bridge, not this project
```

## License

Apache-2.0

Copyright 2026 Runcheng Zhou

See [LICENSE](LICENSE) and [NOTICE](NOTICE).