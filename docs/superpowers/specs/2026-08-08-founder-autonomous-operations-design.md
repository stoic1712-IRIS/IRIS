# Founder Autonomous Operations Design

**Status:** Founder-approved design

**Date:** 2026-08-08

**Repositories:** `stoic1712-IRIS/IRIS` and `stoic1712-IRIS/iris-founder-command-center`

## Objective

Make IRIS a low-friction, Founder-operated system that can start reliably with Windows, reason with the strongest suitable available local model, inspect and operate the workstation, complete ordinary software-delivery work, diagnose and repair its own implementation, and acquire a missing capability through an exact approval plan instead of ending with a generic refusal.

The Founder-approved operating posture is one explicit **Full access** action after Windows sign-in. The grant remains active until the Founder disables it, signs out, or restarts Windows. It covers the complete ordinary local and repository workflow while preserving separate approval for credentials, spending, deployment or public/LAN exposure, account or repository administration, force-push or history rewriting, destructive data operations, and final Phase 0 graduation.

## Selected Architecture

The implementation is one coordinated objective delivered as three independently testable tranches:

1. **Windows lifecycle and trusted local session**
2. **Founder Full access and governed desktop operation**
3. **Conversational self-repair and capability acquisition**

A single unrestricted monolith was rejected because startup, desktop effects, repository effects, and capability installation have different recovery and evidence requirements. Per-action typed approval for every ordinary effect was also rejected because it recreates the friction this change is meant to remove. The selected design uses one visible, revocable Full-access grant plus separate exact approval only when a protected boundary is crossed.

## Permanent Ownership

IRIS Core permanently owns:

- identity, authority classification, grants, revocation, and audit;
- model routing and independent-review requirements;
- capability-gap classification, acquisition plans, and provider registry updates;
- self-repair objectives, proposals, workspaces, verification, rollback, and evidence;
- desktop target, observation, action, interruption, and receipt contracts;
- lifecycle state and health semantics.

The Founder Command Center is the replaceable control surface. PowerShell, Windows Task Scheduler, Windows UI Automation, Ollama, SearXNG, Docker Desktop, WSL, Git, GitHub CLI, browsers, and installed applications remain replaceable providers.

## Founder Full Access

### Lifecycle

The Founder authenticates to the local Command Center and selects **Enable Full access** once. Core issues a grant bound to the authenticated Founder session and the current Windows logon session. The grant ends on explicit disable, browser logout, gateway shutdown, Windows sign-out, or reboot. It never silently restores after a reboot.

The application must display a persistent Full-access indicator and an always-available emergency stop. Revocation aborts running workers, desktop activity, capability installation, and the next repository/provider effect. Every authorization, denial, revocation, expiry, and protected stop enters the hash-chained audit.

### Ordinary capabilities

Full access includes:

- goal creation, planning, delegation, steering, pause, resume, and cancellation;
- source-efficient research, browser inspection, and approved connectors;
- repository inspection and bounded editing;
- exact non-interactive terminal commands;
- approved dependency materialization in bounded environments;
- disposable workspaces, tests, lint, typecheck, builds, repair, and cleanup;
- candidate commits, non-force branch pushes, pull requests, CI monitoring, review reconciliation, verified merge of an exact reviewed head, remote equality, and synchronization;
- local runtime start, stop, restart, health repair, and smoke testing;
- selected-window observation and desktop control;
- zero-dollar capability acquisition and registration from an approved plan;
- local notifications and evidence capture.

Ordinary authority is still target- and session-bound. It cannot expand itself, operate outside a declared repository or selected window, leak a secret, or claim an effect without evidence.

### Protected capabilities

The following remain separate exact Founder decisions even while Full access is active:

- reading or disclosing credential values;
- spending or enabling paid usage;
- deployment or public/LAN exposure;
- account, organization, repository, ruleset, billing, secret, or variable administration;
- force-push, history rewriting, broad deletion, irreversible data destruction, or operating-system elevation;
- final Phase 0 graduation.

Encountering a protected effect creates a precise stopped state and an approval plan. It does not collapse into “I cannot do that.”

## Reasoning and Review

IRIS uses the existing model router with these preferred roles:

- `qwen3.6:27b`: ordinary conversation and visual reasoning;
- `qwen3-coder:30b`: repository work, debugging, repair, and implementation;
- `gpt-oss:20b`: deep reasoning, research review, and independent software review;
- `qwen3:8b`: fast fallback and low-complexity dialogue.

Coding, deep reasoning, research, capability acquisition, and self-repair require a reviewer model distinct from the producer whenever at least two approved models are available. If no distinct reviewer exists, IRIS reports `reviewer-model-unavailable` and proposes a capability acquisition or waits for Founder direction; it does not silently self-review.

Model failure triggers bounded fallback in the existing priority order. The response and evidence identify the selected model, fallback, reviewer, and reason. IRIS never presents a model’s unsupported statement as tool evidence.

## Capability-Gap Classification

Every blocked objective is classified as exactly one or more of:

- `capability-not-registered`;
- `provider-not-installed`;
- `provider-not-running`;
- `provider-version-incompatible`;
- `authorization-not-granted`;
- `credential-reference-required`;
- `network-or-source-unavailable`;
- `hardware-insufficient`;
- `unsupported-after-research`;
- `protected-effect-required`.

The user-facing response must name the missing capability, the failed preflight evidence, and the next governed action. Generic “I cannot access your filesystem,” “run these commands for me,” or “I do not possess authority” responses are defects when a registered route, Full-access grant, or acquisition workflow can satisfy the request.

## Capability Acquisition

When a needed capability is absent, IRIS may research it without mutating the workstation. Research prefers official documentation, primary repositories, pinned releases, and local-first or exportable providers. Untrusted content remains isolated and cannot grant authority.

IRIS then produces a strict acquisition plan containing:

1. missing capability identifier and originating objective;
2. candidate provider name, publisher, source URL, exact version or revision, and artifact digest when available;
3. license, security, privacy, portability, data-flow, and removal review;
4. expected cost and whether any credential, account, elevation, deployment, or network exposure is required;
5. exact download, install, configuration, registry, and verification operations;
6. allowed filesystem, registry, package, process, and network targets;
7. timeout, storage, and resource limits;
8. rollback, uninstall, cleanup, and retained-evidence plan;
9. the exact approval statement.

Zero-dollar, non-elevated acquisition can execute under Full access only after the Founder approves that exact plan. Any changed version, source, digest, permission, cost, target, or data flow requires a new plan. Lifecycle scripts are disabled unless specifically present in the approved plan. The capability is registered only after verification passes, and the original objective resumes from its preserved checkpoint.

If acquisition is impossible, IRIS reports the exact reason and the narrowest viable alternative. “Unsupported after research” must cite the sources and evidence used.

## Self-Repair and Self-Upgrade

Conversation must route repository inspection and repair requests into the existing operator, executable-worker, complete-delivery, review, checkpoint, and workflow machinery instead of returning shell commands to the Founder.

The ordinary self-repair sequence is:

`observe failure -> reproduce -> diagnose -> inspect canonical sources -> bind objective and base -> create disposable workspace -> implement -> verify -> independently review -> repair if needed -> commit candidate -> push non-force -> create PR -> monitor CI -> reconcile review -> verify exact head -> merge under active Full access -> synchronize -> restart -> smoke-test -> roll back on failure -> clean workspace -> record evidence`

The active Full-access grant authorizes this ordinary sequence. Every repository effect rechecks the grant and exact target immediately before execution. Merge is allowed only for the exact reviewed head after required checks pass, changed paths remain within scope, no protected effect is present, and rollback evidence exists. Merge never implies deployment.

IRIS may repair its own code through this path. A final Phase 0 Development Independence claim remains separate: during that graduation execution, IRIS must perform the genuine canonical multi-file self-upgrade while Codex and Claude are audit-only and make no repository changes.

## Governed Desktop Operation

The live provider extends the existing Core desktop-control contract rather than bypassing it. Windows UI Automation is preferred. A selected-window visual fallback may use window-relative coordinates only when bound to the exact window identity, bounds, and screenshot digest. Whole-desktop coordinate control and hidden background input remain prohibited.

Full access permits IRIS to:

- enumerate visible non-sensitive windows;
- select and focus an exact window;
- inspect its UI Automation tree;
- capture a bounded screenshot of that window;
- invoke controls, set bounded non-secret text, choose options, use bounded keys, and use window-relative clicks when UI Automation is unavailable;
- open or close an approved desktop application;
- verify the result visually and recover or stop.

The live Windows runner is a fixed PowerShell/.NET program invoked with `execFile` semantics and a strict JSON stdin/stdout protocol. No model-authored shell string is evaluated. The provider receives only the exact validated plan and returns metadata, hashes, and stable error codes.

Selected-window screenshots are stored under a bounded local runtime directory, retained only for the active objective, redacted before model use, hashed, and deleted during cleanup. Password fields, secure-desktop prompts, browser password managers, credential dialogs, payment screens, account-administration screens, and windows on the sensitive denylist stop for separate Founder action. No screenshot or entered text becomes canonical memory automatically.

Desktop execution has a visible listening/working indicator, a global emergency-stop hotkey, a Command Center stop control, per-action and total timeouts, bounded retries, focus recovery, and an audit receipt. Sign-out or Full-access revocation terminates the runner.

## Windows Sign-In Lifecycle

Installation creates one non-elevated per-user Windows Scheduled Task using an absolute canonical script path. The task triggers at the current user’s logon, starts no duplicate instance, and runs a lifecycle controller with `Start`, `Stop`, `Restart`, `Status`, `Repair`, `Install-Startup`, and `Remove-Startup` operations.

The controller:

1. validates canonical Core and Command Center paths;
2. checks WSL, Docker/SearXNG, Ollama, the voice service, Core read service, and the Command Center gateway;
3. stops or repairs stale partial state before starting;
4. starts providers in dependency order;
5. polls explicit health conditions rather than sleeping blindly;
6. records bounded rotating logs and process identities under `%LOCALAPPDATA%\STOIC-IRIS\runtime`;
7. rolls back processes started by the failed attempt;
8. opens `http://127.0.0.1:4174/` only after the complete stack is healthy;
9. allows the browser to restore a persistent authenticated local-device session;
10. triggers exactly one neural “Hello, Founder” greeting per Windows boot after the authenticated application and voice service are ready.

The persistent browser login does not persist Full access. Full access requires one click after each Windows sign-in/restart. Startup registration grants no desktop, repository, credential, spending, or provider authority by itself.

## Failure Handling and Recovery

- Partial runtime state is repaired or stopped before restart; it is never treated as healthy.
- Startup failure preserves the failing component, stable error code, relevant bounded log tail, and rollback result.
- Desktop/provider failure stops at the current action, attempts only the declared recovery, and never advances silently.
- Capability installation failure rolls back only artifacts created by the approved plan and preserves diagnostic evidence.
- Repository repair failure preserves the candidate and resumable journal without modifying canonical `main`.
- A failed post-merge restart automatically performs a history-preserving revert proposal or the preapproved rollback described by the exact repair plan; it never rewrites history.
- Every claim distinguishes verified, inferred, proposed, approved, executed, blocked, and rolled back states.

## Security and Data Boundaries

All service endpoints remain loopback-only. No public or LAN listener is added. Raw credentials never enter model context, repository files, logs, screenshots, plans, receipts, or canonical memory. OS keyring and browser-protected session references may be used only through fixed adapters. Provider output, web pages, repository content, screenshots, and application text remain untrusted evidence.

The emergency stop must function independently of the model. Authority records and audits are Core-owned and verified before completion. Technical availability never creates permission.

## Verification and Acceptance

Acceptance is layered:

### Core automated verification

- strict access-profile, expiry, reboot-boundary, revocation, and protected-capability tests;
- capability-gap and acquisition-plan schema, source binding, rollback, tamper, replay, and resume tests;
- model routing and distinct-reviewer tests;
- self-repair orchestration, exact-path, idempotency, rollback, merge-head binding, and cleanup tests;
- desktop observation/action, sensitive-window denial, screenshot cleanup, interruption, timeout, and audit tests;
- lifecycle-controller plan-mode tests for clean, partial, failed, duplicate, stop, restart, and rollback states;
- existing focused suites and `pnpm verify`.

### Command Center automated verification

- conversation routing from repository-inspection request to an approval card rather than a refusal;
- Allow-once and Full-access enable/disable behavior;
- self-repair and acquisition-plan status and approval surfaces;
- desktop working/listening indicators and emergency stop;
- startup-health and greeting state;
- strict client schemas, same-origin CSRF protections, and full `pnpm verify`.

### Live local acceptance

1. reboot or simulate user logon;
2. verify one runtime instance, all health endpoints, automatic application open, and one neural greeting;
3. enable Full access once;
4. rerun the repository-inspection test and require IRIS to produce branch, commit, cleanliness, file existence, and exact evidence herself;
5. run a bounded desktop task and interrupt it;
6. create a disposable known-defect fixture and require IRIS to diagnose, repair, verify, review, and clean it;
7. exercise one missing-capability fixture, approve acquisition, verify registration, and require automatic objective resume;
8. revoke Full access and prove the next ordinary effect is denied;
9. verify logs contain no credential values and all temporary artifacts are removed.

No Phase 0 graduation claim is made by these tests. That claim requires the separate Founder-operated canonical self-upgrade gate.

## Repository and Publication Plan

Core owns the contracts, lifecycle controller, provider adapters, self-repair/acquisition orchestration, registries, tests, specifications, and evidence. The Command Center owns the authenticated UI, conversation dispatch, approval cards, status views, and gateway adapters.

Each repository uses one isolated branch and worktree. Changes are staged by exact path, committed, pushed non-force, opened as pull requests, independently reviewed, repaired if necessary, merged only after checks pass, synchronized to local `main`, and smoke-tested. Existing artifacts are preserved; the unpublished cold-start readiness commit is retained as the first Core ancestor.

“Published” in this mandate means published to the authorized GitHub repositories through merged pull requests. It does not mean deployment, public network exposure, package publication, or a release.

## Rollback

Before merge, close the pull request and preserve or delete only the exact clean feature worktree and branch without force. After merge, revert exact merge commits in history order. Remove the per-user Scheduled Task and runtime state only through the lifecycle controller’s exact cleanup command. Revoke Full access before rollback. No rollback uses force-push, reset of canonical history, broad deletion, or secret removal through model-authored commands.

## Completion Gate

Completion requires both repositories merged and synchronized, all focused and full checks passing, Windows startup registration verified, complete loopback runtime health, successful one-click Full-access activation and revocation, successful conversation-driven repository inspection, successful governed desktop operation and interruption, successful disposable self-repair and capability-acquisition/resume proofs, clean canonical worktrees, remote equality, bounded logs, and no residual disposable artifacts.

