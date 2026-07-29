# TNM HR Platform

TNM HR Platform is a resume and job-application workspace for creating, managing, tailoring, and sharing professional resumes.

## Capabilities

- Resume builder with reusable templates and live preview
- PDF, DOCX, and JSON import/export
- Job application tracking and resume linking
- AI-assisted resume analysis and tailoring
- Authentication, API keys, OpenAPI, and MCP integrations
- Self-hosted deployment with PostgreSQL and optional S3-compatible storage

## Local development

Requirements:

- Node.js 24
- pnpm 11.10
- PostgreSQL

Copy `.env.example` to `.env.local`, configure the required values, then run:

```bash
pnpm install
dotenvx run -f .env.local -- pnpm dev
```

The application is available at `http://localhost:3000` by default.

## Validation

```bash
pnpm typecheck
pnpm test
pnpm exec turbo boundaries
pnpm build
```

## License and third-party notices

This repository is licensed under the MIT License. See `LICENSE` and `THIRD_PARTY_NOTICES.md` for required upstream copyright
and attribution notices.
