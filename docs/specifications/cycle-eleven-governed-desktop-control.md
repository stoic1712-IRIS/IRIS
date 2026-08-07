# Cycle Eleven Governed Desktop Control Specification

**Status:** Implemented and verified locally; live desktop activation remains prohibited

**Date:** 2026-08-07

## Objective

Give IRIS Core a provider-independent contract for previewing, approving, interrupting, recovering, and auditing one exact bounded desktop-control plan. Cycle Eleven A proves the contract with hermetic adapters and performs no live desktop action.

## Ownership

IRIS Core owns targets, plans, preview digests, typed approval binding, replay prevention, cancellation, timeouts, recovery policy, audit, and receipts. Windows UI Automation is a replaceable provider and owns none of those responsibilities.

## Exact Target

A target contains one exact `applicationId`, one exact `windowTitle`, and an optional exact `automationRootId`. Wildcards, outer whitespace, URLs, secret-like text, authority-laundering text, and pointer coordinates are rejected. No target means no preview or execution.

## Bounded Plan

A plan contains one to twenty actions, lives for no more than five minutes, and declares a total duration from one millisecond through thirty seconds. Allowed actions are exact-window focus, exact automation-element invoke, at most 500 characters of non-secret text entry, one bounded exact option selection, or `Enter`, `Escape`, `Tab`, and arrow keys.

Unknown fields, coordinates, arbitrary key combinations, clipboard operations, paths, shell commands, secret input, URLs, and unbounded text are outside the schema.

## Preview and Approval

`createDesktopControlPreview` validates the plan and emits only the exact target, action count and safe summaries, SHA-256 plan digest, identifiers and times, exact required Founder statement, provider label, `enabled: false`, and `authority: none`. Input text and selected option values are not copied into summaries.

The approval must bind the preview identifier, plan digest, generated target-bound statement, Founder identity, issue and expiry times, and `oneTime: true`. Any mismatch fails before the provider is called.

## Execution

`executeDesktopControl` requires an explicit `enabled: true` from an already-authorized caller. The flag is a runtime gate, not approval. Core strictly parses all inputs, verifies time and binding, consumes the one-shot replay claim, runs actions sequentially, races provider promises against immediate Founder cancellation and the remaining total deadline, rechecks expiry, attempts bounded recovery after an ordinary provider failure, seals the decision in the mandatory audit, and returns metadata only.

Cancellation and timeout stop Core immediately even if the adapter promise never settles. They do not start recovery or another desktop effect. Ordinary provider failures attempt bounded recovery; unsuccessful recovery fails closed.

## Audit and Replay

The append-only audit records previewed, accepted, denied, cancelled, and recovered outcomes with a previous-entry digest. A malformed or unavailable recorder blocks preview or completion. The bounded in-memory replay guard consumes an exact preview/digest pair once and removes expired claims.

## Provider Adapter

`WindowsUiAutomationAdapter` wraps an injected `WindowsUiAutomationRunner`. Importing the module and constructing the adapter are inert. This tranche supplies no live runner and invokes no operating-system API during tests.

## Acceptance Gate

```text
pnpm exec vitest run tests/cycle-eleven-governed-desktop-control.test.ts tests/cycle-ten-local-workstation-provider.test.ts
pnpm verify
```

Acceptance requires strict-schema and binding tests, default disablement, replay and expiry denial, immediate cancellation, non-cooperative timeout, recovery, audit failure, metadata-only receipts, unchanged Cycle Ten acceptance, and proof that no live provider effect occurred.

## Deferred Work

Cycle Eleven B may expose preview-only Founder controls after binding the exact merged Cycle Eleven A revision. A live runner, credentials, public or LAN access, deployment, persistent services, background operation, and final Phase 0 graduation remain prohibited.
