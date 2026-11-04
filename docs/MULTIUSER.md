# Multi-user (optional)

The default process is single-user.

For local multi-user, start the gateway instead:

```bash
npm run start:multi
```

It uses:

```text
data/users.json
data/access-token
data/users/<id>/
```

## Add a user

```bash
npm run user -- --data data add "Alice"
```

The command prints the new token once.

Restart the gateway after adding a user.

## Login

Open:

```text
http://127.0.0.1:8787/?token=<token>
```

or paste the token into the login dialog.

## Isolation

Each user gets a separate data directory:

```text
cognitive/
settings.json
conversations.json
approvals.json
model-secret.json
workspace/
```

Memory, goals, tasks, approvals, chat history, API keys, and backups are isolated per user.

## Security

```text
Tokens are stored in data/users.json
The file and data/access-token are mode 600
Bind to 127.0.0.1 by default
There is no public registration endpoint
User creation is a local CLI action
```

Do not commit `data/users.json`, `data/access-token`, or any user data directory.

## Limit

This is local multi-user, not a multi-tenant SaaS. It does not provide:

```text
password reset
email verification
OAuth
public registration
billing
per-user rate limits
```