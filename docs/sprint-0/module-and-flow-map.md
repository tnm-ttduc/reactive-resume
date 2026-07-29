# Module and Flow Map

## Extension points

| Capability | Current owner | HR Platform seam |
|---|---|---|
| Auth/session | `packages/auth`, `apps/server/src/http/auth.ts` | Organization membership hooks và server authz |
| Resume API/version | `packages/api/src/features/resume` | Candidate relation, audit, approval, policy projection |
| Persistence | `packages/db/src/schema` | Organization, membership, candidate, document, audit tables |
| Resume schema | `packages/schema/src/resume` | Canonical adapter; tránh nhồi HR entity vào resume JSON |
| Builder/preview | `apps/web/src/routes/builder`, `apps/web/src/features/resume` | HR workspace route và renderer bridge |
| PDF | `packages/pdf` | Legacy renderer implementation phía sau registry |
| DOCX | `packages/docx` | Editable-export adapter và fidelity diagnostics |
| Import/AI | `packages/import`, `packages/ai`, `packages/api/src/features/ai` | Candidate import review, provenance và provider policy |
| Storage | server/API storage features | Tenant prefix, ownership, retention và scan status |
| Product config | chưa có seam tập trung | Module config/feature flags trước rebrand sâu |

## Data/save flow

```text
Builder form -> local resume state -> oRPC protected procedure
-> resume service owner check -> PostgreSQL resume.data JSONB
-> auto/manual version snapshot -> resume_version
```

## Import flow

```text
PDF -> PDF.js local text extraction ----+
                                        +-> AI provider -> schema validation/sanitize -> review/apply
DOCX -> OOXML local text extraction ----+
JSON -> importer/schema validation -----------------------------------------> review/apply
```

## Export flow

```text
Resume data + locale + exact template
-> browser/server PDF adapter -> React PDF template -> PDF
-> DOCX adapter -> editable DOCX
-> JSON/Markdown serializers
```

Target insertion point:

```text
Candidate snapshot + Resume variant + Anonymization + Branding
-> CanonicalResume/PresentationConfig
-> RendererRegistry(legacy|ast)
-> artifact + warnings + audit event
```

## Authorization rule

Baseline resume operations filter by authenticated `userId`. Sprint 1 must introduce organization-aware checks before
sharing HR records between internal recruiters; client-supplied organization IDs are never sufficient authorization.
