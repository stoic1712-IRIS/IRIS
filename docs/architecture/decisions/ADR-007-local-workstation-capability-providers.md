# ADR-007: Local Workstation Capability Providers

**Template status:** Canonical

**Status:** Accepted

**Date:** 2026-08-07

**Owners:** IRIS Core (permanent contract owner); Founder Cristofer Stoic Arellano (approver)

**Related wave/capability:** Cycle Ten (Research, Browser, Computer, and Connector Parity); Cycle Ten C local-workstation provider governance

## Context

Cycle Ten introduces Founder-facing capabilities that touch the local workstation. Three providers were already pinned and implemented behind the Cycle Six governed tool gateway but were never recorded in the registries: the SearXNG search container, Playwright browser inspection, and the Model Context Protocol (MCP) TypeScript SDK. Three further Founder-directed capabilities require governance before any implementation: ephemeral redacted screenshot capture, opaque operating-system credential references, and local-only native notifications.

The governing sources require that a provider becomes canonical only through an approved decision, bounded implementation, verification, and repository history; that technical availability never creates authority; that secrets are never exposed to logs, prompts, or evidence; and that default-open capability is prohibited. This ADR records the exact adoption status of the existing providers and the bounded, provider-independent safety contracts for the new local capabilities, and it explicitly declines to adopt Windows desktop control.

## Decision Drivers

- Sovereignty: IRIS owns the contracts; providers are replaceable adapters, never authority or canonical memory.
- Safety: no raw secret, screenshot bytes, or notification payload may reach logs, evidence, canonical memory, or model context; every capability fails closed.
- Least authority: no capability is available by default; no existing grant is widened; no unbounded tool name is added.
- Locality: no remote delivery, no network egress beyond the already-approved loopback boundaries, no persistence beyond an exact ephemeral contract.
- Replaceability and removal: every provider can be swapped or removed without changing the Core contract.

## Options Considered

**Screenshot capture — Playwright-backed ephemeral capture.** Identity `playwright` 1.62.0 (already pinned). Benefit: reuses the existing ephemeral Chromium context; no new dependency. Limitation: can capture only what the bounded browser context renders, which is the intended scope. Data path: image bytes remain inside the adapter; the Core contract receives only redaction-attested metadata and a content digest. Removal: drop the adapter; the contract remains valid with any other attesting adapter. Rejected alternatives: OS-level full-screen capture APIs (unbounded scope, no redaction guarantee) — not adopted.

**Credential storage — Windows Credential Manager, reference-only.** Identity: Windows Credential Manager (OS component). Benefit: Founder-controlled OS store; IRIS holds only an opaque `wcm://` reference and never a value. Limitation: resolution of a real secret is deliberately out of scope for this tranche and requires a separate exact Founder authorization. Data path: no credential value enters any IRIS process, log, test, or evidence. Removal: delete the reference; no stored secret is touched. Rejected alternatives: embedding secrets in configuration or environment files (prohibited by policy) — not adopted.

**Local notifications — Windows native local notifications.** Identity: Windows native notification surface (OS component). Benefit: local, credential-free, non-networked Founder signal. Limitation: plain bounded text only; no links, actions, input, images, or remote destinations. Data path: bounded redacted text to the local surface; no network, no persistence. Removal: drop the adapter. Rejected alternatives: external or remote messaging services (out of scope; a separate provider decision) — not adopted.

**Desktop control — declined.** Keyboard or pointer injection, application or window control, and accessibility automation are **not** adopted. They remain blocked pending a separate Founder-approved ADR and registry decision covering preview, exact application and window scope, immediate interruption, audit, recovery, and fail-closed behavior.

## Decision

IRIS Core adopts three provider-independent local-workstation safety contracts, implemented additively in `packages/tool-gateway/src/local-workstation-provider.ts` with injected adapters and strict schemas:

1. **Ephemeral redacted screenshot capture.** A capture is bound to one exact target, is byte- and dimension-bounded, is released only when the adapter reports redaction, carries only metadata and a content digest (never bytes or a path), is structurally ephemeral and unpersistable, and carries no authority.
2. **Opaque credential references.** A reference is a provider-qualified `wcm://` locator plus safe metadata, holds no value, cannot be enumerated, and cannot be resolved without a later exact, unexpired, reference-bound Founder authorization — and even then no value is produced by this contract.
3. **Local-only native notifications.** A notification is local-destination only, bounded redacted plain text, with no link, action, input, image, remote destination, persistence, or implied authority.

The already-pinned **SearXNG** (digest `sha256:f4c8e59de166ed71f6380c0847c312ca51f0d41996e31d0559163b6b09ecde52`), **Playwright** `1.62.0`, and **MCP TypeScript SDK** `@modelcontextprotocol/sdk 1.30.0` are recorded as adopted providers behind the Cycle Six governed tool gateway.

The permanent owner is IRIS Core. Providers are replaceable adapters. The gateway is not weakened, no grant is widened, and no new governed tool name is added. Windows desktop control is explicitly not adopted.

## Consequences

- Positive: the existing providers are accurately registered; the new capabilities have bounded, testable, fail-closed contracts before any live use.
- Negative: screenshot, credential-resolution, and notification *activation* remain out of scope; a later tranche must add adapters and Founder-facing controls.
- Security/privacy: no secret, screenshot bytes, or notification content can flow to logs, evidence, canonical memory, or model context; enumeration and resolution are denied; desktop control is refused.
- License/cost: no new dependency, no spending, no provider-resource creation. OS components are used under their existing terms; Playwright, SearXNG, and MCP SDK retain their recorded licenses.
- Layer 4: the Command Center gains no new authority; this ADR governs Core contracts only.

## Verification

`tests/cycle-ten-local-workstation-provider.test.ts` proves, hermetically and without any live effect: redaction-gated screenshot release; byte/dimension bounds; ephemeral, no-persistence, no-bytes handles; unsafe-target rejection; opaque credential references with no value field; enumeration denial; resolution-authorization requirement with no value ever produced; local-only, redacted, non-actionable notifications; link, secret, and authority-laundering rejection; expiry and cancellation fail-closed; and a hash-chained decision audit. The Cycle Six governed-tool-gateway and connected-provider suites remain passing with no grant widening. Independent Codex review of the exact producer commit is required before merge.

## Rollback and Removal

Revert the Cycle Ten C merge with a history-preserving `git revert -m 1 <merge-commit>`. The contracts are additive and export-only; removing the `local-workstation-provider` export and file restores the prior surface with no data migration. No provider resource, credential, or persisted artifact exists to clean up.

## Approval

- Approver: Founder Cristofer Stoic Arellano
- Approval identifier: `founder-cycle-ten-c-task-publication-2026-08-07`
- Date: 2026-08-07
- Commit: recorded in the Cycle Ten C pull request and handoff
- Reapproval triggers: adopting any live activation, adopting desktop control, changing a provider identity or pin, or widening any capability scope.

## Supersession

This decision supersedes no prior ADR. Windows desktop control remains explicitly un-adopted and must be decided by a future ADR that never erases this record.
