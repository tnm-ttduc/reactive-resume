# Roadmap and Delivery Plan

## 1. Assumptions

- Core team: 1 Product Owner, 1 Tech Lead/Full-stack, 1 Full-stack, designer/QA part-time.
- Roadmap dùng outcome/gate; thời lượng sẽ thay đổi theo team và discovery.
- Reactive Resume được pin tại một commit/release, không chạy theo `latest` trong production.

## 2. Phase 0 — Discovery and baseline (Tuần 1–2)

### Outcomes

- Fork/build/test được baseline.
- Legal/third-party inventory bản đầu.
- Hiểu data/render/import/export/auth flow.
- Product scope và pilot cohort được chốt.

### Deliverables

- Local + staging runbook.
- Baseline feature matrix.
- Architecture/module map.
- ADR-001 Foundation, ADR-002 Canonical model, ADR-003 Renderer Bridge.
- Golden resume dataset và 3 template samples.
- Pilot interview plan.

### Exit gate

- PDF tiếng Việt/multi-page pass smoke test.
- Backup/restore staging được diễn tập.
- Không có license blocker đã biết.
- Tech lead xác định được extension points.

## 3. Phase 1 — Product foundation (Tuần 3–4)

### Outcomes

- Rebrand không làm fork lan rộng.
- Product config/feature flags tập trung.
- CI, test, security baseline.

### Deliverables

- Brand/config module.
- CI: typecheck, unit, boundary, build, container scan cơ bản.
- Environment/secrets matrix.
- Observability baseline.
- Upstream sync procedure.

### Exit gate

- Một upstream test merge/rebase trial thành công.
- Staging reproducible từ pinned commit.

## 4. Phase 2 — HR Pilot MVP (Tuần 5–10)

### Increment A: Tenant and candidate

- Organization, membership, roles.
- Candidate list/detail/master profile/documents/notes.
- Tenant authorization tests.

### Increment B: Resume operations

- Candidate → resume.
- Multiple resume variants.
- Version/restore.
- Job/client metadata.

### Increment C: Client-ready output

- Anonymization.
- Branding.
- PDF export audit.
- AI rewrite guardrails/diff.

### Exit gate

- 5 recruiter/2 organizations/30 real CV pilot.
- Không có PII leak severity 1/2.
- ≥95% golden export pass.
- Median time-to-ready giảm ≥50%.

## 5. Phase 3 — Architecture bridge (Tuần 11–12)

- Canonical schema v0.1 và adapters.
- Renderer interface/registry.
- Legacy renderer output parity.
- Template metadata có engine/version.

### Exit gate

Golden legacy PDFs không thay đổi ngoài ngưỡng đã duyệt; builder không gọi template implementation trực tiếp ở flow mới.

## 6. Phase 4 — Template AST prototype (Tuần 13–16)

- AST schema, component registry, tokens.
- Structured + visual layer.
- ATS parity template.
- Creative/portfolio template.
- Pagination/asset diagnostics.

### Exit gate

Hai template chạy trên 5 dataset dài/ngắn, visual quality được reviewer duyệt, output reproducible theo version.

## 7. Phase 5 — Internal Template Editor (Tháng 5)

- Tree/layer/properties/live preview.
- Draft/review/publish/version.
- Dataset switch và visual regression.

### Exit gate

Operator không code tạo một brand variant và chỉnh layout supported trong dưới 60 phút.

## 8. Phase 6 — Template Compiler R&D (Tháng 6+)

- PDF/DOCX extraction experiments.
- Semantic/layout/token mapping.
- Draft AST, confidence, unsupported report.
- Human correction workflow.

### Exit gate

Giảm ≥50% thời gian tạo template trên 3 mẫu đại diện trước khi quyết định productionize.

## 9. Release strategy

- `foundation`: baseline deployable gần upstream.
- `pilot`: HR features sau feature flags.
- `ast-alpha`: internal only.
- Template publish tách khỏi application deployment khi schema/registry ổn định.
- Canary theo organization cho renderer/template mới.

## 10. Team cadence

- Weekly product discovery review.
- Weekly PDF/golden regression review.
- Biweekly architecture decision review.
- Monthly upstream sync/security review.
- Pilot feedback trong 24–48 giờ sau session sử dụng.

## 11. Budget categories cần dự toán

- Engineering/design/QA.
- Managed DB/storage/Redis/email/observability.
- AI parsing/rewrite/token cost.
- Security/legal/privacy review.
- Fonts/icons/assets license.
- Pilot onboarding/support.

Không chốt con số trước khi đo: file size, resumes/month, exports/month, AI actions/resume và retention.
