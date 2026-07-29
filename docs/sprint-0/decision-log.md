# Sprint 0 Decision Log

Ngày ghi nhận: `2026-07-21`.

## D-001 — Staging

- Quyết định: triển khai trên VPS bằng Dokploy.
- Trạng thái: chưa cần triển khai staging thực tế trong checkpoint hiện tại.
- Thông tin chờ: host, SSH/deployment access, domain, TLS, region, backup target và secret ownership.

## D-002 — AI provider

- Quyết định sản phẩm: dùng một API tương thích chuẩn OpenAI.
- Cấu hình mong muốn: base URL, API key và model được inject qua environment variables.
- Không lưu key trong repository hoặc tài liệu.

### Trạng thái triển khai

Reactive Resume `5.2.3` hiện quản lý AI provider theo user:

- provider/model/base URL và API key được cấu hình từ Integrations UI;
- credential được mã hóa và lưu trong PostgreSQL;
- provider cần được test thành công trước khi bật;
- `REDIS_URL` và `ENCRYPTION_SECRET` là điều kiện cho AI provider/agent workspace.

HR Platform đã bổ sung global OpenAI-compatible provider đọc trực tiếp từ env. Cấu hình này là server-only,
được ưu tiên làm provider mặc định và hiển thị read-only trong Integrations UI. Provider lưu theo user vẫn được giữ làm fallback.

### Contract đề xuất

Adapter sử dụng các biến sau:

```dotenv
AI_PROVIDER_BASE_URL=""
AI_PROVIDER_API_KEY=""
AI_PROVIDER_MODEL=""
```

Yêu cầu triển khai:

- server-only; không đưa API key vào web bundle;
- base URL phải qua SSRF/safe URL policy hiện có;
- env provider là mặc định cho HR nội bộ;
- không ghi key vào log, API response hoặc audit metadata;
- có health/test connection không làm lộ credential;
- có hành vi rõ khi thiếu một trong ba biến;
- giữ khả năng chuyển lại provider theo user bằng feature flag hoặc ADR.

Nếu endpoint local/LAN dùng HTTP hoặc private IP, local development cần đặt
`FLAG_ALLOW_UNSAFE_AI_BASE_URL="true"`. Không bật cờ này trên staging/production public nếu chưa có kiểm soát SSRF phù hợp.

Kết quả smoke test:

- connection test pass;
- DOCX extraction pass;
- PDF extraction pass sau khi thêm local PDF text extraction;
- adapter hỗ trợ response JSON non-stream bị provider gắn nhầm `text/event-stream`/`[DONE]` mà không thay đổi luồng streaming thật.

## D-003 — Test data

- Chủ dự án đã đặt 7 file CV vào `research/input-cvs/` (4 PDF, 3 DOCX).
- File CV bị Git ignore để giảm rủi ro commit PII.
- Ưu tiên dữ liệu anonymized; quyền sử dụng phải rõ.

## D-004 — Pilot segment

- Phân khúc ưu tiên: HR nội bộ.
- Hệ quả discovery: ưu tiên chuẩn hóa CV cho hiring manager, quyền truy cập nội bộ, private notes, approval, audit và retention.
- Agency/client branding vẫn là khả năng tương lai, không phải giả định chính của pilot đầu tiên.
