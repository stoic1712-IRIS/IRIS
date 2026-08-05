# Wave 10 Sovereign Development Runtime Readiness — 2026-08-05

## Status

The Wave 10 machinery is implemented and locally verified. The permanent graduation gate is deliberately not marked complete because IRIS has not yet executed the real-model, Founder-approved, private-checkpoint self-upgrade without Codex or Claude modifying the repository.

## Implemented Controls

- exact bounded multi-file proposal schema;
- content and before/after digest binding;
- typed authenticated Founder approval bound to the full proposal digest;
- disposable exact-revision Git worktree;
- allowed and forbidden path enforcement;
- governed command execution;
- tests, builds, and independent changed-path verification;
- repair requiring a new proposal and reapproval;
- private checkpoint push and remote SHA equality;
- history-preserving revert evidence;
- workspace cleanup and worktree pruning;
- paid-resource termination and provider-authoritative zero-resource query;
- real Ollama/Qwen3 8B proposal entrypoint and separate approved execution entrypoint.

## Verification

Seven focused Wave 10 tests cover schema binding, unsafe-path rejection, digest rejection, approval mismatch, successful multi-file lifecycle, repair/reapproval, command failure cleanup, and remote inequality. Full repository verification results are recorded in the merge pull request.

## Mandatory Next Gate

After this machinery is merged into canonical `main`, the repository must have a private `checkpoint` remote. IRIS must then inspect the clean canonical revision and create the proposal outside the repository. The Founder must type the exact digest-bound statement. From that point until IRIS finishes or safely fails, Codex and Claude must not modify the repository.

No fixture, machinery-only test, Codex-authored change, public checkpoint, or preapproval completes Development Independence.
