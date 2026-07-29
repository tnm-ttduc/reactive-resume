# Non-functional, Security and Privacy Requirements

## 1. Data classification

| Class | Ví dụ | Control tối thiểu |
|---|---|---|
| Restricted PII | CV, phone, email, address, photo, notes | Encrypt in transit/at rest, least privilege, audit, retention |
| Confidential | Client/job, template nội bộ, AI prompt/result | Tenant access, encryption, logging redaction |
| Internal | Metrics, non-sensitive config | Authenticated access |
| Public | Published resume/template marketing asset | Explicit publish action, revoke |

## 2. Security requirements

### Identity/access

- Server-side authorization cho mọi resource.
- MFA/passkey khuyến nghị cho admin/owner.
- Session expiration/revocation và secure cookie.
- Rate limiting cho auth/import/export/AI/public endpoints.
- API keys scoped, revocable, hashed where applicable.

### Tenant isolation

- Object-level authorization test với cross-tenant IDs.
- Organization context không chỉ lấy từ client input.
- File/object access dùng signed/authorized path.
- Background jobs preserve tenant/actor context.

### Upload/file processing

- Allowlist MIME/extension, magic-byte validation, size/page limits.
- Malware scanning hoặc quarantine strategy trước production.
- Filename không được dùng trực tiếp làm object path.
- PDF/DOCX parser chạy với resource/time limit.
- Không thực thi macro/external link/embedded code.

### Application

- Input/schema validation bằng Zod/contracts.
- Rich text sanitize; không cho arbitrary script/CSS.
- CSP, secure headers, CSRF strategy theo auth architecture.
- Dependency/SBOM/container scan định kỳ.
- Secrets ở secret manager/env, không commit/log.

## 3. AI privacy and safety

- Admin chọn provider được phép; hiển thị data-flow disclosure.
- Chỉ gửi field cần thiết cho action.
- Không dùng dữ liệu ứng viên để training nếu provider/config không bảo đảm theo policy.
- Lưu prompt/output theo retention đã chốt; hỗ trợ delete.
- Log metadata/cost/model, không log raw PII mặc định.
- Output là proposal; diff + user approval.
- Guardrail chống fabricated metrics/credentials/employment.
- Chống prompt injection từ file: nội dung CV là data, không phải instruction.

## 4. Privacy lifecycle

- Xác định legal basis/consent theo thị trường triển khai.
- Notice nêu purpose, provider/subprocessor, retention, sharing.
- Data subject workflow: access, correction, deletion/export nếu áp dụng.
- Retention theo candidate status và contract.
- Hard delete job bao phủ DB, object storage, AI attachment/result, artifacts/cache.
- Backup retention và restore behavior được tài liệu hóa.

Tài liệu này không thay tư vấn pháp lý. Cần counsel đánh giá quy định Việt Nam và thị trường mục tiêu trước launch.

## 5. Availability and recovery

Pilot target đề xuất:

- Availability: 99.5% monthly, loại trừ planned maintenance.
- RPO: 24 giờ lúc đầu; giảm theo contract.
- RTO: 4–8 giờ lúc đầu.
- Daily automated backup PostgreSQL và object storage durability policy.
- Quarterly restore drill; monthly cho production-critical giai đoạn sau.

## 6. Performance targets

Targets cần đo lại từ payload thật:

- P95 authenticated list/detail API < 500 ms trong normal load.
- Builder save acknowledgment < 1 s P95.
- Preview update < 500 ms cho thay đổi thông thường.
- PDF 1–3 trang hoàn tất < 10 s P95 trên thiết bị/reference environment hỗ trợ.
- Import/AI là asynchronous khi vượt request budget; có progress/retry/cancel.

## 7. Rendering quality

- Deterministic theo canonical version, template version, renderer version, font/asset checksum.
- Unicode Vietnamese và English.
- Golden datasets cho short/long/missing fields.
- Warning/error cho overflow, missing font/asset, unsupported node.
- Preview/anonymization/branding khớp export trong capability đã công bố.
- Browser/device support matrix được pin và test.

## 8. Accessibility/localization

- UI keyboard navigation, focus, labels, contrast theo design system.
- Locale formatting ngày/tháng và section label.
- Không hard-code text trong template engine.
- RTL giữ như capability của upstream nếu không có lý do loại bỏ.

## 9. Audit and incident response

Audit events tối thiểu:

- sign-in/admin/member changes;
- candidate create/view-sensitive/update/delete;
- resume export/share;
- anonymization/branding policy change;
- template publish;
- AI action ở mức metadata phù hợp.

Incident runbook cần owner, severity, containment, evidence preservation, notification decision và postmortem.

## 10. Pre-production checklist

- Threat model completed.
- Tenant isolation penetration tests.
- Privacy/counsel review.
- Backup restore drill.
- Secret rotation test.
- Dependency/license/SBOM review.
- PII removed from logs/analytics.
- File upload limits/scanning.
- Abuse/rate-limit tests.
- Golden export suite pass.
