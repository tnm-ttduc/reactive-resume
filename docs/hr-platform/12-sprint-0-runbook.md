# Sprint 0 Runbook (2 tuần)

## Sprint goal

Có một Reactive Resume baseline được pin và chạy ổn định ở local/staging, có audit kỹ thuật/pháp lý đủ để bắt đầu HR Platform mà không tạo fork debt không kiểm soát.

## Day 1–2 — Repository and legal baseline

- Tạo GitHub organization/repository theo quyết định công ty.
- Add upstream remote, pin tag/commit/image digest.
- Copy/retain MIT license; tạo third-party notices skeleton.
- Inventory fonts/icons/images/dependencies.
- Ghi product/trademark rebrand rules.

Evidence:

- Repository settings screenshot/export.
- Baseline manifest.
- License checklist owner/date.

## Day 2–4 — Local and staging

- Node.js/pnpm versions theo pinned baseline.
- PostgreSQL; local/S3 storage; Redis nếu bật AI agent.
- `.env.example` riêng cho HR Platform, không chứa secret.
- Build/test/start.
- Staging HTTPS, persistent volume, healthcheck.
- SMTP dev/staging behavior rõ.

Evidence:

- Deployment guide.
- Healthcheck/log sample đã redacted.
- Backup and restore smoke test.

## Day 4–6 — Feature verification

Test matrix:

- Register/login/logout/password reset.
- Create/edit/duplicate/delete resume.
- Reorder/hide sections.
- Version snapshot/restore.
- Import JSON/PDF/DOCX (khi AI configured).
- Export PDF/DOCX/JSON.
- Public/private/password share.
- Vietnamese/English, A4/Letter/free-form.
- 1/2/3-page samples.
- 15 template smoke test.

Ghi pass/fail/evidence/owner/issue; không chỉ checklist yes/no.

## Day 5–8 — Codebase audit

Vẽ flow:

- builder state → API → DB;
- resume schema → template selection → PDF;
- PDF/DOCX import → AI → sanitize/schema;
- export PDF/DOCX/JSON;
- auth/session/resource authorization;
- storage upload/delete.

Xác định extension points cho:

- ProductConfig;
- organizations/candidates;
- Canonical adapter;
- Renderer Bridge;
- audit events.

## Day 7–9 — Quality and security baseline

- Run typecheck/tests/build/boundary.
- Set CI.
- Dependency/SBOM/container vulnerability scan.
- Threat modeling workshop 60–90 phút.
- Cross-user access tests trên API hiện tại.
- Log review để tìm PII/secrets.
- Golden PDF fixtures và visual diff approach.

## Day 8–10 — Product discovery preparation

- Recruit 8–12 participants.
- Chọn 3 workflow observations.
- Tạo template corpus permission form/metadata.
- Chốt baseline time measurement.
- Chọn 30 CV pilot dự kiến hoặc synthetic/redacted equivalent.

## Sprint deliverables

- `baseline-manifest.md`.
- `deployment-guide.md`.
- `feature-verification-matrix.md`.
- `reactive-resume-module-map.md`.
- `data-render-import-export-flow.md`.
- `license-and-asset-inventory.md`.
- `threat-model-v0.md`.
- `golden-test-plan.md`.
- ADR-001/002/003 draft.
- Sprint 1 backlog estimates.

## Exit criteria

- Baseline reproduced by a second engineer/environment.
- Staging survives restart and data persists.
- Backup restore smoke test succeeds.
- Vietnamese PDF pass trên golden sample.
- Known license/security blocker có owner/decision.
- Extension points được tech lead review.
- Pilot participant pipeline tồn tại.

## Do not do in Sprint 0

- Không redesign UI.
- Không migrate toàn bộ schema.
- Không code Template AST/Compiler.
- Không bật public production với dữ liệu thật.
- Không dùng `latest` image/tag cho baseline.
- Không hard-code rebrand vào hàng chục file trước ProductConfig.

## Suggested kickoff questions

1. Baseline release/commit chính thức là gì?
2. Ai giữ quyền owner repository/cloud/secrets?
3. Region/data residency nào?
4. AI provider nào được phép ở Pilot?
5. Pilot data có thật hay redacted/synthetic?
6. Ai ký acceptance cho PDF quality và privacy?
