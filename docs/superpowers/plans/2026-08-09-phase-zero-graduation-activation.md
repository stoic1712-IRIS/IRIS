# Phase 0 Graduation Proposal and Activation Implementation Plan

> Execute this plan only under the Founder mandate recorded in `.iris/coordination/tasks/phase-zero-graduation-activation.json`. Do not approve or execute the generated graduation proposal during this implementation.

## 1. Bind the task and baseline

- Validate the cross-repository task schema and exact base revisions.
- Confirm clean isolated Core and Command Center worktrees.
- Run focused existing graduation tests before modification.

## 2. Add failing Core tests

- Extend transport signing tests for the proposal route and scope.
- Add coordinator tests for canonical evidence binding, strict model output, durable atomic state, replay denial, exact approval consumption, one-time runtime activation, merge-approval rendezvous, and restart fail-closed behavior.
- Add live-adapter contract tests with injected process, model, and provider seams; no provider mutation in tests.

## 3. Implement Core ownership

- Extend the kernel graduation request contract with a distinct proposal scope.
- Add strict proposal-request and model-plan schemas.
- Implement the file-backed Core coordinator and atomic ledger.
- Implement the live adapter by composing existing executable-worker, Git, local model, review, GitHub CLI, equality, rollback, cleanup, and zero-resource mechanisms.
- Wire the coordinator, proposer, and runtime into `iris-core-read-service.mjs`.
- Export the new Core APIs and correct the stale technology-registry description.

## 4. Add failing Command Center tests

- Test strict proposal client request/response handling.
- Test authenticated CSRF gateway relay and signed Core proposal scope.
- Test the idle Graduation surface preparation form and ensure it cannot approve or execute automatically.

## 5. Implement the Founder surface

- Add `prepareGraduationProposal` to the client.
- Add the gateway proposal relay without storing graduation truth.
- Add a bounded objective form to the idle Graduation view and refresh from Core after preparation.

## 6. Verify and review

- Run focused Core and Command Center tests while implementing.
- Run Core `pnpm verify` and Command Center format, lint, typecheck, test, and build.
- Validate task scope and changed paths.
- Obtain independent read-only review of the exact commits; repair findings and rerun verification.

## 7. Publish and integrate

- Stage exact allowed paths, commit, and non-force push both branches.
- Create pull requests, confirm exact heads and checks, merge without bypass, and synchronize both canonical `main` branches.
- Remove disposable implementation worktrees after merged-state verification.

## 8. Restart and smoke test

- Restart the loopback IRIS stack from synchronized canonical `main`.
- Request one real-model Phase 0 proposal from the Founder surface.
- Verify the UI displays a strict Core-owned digest and exact statement.
- Do not type, forward, approve, or execute the proposal. Report the proposal identity and transition Codex and Claude to audit-only only after the Founder later activates it.
