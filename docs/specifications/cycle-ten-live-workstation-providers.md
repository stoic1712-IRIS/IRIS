# Cycle Ten D Live Workstation Provider Adapters

**Status:** Implemented and locally verified

Cycle Ten D supplies disabled-by-default provider adapters for the three contracts established in Cycle Ten C. The adapters are usable by an authenticated governed caller, but import, construction, startup, and verification perform no screenshot, credential-store, or notification effect.

## Screenshot adapter

`PlaywrightEphemeralScreenshotAdapter` accepts only a `browser-page` target and an injected resolver for an already-governed page. It refuses other target kinds and missing viewports. Password, token-autocomplete, and `data-iris-sensitive` elements are solid-fill masked. PNG bytes exist only as a local adapter variable used to calculate size and SHA-256; they do not enter the handle, audit, log, evidence, model context, or persistent path. The adapter generates the exact Core-owned redaction-attestation digest, after which the Cycle Ten C contract independently enforces target binding, byte and dimension bounds, replay, timeout, cancellation, post-provider expiry, and audit.

## Credential-reference adapter

`WindowsCredentialReferenceRegistry` registers strict Core-owned `wcm://` reference objects, supports exact retrieval by the derived reference identifier, and removes only that exact reference. It exposes no enumeration or resolution method. No Windows Credential Manager API is called and no secret value exists in the type or runtime state.

## Local notification adapter

`WindowsNativeNotificationAdapter` is runner-injected. The production Windows runner is an explicit function rather than a startup side effect. It launches hidden non-interactive PowerShell only when invoked, sends bounded title/body JSON over child stdin, builds a non-actionable local toast from DOM text nodes, and returns no content. The outer Cycle Ten C contract rejects links, secrets, authority laundering, remote/action/input/image fields, replay, expiry, and cancellation before or after delivery.

## Boundaries and verification

No governed tool grant is widened. No service, browser, credential store, live notification, network provider, or persistent artifact is created. Hermetic tests prove metadata-only screenshot release, redaction binding, non-browser refusal, cancellation, exact credential reference behavior, local notification receipt minimization, and no runner invocation after cancellation. The existing Cycle Ten C suite remains passing, and the full repository verification remains mandatory.
