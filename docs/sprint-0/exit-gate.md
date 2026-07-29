# Sprint 0 Exit Gate

Ngày đánh giá: `2026-07-21`.

## Kết luận

**Local technical baseline: GO.** Codebase đủ điều kiện bắt đầu Sprint 1 trên local. Sprint 0 chưa thể đóng hoàn toàn ở cấp
staging/pilot vì các gate phụ thuộc VPS/Dokploy, owner và dữ liệu tổ chức chưa được cung cấp.

## Gate status

| Gate | Status | Evidence / blocker |
|---|---|---|
| Fork và baseline commit được pin | PASS | Origin/upstream/commit/runtime đã ghi trong baseline manifest |
| Frozen install, typecheck, tests, boundaries, build | PASS | 18/18 typecheck; tests pass; 1.016 files; production build pass |
| Local DB/migrations/storage/health | PASS | PostgreSQL, migrations, API health và local storage pass |
| Auth/builder/version/share/export | PASS | Browser workflows và feature matrix |
| AI env provider + PDF/DOCX extraction | PASS | Server-only default provider; connection và 2 smoke cases pass |
| Vietnamese 1/2/3-page PDF quality | PASS | 60/60 PDFs; 15 templates; no low-content pages |
| CI definition | PASS | `quality.yml` lint pass; GitHub run chờ push |
| License/security baseline | CONDITIONAL | No critical/high; 1 moderate advisory và asset clearance actions tracked |
| Architecture extension points/ADR | PASS | Module/flow map; ADR-001/002/003 |
| JSON import UI | NOT RUN | In-app browser không hỗ trợ file upload; importer package tests pass |
| Drag between layout columns | PARTIAL | Hide/persistence pass; interactive drag vẫn cần manual QA |
| Dokploy staging + persistence | WAITING | Cần VPS, domain, access, region và secret owner |
| Backup/restore drill | WAITING | Thực hiện cùng staging; không xóa local volume để giả lập |
| Second environment reproduction | WAITING | Cần người/máy thứ hai hoặc CI run đầu tiên |
| Pilot participant pipeline | WAITING | Đã chốt HR nội bộ; cần 3-5 HR users và owner discovery |
| AI/legal retention policy | WAITING | Cần retention, legal basis và provider data policy |

## Work remaining to close Sprint 0

Không cần dừng Sprint 1 local vì các mục dưới đây, nhưng phải hoàn tất trước khi dùng CV thật trên staging:

1. Cung cấp Dokploy/VPS access, domain, region, backup target và secret owner.
2. Push branch/PR để lấy CI run đầu tiên; một môi trường sạch reproduce install/build/golden suite.
3. Chạy manual JSON upload và drag/reorder; lưu screenshot hoặc issue nếu fail.
4. Chọn 3-5 HR nội bộ cho discovery/pilot và xác nhận quyền dùng corpus.
5. Chốt AI retention, provider training policy, disclosure và deletion behavior.
6. Pin Postgres/Redis/SeaweedFS/MinIO images bằng version/digest trước staging.

## Next sprint

Sprint 1 bắt đầu với ProductConfig, Organization/Membership, server-side authorization, Candidate CRUD/UI và
Candidate-to-Resume variant. Backlog/estimate nằm trong `sprint-1-backlog.md`.
