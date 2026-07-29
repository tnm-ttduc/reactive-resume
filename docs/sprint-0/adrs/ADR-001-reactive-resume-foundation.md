# ADR-001: Use Reactive Resume as Foundation

- Status: Accepted for Pilot foundation
- Date: 2026-07-21

## Decision

Pin Reactive Resume `5.2.3` at commit `689e7e2` as product shell and legacy renderer. Keep `upstream` remote and isolate HR
features behind new packages/routes/configuration seams.

## Consequences

Builder, auth, import/export, versioning, 15 templates and deployment shape are reused. Direct changes to auth internals,
resume schema and template registry carry high merge risk and require an ADR or adapter boundary.
