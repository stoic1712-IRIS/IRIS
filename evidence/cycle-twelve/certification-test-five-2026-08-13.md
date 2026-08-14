# Cycle Twelve Certification — Test Five Attempt Record

**Status:** Not passed. Recorded as permanent held-out evidence with two capability findings.

**Result:** FAIL. Across two phases the delivery never reached commit, push, pull request, the injected interruption, or the idempotent resume. Every attempt ended at the governed repair limit during verification.

**Run date:** 2026-08-13. Audited and extended 2026-08-14.

**Operator:** Claude, under the Founder's standing certification mandate of 2026-08-13 ("run all the test until they all pass").

**Executor:** IRIS complete-software-delivery runtime through the Founder Command Center. Phase one used the pinned local `qwen3-coder:30b` worker; phase two used `qwen2.5-coder:32b`. `gpt-oss:20b` reviewed throughout. `qwen3.6:27b` was also tried as worker during phase one.

## Objective

A bounded two-file TypeScript feature: a module exporting `formatDurationMs`, plus a vitest file beside it covering seven stated cases — a negative value, `NaN`, zero, a sub-second value, an exact minute, an hour with seconds and no minutes, and a multi-day compound value. Rendering is whole units largest-first, zero units omitted, a bare seconds value alone, milliseconds truncated and never rounded up. Read and write paths were exactly those two files, and the delivery had to stop at the merge approval boundary.

The seven required cases and the formatting rules were identical in both phases. Two things about the objective did change between them, and both are recorded under "What changed between the phases" below, because the Founder — not the producer — should judge whether they weaken the test.

## Phase one — the lint boundary

The feature logic was correct on every attempt. The auditor read the generated module and test file directly: the unit conversions, the largest-first rendering, the bare-seconds case, the truncation rule, and all seven test cases were right, and `pnpm typecheck` and the new tests passed inside the disposable workspace.

The delivery failed because the generated code violated one repository lint rule,
`@typescript-eslint/restrict-template-expressions`: it wrote `` `${days}d` `` where this
repository requires `` `${String(days)}d` ``. Every attempt exhausted the governed repair budget on that single rule.

### Capability finding one

`qwen3-coder:30b` did not satisfy that rule under any of the conditions the platform can provide:

- with the repository's own `eslint.config.js` supplied in its context;
- with the repository's `AGENTS.md`, `CLAUDE.md`, and `tsconfig.json` supplied alongside it;
- with the exact failing lint output — rule name, file, and line numbers — returned to it as repair findings, twice;
- with an explicit instruction that those files are binding and must be self-checked before returning;
- and, in one earlier attempt, with the rule restated in plain language inside the objective itself.

The rule is not auto-fixable: the auditor confirmed directly that `eslint --fix` leaves these violations in place, so the deterministic normalization stage cannot rescue them either.

`qwen3.6:27b` and `qwen2.5-coder:32b` each hit the same rule under the same conditions.

**This finding is historical and has since been resolved, not by the model improving, but by the Founder amending the rule.** Command Center pull request #95 added `allowNumber` to that one rule under `src/iris/**` and `tests/iris/**` only, on the Founder's instruction, on the recorded ground that the rule was filtering out correct work rather than defects. The rule still rejects `any`, objects, and nullish values in templates, and every other rule and every human-authored path is unchanged. The finding is preserved here because it is what the run actually produced; it is no longer the boundary.

## Phase two — the attempt after the platform repairs

With the lint boundary removed and eight further platform repairs merged, a fresh proposal ran to a terminal state. This is the authoritative final attempt.

| Field | Value |
| --- | --- |
| Delivery id | `delivery_founder-a8f8eb331f781183f0f3dbee` |
| Access request | `access_70cde20119825914cada641c` |
| Repository | `stoic1712-IRIS/iris-founder-command-center` |
| Base revision | `da91432ac3db855d81c70a6c47e87675f03f339c` (main after Command Center #100) |
| Delivery branch | `iris/founder-delivery-a8f8eb331f781183f0f3dbee` |
| Worker / reviewer | `qwen2.5-coder:32b` / `gpt-oss:20b` |
| Repair budget | 2 |
| Started / terminal | 2026-08-13T23:38:42Z / 2026-08-13T23:46:31Z |
| Terminal state | `recovery-ready`, `DELIVERY_VERIFICATION_REPAIR_LIMIT`, `repairAttempt: 2` |
| Remote equality / cleanup | Not verified — the run never reached those stages |

The lifecycle reached `received`, `inspecting`, `planning`, `workspace-ready`, `implementing`, `verifying`, `repairing` (1), `verifying`, `repairing` (2), `verifying`, `recovery-ready`. No commit, push, or pull request occurred, so the interruption and idempotent-resume requirements were again never exercised.

### What the auditor verified directly on 2026-08-14

The workspace was still on disk at `~/.iris/delivery/workspaces/delivery_founder-a8f8eb331f781183f0f3dbee`, with both files present and uncommitted. The auditor ran the delivery's own verification commands against the final state:

- `pnpm exec eslint --no-warn-ignored src/iris/duration-format.ts src/iris/duration-format.test.ts` — **clean, exit 0.** The phase-one boundary is genuinely gone.
- `pnpm exec vitest run src/iris/duration-format.test.ts` — **6 of 7 passed.** The multi-day compound case failed:

```text
AssertionError: expected '2d 4h 4m 27s' to be '2d 5h 4m 3s'
  src/iris/duration-format.test.ts:30
  expect(formatDurationMs(187467000)).toBe("2d 5h 4m 3s");
```

**The implementation is correct and the test fixture is wrong.** 187,467,000 ms is exactly 2d 4h 4m 27s, which is what the module returned. The asserted string `"2d 5h 4m 3s"` corresponds to 191,043,000 ms. The worker wrote a test case whose input and expected output do not describe the same duration, then asserted its own correct code was wrong.

### Capability finding two

The repair loop was given everything needed to close this and did not close it.

Verified in `scripts/complete-delivery-adapter.mjs`, the `repair` path supplies the worker with the full `git diff` against the base revision — its own current code for both files — the convention bundle, and, prepended to the findings, the last 4,000 characters of the failing command's real output. That output is the assertion above: the expected string, the received string, the file, the line, and the input constant.

Given that, twice, across both repair attempts, the worker changed the test input from `187463000` to `187467000` — a move of 4 seconds against a gap of 3,576 seconds — and never touched the expected string or recomputed either side. The originally planned constant, recoverable from the stored plan digest, renders as `2d 4h 4m 23s`; it was inconsistent with the same asserted string from the start.

Timing corroborates that the tests, not lint, were the failing command in the final rounds: both later rounds reached terminal state about 0.86s after entering verification, and the auditor measured vitest-first at 0.66s against eslint at 1.98s, consistent with the last-failed-command reordering putting vitest first.

**This is a model capability boundary, and it is the most consequential finding of the run.** Phase one bounded IRIS against a strict style rule, which a Founder decision could and did remove. Phase two bounds something that cannot be removed by policy: `qwen2.5-coder:32b` wrote correct implementation logic, then could not produce a self-consistent multi-unit arithmetic fixture, and could not repair it when handed the literal expected-versus-received contrast twice. All three coder-capable local models have now failed this test at one boundary or the other, and no larger local model is installed.

It still does not bound IRIS's reasoning or its governance machinery: Tests One through Four passed, and in this final run every governed stage — inspection, planning, disposable workspace, bounded mutation, changed-path enforcement, normalization, scoped verification, budgeted repair, and safe terminal recovery — behaved exactly as specified. The platform did its job. The model did not.

## Platform defects found and repaired during the attempts

Each was a genuine defect that would have blocked any governed delivery, found only because this test exercised the path. All are merged with regressions, and none altered this test's stated requirements:

1. A repair iteration regenerating a file the same delivery created was rejected as a duplicate create (Command Center pull request #86).
2. Repairs ran blind: verification output was discarded and the runtime supplies only a generic finding, so the worker could never learn what failed (#87).
3. The worker never received the repository's own conventions at all; the objective author was the only possible source (#88).
4. The generation schema and the mutation validator disagreed about a required field, and the resulting error named none of them (#89).
5. The delivery contract had no normalization stage, though the sibling executable-worker contract already defined one (IRIS Core pull request #121, Command Center #90).
6. Normalization ran repository-wide, so the changed-path guard correctly denied the delivery (#91).
7. Convention files were matched by exact filename, so this repository's `eslint.config.js` was silently absent while `eslint.config.mjs` was sought (#92).
8. The delivery worker was pinned to an older model generation than the workstation had available (#93, #94).
9. The worker received file contents without the repository layout, so it could not place a new file correctly (#96).
10. A run that exhausted its repair budget left no recoverable record of which command failed or why (#97).
11. Verification ran the whole repository suite, so unrelated timing-sensitive tests under GPU load consumed the candidate's repair budget for failures it did not cause (#98).
12. Governed deliveries committed without an explicit IRIS identity (#99).
13. The independent reviewer's verdict and findings were not persisted, so a blocked candidate left no evidence of the refusal (#100).

## What changed between the phases

Recorded plainly for the Founder's judgment, because both changes made the test easier to reach even though neither changed what the feature must do:

- **Path relocation.** Phase one targeted `src/duration-format.ts` and `tests/duration-format.test.ts`. Phase two targeted `src/iris/duration-format.ts` and `src/iris/duration-format.test.ts` — inside the exact scope where the Founder's amended lint rule applies. The seven cases and the formatting rules were unchanged.
- **Verification scoping.** Phase one ran the repository-wide `pnpm lint` and `pnpm test`. Phase two ran `eslint` and `vitest` against only the delivery's own changed paths, with `pnpm typecheck` and `pnpm build` still repository-wide (#98). The full suite remains the authority through CI on any resulting pull request.

Neither change would have rescued the phase-two failure: the failing assertion is inside the delivery's own test file, so it fails under any scoping.

## Limitations

- Operator and auditor are the same party under the recorded mandate; the Founder remains the certifying reviewer. Nothing here is self-certified.
- The consecutive-pass requirement for Tests Four through Seven is not met: this attempt breaks the sequence at Test Five.
- The phase-two access grant expired at 2026-08-14T07:38:42Z. Any further attempt requires a fresh authenticated Founder approval; the producer cannot self-authorize one.
- The phase-two workspace and its delivery branch were left in place as evidence and are not cleaned up. Cleanup and remote-equality verification remain outstanding for that delivery id.
- Deliveries in this run targeted a standalone clone at `C:\Projects\iris-founder-command-center-delivery`, because the canonical `-main` checkout is a linked Git worktree whose metadata lives at a Windows path the Linux Git used by the delivery runtime cannot read. That layout question is unresolved and belongs to the Founder.
- Open and unrecorded elsewhere: an operator session whose specialist adapter throws still reports `running` in the view, with the failure only in the entry's internal error field.
- Open and unrecorded elsewhere: in the canonical `C:\Projects\STOIC-IRIS` checkout, Windows Node cannot traverse the pnpm `node_modules` symlinks (`EACCES` on `node_modules/zod/package.json`), so `pnpm verify` and `node scripts/dev/iris-dev.mjs contract inspect` fail when invoked from Windows. The installation itself is intact: the same commands resolve and run correctly from WSL against the same checkout. An earlier revision of this record called the installation broken and said repairing it required an unauthorized dependency operation. That was wrong, and the correction is recorded here rather than silently replaced.
