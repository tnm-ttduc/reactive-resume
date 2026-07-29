# Baseline Manifest

## Source

| Field | Value |
|---|---|
| Product working name | HR Platform |
| Origin | `git@github.com:tnm-ttduc/reactive-resume.git` |
| Upstream | `git@github.com:amruthpillai/reactive-resume.git` |
| Branch | `main` |
| Commit | `689e7e24d45a0744d33f39ed1f1cfe872d58e933` |
| Commit date | `2026-07-09T08:50:34-05:00` |
| Commit subject | `Filter invalid style intents to preserve valid custom styles (#3241)` |
| Package version | `5.2.3` |
| License | MIT |

## Local toolchain

| Component | Version |
|---|---|
| macOS | `15.7.7` (`24G720`) |
| Node.js | `24.14.0` |
| pnpm | `11.10.0` |
| Docker | `28.3.0` |
| Docker Compose | `2.38.2-desktop.1` |
| PostgreSQL image | `postgres@sha256:3a82e1f56c8f0f5616a11103ac3d47e632c3938698946a7ad26da0df1334744a` |

## Reproducibility command

Use the pinned runtime when Volta is installed:

```bash
volta run --node 24.14.0 --pnpm 11.10.0 pnpm install --frozen-lockfile
volta run --node 24.14.0 --pnpm 11.10.0 pnpm typecheck
volta run --node 24.14.0 --pnpm 11.10.0 pnpm test
volta run --node 24.14.0 --pnpm 11.10.0 pnpm exec turbo boundaries
volta run --node 24.14.0 --pnpm 11.10.0 pnpm build
```

## Baseline verification

| Gate | Result | Evidence summary |
|---|---|---|
| Lockfile install | PASS | Frozen lockfile; supply-chain policy pass 1,490 entries |
| Typecheck | PASS | 18/18 tasks |
| Unit tests | PASS | All monorepo test tasks completed successfully |
| Boundaries | PASS | 1,016 files checked across 19 packages, no issues |
| Production build | PASS | Server and web builds completed |
| Database | PASS | PostgreSQL healthy; migrations applied |
| API health | PASS | Service, database and local storage healthy |
| Web smoke | PASS | HTTP 200; landing page rendered in browser |
| Register/dashboard | PASS | Local test account created and dashboard loaded |
| Resume create/autosave | PASS | Resume created; saved state observed |
| Vietnamese preview | PASS | Vietnamese name, headline, phone and location rendered correctly |
| Browser feature flows | PASS | Auth, version/restore, duplicate/delete, sharing, locale and exports |
| Golden PDF suite | PASS | 60 PDFs; all templates pass 1/2/3-page Vietnamese cases |
| Production dependency audit | CONDITIONAL | 0 critical/high; 1 moderate OAuth-provider advisory tracked |

## Known caveats

- The Docker Compose source still references mutable `latest` tags; recorded digest is evidence, not yet a source pin.
- Local `.env.local` is intentionally gitignored and contains a generated development-only secret.
- Redis, S3/SeaweedFS, SMTP and social login are not part of the current local baseline.
- Default OpenAI-compatible env provider is enabled and passed connection, PDF and DOCX extraction smoke tests.
- Dokploy/VPS backup/restore and container digest pinning remain pending until staging access is supplied.
