# Cycle Ten A Research Integrity — 2026-08-07

## Status

Implemented, independently reviewed, repaired, and re-verified by the producer. Codex returned
CHANGES REQUIRED on head `58baeec8e4bdb6a65ae5ef1c6ca197d7ab26a259` with three blocking findings; all
three are repaired below. A further independent Codex review of the new exact head is required before
merge. Claude cannot approve its own material output.

## Independent review repairs

Codex reproduced three defects in a detached worktree. All were real and all are fixed inside the
existing allowed paths.

### 1. Hidden-character injection bypass (blocking)

`isolateContent` detected patterns on the raw text and only afterwards stripped hidden Unicode. A single
zero-width space — `Ignore all prev<U+200B>ious instructions` — matched only `hidden-content`, escaped
quarantine, and was then **retained as clean readable text**, reconstituting the instruction.

Repair: hidden and bidirectional controls are normalized **before** high-severity detection. The
`hidden-content` finding is still raised from the original text, and `contentDigest` still binds the
exact original bytes, so tampering evidence survives. Regression tests cover a zero-width split payload,
a bidirectional-override split payload, and digest/evidence preservation.

### 2. Non-network URL acceptance (blocking)

`canonicalizeUrl` and `recordSearch` accepted any scheme `new URL()` parsed. A
`file:///C:/secret.txt` result was retained with a positive score.

Repair: only `https:` and `http:` may enter a session. Anything else raises
`RESEARCH_SOURCE_SCHEME_DENIED`, `scoreSource` independently returns `score: 0` / tier `rejected`, and
`recordSearch` refuses the whole batch rather than silently dropping the entry. HTTPS remains the normal
path; plain HTTP is explicitly retained for loopback and legacy documentation sources, penalized by
`scoreSource`, documented in the specification, and tested. Regression tests cover `file:`,
`javascript:`, `data:`, and `ftp:`, plus batch refusal and the retained-HTTP behavior.

### 3. Resume budget widening (blocking)

The public constructor accepted a resume state but bound the **separately supplied** plan, so a
one-query exhausted state could be reopened with `maximumQueries: 25`, yielding 24 unapproved queries.

Repair: a resumed session binds to its own serialized plan; a differing supplied plan raises
`RESEARCH_RESUME_PLAN_MISMATCH`. Resume state is additionally validated against that plan — queries
within budget, sources within the ceiling, no duplicate queries or canonical URLs, quarantine count not
exceeding observed items — raising `RESEARCH_RESUME_STATE_INVALID` otherwise. Regression tests cover
plan mismatch, over-budget state, duplicate queries, an impossible quarantine count, and an
over-ceiling source list.

## Binding

- Task: `cycle-ten-a-research-integrity` (`status: approved`, `risk_class: R2`, `phase0_graduation: false`)
- Task base revision: `93baed93b937c6f359af600f19b4a533548d8f47`
- Worktree base revision: `3e949479f2429037bfacea7e88eed60efbbd77aa` (the task-issuance merge, a direct
  descendant of the task base; the Founder directed the worktree be cut from current `origin/main`)
- Branch: `iris/cycle-ten-a-research-integrity`
- Isolated Claude-owned worktree: `C:\Projects\STOIC-IRIS-cycle-ten-a`
- Producer: Claude · Independent reviewer and publisher: Codex

All six foundation-source SHA-256 digests were verified against `SOURCE-MANIFEST.md` before and after
the work. The library was read only and never staged.

## Implemented controls

- exact research plan with query budget, source ceiling, and minimum source score;
- query normalization so equivalent phrasings consume one budget unit;
- fail-closed `RESEARCH_QUERY_BUDGET_EXCEEDED` rather than silent degradation;
- canonical-URL deduplication across queries;
- untrusted-content isolation for every `search`, `browser`, and `mcp` item, always `trusted: false`,
  carrying origin, source URL, retrieval time, and a SHA-256 digest of the exact original text;
- six injection categories, with instruction-override, authority-laundering, credential-exfiltration,
  and tool-invocation quarantined so their text is withheld entirely;
- zero-width and bidirectional control-character stripping on retained text;
- deterministic source-quality scoring from observable provenance only, with quarantined sources
  scored `0` and tiered `rejected`;
- claim-to-source verification returning `supported`, `unsupported`, or `conflicted`, never citing a
  quarantined source, and refusing unsupported claims outright;
- abort-signal and explicit cancellation failing closed before budget is consumed;
- exact serializable session state and resumption that neither re-spends budget nor duplicates sources.

## Verification

Commands run in the isolated worktree with Node `24.19.0` and pnpm `11.20.0`.

Post-repair run:

| Command | Exit |
| --- | --- |
| `pnpm install --offline --frozen-lockfile --ignore-scripts` | **0** — see limitation 1 |
| `pnpm exec vitest run tests/cycle-ten-research-integrity.test.ts tests/cycle-six-connected-tool-providers.test.ts tests/cycle-six-governed-tool-gateway.test.ts` | **0** — 48 passed |
| `pnpm format:check` | 0 |
| `pnpm lint` | 0 |
| `pnpm typecheck` | 0 |
| `pnpm test` (full) | **1** — 268 passed, 1 failed; see limitation 2 |
| `pnpm build` | 0 |
| `pnpm diagnostics` | 0 |
| `pnpm verify` (aggregate) | **1** — short-circuits on the same single pre-existing failure |

`tests/cycle-ten-research-integrity.test.ts` contributes 28 tests covering query normalization and
budgeting, budget-exceeded failure, canonical deduplication, the source ceiling, all six injection
categories including authority-laundering and credential-exfiltration attempts, quarantine withholding
text, per-origin isolation, hidden-character stripping, source scoring and rejection, plaintext-transport
penalty, supported/unsupported/quarantined-not-cited/conflicted claim verdicts, abort and explicit
cancellation, exact resumption, gateway audit-chain integrity across a bounded research call, and the
retained-text bound.

The Cycle Six governed-tool-gateway and connected-provider suites are unchanged and passing.

## Limitations

1. **Offline install deviation — resolved, not repeated.** On the first pass `--offline` failed with
   `ERR_PNPM_NO_OFFLINE_TARBALL` for one already-pinned tarball (`@xyflow/react@12.11.2`), and the
   producer fell back to the same command without `--offline`. Codex reviewed that as a non-payload
   process deviation exceeding the literal task permission and directed that it not be repeated or
   treated as precedent. This repair used **`--offline` only**, which now exits 0. `pnpm-lock.yaml`
   remains byte-identical (`sha256:c439ca27…03b9c4`) across both passes, and no dependency version or
   lifecycle script was ever changed or run.
2. **One pre-existing full-suite failure, unrelated to Cycle Ten.** Unchanged by the repair.
   `tests/cycle-eight-executable-worker-runtime.test.ts > denies a tracked symlink without modifying its
   external target` fails with `EPERM: operation not permitted, symlink` at its own setup (line 464).
   This Windows session cannot create symlinks at all: Developer Mode is off and the shell is not
   elevated; an isolated `fs.symlinkSync` probe fails identically. That test imports no Cycle Ten code
   and was not modified. It is an environment privilege limitation, not a code defect, and was left
   unrepaired because `tests/cycle-eight-executable-worker-runtime.test.ts` is outside this task's
   allowed paths.
3. **No live provider was exercised.** All verification uses deterministic hermetic fixtures. SearXNG,
   Playwright, and MCP processes were not started, as the task requires.
4. **Cycle Six provider internals were not modified.** `browser-provider.ts`, `search-provider.ts`,
   `gateway.ts`, and `contracts.ts` were available in allowed paths but needed no change: isolation
   composes above the gateway without weakening or altering it. Only `index.ts` changed, to export the
   new module.

## Boundary

No provider was added or adopted. No service or container was started. No credential was read, used, or
disclosed. No desktop control, screenshot capture, notification delivery, or remote access was
implemented. No dependency version or lockfile changed. No lifecycle script ran. USD 0 was spent, zero
provider resources were created, and no port beyond loopback was opened. Nothing in this cycle performs
or claims Phase 0 graduation, and no claim of complete Cycle Ten capability parity is made.

## Rollback

Close the pull request without merging, delete the remote branch
`iris/cycle-ten-a-research-integrity` through the ordinary non-force path, remove the isolated worktree
`C:\Projects\STOIC-IRIS-cycle-ten-a`, and prune. `main` is never modified, so no history rewrite is
required at any point.
