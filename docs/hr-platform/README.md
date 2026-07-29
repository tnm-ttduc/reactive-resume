# HR Platform — Hồ sơ chuẩn bị phát triển

Phiên bản tài liệu: `0.1`
Ngày cập nhật: `2026-07-21`
Trạng thái: Discovery / pre-development

## Mục đích

Bộ tài liệu này chuyển hóa ý tưởng “Web Tool for HR CV Builder” thành một chương trình phát triển có thể thực thi. Chiến lược được chọn là dùng Reactive Resume làm product shell và baseline kỹ thuật, tạo giá trị HR sớm, sau đó thay dần phần lõi bằng Canonical Resume Model, Renderer Bridge, Template AST, Template Editor và Template Compiler của HR Platform.

## Quyết định cấp cao

1. Tên sản phẩm làm việc: **HR Platform**.
2. Khách hàng đầu tiên: HR nội bộ, headhunter và recruitment agency.
3. Không xây lại toàn bộ UI/UX từ đầu.
4. Không sửa sâu Reactive Resume ngay trong sprint đầu.
5. Candidate là hồ sơ gốc; Resume là một phiên bản trình bày theo job/khách hàng.
6. Legacy renderer và AST renderer phải chạy song song trong giai đoạn chuyển đổi.
7. PDF/DOCX → template là quy trình semi-automatic có human review, không hứa pixel-perfect tự động.

## Danh mục tài liệu

| Tài liệu | Mục đích | Người đọc chính |
|---|---|---|
| [01-executive-brief.md](01-executive-brief.md) | Bản tóm tắt để ra quyết định | Founder, sponsor |
| [02-product-requirements.md](02-product-requirements.md) | Vision, persona, scope, user flow, KPI | Product, design, engineering |
| [03-reactive-resume-assessment.md](03-reactive-resume-assessment.md) | Audit baseline và gap analysis | Tech lead, architect |
| [04-target-architecture.md](04-target-architecture.md) | Kiến trúc đích và chiến lược migration | Engineering |
| [05-template-platform-spec.md](05-template-platform-spec.md) | Định hướng Template AST/Editor/Compiler | Rendering team |
| [06-domain-data-model.md](06-domain-data-model.md) | Domain model và dữ liệu đa tenant | Backend, data |
| [07-roadmap-and-delivery-plan.md](07-roadmap-and-delivery-plan.md) | Roadmap, gate và deliverable | Product, delivery |
| [08-prioritized-backlog.md](08-prioritized-backlog.md) | Backlog theo epic và acceptance | Delivery team |
| [09-discovery-and-research-plan.md](09-discovery-and-research-plan.md) | Phỏng vấn, template corpus, experiment | Product, research |
| [10-non-functional-security-privacy.md](10-non-functional-security-privacy.md) | NFR, bảo mật, dữ liệu cá nhân | Engineering, security |
| [11-risks-decisions-and-governance.md](11-risks-decisions-and-governance.md) | Risk register, ADR, upstream policy | Leadership, tech lead |
| [12-sprint-0-runbook.md](12-sprint-0-runbook.md) | Checklist bắt đầu triển khai | Engineering team |
| [13-source-register.md](13-source-register.md) | Nguồn chính thức và snapshot nghiên cứu | Tất cả |

## Cách dùng bộ tài liệu

- Founder/Product đọc 01, 02, 07, 09 trước.
- Tech lead đọc 03–06, 10–12 trước khi tạo repository chính thức.
- Mọi thay đổi kiến trúc quan trọng phải được ghi thành ADR và liên kết từ tài liệu 11.
- Mọi scope đưa vào sprint phải có acceptance criteria từ tài liệu 08 hoặc issue tương đương.
- Sau khi fork chính thức, cập nhật commit baseline, dependency/license inventory và đường dẫn repository trong 03, 11, 12, 13.

## Definition of Ready để bắt đầu coding

- Có product owner và tech lead chịu trách nhiệm.
- Có 5–10 HR/recruiter đồng ý discovery, tối thiểu 3 người đồng ý pilot.
- Có template corpus hợp pháp để nghiên cứu: ATS, corporate, two-column, creative/portfolio.
- Có fork private/public phù hợp với chiến lược công ty và baseline commit được pin.
- Có môi trường local + staging, backup và test account.
- Có ADR-001 đến ADR-005 bản đầu.
- Có scope Pilot MVP được chốt và các non-goal được chấp thuận.

## Mốc thành công đầu tiên

Một recruiter có thể tạo candidate, tạo nhiều CV version, ẩn thông tin nhạy cảm, áp branding agency, chỉnh nội dung, preview và export PDF trong dưới 15 phút; đồng thời upstream baseline vẫn có thể được đồng bộ có kiểm soát.
