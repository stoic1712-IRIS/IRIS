# Wave 7 Mission and Development Intelligence

**Status:** Implemented and verified

**Date:** 2026-08-05

## Outcome

Wave 7 gives IRIS a Core-owned planning boundary that decomposes objectives, governs roadmap state, and recommends development priorities without displacing Founder authority. External workers and models may supply evidence or bounded execution, but they do not own strategic planning.

## Mission Planner

A mission contains a bounded objective and uniquely identified tasks. Every task declares dependencies, required evidence, its approval checkpoint, and a worker recommendation with explicit maximum permissions. Planning validates all dependencies, rejects cycles, and produces a deterministic prerequisite-first execution order.

The plan separately exposes approval checkpoints and evidence requirements so neither can be hidden inside narrative task text. A worker recommendation is advisory and does not create or authorize a worker.

## Roadmap Manager

Roadmap milestones belong to explicit phases and move through `planned`, `ready`, `in-progress`, `blocked`, and `complete` states. Transitions are constrained. A milestone cannot become ready, active, or complete while capability prerequisites or blockers remain unresolved. Completion requires evidence.

The manager records available capabilities, identifies missing prerequisites, preserves blocker state, and returns phase-scoped milestone records. Completed milestones cannot silently reopen.

## Development Intelligence

Candidates are scored from capability return, reuse multiplier, prerequisite unlocks, technical-debt reduction, risk, and effort. The formula deliberately gives reusable foundations and prerequisite multipliers greater weight than isolated feature value. Recommendations retain dependencies, risks, evidence, classification, and a human-readable score explanation.

Domain-specific work that does not strengthen IRIS is classified as Layer 4. Foundational capabilities remain IRIS Core. Only an actor explicitly identified as the Founder may override the computed strategic ordering, and the override requires rationale.

## Decision Gate

Wave 7 passes only when:

- reusable prerequisites outrank isolated features in the governed fixture;
- every recommendation explains its dependencies, risks, evidence, and scoring basis;
- unresolved prerequisites and blockers prevent roadmap progress;
- milestone completion requires evidence;
- Core and Layer 4 remain separated; and
- IRIS Core and workers are unable to exercise the Founder-only priority override.

## Rollback

Before a dependent wave consumes these interfaces, revert the Wave 7 merge commit. No persistent service, external provider, paid resource, credential, or data migration is introduced. Existing Wave 0-6 contracts continue independently.
