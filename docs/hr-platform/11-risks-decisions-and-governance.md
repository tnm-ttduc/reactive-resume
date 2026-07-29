# Risks, Decisions and Governance

## 1. Risk register

| ID | Risk | L | I | Mitigation / trigger |
|---|---|---:|---:|---|
| R1 | Fork diverges from upstream | H | H | Product config, adapters, monthly sync drill; track conflict hours |
| R2 | Cross-tenant/PII leak | M | Critical | Server authz, tenant tests, audit, security review |
| R3 | PDF layout regressions | H | H | Golden datasets, visual diff, canary by org |
| R4 | Template AST quá tự do/phức tạp | H | H | Bounded DSL, component registry, prototype gates |
| R5 | AST không đủ creative templates | M | H | Structured + visual layers, corpus, supported/unsupported report |
| R6 | Compiler kỳ vọng pixel-perfect | H | H | Semi-automatic positioning, confidence + human review |
| R7 | AI bịa dữ liệu | M | H | Proposal/diff, fact constraints, no auto-apply |
| R8 | Third-party asset/license issue | M | H | Permission metadata, notices, counsel review |
| R9 | DOCX fidelity mismatch | H | M | Product wording, separate renderer/test matrix |
| R10 | Scope phình thành ATS/CRM | H | H | Pilot non-goals, outcome gates, PO approval |
| R11 | Upstream breaking changes | M | H | Pin version, controlled upgrade, compatibility tests |
| R12 | Insufficient real template/data corpus | M | H | Discovery requirement before Compiler investment |
| R13 | AI/provider data residency conflict | M | Critical | Provider allowlist, disclosure, deployment/legal decision |
| R14 | Font availability/licensing | M | H | Font manifest/license/checksum and fallback test |

`L`: likelihood, `I`: impact.

## 2. Architecture Decision Records cần tạo

| ADR | Decision |
|---|---|
| ADR-001 | Use Reactive Resume as foundation |
| ADR-002 | Separate Candidate from Resume |
| ADR-003 | Canonical Resume Schema + adapter |
| ADR-004 | Renderer Bridge with legacy/AST engines |
| ADR-005 | Template as bounded AST |
| ADR-006 | Structured flow + visual decoration layers |
| ADR-007 | Client/server PDF rendering responsibility |
| ADR-008 | Multi-tenancy and authorization model |
| ADR-009 | AI provider/privacy/no-fabrication policy |
| ADR-010 | Template versioning/publish lifecycle |
| ADR-011 | DOCX fidelity contract |
| ADR-012 | Upstream sync and contribution policy |

Mỗi ADR gồm context, decision, alternatives, consequences, status, date, owner và review trigger.

## 3. Upstream governance

### Branch model đề xuất

```text
upstream/main
company/base        # clean pinned baseline + controlled upstream merges
company/develop     # integration
feature/*
release/*
```

Không nhất thiết giữ đúng tên branch; nguyên tắc là có baseline ít chỉnh và integration branch riêng.

### Monthly sync process

1. Review upstream releases/security/changelog.
2. Fetch and create sync branch.
3. Run dependency/license diff.
4. Merge/rebase theo policy đã chọn.
5. Resolve trong boundary, không bypass tests.
6. Run unit/type/boundary/build/golden/tenant tests.
7. Deploy staging/canary.
8. Record conflict hours, behavioral changes và rollback.

### Contribute upstream

Ưu tiên upstream các fix generic, security, localization, PDF bug không chứa domain/proprietary logic. Giữ riêng HR domain, business policy và Template Platform trừ khi công ty chủ động open-source.

## 4. Ownership (RACI rút gọn)

| Area | Accountable | Responsible |
|---|---|---|
| Product scope/KPI | Product Owner | Product/Research |
| Architecture/upstream | Tech Lead | Engineering |
| Security/privacy | Founder/Security owner | Tech Lead + counsel |
| Template quality | Product/Design owner | Rendering engineer/QA |
| Pilot operation | Product Owner | Customer success/Recruiter champion |
| Release | Tech Lead | Engineering/QA |

## 5. Change control

Thay đổi cần ADR hoặc product decision nếu:

- sửa canonical schema breaking;
- thêm template node có executable/arbitrary style capability;
- thay tenant/auth model;
- thêm AI provider/data flow;
- thay PDF/DOCX fidelity contract;
- làm tăng scope Pilot quá một sprint hoặc ảnh hưởng exit gate.

## 6. Decision gates

- Gate 0: Legal/baseline viable.
- Gate 1: HR Pilot value demonstrated.
- Gate 2: Renderer Bridge parity.
- Gate 3: AST handles simple + creative.
- Gate 4: Editor reduces non-code work.
- Gate 5: Compiler saves measurable time.

Không đi tiếp chỉ vì đã đầu tư; mỗi gate cần evidence và kill/pivot option.
