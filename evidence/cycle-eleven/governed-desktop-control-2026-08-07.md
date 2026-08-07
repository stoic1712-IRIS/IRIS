# Cycle Eleven A Governed Desktop Control Evidence

**Date:** 2026-08-07

**Task:** `cycle-eleven-a-governed-desktop-control`

**Repository:** `stoic1712-IRIS/IRIS`

## Authority and Source Verification

- The isolated worktree began clean on branch `iris/cycle-eleven-a-governed-desktop-control` at task-activation revision `ad02d192c97efc5436f46fadb0f91f1de1158e94`, equal to `origin/main` at implementation start.
- The canonical task authorizes bounded governance, implementation, hermetic verification, exact-path delivery, review, merge, synchronization, and cleanup. It excludes live desktop action, secrets, deployment, spending, provider resources, GitHub administration, force-push, history rewriting, and final Phase 0 graduation.
- The three foundation DOCX SHA-256 values and three readable-extraction SHA-256 values matched `SOURCE-MANIFEST.md`. The external library remained read only and outside Git.
- Required project context, ADR-007, approval policy, security policy, testing standards, and registries were read before implementation.

## Implemented Boundary

- Added strict exact desktop targets and coordinate-free bounded actions.
- Added metadata-only previews, exact plan digest and Founder statement binding, one-shot approval, expiry, replay prevention, default disablement, immediate interruption, and a hard duration ceiling.
- Added bounded target recovery, stable Core denial codes, required hash-chained audit, and metadata-only receipts.
- Added an inert injected Windows UI Automation adapter. Import and construction have no provider effect.
- Updated ADR, specification, security policy, and registries without adding a package or widening an existing governed tool grant.

## Hermetic Acceptance

Focused acceptance passed 42 tests: 15 Cycle Eleven tests and all 27 unchanged Cycle Ten local-workstation tests. Coverage includes exact binding; coordinate, wildcard, secret, and unbounded-input refusal; request windows; default disablement; metadata-only receipts; altered payload rejection; replay; immediate cancellation; non-cooperative timeout; recovery; audit failure; inert construction; hash-chain verification; and replay bounds.

The first focused run reported an unhandled rejection in the fake-timer timeout test because the assertion was attached after clock advancement. Production behavior and the expected timeout were correct. The test was repaired to attach the assertion first; the rerun passed without an unhandled error.

The fresh worktree initially had no built workspace outputs. The pinned dependencies were materialized from existing offline pnpm stores with zero downloads and no lockfile change. The final WSL materialization used Node `24.19.0`, pnpm `11.20.0`, frozen lockfile, offline mode, and disabled lifecycle scripts.

## No-Live-Effect Attestation

All adapters in acceptance were injected in-memory fixtures. No Windows UI Automation API, application, window, keyboard, pointer, clipboard, credential store, screenshot provider, notification provider, browser, network, shell effect, deployment, port, provider resource, or paid service was invoked by the capability tests. No secret or raw input appears in preview or receipt data.

## Verification Results

The exact final focused and full verification commands, exit codes, result commit, and patch digest are recorded in the coordination handoff after final verification.

## Rollback and Cleanup

Before merge, close the pull request and delete the feature branch without force. After merge, history-preservingly revert the Cycle Eleven A merge commit. The module and export are additive; no data migration or live resource cleanup is required. Remove the isolated worktree and local feature branch after verified synchronization.
