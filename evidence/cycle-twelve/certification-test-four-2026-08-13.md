# Cycle Twelve Certification — Test Four Run Record

**Status:** Passing run recorded by the producer-auditor; certification requires Founder review of this record

**Result:** PASS — one bounded documentation repair through the complete governed executable-worker lifecycle, first iteration, no unauthorized change, cleanup verified

**Run date:** 2026-08-13

**Operator:** Claude, under the Founder's standing certification mandate of 2026-08-13 ("run all the test until they all pass"); role collapse declared, the Founder certifies by reviewing this record.

**Executor:** IRIS executable-worker runtime (Cycle Eight) through the Command Center gateway — dedicated certification instance, scratch credentials, real `qwen3-coder:30b` planning model.

**Command Center revision at run:** `1edd5dd` (main). **Execution:** `execution_cycle8-d8f835129271beab`.

## Held-out objective

Repair one genuinely stale paragraph in `README.md`: the "Qwen primary cognitive orchestration" section still described the removed GPT-OSS CPU-safe profile (`num_gpu: 0`, 4,096-token context). The objective demanded rewriting only that paragraph to the current truth (GPU, no pin, 16,384-token window, 6,144-token completion budget, with the measured rationale), preserving the surrounding sentences' meaning and changing nothing else. Read and write paths were exactly `README.md`.

## Observed lifecycle

Hash-linked event chain: `preparing-workspace → materializing → verifying (baseline) → planning → editing → verifying → checkpointing → completed`, all on iteration 1 of 3, ending `succeeded` with "Candidate checkpoint passed every exact check and the workspace was removed."

- Preflight: clean canonical worktree, exact base revision, exact origin, unique candidate branch, pinned pnpm, local coding model.
- Offline dependency materialization in the disposable workspace (`--offline --frozen-lockfile --ignore-scripts`).
- Baseline: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` recorded before editing — all exit 0.
- The coding model produced one digest-bound exact replacement for `README.md`; changed paths were exactly `["README.md"]`.
- Post-edit verification: all four commands exit 0.
- Checkpoint: local candidate branch `iris/candidate/cycle8-d8f835129271beab`, commit `1a71aab7fe1a46e3017fd38d157471b7a13b6220` — the prepared non-force delivery state, deliberately unpushed (this runtime has no push authority).
- Cleanup: workspace scope, git registration, prune, filesystem removal, and post-verification all `ok`; canonical `main` untouched and equal to `origin/main` afterward.

## Independent confirmation of the mutation

The auditor read the candidate diff directly: it replaces exactly the stale three lines with the accurate current profile and touches nothing else in the file or repository. The stated facts match the merged provider configuration (Command Center pull requests #78/#79).

## Platform defects surfaced and repaired before the pass

Per the reset rule, the failed attempts are recorded; each produced a merged repair without changing this test's requirements:

1. The coding model copies the context-heading file digest without its `sha256:` prefix, failing plan validation on an otherwise-correct plan — normalized at the gateway boundary (PR #82).
2. The repository test suite could not pass inside a worker workspace under the WSL gateway at all: hardcoded Windows Core-root paths, Windows-tuned poll budgets, a Windows-only path fixture, and the governed inspector's designed detached-HEAD fail-close colliding with a test that inspects its own checkout (PR #83).
3. Two more Windows-tuned time budgets (contract digest sweep, expiry-harness startup) (PRs #84, #85).
4. One failure was the auditor's own harness: the certification gateway occupied port 4276, which the suite's expiry harness needs; the harness moved to unclaimed ports. Recorded as an operator error, not a platform defect.

## Deviations and limitations

- The Cycle Eight executable-worker lifecycle verifies with exact commands and a candidate checkpoint but contains no model-reviewer stage; the independent review required by the program was performed by the auditor against the planted ground truth, and the Founder can review the preserved candidate branch directly. The model-reviewed delivery path (Cycle Eleven C) is exercised from Test Five onward.
- "Remote equality" for this runtime means the canonical repository remained equal to origin and the candidate stayed local by design; no push occurred.
- Operator and auditor are the same party under the recorded mandate.
- The candidate branch `iris/candidate/cycle8-d8f835129271beab` is preserved for Founder inspection and may be deleted after review.
