# Deploy Notes

## Repository layout

`xi-node` is a single self-contained repository.

```text
xi-node/
  core/          # cognitive runtime
  server/        # HTTP, model, backup, auth, secret store
  web/           # browser UI
  server.mjs
  Dockerfile
  docker-compose.yml
```

`core/` is a pinned copy of the xi-core runtime so Docker and Windows portable
builds do not need a sibling repository.

## Docker

```bash
docker compose up -d --build
```

Read the generated access token:

```bash
docker compose exec xi-node cat /data/access-token
```

Open:

```text
http://127.0.0.1:8787/?token=<token>
```

## Source

```bash
node server.mjs
```

Read:

```text
data/access-token
```

## Security notes

```text
API listens on 127.0.0.1 by default
Docker publishes only 127.0.0.1:8787
all /api routes except /api/health require the token
API keys use DPAPI on Windows and a local file fallback elsewhere
```