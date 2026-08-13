# Cycle Twelve Certification — Test Five Attempt Record

**Status:** Not passed. Recorded as permanent held-out evidence with a capability finding.

**Result:** FAIL — the delivery never reached commit, push, pull request, the injected interruption, or the idempotent resume. It failed at verification repair on every attempt.

**Run date:** 2026-08-13

**Operator:** Claude, under the Founder's standing certification mandate of 2026-08-13 ("run all the test until they all pass").

**Executor:** IRIS complete-software-delivery runtime through the Founder Command Center, with the pinned local `qwen3-coder:30b` worker and `gpt-oss:20b` reviewer.

## Objective

A bounded two-file TypeScript feature: `src/duration-format.ts` exporting `formatDurationMs`, plus `tests/duration-format.test.ts` covering seven stated cases. Read and write paths were exactly those two files, verification was the repository's own `pnpm lint`, `typecheck`, `test`, and `build`, and the delivery had to stop at the merge approval boundary.

## What IRIS produced

The feature logic was correct on every attempt. The auditor read the generated module and test file directly: the unit conversions, the largest-first rendering, the bare-seconds case, the truncation rule, and all seven test cases were right, and `pnpm typecheck` and the new tests passed inside the disposable workspace.

The delivery failed because the generated code violated one repository lint rule,
`@typescript-eslint/restrict-template-expressions`: it wrote `` `${days}d` `` where this
repository requires `` `${String(days)}d` ``. Every attempt exhausted the governed repair budget on that single rule.

## Capability finding

`qwen3-coder:30b` did not satisfy that rule under any of the conditions the platform can provide:

- with the repository's own `eslint.config.js` supplied in its context;
- with the repository's `AGENTS.md`, `CLAUDE.md`, and `tsconfig.json` supplied alongside it;
- with the exact failing lint output — rule name, file, and line numbers — returned to it as repair findings, twice;
- with an explicit instruction that those files are binding and must be self-checked before returning;
- and, in one earlier attempt, with the rule restated in plain language inside the objective itself.

The rule is not auto-fixable: the auditor confirmed directly that `eslint --fix` leaves these violations in place, so the deterministic normalization stage cannot rescue them either.

This is a model capability boundary, not a platform defect. It is the most consequential finding of the run, because it bounds what IRIS can deliver unaided into a repository with strict type-checked lint. It does not bound IRIS's reasoning: Tests One through Four passed, including a governed one-file repair through the full executable-worker lifecycle.

## Platform defects found and repaired during the attempts

Each was a genuine defect that would have blocked any governed delivery, found only because this test exercised the path. All are merged with regressions, and none altered this test's requirements:

1. A repair iteration regenerating a file the same delivery created was rejected as a duplicate create (Command Center pull request #86).
2. Repairs ran blind: verification output was discarded and the runtime supplies only a generic finding, so the worker could never learn what failed (#87).
3. The worker never received the repository's own conventions at all; the objective author was the only possible source (#88).
4. The generation schema and the mutation validator disagreed about a required field, and the resulting error named none of them (#89).
5. The delivery contract had no normalization stage, though the sibling executable-worker contract already defined one (IRIS Core pull request #121, Command Center #90).
6. Normalization ran repository-wide, so the changed-path guard correctly denied the delivery (#91).
7. Convention files were matched by exact filename, so this repository's `eslint.config.js` was silently absent while `eslint.config.mjs` was sought (#92).

## Limitations

- Operator and auditor are the same party under the recorded mandate; the Founder remains the certifying reviewer.
- The consecutive-pass requirement for Tests Four through Seven is not met: this attempt breaks the sequence at Test Five.
- Deliveries in this run targeted a standalone clone at `C:\Projects\iris-founder-command-center-delivery`, because the canonical `-main` checkout is a linked Git worktree whose metadata lives at a Windows path the Linux Git used by the delivery runtime cannot read. That layout question is unresolved and belongs to the Founder.
- Open and unrecorded elsewhere: an operator session whose specialist adapter throws still reports `running` in the view, with the failure only in the entry's internal error field.
