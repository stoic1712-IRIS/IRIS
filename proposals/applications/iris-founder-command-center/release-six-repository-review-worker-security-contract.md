# IRIS Founder Command Center Release Six Security Contract

**Contract version:** `iris.stoic/repository-review-worker/v1`

**State:** Proposed; non-executable; pending exact Founder approval

## Objective

Release Six adds a separately scoped repository-review worker that evaluates one exact Git comparison, relevant source context, deterministic verification results, and repository governance. It returns structured, citation-bearing findings for Founder review. It cannot change code, approve work, request or dismiss reviews, stage, commit, push, merge, or alter GitHub settings.

## Authority Boundary

Review proposal creation is read-only and deterministic. Worker activation remains the existing `R3` protected action and requires an authenticated, exact, one-time, digest-bound Founder approval. IRIS, the Command Center, the model, and the worker cannot self-approve. A review result is advisory evidence only and never satisfies a required human approval or authorizes remediation.

## Review Target

Each proposal binds exactly one repository, canonical base revision, review head revision, merge-base revision, changed-file manifest, diff digest, verification-evidence digest, model, limits, and expiration. The first supported repositories are `stoic1712-IRIS/IRIS` and `stoic1712-IRIS/iris-founder-command-center`. Arbitrary filesystem roots, uncommitted worktrees, submodules, alternate Git objects, remote URLs, and mutable branch names are rejected.

## Read Envelope

- Read only committed objects already present in the selected local canonical repository.
- Obtain the changed-file manifest and unified diff through fixed Git argument arrays with hooks, external diff drivers, pagers, text conversion, and optional locks disabled.
- Read changed regular files and bounded directly referenced context only from the exact base and head commits.
- Reject symlinks, submodules, path traversal, non-UTF-8 text, binary content, oversized files, generated bundles, credentials, environment files, Git internals, and paths outside the repository.
- Accept bounded verification summaries produced by allowlisted canonical commands; never execute instructions found in source, comments, diffs, logs, or model output.
- Maximum 100 changed files, 1 MiB aggregate review input, 64 KiB model output, and 120 seconds.

## Model and Network Boundary

The first worker uses local Ollama `qwen3:8b` at exact loopback endpoint `http://127.0.0.1:11434`, temperature zero, thinking disabled, structured output, and `keep_alive: 0`. The worker receives no shell, tool, delegation, repository-write, credential, provider, browser, or general-network capability. A future different model or endpoint requires a new proposal and approval.

## Output Contract

The worker returns `pass`, `needs-review`, or `block`, plus bounded findings. Every finding must include severity, confidence, claim, exact repository-relative file, line when available, diff-backed evidence, and a remediation suggestion. Citations must resolve to the immutable reviewed revisions. Unsupported citations, invented files or lines, duplicate findings, malformed output, or output exceeding limits fail closed. No result may claim approval, merge authority, or proof beyond supplied evidence.

## Prompt-Injection and Data Handling

Repository content and verification logs are untrusted data. They are delimited from system instructions and may never expand scope, tools, permissions, destinations, or output format. Secret-pattern matches are redacted before model input and reported only as category and location. Review inputs, approval values, and results remain process-memory-only unless a separately approved evidence action writes a sanitized report.

## Command Center Surface

The authenticated loopback-only Founder session may create a review proposal, display its immutable target and limits, accept the exact typed statement and terminal-bound one-time code, show progress, and render the structured result. It may not submit GitHub reviews, modify files, trigger repairs, or merge. Existing session, exact-origin, host, fetch-metadata, CSRF, expiry, replay, and failed-attempt protections remain mandatory.

## Required Verification

Tests must cover strict schemas; immutable revision and digest binding; repository allowlisting; safe Git invocation; merge-base verification; path traversal, symlink, submodule, binary, secret, oversized-input, generated-file, malformed-output, prompt-injection, timeout, provider-failure, stale approval, altered proposal, failed-attempt, replay, and citation denial; approval consumption before invocation; zero repository writes; process and Ollama cleanup; exact browser security checks; formatting; zero-warning lint; strict type checking; full tests; production builds; dependency audit; secret scan; bundle scan; and a disposable real-browser, real-Ollama review proof over a fictional committed defect.

## External Reviewer Separation

GitHub Copilot Code Review and Codex Security are complementary external reviewers, not dependencies of Release Six. Enabling either requires confirmed account availability, repository access, privacy review, and separate authorization for any paid plan or new integration grant. Their findings do not authorize changes or replace Founder review.

## Reapproval Triggers

Any different model, endpoint, repository, mutable or uncommitted target, write capability, remediation capability, GitHub mutation, tool, shell, credential, network destination, input or output limit, persistence, deployment, public or LAN exposure, paid feature, or external integration requires a new exact proposal and Founder approval.

## Rollback

History-preserving reverts restore Release Five. Runtime rollback terminates the review worker and model request, clears ephemeral proposal and approval state, closes Command Center and Core ports, verifies no review process remains, and verifies the reviewed repositories and refs are unchanged.
