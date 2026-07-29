# Sprint 1 Backlog: HR Internal Foundation

Giả định: 2 tuần, 1 tech lead/full-stack + 1 full-stack, product/QA part-time. Estimates là ideal engineering days và
phải recalibrate sau refinement.

## Sprint goal

Một HR nội bộ có organization mặc định, tạo và quản lý Candidate master profile, rồi tạo một Resume variant bằng legacy
builder mà không phá upstream baseline.

| ID | Deliverable | Estimate | Acceptance |
|---|---|---:|---|
| S1-01 | ProductConfig và feature flags | 2d | Tên/logo/link/flags có một nguồn cấu hình; không rebrand rải rác |
| S1-02 | Organization + membership schema | 3d | User có organization context; migration/rollback documented |
| S1-03 | Server-side organization authorization | 3d | Cross-org ID tampering tests fail closed |
| S1-04 | Candidate schema + CRUD API | 4d | Create/list/read/update/archive trong organization |
| S1-05 | Candidate list/detail UI | 4d | HR hoàn tất basic profile bằng tiếng Việt |
| S1-06 | Candidate -> Resume variant | 3d | Snapshot source rõ; mở được legacy builder/export |
| S1-07 | Audit skeleton | 2d | Candidate create/update và resume export có actor/resource/result |
| S1-08 | CI/golden hardening | 2d | Quality workflow pass; visual baseline strategy được chốt |

Tổng ước lượng thô: 23 ideal days. Team phải cắt theo capacity; lát cắt bắt buộc là S1-01 đến S1-06, audit có thể chỉ
ghi event tối thiểu.

## Không thuộc Sprint 1

- Template AST/editor/compiler.
- ATS/CRM pipeline, client workspace hoặc billing.
- AI auto-apply, scoring không giải thích được.
- Rebrand marketing hoàn chỉnh hoặc staging production data.

## Exit gate

- Organization/candidate isolation tests pass.
- Một CV source synthetic/redacted tạo được Candidate và Resume variant end-to-end.
- Legacy PDF golden suite vẫn pass.
- Migration rollback và known risks được review.
