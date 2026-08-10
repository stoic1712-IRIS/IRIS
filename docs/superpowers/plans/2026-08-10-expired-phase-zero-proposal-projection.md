# Expired Phase Zero Proposal Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent an expired unapproved Phase 0 proposal from remaining actionable in the Core read projection while preserving its durable audit record until an explicit replacement request.

**Architecture:** Add one expiry branch to the file-backed coordinator's read path. The branch returns the existing strict idle transport envelope and does not write or delete state; the existing explicit proposal-preparation path remains responsible for replacing expired state.

**Tech Stack:** TypeScript 6, Zod 4, Vitest 4, pnpm 11.20.0, Node.js 24.19.0.

## Global Constraints

- Preserve the expired durable record during reads.
- Never submit an approval, generate a replacement proposal, or activate graduation during verification.
- Keep all Git publication non-force and preserve canonical history.
- No dependency or lockfile changes.

---

### Task 1: Expired read projection regression and repair

**Files:**
- Modify: `tests/phase-zero-graduation-activation.test.ts`
- Modify: `packages/development/src/phase-zero-graduation-coordinator.ts`

**Interfaces:**
- Consumes: `FilePhaseZeroGraduationCoordinator.read(): Promise<unknown>` and the injected `now(): Date` clock.
- Produces: an `idle` `phaseZeroGraduationEnvelopeSchema` projection for an expired unapproved proposal without mutating the state file.

- [ ] **Step 1: Write the failing regression**

Add a Vitest case that prepares a proposal, captures the state-file bytes, advances the clock by 61 minutes, reads the coordinator, expects `state === "idle"`, and expects the state-file bytes to be unchanged.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run tests/phase-zero-graduation-activation.test.ts`

Expected: the new assertion fails because `read()` returns `presented`.

- [ ] **Step 3: Implement the minimal expiry branch**

Before refreshing a loaded envelope, return `createIdlePhaseZeroGraduationEnvelope(currentCoreRevision, now)` when no graduation receipt exists and `proposal.expiresAt <= now`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm vitest run tests/phase-zero-graduation-activation.test.ts`

Expected: all focused tests pass.

- [ ] **Step 5: Run full verification**

Run: `pnpm verify`

Expected: formatting, build, lint, typecheck, all tests, and diagnostics exit 0.

- [ ] **Step 6: Commit exact paths**

Stage only the coordinator, regression, design, and implementation plan. Commit with `fix: expire stale Phase 0 proposal projection`.

