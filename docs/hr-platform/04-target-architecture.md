# Target Architecture

## 1. Architecture goals

- Ra Pilot MVP nhanh nhờ foundation sẵn có.
- Giữ khả năng nhận security/bug fix từ upstream.
- Tách domain HR khỏi resume builder cá nhân.
- Hỗ trợ legacy template và AST template song song.
- Cho phép preview, PDF, DOCX và về sau HTML/image từ cùng canonical input ở mức hợp lý.
- Bảo vệ PII theo organization policy.

## 2. Logical architecture

```text
HR Platform Web
├── Existing product shell
│   ├── Auth / settings / i18n
│   ├── Builder UI / preview / export
│   └── UI primitives
├── HR Workspace
│   ├── Organizations / members / roles
│   ├── Candidates / documents / notes
│   ├── Resume variants / approval
│   └── Branding / anonymization
└── Template Studio (internal first)
    ├── Tree/layer editor
    ├── Properties/tokens
    └── Test datasets / publish

Application services
├── Candidate Service
├── Resume Service
├── Policy/Anonymization Service
├── Branding Service
├── AI Orchestration
├── Template Service
├── Render Service
└── Export/Audit Service

Core contracts
├── Canonical Resume Schema
├── Reactive Resume Adapter
├── Template AST Schema
├── Component Registry
└── Renderer Interface

Infrastructure
├── PostgreSQL
├── Object storage
├── Redis / job or AI stream state
├── Email / identity providers
├── AI providers
└── Observability / backup / secrets
```

## 3. Bounded contexts

### Identity & Organization

User, organization, membership, role, invitation, policy.

### Candidate

Master profile, source documents, consent/legal basis, tags, owner, notes, retention status.

### Resume

Job/client-specific content snapshot, presentation config, anonymization result, approval, version.

### Template

Template identity, engine, AST/code reference, version, assets, compatibility, publish lifecycle.

### Rendering

Canonical input + template reference + branding/policy → preview/PDF/DOCX artifacts.

### AI

Provider policy, prompt version, extraction/rewrite job, user review, trace metadata.

## 4. Canonical boundary

Không để UI legacy, database HR và Template Compiler phụ thuộc lẫn nhau qua Reactive Resume schema.

```text
ReactiveResumeData ←→ ReactiveResumeAdapter ←→ CanonicalResume
                                               + PresentationConfig
                                               + PolicyContext
```

`CanonicalResume` chứa semantic content. `PresentationConfig` chứa thứ tự/visibility/style intent/template reference. `Candidate` là entity dài hạn; canonical resume thường là snapshot hoặc projection có chủ đích.

## 5. Renderer Bridge

```ts
type RenderInput = {
  resume: CanonicalResume;
  presentation: PresentationConfig;
  template: TemplateReference;
  branding?: BrandingConfig;
  policy: RenderPolicyContext;
  locale: string;
};

type RenderOutput = {
  artifact: Blob | Uint8Array;
  mediaType: string;
  warnings: RenderWarning[];
  diagnostics: RenderDiagnostics;
};

interface ResumeRenderer {
  readonly engine: "legacy" | "ast";
  render(input: RenderInput): Promise<RenderOutput>;
}
```

Registry:

```text
RendererRegistry
├── legacy → ReactiveResumeRenderer
└── ast    → AstTemplateRenderer
```

Template metadata quyết định engine. Builder không import trực tiếp từng template component.

## 6. Request flow: export PDF

```text
User requests export
→ authorize organization/candidate/resume
→ load candidate/resume snapshot
→ apply anonymization policy to projection
→ resolve branding + template version
→ validate canonical/presentation/template compatibility
→ render
→ quality warnings
→ store/export artifact according to policy
→ write audit event
```

Không chỉnh sửa master profile khi anonymize; chỉ tạo projection có kiểm soát.

## 7. Multi-tenancy

Pilot dùng shared database, row-level tenant key ở application level; cân nhắc PostgreSQL RLS sau khi query patterns ổn định.

Nguyên tắc:

- Mọi entity business có `organization_id` trực tiếp hoặc derivable không mơ hồ.
- API không nhận organization ID rồi tin tưởng; phải resolve membership và ownership.
- Unique constraints phải scope theo organization khi phù hợp.
- File path/object key mang tenant prefix không thể đoán và metadata ownership.
- Background job luôn mang organization/user context.

## 8. Deployment

### Foundation/Pilot

```text
Reverse proxy / TLS
        ↓
Single HR Platform container
        ├── Web static/app
        ├── Hono API/Auth
        └── render adapters
PostgreSQL + S3-compatible storage + Redis(optional/AI)
```

### Scale-out later

- Tách render worker khi CPU/memory hoặc throughput yêu cầu.
- Tách AI/parse jobs khỏi request path.
- CDN cho public/static asset.
- Managed PostgreSQL, Redis và object storage.

Không microservice hóa sớm; ưu tiên modular monolith với package boundaries thực thi được.

## 9. Observability

- Structured logs với request ID, organization ID đã pseudonymize, actor ID, operation.
- Metrics: request latency/error, export duration/failure, AI job duration/cost, storage/database health.
- Trace các flow import/export/AI, không ghi raw PII vào log.
- Alert: auth anomaly, export failure spike, DB/storage errors, queue backlog.

## 10. Migration sequence

1. Fork clean baseline.
2. Product config/rebrand isolation.
3. Add organizations/candidates without changing renderer.
4. Add canonical adapters behind tests.
5. Route export through Renderer Bridge; legacy output unchanged.
6. Add AST engine and one parity template.
7. Add creative AST template.
8. Internal Template Editor.
9. Compiler experiments.
10. Migrate legacy templates only when ROI positive.

## 11. Architecture quality gates

- No cross-workspace private imports.
- Tenant isolation tests for every new API feature.
- Canonical schema version + migrations/adapter fixtures.
- Renderer deterministic for same versioned inputs/assets/fonts.
- Golden PDF visual tests.
- Backward-compatible import of existing Reactive Resume JSON where supported.
- Rollback path for database migration and template publish.
