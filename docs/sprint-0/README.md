# Sprint 0 Execution Status

Ngày bắt đầu: `2026-07-21`
Baseline: `689e7e24d45a0744d33f39ed1f1cfe872d58e933` (`5.2.3`)
Trạng thái: **đang thực hiện**

## Đã hoàn thành

- Fork `tnm-ttduc/reactive-resume` được đặt tại repository root.
- `origin` trỏ tới fork; `upstream` trỏ tới repository chính thức.
- 14 tài liệu chuẩn bị được lưu tại `docs/hr-platform/`.
- Cài dependencies bằng pnpm `11.10.0` với frozen lockfile.
- Typecheck pass 18/18 tasks.
- Unit tests pass toàn monorepo.
- Package boundaries pass: 1.016 file, không có vi phạm ở lần chạy mới nhất.
- Production build pass bằng Node.js `24.14.0`.
- PostgreSQL local chạy healthy; migrations áp dụng thành công.
- API healthcheck pass; database và local storage healthy.
- Web app trả HTTP 200 và trang chủ render thành công trong trình duyệt.
- Đăng ký tài khoản local, vào dashboard và tạo CV mới thành công.
- Auto-save và preview hiển thị đúng chuỗi tiếng Việt có dấu trong hồ sơ cơ bản.
- 7 file CV đầu vào (4 PDF, 3 DOCX) mở và render thành công; đã ghi nhận hai blank-page edge cases.
- Default OpenAI-compatible provider có thể cấu hình hoàn toàn bằng env và được ưu tiên trước provider theo user.
- Kết nối AI env pass; smoke test AI extraction pass với một PDF và một DOCX trong corpus.
- Login/logout, password reset request, duplicate/delete, version/restore, sharing và Vietnamese UI locale pass.
- PDF, DOCX và JSON browser exports pass; exported Vietnamese PDF passed visual QA.
- Golden harness rendered 60/60 PDFs across 15 templates and deterministic 1/2/3-page datasets.
- Scizor trailing blank-page regression was found and fixed; 263 PDF package tests pass after the change.
- CI quality workflow, threat model, license/asset inventory, module/flow map và ADR-001/002/003 đã được thêm.

## Phát hiện baseline

1. Volta có thể chạy child process của pnpm bằng Node.js `22.16.0` dù shell đang dùng Node.js 24. Khi đó `tsdown` chọn config loader `unrun` và build thất bại vì optional peer chưa được cài. Dùng `volta run --node 24.14.0 --pnpm 11.10.0 ...` giải quyết và phù hợp yêu cầu repository.
2. `pnpm dev` chạy cả email preview; công cụ này ghi vào macOS Preferences và bị sandbox chặn. Chạy riêng `server` và `web` đủ cho local application smoke test.
3. `compose.dev.yml` dùng `postgres:latest`. Image local hiện tại đã được ghi digest trong baseline manifest; cần pin image trước khi coi staging là reproducible.

## Việc còn lại của Sprint 0

- Chạy JSON import synthetic end-to-end.
- Kiểm thử drag/reorder giữa main/sidebar; hide/persistence đã pass.
- Pin container images và diễn tập backup/restore khi có Dokploy/VPS.
- Chạy CI workflow trên GitHub và lưu link run đầu tiên.
- Chốt AI retention/legal basis và quyền sử dụng corpus trước dữ liệu pilot thật.

## Tài liệu thực thi

- [Baseline manifest](baseline-manifest.md)
- [Local deployment guide](deployment-guide.md)
- [Feature verification matrix](feature-verification-matrix.md)
- [Decision log](decision-log.md)
- [Input CV verification](input-cv-verification.md)
- [Golden PDF plan/results](golden-test-plan.md)
- [License and asset inventory](license-and-asset-inventory.md)
- [Threat model v0](threat-model-v0.md)
- [Module and flow map](module-and-flow-map.md)
- [Sprint 1 backlog](sprint-1-backlog.md)
- [Sprint 0 exit gate](exit-gate.md)

## Đầu vào đang chờ

- Thông tin Dokploy/VPS khi bắt đầu staging.
- Thông tin policy/retention của AI provider trước khi dùng dữ liệu production.
