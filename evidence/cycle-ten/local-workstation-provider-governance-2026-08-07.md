# Cycle Ten C Local Workstation Provider Governance — 2026-08-07

## Status

Claude produced the initial bounded branch. Codex independently reviewed exact commit `b4e0427c747ac2acae694fea0dc1531941dadb59`, found five blocking fail-closed defects, and posted one consolidated review. The Founder then explicitly ended Claude participation and reassigned completion to Codex. Codex repaired only the reviewed defects under the same task scope and allowed paths; no provider was activated.

## Binding

- Task: `cycle-ten-c-local-workstation-provider-governance` (`approved`, `R2`, `phase0_graduation: false`)
- Activation revision: `cc13fe1664ab863c07c74eadf13301f9dbeaa518`
- Bound Core base (activation parent): `c228c34ffa14b9a7d10cc01271e5e89fd6dc2213`
- Bound Command Center base: `97f3bdb79ce7d7d503eba3d3570b04c8309a1785` (registered only; not modified)
- Branch: `iris/cycle-ten-c-local-workstation-provider-governance`
- Isolated worktree: `C:\Projects\STOIC-IRIS-cycle-ten-c`, clean at operator transfer
- Initial producer: Claude · Exact-head independent reviewer, repair operator, and publisher after explicit Founder reassignment: Codex

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

## Independent review and bounded repair

Codex's exact-head review identified five real contract defects before merge:

1. adapter cancellation and timeout were advisory rather than enforced by Core;
2. replay and request-window rejection were absent despite the task's explicit acceptance requirement;
3. the credential authorization digest was syntactic and never compared with an exact binding;
4. screenshot redaction attestations were not bound to their request target or capture metadata; and
5. the audit implementation was optional and disconnected from protected operations.

The repair adds a Core-enforced provider race with post-call cancellation and expiry checks, a bounded one-shot replay guard, a five-minute request-window ceiling, exact screenshot-attestation and credential-authorization digest payloads, and mandatory injected decision recording that fails closed when recording fails. New hermetic regressions cover non-cooperative adapters, mid-flight cancellation, timeout, replay, future and overlong windows, post-provider expiry, target/content attestation mismatch, credential field tampering, authorization replay, accepted/denied audit outcomes, and audit-recorder failure.

## Verification

Commands run in the isolated worktree with Node `24.19.0` and pnpm `11.20.0`.

| Command | Exit |
| --- | --- |
| `pnpm install --offline --frozen-lockfile --ignore-scripts` | 0 |
| `pnpm exec vitest run tests/cycle-ten-local-workstation-provider.test.ts tests/cycle-six-governed-tool-gateway.test.ts tests/cycle-six-connected-tool-providers.test.ts` | **0** — 35 passed |
| `pnpm format:check` | 0 |
| `pnpm lint` | 0 |
| `pnpm typecheck` | 0 |
| `pnpm test` (full, WSL) | **0** — 300 passed |
| `pnpm build` | 0 |
| `pnpm diagnostics` | 0 |
| `pnpm verify` (aggregate, WSL) | **0** |

The repaired suite contributes 27 tests. In addition to the original contract coverage, it proves exact target/content redaction binding, one-shot screenshot/credential/notification requests, a bounded replay-ledger capacity, bounded request windows, Core-enforced cancellation and timeout against non-cooperative adapters, post-provider expiry rejection, exact credential authorization binding, and required accepted/denied audit outcomes. The Cycle Six governed-tool-gateway and connected-provider suites are unchanged and passing.

`pnpm-lock.yaml` is byte-identical before and after the offline materialization: `sha256:` unchanged; no dependency version changed and no lifecycle script ran.

## Limitations

1. **Windows-only symlink limitation cleared by required WSL verification.** The initial Windows producer run could not create the Cycle Eight test symlink. Codex reran the complete aggregate suite under the repository-pinned WSL toolchain; all 300 tests and every verification stage passed. No test was weakened or skipped.
2. **No live effect.** All verification uses deterministic hermetic fixtures; no screenshot API, credential store, notification service, desktop, browser session, or network was invoked.
3. **Contracts, not activation.** This tranche delivers governance and safety contracts only. Live activation and Founder-facing controls remain later Cycle Ten integration.

## Boundary

No provider was activated. No screenshot was captured or persisted; no credential was enumerated, resolved, or exposed; no notification was delivered; no desktop was controlled; no browser session, network, credential, provider resource, or port beyond loopback was used. No dependency version or lockfile changed and no lifecycle script ran. USD 0 was spent. Windows desktop control remains blocked. Nothing performs or claims Phase 0 graduation, and no claim of complete Cycle Ten parity is made.

## Rollback

Close the pull request without merging, delete the remote branch `iris/cycle-ten-c-local-workstation-provider-governance` through the ordinary non-force path, remove the isolated worktree `C:\Projects\STOIC-IRIS-cycle-ten-c`, and prune. `main` is never modified, so no history rewrite is required. The contracts are additive and export-only; removing the export and file restores the prior surface with no data migration.
