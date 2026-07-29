# ADR-003: Canonical Resume and Renderer Bridge

- Status: Proposed; implementation after Pilot value slice
- Date: 2026-07-21

## Decision

Introduce a versioned canonical resume contract and adapter instead of making HR domain, legacy UI and future Template
AST depend directly on one another. Route exports through a renderer registry supporting `legacy` first and `ast` later.

## Consequences

Legacy output must remain within approved golden thresholds. Compiler/AST work does not start until candidate workflow
and renderer parity gates pass.
