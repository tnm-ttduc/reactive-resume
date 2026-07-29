# Domain and Data Model v0.1

## 1. Modeling principles

- Candidate khác Resume.
- Organization là tenant boundary.
- Dữ liệu cần query/policy/audit dùng table chuẩn hóa.
- Content/presentation snapshot có thể là versioned JSONB với schema version.
- Export luôn dùng immutable/versioned inputs khi cần reproducibility.
- Xóa dữ liệu phải bao phủ source, derived, AI và artifact.

## 2. Entity overview

```text
Organization
├── Membership → User
├── OrganizationPolicy
├── BrandingProfile
├── ClientAccount (optional phase 2)
├── Candidate
│   ├── CandidateDocument
│   ├── CandidateNote
│   ├── CandidateConsent/Retention
│   └── Resume
│       ├── ResumeVersion
│       ├── Approval
│       ├── AI Generation
│       └── ExportArtifact
├── Template
│   └── TemplateVersion
└── AuditEvent
```

## 3. Main entities

### Organization

`id`, `name`, `slug`, `status`, `default_locale`, `timezone`, `created_at`, `updated_at`.

### Membership

`organization_id`, `user_id`, `role`, `status`, `invited_by`, timestamps. Unique theo organization/user.

### Candidate

`id`, `organization_id`, `external_ref`, `owner_user_id`, `status`, `full_name`, searchable normalized fields, `profile_data`, `schema_version`, `retention_until`, timestamps.

PII có thể được tách/field-level encrypted sau threat modeling; không quyết định encryption-at-column quá sớm khi chưa có key management.

### CandidateDocument

`id`, `organization_id`, `candidate_id`, `kind`, `storage_key`, `filename`, `media_type`, `size`, `checksum`, `scan_status`, `source`, timestamps.

### Resume

`id`, `organization_id`, `candidate_id`, `name`, `target_job`, `client_ref`, `status`, `current_version_id`, timestamps.

### ResumeVersion

Immutable snapshot:

- `canonical_resume_data`;
- `presentation_config`;
- `schema_version`;
- `template_version_id`;
- `branding_profile_id/version`;
- `anonymization_policy_snapshot`;
- `label`, `change_source`, `created_by`, `created_at`.

### Template / TemplateVersion

Template giữ identity/ownership; version giữ engine (`legacy|ast`), AST/code ref, schema version, asset manifest, compatibility, status, checksum.

### ExportArtifact

`id`, `resume_version_id`, `format`, `storage_key` hoặc ephemeral marker, `checksum`, `renderer_version`, `warnings`, `created_by`, `expires_at`, timestamps.

### AuditEvent

`organization_id`, `actor_id`, `action`, `resource_type/id`, `result`, `request_id`, `metadata_redacted`, `created_at`. Không lưu raw resume content trong audit metadata.

## 4. Candidate vs Resume behavior

- Candidate update không tự động rewrite mọi ResumeVersion cũ.
- Tạo resume mới lấy projection từ candidate master profile.
- Sync candidate → draft resume phải là explicit action với diff.
- Resume-specific rewrite không ghi ngược vào master profile trừ khi user chọn promote.
- Anonymization chỉ tác động render projection/snapshot, không xóa PII gốc.

## 5. Canonical resume outline

```text
schemaVersion
profile
contacts
summary
experience[]
education[]
skills[]
projects[]
certifications[]
languages[]
publications[]
references[]
customSections[]
provenance (optional field-level source/confidence)
```

Presentation config:

```text
templateRef
locale/page
sectionOrder/visibility
componentVariants
styleIntents/tokenOverrides
paginationOverrides
brandingRef
```

## 6. Tenant integrity constraints

- Child `organization_id` phải khớp parent organization.
- Resume candidate và template access phải cùng tenant hoặc template global/public.
- `current_version_id` phải thuộc cùng resume.
- Branding ref phải accessible bởi organization.
- API update cần optimistic concurrency (`updated_at`/revision).

Các invariant phức tạp cần service-level test; có thể thêm DB constraints/trigger khi ổn định.

## 7. Migration from Reactive Resume

### Stage 1

Giữ bảng `resume` legacy; tạo organization mặc định cho mỗi user hoặc migration mapping đã quyết định.

### Stage 2

Tạo candidate và liên kết resume; adapter đọc `resume.data` sang canonical projection.

### Stage 3

Ghi song song hoặc explicit migration sang `resume_version` mới. Không dual-write vô thời hạn.

### Stage 4

Renderer Bridge nhận canonical model; legacy adapter vẫn render template cũ.

### Stage 5

Chỉ retire field legacy sau telemetry, backfill verification và rollback window.

## 8. Retention and deletion

- Organization policy định nghĩa retention theo candidate status.
- Soft delete chỉ là workflow state; hard delete cần job xử lý DB, object storage, AI attachments, export artifacts và cache.
- Backup retention phải được công bố; hard delete khỏi active system không đồng nghĩa xóa ngay khỏi immutable backup.
- Legal hold cần override retention nếu thị trường yêu cầu.

## 9. Indexing/search

Pilot:

- organization/status/owner/updated time indexes;
- normalized name/email/phone search có access check;
- tags có GIN nếu volume thực tế yêu cầu;
- không đưa raw PII vào external search engine trong Pilot.

## 10. Open decisions

- Candidate profile dùng JSONB hoàn toàn hay hybrid columns + JSONB.
- Field-level encryption và key rotation scope.
- Organization-scoped sequential candidate code.
- ClientAccount có vào Pilot không.
- Audit retention và export artifact lifetime.
