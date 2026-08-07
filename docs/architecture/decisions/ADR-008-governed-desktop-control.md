# ADR-008: Governed Desktop Control

**Status:** Accepted

**Date:** 2026-08-07

## Context

IRIS needs a bounded way to operate Founder-selected desktop applications while preserving the Core-owned authority, approval, interruption, audit, recovery, and provider-replacement boundaries established by the Constitution and ADR-007. Generic coordinate clicking, inherited permissions, unbounded text entry, and provider-owned approval state would turn technical reach into authority and are therefore unacceptable.

Cycle Eleven A does not activate or exercise desktop control. It establishes the Core contract and an inert, injected Windows UI Automation adapter so the safety boundary can be verified without touching a live window.

## Decision

Adopt Microsoft Windows UI Automation as the initial replaceable desktop-control provider behind the IRIS-owned `desktop-control-provider` contract.

One execution must satisfy every condition below:

1. The target names one exact application identifier and one exact window title. Optional automation-root scope is exact. Wildcards and pointer coordinates are rejected.
2. The plan contains one to twenty schema-limited actions and a maximum duration of thirty seconds. Supported actions are exact-window focus, automation-element invoke, bounded non-secret text entry, exact option selection, and a small navigation-key allowlist.
3. Core creates a metadata-only preview bound to the exact plan digest. Text content is summarized by length and never copied into the preview or receipt.
4. Execution requires the exact preview identifier, plan digest, target-bound typed statement, Founder identity, one-time marker, and unexpired approval.
5. Desktop control remains disabled by default. Importing or constructing the adapter has no provider effect.
6. Core enforces immediate Founder cancellation and a hard timeout even when an adapter ignores its signal.
7. An ordinary provider action failure triggers bounded recovery that refocuses the exact target. Cancellation and timeout do not start additional desktop actions.
8. Preview, acceptance, denial, cancellation, and recovery decisions enter a required hash-chained audit. Audit failure fails closed.
9. The receipt contains safe metadata and digests only. It carries no input text, screenshot bytes, credential values, implied approval authority, or canonical-memory mutation.

## Provider Boundary

`WindowsUiAutomationAdapter` delegates to an injected runner. The runner is replaceable and owns no identity, plan, permission, approval, replay state, audit, memory, or recovery policy. No external library or package is added; the intended live implementation uses the Windows 11 operating-system API through a separately reviewed runner.

The initial contract does not authorize live desktop control, coordinate input, arbitrary shortcuts, shell execution, clipboard use, file selection, downloads, uploads, secret entry, persistence, startup registration, remote access, deployment, spending, provider resources, or final Phase 0 graduation.

## Security and Failure Model

Strict schemas reject unknown fields, wildcard scope, URLs, secret-like material, authority-laundering text, invalid windows, replay, altered previews, changed plans, changed statements, expiration, disabled execution, oversized plans, and invalid provider results. A non-cooperative provider cannot defeat Core cancellation or timeout because Core races the provider promise against its own abort and deadline controls.

Provider exceptions are reduced to stable Core denial codes; raw provider details do not enter the receipt or audit. Recovery failure is explicit and blocks completion. A provider action that occurred before an audit failure is not reported as authorized success.

## Verification

Acceptance uses injected hermetic adapters only. Tests prove exact binding, default disablement, no import or construction effect, coordinate and secret rejection, replay denial, expiry, immediate interruption, non-cooperative timeout, recovery, required audit, and metadata-only receipts. The unchanged Cycle Ten local-workstation suite runs beside Cycle Eleven acceptance.

## Rollback and Replacement

The change is additive. Before merge, close the pull request and delete the feature branch without force. After merge, use a history-preserving revert of the Cycle Eleven A merge commit. Removing the module export and registry entries restores the prior state. No provider resource, persistent state, live authorization, secret, or desktop artifact requires cleanup.

## Approval and Reapproval

- Approver: Founder Cristofer Stoic Arellano
- Approval reference: `founder-cycles-ten-through-twelve-completion-2026-08-07`
- Implementer and publisher: Codex under the canonical Cycle Eleven A completion mandate

Reapproval is required before any live runner is activated, scope or action kinds are widened, coordinates or secrets are introduced, interruption or audit is weakened, the provider changes, or deployment/final graduation begins.

## Supersession

This decision narrows ADR-007's explicit desktop-control block only to the contract and inert adapter described here. ADR-007 continues to govern screenshots, credential references, and notifications.
