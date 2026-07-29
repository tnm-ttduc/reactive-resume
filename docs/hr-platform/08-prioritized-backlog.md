# Prioritized Backlog

## Priority convention

- P0: cần để chạy baseline/Pilot an toàn.
- P1: tạo giá trị trực tiếp trong Pilot.
- P2: sau khi Pilot chứng minh nhu cầu.
- P3: research/later.

## Epic A — Foundation and upstream

| ID | P | Story | Acceptance summary |
|---|---:|---|---|
| A1 | P0 | Pin fork baseline | Commit/tag, container image digest và changelog được ghi lại |
| A2 | P0 | Local/staging deployment | Healthcheck, migration, persistent storage, TLS staging hoạt động |
| A3 | P0 | Third-party notices | MIT notice và dependency/asset inventory bản đầu |
| A4 | P0 | Product config | Name/logo/domain/email/flags không hard-code rải rác |
| A5 | P0 | CI quality gate | Typecheck/test/build/boundary chạy tự động |
| A6 | P1 | Upstream sync drill | Merge/rebase thử và report conflict/risk |

## Epic B — Organization and access

| ID | P | Story | Acceptance summary |
|---|---:|---|---|
| B1 | P0 | Organization model | User có organization context hợp lệ |
| B2 | P0 | Membership/RBAC | Owner/Admin/Recruiter/Viewer được enforce server-side |
| B3 | P0 | Tenant isolation test | Không đọc/ghi resource tenant khác qua ID tampering |
| B4 | P1 | Invitation | Invite/accept/revoke có expiry và audit |
| B5 | P2 | SSO/domain policy | Sau enterprise discovery |

## Epic C — Candidate workspace

| ID | P | Story | Acceptance summary |
|---|---:|---|---|
| C1 | P0 | Candidate CRUD | List/create/edit/archive trong organization |
| C2 | P0 | Master profile | Structured data và schema validation |
| C3 | P1 | Source documents | Upload validated, ownership, storage, delete |
| C4 | P1 | Notes/tags/owner | Private access theo role |
| C5 | P1 | Import content | PDF/DOCX → draft profile với review |
| C6 | P2 | Bulk import | Sau đo nhu cầu và data quality |

## Epic D — Resume operations

| ID | P | Story | Acceptance summary |
|---|---:|---|---|
| D1 | P0 | Candidate → Resume | Tạo snapshot rõ source và target job |
| D2 | P0 | Multiple variants | Candidate có nhiều resume độc lập |
| D3 | P0 | Duplicate/version | Snapshot immutable, restore không mất current version |
| D4 | P1 | Diff/approval | Reviewer thấy thay đổi và approve/reject |
| D5 | P1 | Sync from candidate | Explicit diff, không overwrite ngầm |

## Epic E — Anonymization and branding

| ID | P | Story | Acceptance summary |
|---|---:|---|---|
| E1 | P0 | PII mask policy | Email/phone/address/name/photo field options; preview=export |
| E2 | P0 | Organization branding | Logo/color/footer có validation |
| E3 | P1 | Client branding override | Permission và fallback rõ |
| E4 | P1 | Cover page | Versioned, không phá pagination |
| E5 | P0 | Export audit | Actor/resume version/policy/template/timestamp |

## Epic F — AI assistance

| ID | P | Story | Acceptance summary |
|---|---:|---|---|
| F1 | P1 | Rewrite with diff | Không apply tự động; user accept/reject |
| F2 | P1 | No-fabrication guardrail | Không sinh metric mới; hỏi/placeholder nếu thiếu |
| F3 | P1 | Translate/shorten | Locale rõ, preserve facts |
| F4 | P0 | Provider/privacy policy | Admin kiểm soát provider; disclosure/retention |
| F5 | P2 | JD matching | Giải thích keyword/gap; không score giả precision |

## Epic G — Rendering quality

| ID | P | Story | Acceptance summary |
|---|---:|---|---|
| G1 | P0 | Vietnamese font suite | Dấu tiếng Việt đúng trên preview/PDF/DOCX supported |
| G2 | P0 | Golden PDF regression | ATS/corporate/portfolio, 1–3 trang |
| G3 | P0 | Export warnings | Missing font/overflow/unsupported style observable |
| G4 | P1 | Artifact naming | Safe, configurable, deterministic |
| G5 | P1 | Accessibility HTML/public | Semantic output khi public page in scope |

## Epic H — Architecture bridge

| ID | P | Story | Acceptance summary |
|---|---:|---|---|
| H1 | P1 | Canonical schema | Versioned fixtures và adapter tests |
| H2 | P1 | Renderer interface | Legacy renderer behind registry |
| H3 | P1 | Template metadata/version | Exact engine/version resolution |
| H4 | P1 | Legacy parity | Visual diff within approved threshold |

## Epic I — Template Platform

| ID | P | Story | Acceptance summary |
|---|---:|---|---|
| I1 | P2 | AST schema | Unknown/unsafe nodes rejected, migration path |
| I2 | P2 | Component registry | Props/binding/variant/pagination contracts |
| I3 | P2 | AST ATS template | Pass 5 datasets |
| I4 | P2 | AST portfolio template | Structured + visual layer pass |
| I5 | P2 | Internal editor | Tree/live preview/properties/draft/publish |
| I6 | P3 | PDF compiler experiment | Draft AST + confidence + review |
| I7 | P3 | DOCX compiler experiment | Separate extraction/evaluation |

## Pilot Definition of Done

- Unit/integration/tenant authorization tests pass.
- Relevant golden export cases pass.
- Telemetry and audit are present without raw PII logs.
- Migration and rollback documented.
- Product acceptance criteria passed on staging.
- Privacy/security checklist reviewed.
- User-facing Vietnamese/English strings reviewed.
