# ADR-002: Separate Candidate from Resume

- Status: Accepted for Sprint 1 design
- Date: 2026-07-21

## Decision

Candidate is the organization-owned master record. Resume is a job-specific presentation/version derived from an
explicit candidate snapshot. Resume edits do not silently overwrite the candidate master profile.

## Consequences

Sprint 1 adds organization/candidate tables and links existing resumes through a migration-safe relation. Sync and
promotion require a visible diff. PII masking creates a projection and never mutates the source record.
