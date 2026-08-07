# Cycle Ten C Local Workstation Provider Governance — 2026-08-07

## Status

Implemented and locally verified by the producer. Independent Codex review of the exact producer commit is required before merge. Claude cannot approve its own material output.

## Binding

- Task: `cycle-ten-c-local-workstation-provider-governance` (`approved`, `R2`, `phase0_graduation: false`)
- Activation revision: `cc13fe1664ab863c07c74eadf13301f9dbeaa518`
- Bound Core base (activation parent): `c228c34ffa14b9a7d10cc01271e5e89fd6dc2213`
- Bound Command Center base: `97f3bdb79ce7d7d503eba3d3570b04c8309a1785` (registered only; not modified)
- Branch: `iris/cycle-ten-c-local-workstation-provider-governance`
- Isolated Claude-owned worktree: `C:\Projects\STOIC-IRIS-cycle-ten-c`, clean before work
- Producer: Claude · Independent reviewer and publisher: Codex

All six foundation-source SHA-256 digests were verified against `SOURCE-MANIFEST.md` before material work. The library was read only.

## Changed paths (exact, all within `allowed_paths`)

- `packages/tool-gateway/src/local-workstation-provider.ts` (new)
- `packages/tool-gateway/src/index.ts` (one export line)
- `tests/cycle-ten-local-workstation-provider.test.ts` (new)
- `docs/architecture/decisions/ADR-007-local-workstation-capability-providers.md` (new)
- `docs/registries/technology-and-platform-registry.md`
- `docs/registries/dependency-attribution-registry.md`
- `docs/governance/security-and-secrets-policy.md`
- `docs/specifications/cycle-ten-local-workstation-provider-governance.md` (new)
- `evidence/cycle-ten/local-workstation-provider-governance-2026-08-07.md` (this file)
- `.iris/coordination/handoffs/cycle-ten-c-local-workstation-provider-governance.json` (handoff)

`packages/tool-gateway/src/contracts.ts` was available but not modified: no governed tool name was added, matching the prohibition against unbounded tool names and grant widening.

## Implemented governance

- **ADR-007** records the exact provider identities, ownership boundary, source and version evidence, license and security status, interfaces, limitations, replacement and removal paths, approval provenance, and the explicit non-adoption of Windows desktop control.
- **Registry corrections** record SearXNG (image digest `sha256:f4c8e59d…ecde52`, loopback-only), Playwright `1.62.0`, and MCP SDK `1.30.0` as adopted, and record screenshot capture, Windows Credential Manager references, and Windows local notifications as bounded proposed contracts, not activated. Desktop control is recorded as blocked.
- **Security policy** gains a Local Workstation Capability Contracts section.
- **Provider-independent Core contracts** with injected hermetic adapters for ephemeral redaction-attested screenshots, opaque credential references, and local-only notifications, plus a hash-chained decision audit.

## Verification

Commands run in the isolated worktree with Node `24.19.0` and pnpm `11.20.0`.

| Command | Exit |
| --- | --- |
| `pnpm install --offline --frozen-lockfile --ignore-scripts` | 0 |
| `pnpm exec vitest run tests/cycle-ten-local-workstation-provider.test.ts tests/cycle-six-governed-tool-gateway.test.ts tests/cycle-six-connected-tool-providers.test.ts` | **0** — 25 passed |
| `pnpm format:check` | 0 |
| `pnpm lint` | 0 |
| `pnpm typecheck` | 0 |
| `pnpm test` (full) | **1** — 289 passed, 1 failed; see limitation 1 |
| `pnpm build` | 0 |
| `pnpm diagnostics` | 0 |
| `pnpm verify` (aggregate) | **1** — short-circuits on the same single failure |

The new suite contributes 17 tests: redaction-gated screenshot release; byte and dimension bounds; ephemeral, no-persistence, no-bytes handles; unsafe-target rejection; expiry and cancellation fail-closed; opaque credential references with no value field; enumeration denial; resolution-authorization requirement with no value produced; secret-like input rejection; local-only, redacted, non-actionable notifications; link, secret, and authority-laundering rejection; and a hash-chained decision audit with outcome binding. The Cycle Six governed-tool-gateway and connected-provider suites are unchanged and passing.

`pnpm-lock.yaml` is byte-identical before and after the offline materialization: `sha256:` unchanged; no dependency version changed and no lifecycle script ran.

## Limitations

1. **One pre-existing full-suite failure, unrelated to Cycle Ten C.** `tests/cycle-eight-executable-worker-runtime.test.ts > "denies a tracked symlink without modifying its external target"` fails with `EPERM: operation not permitted, symlink` at its own setup. This Windows session cannot create symlinks at all: an isolated `fs.symlinkSync` probe fails identically (Developer Mode off, shell not elevated). That test imports no Cycle Ten C code, was not modified, and lies outside this task's allowed paths, so it was left unrepaired. All other 289 tests pass, and format, lint, typecheck, build, and diagnostics each exit 0. Codex's full `pnpm verify` under WSL, where symlink creation is supported, is expected to pass.
2. **No live effect.** All verification uses deterministic hermetic fixtures; no screenshot API, credential store, notification service, desktop, browser session, or network was invoked.
3. **Contracts, not activation.** This tranche delivers governance and safety contracts only. Live activation and Founder-facing controls remain later Cycle Ten integration.

## Boundary

No provider was activated. No screenshot was captured or persisted; no credential was enumerated, resolved, or exposed; no notification was delivered; no desktop was controlled; no browser session, network, credential, provider resource, or port beyond loopback was used. No dependency version or lockfile changed and no lifecycle script ran. USD 0 was spent. Windows desktop control remains blocked. Nothing performs or claims Phase 0 graduation, and no claim of complete Cycle Ten parity is made.

## Rollback

Close the pull request without merging, delete the remote branch `iris/cycle-ten-c-local-workstation-provider-governance` through the ordinary non-force path, remove the isolated worktree `C:\Projects\STOIC-IRIS-cycle-ten-c`, and prune. `main` is never modified, so no history rewrite is required. The contracts are additive and export-only; removing the export and file restores the prior surface with no data migration.
