# Cycle Ten C Local Workstation Provider Governance

**Status:** Implemented and locally verified

Cycle Ten C establishes canonical provider governance and provider-independent Core safety contracts for three Founder-directed local workstation capabilities, and accurately registers three already-pinned providers. It performs no live screenshot, credential-store, notification, desktop, or external-provider effect.

## Scope

- Register the existing **SearXNG**, **Playwright**, and **MCP TypeScript SDK** providers (ADR-007, both registries).
- Add provider-independent contracts, with injected hermetic adapters, for:
  1. ephemeral, redaction-attested screenshot capture;
  2. opaque operating-system credential references;
  3. local-only, non-networked native notifications.
- Explicitly decline Windows desktop control.

All contracts are implemented additively in `packages/tool-gateway/src/local-workstation-provider.ts` and exported from the package index. No governed tool name is added, no grant is widened, and the Cycle Six gateway is unchanged.

## Contracts

### Screenshot capture

A `ScreenshotRequest` binds one exact target (`browser-page`, `named-window`, or `screen-region` with an explicit descriptor), a maximum byte size, and maximum width and height. A `ScreenshotCaptureAdapter` performs the capture and redaction and reports metadata only — width, height, byte length, a content digest, and a redaction report — never image bytes. `captureRedactedScreenshot` releases a `ScreenshotHandle` only when the adapter reports `attested: true` and the capture is within the request's exact bounds. The handle is structurally `ephemeral: true`, `persisted: false`, `authority: "none"`, and carries no `bytes`, `data`, or `path` field, so an image cannot be persisted or exposed through the contract. Unsafe target descriptors (secret-like or URL-bearing), expired requests, and cancellation fail closed before any adapter call.

### Credential references

A `CredentialReference` is an opaque, provider-qualified `wcm://` pointer plus safe metadata; it structurally `holdsValue: false` and has no value field. `registerCredentialReference` refuses secret-like input. `describeCredentialReference` returns metadata only. `denyCredentialEnumeration` always refuses listing. `assertCredentialResolutionAuthorized` requires an exact, unexpired, reference-bound Founder authorization before any future resolution; even with a valid authorization the contract produces no secret value, and no credential store is touched in this tranche.

### Local notifications

A `LocalNotificationRequest` is `destination: "local"` only, with bounded plain-text title and body and a low/normal urgency. `presentLocalNotification` refuses links, secret-like content, and authority-laundering payloads, and strict parsing refuses any action, input, image, remote-destination, or persistence field. The `LocalNotificationReceipt` carries no content and is structurally `remote: false`, `actionable: false`, `persisted: false`, `authority: "none"`. Expired requests and cancellation fail closed before delivery.

### Audit

Every accept or deny decision may be sealed into a `LocalWorkstationAudit`, a hash-chained, append-only record whose `verify()` confirms sequence, previous-digest linkage, and per-entry digest. The outcome is bound into each digest.

## Boundaries

No live capture, credential access, notification delivery, desktop control, browser session, network egress, credential, provider-resource creation, spending, or persistence occurs. Windows desktop control is not adopted. Providers are replaceable; removing the export and file restores the prior surface.

## Verification

`tests/cycle-ten-local-workstation-provider.test.ts` exercises every contract with deterministic hermetic fixtures and asserts the rejection paths above. Acceptance command one runs the new suite with the Cycle Six governed-tool-gateway and connected-provider suites, which remain passing with no grant widening. The full `pnpm verify` suite remains required; passing tests prove contract readiness only, not live activation.
