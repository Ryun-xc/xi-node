# Privacy and release hygiene

XI Node is local-first. The repository must never contain real runtime data.

## Never commit

```text
data/
data-demo/
backups/
access-token
model-secret.json
approvals.json
screenshots/
*.log
.env
*.key
*.pem
dist/
release/
```

Everything above is ignored by `.gitignore`.

## Runtime data is local

These files exist only on the machine or inside the Docker volume:

```text
data/access-token
data/model-secret.json
data/approvals.json
data/cognitive/
data/backups/
```

They may contain real conversations, private memories, API keys, and approval history.

## Before publishing

1. Use `scripts/package-release.ps1` to build a zip from tracked files only.
2. Do not zip the working directory manually.
3. Do not push `data/`, screenshots, logs, archives, or tokens.
4. If history contains old screenshots or data, publish from a clean repository or clean history.

## Reporting

Do not open a public issue containing an API key, access token, private memory, or chat transcript.