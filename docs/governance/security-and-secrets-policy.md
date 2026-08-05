# Security Baseline and Secrets-Handling Policy

**Status:** Canonical

**Version:** 1.0.0

## Security Objectives

STOIC-IRIS must preserve Founder control, least privilege, data confidentiality, repository integrity, provider replaceability, verifiable execution, recoverability, and visible failure.

## Baseline Controls

### Workstation and operating systems

- Use supported operating-system releases and current security maintenance.
- Record firmware, driver, WSL, Docker, GPU, and development-tool versions in reproducible diagnostics.
- Review reported vulnerabilities and deferred updates; do not conceal or force updates without cause.
- Separate disposable evaluation environments from canonical workspaces.

### Repository

- Keep protected work on governed branches with reviewable history.
- Enable secret scanning and dependency alerts where available.
- Do not commit credentials, tokens, private keys, cookies, recovery codes, or unredacted sensitive configuration.
- Treat public visibility as explicit disclosure of all committed history.

### Dependencies and supply chain

- Adopt only exact identified packages, models, images, repositories, or binaries.
- Pin material dependencies and record origin, version, digest when available, license, install behavior, network destinations, telemetry, and removal procedure.
- Run install scripts only after review appropriate to risk.
- Prefer lockfiles, checksums, signed releases, minimal dependency sets, and reproducible builds.

### Containers and execution

- Use disposable containers for evaluation and untrusted execution.
- Avoid privileged mode, host networking, broad filesystem mounts, Docker socket exposure, and unnecessary capabilities.
- Define CPU, memory, GPU, time, storage, and network limits.
- Verify container, workspace, process, model, port, and resource cleanup.

### Models and providers

- Treat prompts and retrieved context as data disclosure to the selected runtime.
- Record provider, model, runtime, configuration, context limits, and network posture.
- Do not send secrets or unrelated canonical memory to a model.
- Validate structured output before treating it as instructions or data.

## Secret Classes

| Class | Examples | Repository rule |
| --- | --- | --- |
| Public configuration | Non-sensitive ports, feature flags, sample values | May be committed when reviewed |
| Internal configuration | Local paths, internal topology, non-secret identifiers | Minimize; exposure policy applies |
| Sensitive data | Personal information, private evidence, internal operational details | Do not publish without exact approval and redaction review |
| Secret | Tokens, passwords, private keys, session cookies, signing material | Never commit or place in prompts/logs |
| Recovery authority | Root credentials, account recovery codes, break-glass keys | Founder-controlled storage only; strongest handling |

## Secret Lifecycle

1. Identify purpose, owner, scope, provider, and required lifetime.
2. Create through the approved provider or local secret mechanism.
3. Store outside source control with least-privilege access.
4. Inject only into the authorized process and environment.
5. Redact logs, errors, prompts, screenshots, and evidence.
6. Rotate after suspected exposure or according to policy.
7. Revoke when no longer required.
8. Verify revocation and remove temporary copies.

Environment-variable names may be documented; values may not. Example files must contain unmistakable placeholders and no usable credentials.

## Network and Telemetry

Every adopted component must document outbound destinations, ports, update checks, analytics, crash reporting, model downloads, and disablement controls. Default-open network access is prohibited for governed workers.

## Logging and Evidence

Logs must be useful for audit without retaining secrets. Sensitive fields must be redacted before persistence. Redaction failures are security incidents and must not be hidden by deleting history.

## Incident Response

On suspected exposure: stop further disclosure, preserve non-secret evidence, revoke or rotate affected credentials, identify scope, notify the Founder, repair the control failure, verify cleanup, and record limitations. Public Git history must be treated as copied even if later rewritten.

## Minimum Wave 1 Verification

- Secret-pattern scan of staged baseline files.
- Confirmation that no usable credentials exist in repository history under review.
- Container test uses disposable cleanup.
- Local model API is bound and exposed according to documented configuration.
- Public/private repository status is captured accurately.
- Branch protections are verified provider-side before the gate passes.

## Founder Decision

- [x] Approved as canonical policy
- [ ] Approved with amendments
- [ ] Rejected for revision

**Founder:**

**Decision date:**

**Approved version or commit:**

**Notes:**
