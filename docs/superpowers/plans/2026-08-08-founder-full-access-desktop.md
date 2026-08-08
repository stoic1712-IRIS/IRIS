# Founder Full Access and Desktop Operation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provide a one-click, auditable Founder Full access session for ordinary work and activate bounded live Windows desktop control without weakening protected-effect gates.

**Architecture:** Expand the existing Founder access contract with a logon-session-bound grant and ordinary capability set. Keep protected effects outside the grant. Connect the existing provider-independent desktop-control contract to a fixed PowerShell/.NET UI Automation runner using strict JSON stdin/stdout, exact target binding, interruption, and audit evidence.

**Tech Stack:** TypeScript, Zod, Node.js `execFile`, PowerShell/.NET UI Automation, Vitest.

## Global Constraints

- Full access never includes raw credential disclosure, spending, deployment or exposure, administration, force-push/history rewrite, destructive operations, elevation, or Phase 0 graduation.
- Grant lifetime is the current authenticated Windows/Founder session and ends on disable, logout, gateway restart, or Windows restart.
- Desktop actions require an exact selected window and an emergency stop; sensitive windows fail closed.

---

### Task 1: Extend the access-profile contract

**Files:**
- Modify: `packages/kernel/src/founder-access-profile.ts`
- Modify: `tests/cycle-ten-founder-full-access-profile.test.ts`
- Create: `tests/founder-autonomous-access-profile.test.ts`

1. Add failing tests for the expanded ordinary capability set, logon-session binding, explicit activation, revocation, restart invalidation, audit entries, and every protected exclusion.
2. Add ordinary capabilities for dependency materialization, verification/repair, reviewed-head merge, runtime control, bounded desktop operation, and capability acquisition.
3. Replace the four-hour ceiling with an authenticated-session expiry contract while retaining replay protection and fail-closed parsing.
4. Run focused tests and commit with `feat: extend Founder Full access contract`.

### Task 2: Implement a fixed Windows UI Automation runner

**Files:**
- Create: `scripts/desktop/iris-desktop-runner.ps1`
- Create: `packages/tool-gateway/src/windows-desktop-runner.ts`
- Modify: `packages/tool-gateway/src/index.ts`
- Create: `tests/windows-desktop-runner.test.ts`
- Modify: `tests/cycle-eleven-governed-desktop-control.test.ts`

1. Add failing adapter tests for strict request/response JSON, loopback-only invocation, exact process/window binding, allowed UIA verbs, timeout, interrupt, sensitive-window refusal, redaction, and malformed-output denial.
2. Implement `WindowsDesktopRunner` with `execFile`; send one strict JSON request on stdin and accept one strict JSON response on stdout. Never interpolate a shell command.
3. Implement PowerShell UI Automation actions: focus, invoke, set non-secret text, select, and bounded keypress. Reject credential, browser-password, payment, account-admin, and elevation surfaces.
4. Add selected-window screenshot metadata and digest support; do not add screen-wide capture or unrestricted coordinates.
5. Run focused tests and commit with `feat: add bounded Windows desktop runner`.

### Task 3: Connect live desktop execution to the existing contract

**Files:**
- Modify: `packages/tool-gateway/src/desktop-control-provider.ts`
- Modify: `tests/cycle-eleven-governed-desktop-control.test.ts`
- Create: `tests/founder-live-desktop-control.test.ts`

1. Add failing tests for Full-access authorization, exact preview digest, one active execution, emergency stop, expiry, provider failure, recovery, and immutable audit records.
2. Add the live runner adapter without changing the existing preview/approval schemas. Activation succeeds only for ordinary, non-sensitive actions under active Full access.
3. Ensure stop writes terminal state before aborting and late provider responses cannot revive the session.
4. Run focused suites and commit with `feat: activate governed desktop control`.

### Task 4: Extend complete software delivery for ordinary exact-head merge

**Files:**
- Modify: `packages/development/src/complete-software-delivery.ts`
- Modify: `tests/cycle-eleven-complete-software-delivery.test.ts`
- Create: `tests/founder-full-access-delivery.test.ts`

1. Add failing tests that permit merge only when the reviewed head equals the pushed head, CI is successful, the access grant is active, branch protection is honored, remote equality is verified, and rollback evidence exists.
2. Add `mergeReviewedHead`, `synchronizeCanonicalMain`, and `cleanupWorkspace` transitions. Reject admin bypass, force merge, stale review, stale CI, or protected-effect expansion.
3. Run focused tests and commit with `feat: complete ordinary software delivery under Full access`.

### Task 5: Document and verify access boundaries

**Files:**
- Create: `docs/specifications/founder-full-access-and-desktop-operation.md`
- Create: `evidence/post-roadmap/founder-full-access-desktop-2026-08-08.md`
- Modify: `docs/governance/authority-policy.md`

1. Record the ordinary/protected matrix, activation and revocation rules, desktop safety contract, emergency stop, and non-graduation boundary.
2. Run all focused tests and `pnpm verify`.
3. Commit exact paths with `docs: certify Founder Full access boundaries`.
