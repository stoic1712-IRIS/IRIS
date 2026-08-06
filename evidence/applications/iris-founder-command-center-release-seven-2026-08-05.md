# Founder Command Center Release Seven Verification Evidence

Date: 2026-08-05

## Bound proposal

- Proposal: `founder-command-center-release-seven-governed-repository-repair-worker`
- Approved digest: `sha256:2ac84f00993b8d8e60f1157b49125f5922990aff6f86518307a5e5640d16dc75`
- Recomputed digest: exact match
- IRIS base and local `origin/main`: `15b7ef83c5df19451846e37ba8b8adc574c5e928`
- Command Center base and local `origin/main`: `593ef580549b9084c6fef478deb43c67c01a8377`

## Dependency materialization

Both disposable Release Seven implementation worktrees completed
`pnpm install --offline --frozen-lockfile --ignore-scripts`. The pnpm store reused
all packages, downloaded zero packages, ran no lifecycle scripts, and changed no
manifest or lockfile.

## Implemented controls

- Strict repair proposal, approval, candidate, verification, and result schemas.
- Exact revision and local remote-tracking equality checks.
- Twenty-file editable allowlist, forty-file context limit, safe relative-path grammar,
  regular-file and committed-blob enforcement, byte limits, changed-line limits, secret
  rejection, malformed-output rejection, unexpected-diff rejection, and no-op rejection.
- One-time digest-bound eight-digit approval with expiry and five-attempt gateway limit.
- Approval consumption before worker execution.
- Local loopback-only `qwen3:8b` structured output with no model tools or shell.
- Uniquely named contained detached worktree, offline frozen dependency materialization,
  complete-file candidate writes, fixed verification command registry, evidence digests,
  and mandatory cleanup in `finally`.
- Command Center Repair view and authenticated same-origin, session, CSRF, and fail-closed
  proposal and activation endpoints.
- No canonical write, GitHub mutation, merge, deployment, credential, spending, provider,
  public, or LAN authority.

## Automated verification

IRIS:

- Zero-warning lint: passed.
- Strict typecheck: passed.
- Tests: 23 files and 137 tests passed, including 5 Release Seven contract/adversarial tests.
- Production build: passed.
- Repository diagnostics: passed.
- Release Seven file-scoped Prettier check: passed.
- Invalid worker input: failed closed before any candidate workspace creation.

Founder Command Center:

- Zero-warning lint: passed.
- TypeScript and Vite production build: passed.
- Tests: 9 files and 53 tests passed, including 2 Release Seven transport-contract tests.
- Release Seven file-scoped Prettier check: passed.

The repository-wide Prettier checks are not used as evidence because both base worktrees
already report unrelated formatting drift (159 IRIS files and 38 Command Center files).
Release Seven does not rewrite unrelated canonical files. Candidate `format-check` is
therefore compiled to inspect the exact changed-file allowlist; the remaining fixed checks
retain repository-wide behavior.

## Browser and real-model gates

The real loopback page rendered the one-time Founder pairing form. The browser controller
then blocked further localhost interaction under its URL safety policy, so authenticated
Repair-view proof is not claimed and the restriction was not bypassed.

The approved design requires a separate exact Founder approval for every candidate
activation. The first such activation and its outcome are recorded below. No candidate
Release Seven directory, branch, canonical change, or GitHub change was created.

### First real-model activation

- Proposal: `proposal_release-seven-5e53b6010980`
- Digest: `sha256:5e53b6010980268320e0fd007401a27c6a7221b42d675558e5f63abf2e8b5549`
- Scope: `README.md` and `apps/README.md`
- Approval: exact typed statement received before expiry and consumed before candidate write.
- Model invocation: one local `qwen3:8b` structured-output request.
- Outcome: failed closed with `MODEL_OUTPUT_DENIED`.
- Retry: not attempted because the approval was one-time and consumed.
- Candidate workspace: not created; model validation occurs before worktree creation.
- Canonical and local remote-tracking revisions: remained equal at
  `15b7ef83c5df19451846e37ba8b8adc574c5e928`.
- Cleanup: loopback gateway and core processes terminated; Ollama model unloaded; ports 4174
  and 4181 closed; no Release Seven candidate directory remained.

At the time of the first denial, non-success HTTP status and oversized response shared one safe
error. No retry or repair iteration was created automatically. The separately authorized
diagnostic repair is recorded below.

### Denial-diagnostic repair

The Founder separately authorized a narrow diagnostic repair. The worker now reports only
`MODEL_OUTPUT_DENIED status=<HTTP status> bytes=<response byte count>` and never records the
response body. The formatter rejects invalid HTTP status values and negative byte counts.
Targeted zero-warning lint, six Release Seven tests, strict typecheck, and the production build
all passed after this repair. No model invocation or candidate activation occurred during its
verification.

### Second real-model activation

- Proposal: `proposal_release-seven-8cb22aee7154`
- Digest: `sha256:8cb22aee7154d3a016d5256b35a1ec44610064948fa2092df09a7f179ccd4af0`
- Scope: `README.md` and `apps/README.md`
- Approval: exact typed statement received before expiry and consumed before candidate write.
- Outcome: failed closed with `MODEL_OUTPUT_DENIED status=400 bytes=144`.
- Interpretation: Ollama rejected the request; the 65,536-byte response ceiling was not the
  cause.
- Retry: not attempted because the approval was one-time and consumed.
- Candidate workspace: not created; no disposable or canonical file was written.
- Cleanup: Ollama unloaded; no candidate directory or loopback service remained.

### Ollama schema-compatibility repair

The Founder separately authorized simplifying only the JSON schema sent to Ollama. The
model-facing schema now expresses the candidate object's required structural fields and
closed-object boundaries without embedding local policy keywords such as `enum`,
`maxLength`, `minItems`, or `maxItems`. The strict local Zod validator remains the authority
for the editable-file allowlist, exact file count, field lengths, candidate byte ceiling,
changed-line ceiling, duplicate files, no-op output, secret-like content, and every other
existing candidate security limit.

Targeted Prettier, zero-warning ESLint, seven Release Seven tests, strict typecheck, and the
production build all passed after this repair. The added boundary test confirms that the
model-facing schema is structural-only and that an unapproved path is still rejected locally
with `CANDIDATE_PATH_DENIED`. No Ollama request, proposal activation, candidate workspace, or
canonical write occurred during this verification.

### Third real-model activation

- Proposal: `proposal_release-seven-cdd6f34baf02`
- Digest: `sha256:cdd6f34baf0299adf8e2543eb743c46a1a280b6348b00314f275af1b52d1dcae`
- Scope: `README.md` and `apps/README.md`
- Approval: exact typed statement received before expiry and consumed before candidate write.
- Model invocation: exactly one local `qwen3:8b` request using the structural-only schema.
- Model boundary: structured output and strict local candidate validation passed.
- Disposable workspace: created at the exact approved revision; offline frozen-lockfile
  dependency materialization with lifecycle scripts disabled completed.
- Outcome: failed closed with `CANDIDATE_DRIFT` at the pre-write byte-equality guard.
- Candidate writes: none; the guard failed before either approved file was written.
- Verification commands: not run because candidate writing never began.
- Retry: not attempted because the approval was one-time and consumed.
- Cleanup: the candidate path was absent and no Git worktree registration remained after
  worker cleanup. The canonical and local remote-tracking revisions remained equal at
  `15b7ef83c5df19451846e37ba8b8adc574c5e928`.

At the time of activation, the exact cause of the pre-write mismatch had not yet been proven.
The separately authorized read-only diagnosis and narrow repair are recorded below.

### Checkout-drift diagnosis and repair

Read-only diagnosis confirmed that the approved revision stores both target files with LF while
the Windows worktree checks them out with CRLF under `core.autocrlf=true`. Git-filtered hashes
matched the canonical blob hashes, while raw filesystem hashes differed. A direct comparison
also proved that CRLF-to-LF normalization makes each checkout exactly equal to its canonical
blob: `README.md` was 331 checkout bytes versus 326 canonical bytes, and `apps/README.md` was
684 checkout bytes versus 675 canonical bytes.

The pre-write guard now accepts only byte-identical content or content that becomes exactly
canonical after replacing CRLF pairs with LF. It continues to reject lone carriage returns,
substantive edits, and added lines with `CANDIDATE_DRIFT`; all path, file-mode, symlink, byte,
secret, candidate, and verification limits are unchanged.

Targeted formatting, zero-warning lint, eight Release Seven tests, strict typecheck, and the
production build passed. Full repository lint, all 23 test files and 140 tests, and repository
diagnostics also passed. No Ollama request or candidate workspace was created during diagnosis
or repair verification.

### Fourth real-model activation

- Proposal: `proposal_release-seven-2c7ecbd6d0c1`
- Digest: `sha256:2c7ecbd6d0c18a88730842a9f5606f4f78bbc80c6004873859e238c263cb8cad`
- Scope: `README.md` and `apps/README.md`
- Approval: exact typed statement received before expiry and consumed before candidate write.
- Model invocation: exactly one local `qwen3:8b` request.
- Candidate: strict local validation passed; both files received only the exact approved
  fictional proof line.
- Diff digest: `sha256:3e9727cd314d9d77bf9338a8790d20b7b7c39824c30a85a597e1779e39b9e881`.
- Passed checks: format, production build, dependency integrity, secret scan, bundle scan,
  and repository diagnostics.
- Failed checks: zero-warning lint, strict typecheck, and unit/integration tests.
- Verdict: `needs-repair`.
- Failure boundary: the fresh candidate worktree lacked prebuilt workspace-package `dist`
  entries when lint, typecheck, and tests ran, so workspace imports such as
  `@stoic-iris/contracts` could not be resolved. The later production-build check succeeded.
- Retry: not attempted because the approval was one-time and consumed.
- Cleanup: the disposable candidate path was removed and no Git worktree registration
  remained. Canonical and local remote-tracking revisions remained equal at
  `15b7ef83c5df19451846e37ba8b8adc574c5e928`.

### Verification-bootstrap repair

The separately authorized repair adds one fixed `pnpm build` bootstrap after offline
frozen-lockfile installation and before any candidate file write. This materializes pinned
internal workspace-package outputs in the disposable worktree. The unchanged verification
registry still runs its production-build check again after candidate generation, so bootstrap
does not substitute for candidate verification. No dependency lifecycle scripts, network
downloads, manifest changes, version changes, or canonical writes are introduced.

Targeted formatting, zero-warning lint, nine Release Seven tests, strict typecheck, and the
production build passed. A fresh detached no-model worktree at the exact approved base revision
then completed offline frozen installation, the new bootstrap build, zero-warning lint, strict
typecheck, and all 22 test files and 132 tests present in that revision. The disposable test
worktree and its WSL-created dependency links were removed after verification. No Ollama request
or repair candidate was created.

### Fifth real-model activation

- Proposal: `proposal_release-seven-027003461419`
- Digest: `sha256:0270034614190531502ac21dfdbe6407a651c474cb1e8310ff1ec88b69a4ad1d`
- Scope: `README.md` and `apps/README.md`
- Approval: exact typed statement received before expiry and consumed before candidate write.
- Model invocation: exactly one local `qwen3:8b` request.
- Candidate: strict local validation passed; both files received only the exact approved
  fictional proof line.
- Diff digest: `sha256:3e9727cd314d9d77bf9338a8790d20b7b7c39824c30a85a597e1779e39b9e881`.
- Verification: all nine fixed checks passed: format, zero-warning lint, strict typecheck,
  22 test files and 132 tests, production build, dependency integrity, secret scan, bundle
  scan, and repository diagnostics.
- Verdict: `verified`.
- Authority: canonical repository changed `false`; GitHub changed `false`.
- Cleanup: the disposable candidate path was removed, no Git worktree registration remained,
  and canonical and local remote-tracking revisions remained equal at
  `15b7ef83c5df19451846e37ba8b8adc574c5e928`.

## Current conclusion

The Release Seven implementation and non-mutating automated verification are complete in
the two disposable implementation worktrees. The fifth activation produced the exact bounded
fictional multi-file candidate and passed every fixed verification check while proving zero
canonical and GitHub mutation plus cleanup.

The real Founder Command Center was then launched on loopback, authenticated with its one-time
pairing code, and inspected through the in-app browser. The live overview displayed revision
`15b7ef83c5df`, the authenticated Founder identity, and zero temporary workers and matching
provider resources. The Repair view rendered the exact bounded proposal controls and explicitly
stated that it has no canonical repository, GitHub, merge, deployment, credential, spending, or
provider authority. The browser session, gateway, core process, pairing state, local ports, and
temporary resolver and logs were then closed or removed.

All Release Seven implementation and evidence gates are now satisfied locally. Repository
publication remains a separate Founder-authorized action.
