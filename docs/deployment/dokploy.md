# Dokploy deployment runbook

This runbook deploys TNM HR Platform as a Dokploy Application backed by separately managed PostgreSQL, Redis, and
S3-compatible object storage. Production deploys use a prebuilt GHCR image pinned by digest.

## Target topology

- One Dokploy project named `tnm-hr-platform`.
- Separate `staging` and `production` environments.
- One Dokploy Application per environment, listening on container port `3000`.
- One PostgreSQL service and one Redis service per environment.
- One S3-compatible bucket per environment.
- A custom HTTPS domain per environment.

Do not expose PostgreSQL, Redis, or object-storage administration ports publicly.

## Required operator inputs

Prepare these values outside the repository:

- Dokploy base URL and API key.
- Dokploy server ID when deploying to a non-default server.
- Staging and production domains.
- GHCR image name and, for a private package, a read-only registry credential.
- PostgreSQL and Redis passwords.
- `AUTH_SECRET` and `ENCRYPTION_SECRET`.
- S3 endpoint, bucket, region, access key, and secret key.
- SMTP credentials when email verification or password reset is enabled.

Generate application secrets with `openssl rand -hex 32`. Do not reuse secrets between environments.

## Provisioning order

1. Create the `tnm-hr-platform` project.
2. Create `staging` and `production` environments.
3. Create and deploy a pinned-major PostgreSQL service in each environment.
4. Create and deploy a pinned-major Redis service in each environment.
5. Create the Application in each environment.
6. Configure the Application to pull the GHCR image.
7. Save runtime environment variables.
8. Add the HTTPS domain and route it to container port `3000`.
9. Configure health checks, rolling updates, resource limits, and restart policy.
10. Deploy staging, run acceptance checks, then deploy production.

Use the Dokploy API only after listing existing projects and services. Reuse matching resources rather than creating
duplicates.

## Runtime environment

Required:

```dotenv
NODE_ENV=production
PORT=3000
APP_URL=https://hr.example.com
DATABASE_URL=postgresql://<user>:<password>@<internal-postgres-host>:5432/<database>
AUTH_SECRET=<64-hex-secret>
```

Agent workspace and saved AI providers:

```dotenv
REDIS_URL=redis://:<password>@<internal-redis-host>:6379
ENCRYPTION_SECRET=<64-hex-secret>
```

S3-compatible storage:

```dotenv
S3_ACCESS_KEY_ID=<access-key>
S3_SECRET_ACCESS_KEY=<secret-key>
S3_REGION=<region>
S3_ENDPOINT=<https-endpoint>
S3_BUCKET=<bucket>
S3_FORCE_PATH_STYLE=false
```

Set `S3_FORCE_PATH_STYLE=true` only when required by the selected storage provider. Private agent attachments require
S3-compatible storage; local filesystem storage is not sufficient for that workflow.

Keep these settings disabled for an internet-facing deployment:

```dotenv
FLAG_DISABLE_API_RATE_LIMIT=false
FLAG_ALLOW_UNSAFE_AI_BASE_URL=false
FLAG_ALLOW_UNSAFE_OAUTH_REDIRECT_URI=false
```

## Dokploy application settings

Domain:

- HTTPS enabled with Let's Encrypt.
- Container port `3000`.
- Internal path `/`.
- Strip path disabled.

Health check:

```json
{
  "Test": [
    "CMD",
    "node",
    "-e",
    "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
  ],
  "Interval": 30000000000,
  "Timeout": 10000000000,
  "StartPeriod": 60000000000,
  "Retries": 3
}
```

Update configuration:

```json
{
  "Parallelism": 1,
  "Delay": 10000000000,
  "FailureAction": "rollback",
  "Order": "start-first"
}
```

Start with one application replica. The application runs database migrations during startup. Only increase replica count
after migrations follow an expand-migrate-contract strategy and concurrent startup has been validated.

## Deployment helper

The helper never reads a checked-in secret file and never prints the API key or registry password.

```bash
export DOKPLOY_URL="https://dokploy.example.com"
export DOKPLOY_API_KEY="<api-key>"
export DOKPLOY_APPLICATION_ID="<application-id>"
export DOKPLOY_IMAGE="ghcr.io/owner/repository@sha256:<digest>"
export DOKPLOY_REGISTRY_URL="ghcr.io"
export DOKPLOY_REGISTRY_USERNAME="<registry-user>"
export DOKPLOY_REGISTRY_PASSWORD="<read-packages-token>"
export APP_URL="https://staging.example.com"

pnpm deploy:dokploy preflight
pnpm deploy:dokploy deploy
```

For a public image, omit `DOKPLOY_REGISTRY_USERNAME` and `DOKPLOY_REGISTRY_PASSWORD`.

GitHub uses two Environments named `staging` and `production`. Each environment must define:

- Variable `DOKPLOY_ENABLED`, initially `false`; change it to `true` only after all secrets are configured.
- Variable `APP_URL`.
- Secrets `DOKPLOY_URL`, `DOKPLOY_API_KEY`, and `DOKPLOY_APPLICATION_ID`.
- Secrets `DOKPLOY_REGISTRY_USERNAME` and `DOKPLOY_REGISTRY_PASSWORD` only for a private GHCR package.

Production may also define `CLOUDFLARE_ENABLED=true` plus `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN`.
The image workflow publishes only to GHCR, so it does not require Docker Hub credentials.

## Acceptance checks

- `GET /api/health` returns `200` with healthy database and storage checks.
- Sign up, sign in, email verification, and password reset work as configured.
- Resume create/edit/version history works.
- PDF and DOCX export work.
- Upload and download work after an application restart.
- AI import and agent tools work when enabled.
- OAuth callbacks use the production HTTPS origin.
- No secret appears in application or deployment logs.
- A database backup and restore test succeeds.

## Rollback

1. Stop the rollout when health or acceptance checks fail.
2. Roll back to the previous image digest in Dokploy.
3. Do not automatically reverse a database migration.
4. If the schema is incompatible, restore the pre-deployment database backup before starting the old image.
5. Record the failed image digest, migration, logs, and recovery actions.

Application rollback is safe only while database changes remain backward compatible.
