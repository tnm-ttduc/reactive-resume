# Source Register

Ngày truy cập/đối chiếu: 2026-07-21.

## Primary sources

1. [Reactive Resume repository](https://github.com/amruthpillai/reactive-resume) — source code, README, release and project metadata.
2. [Reactive Resume package.json](https://github.com/amruthpillai/reactive-resume/blob/main/package.json) — version, package manager, monorepo scripts/dependencies.
3. [Project Architecture](https://docs.rxresu.me/contributing/architecture) — official runtime/workspace boundaries.
4. [Self-Hosting with Docker](https://docs.rxresu.me/self-hosting/docker) — infrastructure, env vars, PDF change from v5.1.
5. [Exporting Your Resume](https://docs.rxresu.me/guides/exporting-your-resume) — PDF/DOCX/JSON behavior and fidelity note.
6. [Importing Resumes](https://docs.rxresu.me/guides/importing-resumes) — user import behavior.
7. [Parse a DOCX file into resume data](https://docs.rxresu.me/api-reference/ai/parse-a-docx-file-into-resume-data) — AI structured extraction API.
8. [Reactive Resume releases](https://github.com/amruthpillai/reactive-resume/releases) — change history, v5.1 client-side PDF migration.
9. [MIT License](https://github.com/amruthpillai/reactive-resume/blob/main/LICENSE) — license text/notice requirement.
10. [Reactive Resume getting started](https://docs.rxresu.me/getting-started) — product capabilities.

## Local research snapshot

Một shallow clone chỉ phục vụ nghiên cứu được đặt trong workspace tại:

```text
work/reactive-resume-upstream
```

Snapshot:

- Commit: `689e7e24d45a0744d33f39ed1f1cfe872d58e933`.
- Commit message: `Filter invalid style intents to preserve valid custom styles (#3241)`.
- Commit date: 2026-07-09.
- `package.json` version: 5.2.3.

Các file đã đối chiếu trực tiếp:

- `AGENTS.md`;
- `docs/contributing/architecture.mdx`;
- `docs/self-hosting/docker.mdx`;
- `compose.yml`, `.env.example`, `Dockerfile`;
- `packages/schema/src/templates.ts`;
- `packages/schema/src/resume/data.ts`;
- `packages/pdf/src/templates/index.ts` và template sources;
- `packages/db/src/schema/resume.ts`;
- `packages/ai`, `packages/import`, `packages/docx`;
- `apps/web/src/routes` và feature/package maps;
- `LICENSE`.

## Verified facts used in this document set

- Project is MIT licensed, subject to notice inclusion.
- Snapshot is a pnpm/Turborepo monorepo with React/TanStack/Vite web and Hono server.
- PostgreSQL/Drizzle back persistence; local or S3-compatible file storage is supported.
- Redis is relevant to AI agent workspace, not a universal requirement for basic self-hosting.
- PDF generation moved to `@react-pdf/renderer` client-side from v5.1, while package boundaries also expose browser/server adapters.
- Snapshot registers 15 code-based PDF templates.
- PDF/DOCX import extracts structured resume content; it does not convert visual design into a reusable template.
- PDF, DOCX and JSON export are supported; DOCX visual fidelity may differ from PDF.
- Resume versions exist in the current DB model, but multi-tenant organization/candidate domain does not match HR Platform needs.

## Claims requiring later re-validation

- Latest version/release/commit at the date of official fork.
- Exact dependency and transitive license inventory.
- Security vulnerabilities and container CVEs.
- Cloud/provider pricing and regional availability.
- Vietnamese privacy, employment and data residency obligations.
- Trademark/branding clearance.
- Rights to all sample/company CV templates, fonts, icons and images.

## Research integrity notes

- Architecture recommendations are design proposals, not claims that Reactive Resume already implements them.
- Legal/privacy sections are preparation checklists, not legal advice.
- Time estimates are planning hypotheses; velocity and discovery evidence must recalibrate them.
- No competitor market claims or pricing claims were included without a dedicated market study.
