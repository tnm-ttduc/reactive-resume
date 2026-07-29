# Local Deployment Guide

## Prerequisites

- Node.js 24.14.0 or a compatible Node.js 24 release.
- pnpm 11.10.0.
- Docker Desktop with Compose.

## Install

```bash
volta run --node 24.14.0 --pnpm 11.10.0 pnpm install --frozen-lockfile
```

Create `.env.local` from `.env.example`. For host-based development, set:

```dotenv
APP_URL="http://localhost:3000"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
AUTH_SECRET="<generated-development-secret>"
AI_PROVIDER_BASE_URL="<openai-compatible-base-url>"
AI_PROVIDER_API_KEY="<server-only-key>"
AI_PROVIDER_MODEL="<model-id>"
```

Leave the S3 variables empty to use local filesystem storage under `data/`.

The AI provider variables are optional as a group. When all three are set, the server exposes the env provider as the
read-only default. Never place the key in a client-prefixed variable or commit `.env.local`.

## Database

```bash
docker compose -f compose.dev.yml up -d postgres
set -a
source .env.local
set +a
volta run --node 24.14.0 --pnpm 11.10.0 pnpm db:migrate
```

## Start application

The root dev command pins Node.js 24.14.0 through pnpm's local runtime and automatically loads `.env.local`:

```bash
pnpm dev
```

This starts the web app, API server and optional email-template preview together.

Endpoints:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Health: `http://localhost:3001/api/health`

## Validate

```bash
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
```

## Stop

Stop the two development processes, then:

```bash
docker compose -f compose.dev.yml stop postgres
```

Do not use `docker compose down -v` unless intentionally deleting the local database volume.
