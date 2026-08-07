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

A `ScreenshotRequest` binds one exact target (`browser-page`, `named-window`, or `screen-region` with an explicit descriptor), byte and dimension ceilings, and a maximum five-minute request window. A `ScreenshotCaptureAdapter` reports metadata only—never image bytes. Release requires an attestation digest that exactly binds the request ID, target, content digest, dimensions, byte length, redaction method, and redacted-region count. A Core-owned one-shot guard refuses replay. Core races the provider call against Founder cancellation and a bounded timeout, then re-checks cancellation and expiry before releasing a handle even if an adapter ignores its signal. The handle remains structurally ephemeral, unpersisted, authority-free, and carries no bytes, data, or path.

### Credential references

A `CredentialReference` is an opaque, provider-qualified `wcm://` pointer plus safe metadata; it structurally `holdsValue: false` and has no value field. `registerCredentialReference` refuses secret-like input. `describeCredentialReference` returns metadata only. `denyCredentialEnumeration` always refuses listing and records the denial. `assertCredentialResolutionAuthorized` requires a one-shot, unexpired Founder authorization whose digest exactly binds the reference ID, provider, opaque pointer, resolution operation, approver, approval time, and expiry. Altering any bound field fails closed. Even with a valid authorization the contract produces no secret value, and no credential store is touched in this tranche.

### Local notifications

A `LocalNotificationRequest` is local-only, with bounded plain text, low/normal urgency, and a maximum five-minute request window. `presentLocalNotification` refuses links, secret-like content, authority-laundering payloads, replay, and strict-schema extras such as actions, input, images, remote destinations, or persistence. Core races delivery against Founder cancellation and a bounded timeout, then re-checks cancellation and expiry before releasing a receipt even if an adapter ignores its signal. The receipt carries no content and remains non-remote, non-actionable, unpersisted, and authority-free.

### Audit

Every protected accept or deny decision must be sealed through an injected recorder. `LocalWorkstationAudit` provides a hash-chained, append-only implementation whose `verify()` confirms sequence, previous-digest linkage, and per-entry digest. Records contain only capability, bounded request identifier, outcome, and a redacted reason code. If the recorder cannot seal the result, the contract fails closed rather than releasing it.

## Boundaries

No live capture, credential access, notification delivery, desktop control, browser session, network egress, credential, provider-resource creation, spending, or persistence occurs. Windows desktop control is not adopted. Providers are replaceable; removing the export and file restores the prior surface.

## Verification

`tests/cycle-ten-local-workstation-provider.test.ts` exercises every contract with deterministic hermetic fixtures, including non-cooperative adapters, replay, exact digest and attestation binding, temporal bounds, post-provider expiry, and mandatory audit outcomes. Acceptance command one runs the suite with the Cycle Six governed-tool-gateway and connected-provider suites, which remain passing with no grant widening. The full `pnpm verify` suite remains required; passing tests prove contract readiness only, not live activation.
