# Reactive Resume Assessment

## 1. Snapshot được đánh giá

| Thuộc tính | Giá trị |
|---|---|
| Repository | [amruthpillai/reactive-resume](https://github.com/amruthpillai/reactive-resume) |
| Commit | `689e7e24d45a0744d33f39ed1f1cfe872d58e933` |
| Commit date | 2026-07-09 |
| Package version | 5.2.3 |
| License | MIT |
| Package manager | pnpm 11.10.0 |
| Runtime | Node.js 24 theo Dockerfile/AGENTS |

Thông tin phiên bản có thể thay đổi. Khi fork chính thức phải pin tag/commit mới và chạy lại audit.

## 2. Kết luận

Reactive Resume phù hợp làm **foundation/product shell**, nhưng không phải domain model cuối của HR Platform. Giá trị tái sử dụng lớn nhất nằm ở builder UX, UI primitives, authentication, resume editing, import/export, version history, preview, i18n và deployment shape. Khoảng trống lớn nhất là multi-tenant HR domain và template-as-data/AST.

## 3. Hiện trạng kiến trúc

Reactive Resume là pnpm/Turborepo monorepo, production chạy một Node process:

```text
Browser / React 19 / TanStack Router / Vite
        ↓ oRPC
Hono server
        ├── Better Auth
        ├── API feature routers
        ├── MCP / OpenAPI
        ├── PostgreSQL + Drizzle
        ├── filesystem hoặc S3 storage
        └── Redis cho AI agent workspace
```

Các package liên quan trực tiếp:

- `apps/web`: routes, builder, dashboard, preview/export UI.
- `apps/server`: Hono production adapter.
- `packages/schema`: Zod resume/page/template schema.
- `packages/pdf`: `@react-pdf/renderer`, primitives và template code.
- `packages/docx`: DOCX generation.
- `packages/import`: JSON/legacy importers.
- `packages/ai`: prompts, PDF/DOCX parsing, sanitize, patch contracts.
- `packages/api`: resume, AI, application, statistics, storage workflows.
- `packages/db`: resume, resume version, auth, application, agent tables.

Nguồn: [Project Architecture](https://docs.rxresu.me/contributing/architecture), [repository](https://github.com/amruthpillai/reactive-resume).

## 4. Capability inventory

### Có thể tái sử dụng sớm

- Authentication, social login/passkey/2FA foundations.
- Dashboard resume grid/list và builder shell.
- Structured resume forms, reorder section/item, rich text.
- 15 template React-PDF trong snapshot.
- PDF render phía browser từ v5.1 bằng `@react-pdf/renderer`.
- PDF server adapter cho use case server-side.
- DOCX, PDF, JSON export.
- JSON import và AI PDF/DOCX → structured resume data.
- Public resume, statistics.
- Version snapshot/restore.
- AI patch proposal pattern.
- UI/design system, i18n, responsive behavior.
- Docker/self-hosting với PostgreSQL; storage local hoặc S3-compatible.

Nguồn: [Export guide](https://docs.rxresu.me/guides/exporting-your-resume), [Self-hosting guide](https://docs.rxresu.me/self-hosting/docker), [DOCX parse API](https://docs.rxresu.me/api-reference/ai/parse-a-docx-file-into-resume-data).

### Cần mở rộng

- Dashboard → organization/candidate workspace.
- Auth → organization membership, RBAC/ABAC.
- Resume API → candidate association, approval, PII policy.
- Branding → organization/client-level assets và tokens.
- Versioning → business event labels, compare, audit.
- AI → consent, provider policy, no-fabrication guardrail.
- Storage → tenant ownership, retention, malware/content validation.

### Cần thay dần

- Template enum đóng (`z.enum`) và registry compile-time.
- Mỗi template là một React component code riêng.
- Resume JSON hiện trộn content và presentation metadata.
- Layout chỉ mô hình hóa page, main/sidebar và section order; chưa phải AST tổng quát.
- Template import chỉ lấy content, chưa lấy visual design.
- Không có Candidate master profile tách khỏi resume version.

## 5. Template/rendering assessment

Snapshot có 15 template được khai báo trong `packages/schema/src/templates.ts` và ánh xạ sang 15 `*Page.tsx` trong `packages/pdf/src/templates/index.ts`. Điều này ổn cho catalog đóng nhưng tạo coupling giữa schema, renderer source và preview assets.

Resume metadata đã có:

- template identifier;
- pages với `main`/`sidebar` section arrays;
- sidebar width;
- margins/gaps/page format;
- typography/color;
- section pagination flags;
- constrained semantic style rules.

Đây là nền tảng tốt để thiết kế adapter, nhưng chưa đủ biểu diễn portfolio template với layer, asymmetric grid, reusable component variants và independent versioning.

## 6. Import/export assessment

### Import hiện tại

```text
PDF/DOCX → AI extraction → Reactive Resume data → schema validation/sanitize
```

Nó giải bài toán **content extraction**, không giải bài toán **design extraction**.

### Export hiện tại

- PDF: React PDF, browser-side từ v5.1; server adapter cũng tồn tại trong package.
- DOCX: renderer riêng, phù hợp editable output; không nên cam kết giống PDF tuyệt đối.
- JSON: backup/portability.

### Hàm ý cho HR Platform

- Tái sử dụng upload, provider setup, extraction prompt pattern và validation.
- Tạo branch mới cho visual analysis; không nhồi Template AST vào Resume Data.
- PDF quality cần visual regression riêng vì React PDF không phải browser CSS engine.

## 7. Data model gaps

Reactive Resume hiện gắn resume trực tiếp với user và lưu `ResumeData` trong JSONB. Có `resume_version`, statistics và analysis. HR Platform cần thêm organization, membership, candidate, documents, notes, branding, policy, audit và quan hệ candidate–resume.

Không nên nhét toàn bộ HR data vào JSONB `resume.data`. Dữ liệu cần query/policy/audit nên ở bảng chuẩn hóa; snapshot nội dung/presentation có thể tiếp tục dùng JSONB với schema version.

## 8. License và trademark

MIT cho phép use/modify/distribute/sublicense/sell, với điều kiện giữ copyright notice và permission notice trong copies/substantial portions. License không phải tư vấn pháp lý và không tự động cấp quyền trademark/brand.

Action bắt buộc:

- Giữ `LICENSE` và notice trong source distribution phù hợp.
- Tạo `THIRD_PARTY_NOTICES.md`.
- Inventory license toàn bộ dependency và asset/font/icon.
- Rebrand rõ ràng; không gây hiểu nhầm là sản phẩm chính thức của Reactive Resume.
- Luật sư rà soát trước commercial launch và khi dùng sample template/assets của bên thứ ba.

Nguồn: [MIT license trong repository](https://github.com/amruthpillai/reactive-resume/blob/main/LICENSE).

## 9. Upstream risk

| Khu vực | Merge risk | Chiến lược |
|---|---:|---|
| Product config/theme | Thấp | Một module cấu hình riêng |
| HR routes/features mới | Thấp–vừa | Feature package/route riêng |
| Database schema mới | Vừa | Migration tách, naming rõ |
| Resume schema trực tiếp | Cao | Canonical adapter, hạn chế sửa upstream schema |
| PDF templates | Cao | Renderer Bridge, legacy giữ nguyên |
| Auth internals | Cao | Dùng hooks/adapters; tránh fork sâu |

## 10. Recommendation

Go với điều kiện:

1. Pin baseline commit/tag.
2. Hoàn thành license/dependency audit.
3. Tạo `ProductConfig`, tenant boundary và feature flags trước rebrand sâu.
4. Đặt Canonical Resume và Renderer Bridge ngoài core legacy.
5. Duy trì test suite và lịch upstream sync hàng tháng.
6. Không bắt đầu Compiler trước khi AST renderer chứng minh được 2 template có độ phức tạp khác nhau.
