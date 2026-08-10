# Phase 0 Graduation Activation Evidence — 2026-08-09

## Mandate

The Founder authorized implementation, local verification, non-force publication, review, merge, synchronization, restart, and proposal-only smoke testing of the missing IRIS-owned Phase 0 proposal and activation path. The mandate explicitly excludes Codex or Claude approval or execution of the resulting graduation proposal.

## Bound bases

- IRIS Core `main`: `ff82266d5f1702f96bff015f44a185cd3c8dac9b`
- Founder Command Center `main`: `7dfbed6e4a71c615971e6ae1cd2118d6ae616800`
- Core branch: `iris/phase-zero-graduation-activation`
- Command Center branch: `iris/phase-zero-graduation-activation`

## Implemented controls

- Core-owned strict proposal creation route with distinct signed proposal scope.
- Exact canonical Core and Command Center evidence with clean-main and remote-equality checks.
- Real loopback `qwen3-coder:30b` proposal model behind a strict schema and bounded evidence.
- Protected-path and verification-command allowlists before durable proposal creation.
- Atomic outside-Git Core proposal and one-time approval ledger.
- Exact authenticated Founder approval consumption and exactly-once activation of the existing graduation runtime.
- Real disposable worker, independent local reviewer model, checkpoint-first delivery, merge rendezvous, remote equality, rollback, cleanup, termination, and zero-resource provider adapters.
- Command Center presentation and authenticated relay only; no local graduation authority.

## Verification

- Core focused after restart, expiry, WSL interop, protected-path, and concurrency hardening: 2 files, 21 tests passed.
- Core full: formatting, build, lint, typecheck, 60 test files, 492 tests passed, 1 existing skip, diagnostics; exit 0; report digest `sha256:987337d454e2ed9285dc4ebed86dbbdf7cf721a8acfbdd9dad9f411fefce38ae`.
- Command Center focused: 3 files, 95 tests passed, 1 existing skip.
- Command Center full: formatting, lint, typecheck, build, 45 test files, 273 tests passed, 4 existing skips; exit 0; report digest `sha256:4383d5f59f68246031254b610e55021e43af8cc33d6db7cb52792bb155fb757b`.
- Lockfiles and dependency versions unchanged. Existing pinned dependencies were reused through local worktree junctions.
- Deployment preflight resolves `gh.exe` and `ollama.exe` only at the detected WSL interop boundary; explicit executable paths and non-WSL platforms remain unchanged.
- A consumed non-concluded approval resumes from durable state after Core restart; delayed approval after proposal expiry is rejected, and an unapproved expired proposal may be replaced.
- Concurrent proposal creation and approval consumption are serialized so only one proposal and one durable receipt can succeed; protected control-file segments are rejected at every path depth; the atomic state file and containing directory are flushed across the deployed POSIX boundary.

## Non-claims

- No Phase 0 graduation proposal has been approved or executed.
- Phase 0 is not complete from this implementation.
- No credential was read into model context or persisted by IRIS.
- No force-push, history rewrite, deployment, public or LAN exposure, spending, provider administration, or destructive data operation occurred.
- The historical Wave 10 checkpoint remains evidence of machinery, not permanent Phase 0 completion.

## First live proposal smoke and repair

- The first post-merge live proposal request failed closed before durable proposal creation. No proposal state file, approval receipt, activation, or graduation execution was created.
- Canonical evidence collection succeeded for Core `fe598682e42e2a69f75f4abbe48b08f237e397b3` and Command Center `5723bf0bedb1bf1c0667aaff812a776ecdb5d953`, producing evidence digest `sha256:05711b5c3894be6400053d990c7e3883701190673ff3f7e818c2a9448cc9db03`.
- The real `qwen3-coder:30b` response violated the existing strict plan contract because two write paths were absent from `readPaths`. Core correctly rejected the response.
- The repair preserves the strict schema and adds the missing model-facing invariant that every write path must also be inspected. Core permits exactly one bounded corrective retry with local validation feedback, then remains fail closed.
- A direct real-model test against the same canonical evidence returned a strictly valid plan after the repair. It did not create, approve, or execute a durable graduation proposal.
- Repair-focused activation tests: 14 passed.
- Repair full verification: formatting, build, lint, typecheck, 60 test files, 493 tests passed, 1 existing skip, diagnostics; exit 0; report digest `sha256:d968e730530776113980d2799cfd80a94c09649bcbb1bbffbd83e81df339ad64`.

## Second live smoke and WSL Git repair

- Core proposal-plan repair PR #89 merged at `80ebe32b613c4e02380b478e08b188cfe1c06836`; local, remote, and provider `main` equality passed.
- The second live proposal request also failed closed before durable proposal creation, approval, or activation.
- Exact reproduction inside the deployed Ubuntu WSL boundary showed that Linux Git misread the canonical Command Center's Windows worktree pointer as a relative WSL path. Canonical repository verification therefore stopped before Ollama was called.
- Windows `git.exe` is available through WSL interop and successfully reads both canonical repositories. The runtime now applies the existing host-aware executable resolver to evidence Git, with an explicit `IRIS_GIT_EXECUTABLE` override retained.
- A disposable WSL proof exercised canonical evidence, the real `qwen3-coder:30b` model, strict proposal construction, and durable presentation with `graduationApprovalConsumed: false`; its temporary state was removed without approval or execution.
- WSL Git repair focused activation tests: 15 passed; exit 0; report digest `sha256:7f25267c51ed38c1d0bb71172475f6c9aa9843237263bd8d3d9bef0a4bc3aea3`.
- WSL Git repair full verification: formatting, build, lint, typecheck, 60 test files, 494 tests passed, 1 existing skip, diagnostics; exit 0; report digest `sha256:e01ca650b0ef86992921f063b48b4c2e96144da5ab803039a68ae34ab4095004`.

## Remaining actions

Full verification, independent exact-head review, publication and merge of the WSL Git repair, local-main synchronization, runtime restart, and a live real-model proposal-only smoke test remain before this implementation task is complete. The final IRIS-generated approval statement must be presented to the Founder and left unsubmitted.
