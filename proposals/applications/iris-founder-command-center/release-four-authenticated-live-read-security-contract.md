# IRIS Founder Command Center Release Four Security Contract

**Contract version:** `iris.stoic/founder-command-center-security/v1`

**Read-model version:** `iris.stoic/read-model/v1`

**State:** Proposed; non-executable; pending exact Founder approval

## Objective

Release Four establishes the first real, local-only, authenticated, read-only connection between the Founder Command Center and IRIS Core. It replaces fictional application data with an allowlisted view of actual local IRIS state without granting the browser approval, mutation, repository-write, worker-launch, provider, deployment, credential-management, or spending authority.

## Trust Boundaries

Three processes have distinct authority:

1. **Browser interface** — renders allowlisted data and initiates a local Founder session. It receives no Core credential, repository access, provider credential, approval-consumption authority, or worker-runtime authority.
2. **Command Center gateway** — serves the application at exact origin `http://127.0.0.1:4174`, authenticates the local Founder session, validates Core responses, redacts output, and exposes the same-origin read endpoint. It owns no canonical IRIS state.
3. **IRIS Core read service** — listens only on `127.0.0.1:4181`, authenticates only the gateway, reads allowlisted local IRIS state, produces integrity-bound envelopes, and exposes no mutation route.

The gateway starts the Core read service as a child process at an exact canonical repository revision. Both terminate together. Neither becomes a persistent background service in Release Four.

## Founder Session Authentication

Release Four uses a bounded console-possession session suitable for the single-Founder local workstation:

- The gateway uses the operating-system cryptographic random generator to create a 256-bit bootstrap secret in memory.
- The terminal displays a separate short pairing code once. The pairing code expires after two minutes and is accepted once.
- The Founder enters the pairing code only at the exact loopback origin. The browser sends it once to `POST /v1/session` with exact-origin and Fetch Metadata checks.
- A successful exchange invalidates the pairing code and returns an opaque, 256-bit session identifier in an `HttpOnly`, `SameSite=Strict`, `Path=/`, host-only cookie. The cookie is never readable by application JavaScript.
- The session expires after eight hours or on gateway termination, whichever occurs first. `DELETE /v1/session` performs local logout only.
- Session identifiers, pairing codes, internal gateway credentials, and integrity keys are never written to disk, browser storage, URLs, source maps, logs, error messages, analytics, or repository evidence.
- Five failed pairing attempts invalidate the pairing code. Authentication failures return one generic response and are rate limited.

This authenticates possession of the Founder-operated launch terminal for R0 read access. It is not approval authentication and cannot authorize R1-R4 actions. A future hardware-backed Founder identity mechanism requires a separate proposal.

## Gateway-to-Core Authentication

- At each launch, the gateway creates a separate 256-bit internal credential and integrity key using the operating-system cryptographic random generator.
- The gateway passes them once to the child Core process through an inherited, anonymous standard-input channel before either listener becomes ready.
- The values exist only in process memory and are not inherited through environment variables or command-line arguments.
- Every Core request requires exact audience `iris-founder-command-center`, scope `read-model:v1`, a unique request identifier, a timestamp within 30 seconds, and an HMAC-SHA-256 request signature.
- Core responses contain an HMAC-SHA-256 attestation over the exact canonical JSON response body. The gateway verifies the signature, digest, request identifier, audience, scope, revision, freshness, and schema before returning any protected display data.
- Replay, signature, audience, scope, clock, request-identifier, or digest failure closes the connection and renders no protected data.

## Exact Network Surface

| Listener                 | Exact route              | Method   | Caller                             | Purpose                         |
| ------------------------ | ------------------------ | -------- | ---------------------------------- | ------------------------------- |
| Gateway `127.0.0.1:4174` | `/` and immutable assets | `GET`    | local browser                      | interface                       |
| Gateway `127.0.0.1:4174` | `/v1/session`            | `POST`   | exact-origin browser               | one-time local session exchange |
| Gateway `127.0.0.1:4174` | `/v1/session`            | `DELETE` | authenticated exact-origin browser | local logout                    |
| Gateway `127.0.0.1:4174` | `/v1/read-model`         | `GET`    | authenticated exact-origin browser | allowlisted display model       |
| Gateway `127.0.0.1:4174` | `/v1/health`             | `GET`    | local browser                      | non-sensitive availability      |
| Core `127.0.0.1:4181`    | `/v1/read-model`         | `GET`    | authenticated gateway only         | signed canonical display model  |
| Core `127.0.0.1:4181`    | `/v1/health`             | `GET`    | authenticated gateway only         | bounded service health          |

Every other method, route, host, origin, redirect, upgrade, WebSocket, event stream, upload, file-serving path, and listener is denied. Neither listener binds to `localhost`, `0.0.0.0`, `::`, a LAN address, or a public interface. CORS is disabled; no wildcard or reflected origin is emitted.

## Browser Protections

- Content Security Policy defaults to `default-src 'self'` and `connect-src 'self'`; no other network destination is permitted.
- `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, and no inline script are required.
- Responses set `Cache-Control: no-store`, `Pragma: no-cache`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and a restrictive Permissions Policy.
- Session and read requests require exact `Origin: http://127.0.0.1:4174`, `Sec-Fetch-Site: same-origin`, and an unpredictable per-session CSRF value delivered only inside the authenticated HTML response and retained only in memory.
- The browser may not use `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, service workers, credential APIs, telemetry, analytics, or error-reporting destinations.

## Allowlisted Real State

IRIS Core may expose only:

- exact local canonical revision, branch, configured remote identity, tracked remote revision, and their observed equality;
- Phase 0 graduation status and checkpoint identifier from canonical IRIS self-description;
- current capability and wave status from canonical specifications and evidence;
- read-only mission, proposal, worker, evidence, blueprint, and component-health summaries already represented by strict IRIS contracts;
- source revision, repository-relative citation, observation time, integrity state, and freshness for every record;
- local model-runtime availability and model label without prompts, context, or unrestricted output;
- provider-zero state only when supported by provider-authoritative evidence; otherwise the field reports `unverified`.

The service uses fixed repository-relative allowlists and IRIS package APIs. It does not accept arbitrary paths, shell text, Git arguments, SQL, URLs, model prompts, provider queries, or user-controlled repository selectors.

## Forbidden Data and Authority

Secrets, tokens, pairing codes, session identifiers, environment values, personal files, raw prompts, hidden reasoning, chain-of-thought, unrestricted logs, private keys, Git credentials, provider credentials, Docker socket access, arbitrary filesystem data, repository contents outside the allowlist, mutation commands, approval statements, and approval-consumption state are forbidden.

Release Four cannot create or launch workers, modify missions, submit or consume approvals, write memory, change repositories, invoke providers, install dependencies, deploy, expose a public service, spend money, or create persistent external resources.

## Limits and Failure Behavior

- Gateway and Core requests time out after two seconds with no automatic retry after authentication or integrity failure.
- The maximum Core response and maximum browser response are each 256 KiB.
- The read model expires after 30 seconds. The interface never falls back to stale or fictional data after live mode begins.
- Authentication, availability, schema, freshness, origin, scope, revision, digest, signature, redaction, size, or source failure renders a visible unavailable state and no protected data.
- Logs contain only bounded event identifiers, result classes, durations, and redacted correlation identifiers.
- Five consecutive integrity failures terminate both services and require a new Founder-operated launch.

## Verification Gate

Implementation must prove:

- exact host, port, method, route, origin, audience, scope, request-signature, response-attestation, freshness, and size enforcement;
- pairing expiry, one-time use, failed-attempt invalidation, session expiry, logout, and process-exit invalidation;
- rejection of missing, stale, replayed, incorrectly scoped, incorrectly addressed, unsigned, altered, oversized, undeclared, contradictory, unverified, secret-containing, and unavailable inputs;
- zero browser-readable credentials and zero browser persistence APIs;
- zero Core credentials in environment variables, arguments, logs, source maps, bundles, evidence, and Git changes;
- no arbitrary path, command, provider, Docker, repository-write, worker-launch, approval, or mutation surface;
- formatting, zero-warning lint, strict type checking, tests, production builds, accessibility, dependency audit, secret scan, bundle destination scan, and clean diffs in both repositories;
- loopback startup, authenticated real read, fail-closed behavior, graceful shutdown, ports `4174` and `4181` closed, child process absent, temporary state removed, and provider-authoritative zero scoped resources after cleanup.

## Rollback

The application rollback revision is `ecb30d9b988f3e58e71c1d2c5da1730873c98415`. The canonical IRIS rollback revision is `7dcd3c24244ffc4ebdc3d56b7aba1ece6915505a`. History-preserving reverts restore the disconnected Release Three application and remove the Core read service. No live data migration or persistent credential removal is required because Release Four stores neither.

## Authorization Boundary

This contract and its proposal authorize nothing by themselves. Implementation, dependency changes, credential creation or use, actual IRIS connectivity, staging, committing, pushing, pull-request creation, merging, deployment, startup registration, public exposure, spending, provider resources, worker activation, and approval submission each remain unavailable until explicitly included in an exact Founder-approved proposal.
