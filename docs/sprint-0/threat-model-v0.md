# Threat Model v0

Phạm vi: local baseline, AI OpenAI-compatible provider, future Dokploy/VPS staging. Pilot ưu tiên HR nội bộ.

## Assets và trust boundaries

- Restricted: CV nguồn, resume JSON, email/phone/address/photo, private notes, AI prompt/result.
- Confidential: API key AI, auth/encryption secrets, database backup, template và cấu hình nội bộ.
- Boundaries: browser to Hono API; API to PostgreSQL/storage/Redis; API to AI provider; Dokploy/VPS to operator; public
  resume link to anonymous viewer.

## Top threats

| ID | Threat | Control hiện có | Action trước staging |
|---|---|---|---|
| T1 | Cross-user/cross-tenant ID tampering | Owner filter trong resume service | Thêm organization boundary và negative authz tests |
| T2 | PII bị gửi quá mức cho AI | Local text extraction, server-only credential | Data minimization, disclosure, provider retention decision |
| T3 | SSRF qua custom AI base URL | Safe URL policy, unsafe flag chỉ cho local | Không bật unsafe flag trên staging; egress allowlist |
| T4 | API key lộ qua bundle/log | Env provider server-only; UI read-only | Secret scan, Dokploy secret ownership, log redaction review |
| T5 | File độc hại/parser exhaustion | Schema/content handling hiện có | MIME/magic-byte/size/page limits và quarantine/malware plan |
| T6 | Public resume/PII lộ ngoài ý muốn | Public off mặc định, optional password | Audit share changes; expiry/revoke; policy theo organization |
| T7 | Backup hoặc object storage lộ | Local storage trong Sprint 0 | Encrypted backup, private bucket, restore drill, retention |
| T8 | Auth/OAuth advisory | OAuth-provider advisory moderate đã ghi nhận | Không bật affected capability; upgrade/test trước production |
| T9 | AI prompt injection từ CV | CV được xem là data trong extraction | Prompt contract, output schema validation, human review |
| T10 | Supply-chain/image drift | Baseline commit/runtime pin | Pin container images/digests; CI; SBOM/container scan |

## Abuse cases cần test

- User A đọc/sửa/export resume của User B bằng ID đoán được.
- Anonymous viewer mở private/locked resume hoặc bypass password.
- Upload file đổi extension, file quá lớn, zip bomb DOCX hoặc PDF không có text layer.
- AI base URL trỏ metadata endpoint/private address khi unsafe flag tắt.
- Prompt trong CV yêu cầu model bỏ qua schema hoặc tiết lộ credential.
- Xóa candidate nhưng source file, AI result hoặc export artifact vẫn còn.

## Sprint 0 disposition

Local test data được cô lập và source CV bị Git ignore. Chưa đưa dữ liệu thật lên staging. Threat model phải được review lại
khi có organization/candidate domain và trước khi staging nhận CV pilot.
