# XI Node v0.1

A local-first, self-hosted AI host.

```text
Browser UI
+ XI Core cognitive runtime
+ Memory review
+ Goals and tasks
+ Approvals
+ Timeline and evidence
+ Backup and restore
```

## Recommended: Docker

```bash
docker compose up -d --build
```

The first start creates an access token:

```bash
docker compose exec xi-node cat /data/access-token
```

Open:

```text
http://127.0.0.1:8787/?token=<token>
```

Data lives in the Docker named volume `xi-node-data`.

## Source

Requires Node.js 20+.

```bash
node server.mjs
```

The token is written to:

```text
data/access-token
```

## What it is not

```text
Not a hosted SaaS
Not a multi-user platform
Not a QQ/WeChat bot
Not a device controller
Not a signed Windows installer
```

## Chat to goal

```text
Send an idea
→ click "Structure into goal"
→ model returns a proposal
→ click "Accept and create"
→ a goal and read-only tasks are created
→ run them in Goals
→ results are written to the timeline
```

The model proposes; it does not create or execute without the user's confirmation.

## Model providers

```text
mock
OpenAI-compatible (including DeepSeek)
Ollama
```

For DeepSeek:

```text
provider: openai
base URL: https://api.deepseek.com/v1
model: deepseek-chat
```

## Security defaults

```text
Binds 127.0.0.1 by default
All API routes except /api/health require the local access token
API keys use DPAPI on Windows; file fallback on Linux/Docker
No external actions by default
```

## Languages

```text
简体中文
繁體中文
English
Español
```

Use the language selector in the top-right corner.

## Verify

```bash
npm test
npm run test:ui
powershell -ExecutionPolicy Bypass -File scripts/verify.ps1
powershell -ExecutionPolicy Bypass -File scripts/verify-docker.ps1
```

## License

Apache-2.0. See `LICENSE` and `NOTICE`.