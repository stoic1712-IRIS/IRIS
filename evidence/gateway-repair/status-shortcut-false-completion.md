# Gateway Repair — Deterministic Shortcut False Completion

**Task:** `.iris/coordination/tasks/gateway-status-shortcut-false-completion.json`

**Producer:** Claude, acting as the primary Founder operator

**Independent reviewer:** Founder Cristofer Stoic Arellano — this record is producer-authored and is not independently certified

**Run date:** 2026-08-12

**IRIS Core revision under which the repair was produced and verified:** `a1c16c252794029a437d93b2795db6f158934396`, branch `claude/remote-control-v1owqp`, worktree `C:\Projects\STOIC-IRIS`

**Command Center base revision:** `dd9b22218ef10456851bdef06c38913e415bcd6f` (`origin/main`)

**Command Center branch:** `iris/gateway-status-shortcut-false-completion-repair`, worktree `C:\Projects\iris-founder-command-center-main`

**Operating contract digest:** `sha256:9ba317acac51f3592fb16db0f7c1beef49b867eb5759f5803230964753b1327a`

## Precondition: the Core terminal repair is present and built

| Check | Result |
| ----- | ------ |
| Core branch | `claude/remote-control-v1owqp` |
| Core HEAD | `a1c16c252794029a437d93b2795db6f158934396`, working tree clean apart from this task's own allowed paths |
| Terminal repair in source | `packages/kernel/src/operating-decision-engine.ts:85` throws `OPERATING_OBJECTIVE_TERMINAL_COMPLETION_NOT_ASSERTABLE` |
| Terminal repair in build | `packages/kernel/dist/operating-decision-engine.js:63` carries the same throw; `dist` mtime 10:36 is later than `src` mtime 10:29 |
| `assertableTerminalStateSchema` | `failed`, `cancelled`, `unsupported`, `physically-impossible`. `completed` is absent |

## Green baseline before any change

`tests/local-gateway.test.ts` was run at untouched `dd9b222` before any edit.

```text
pnpm exec vitest run tests/local-gateway.test.ts
Test Files  1 passed (1)
     Tests  70 passed | 1 skipped (71)
      exit  0
```

The record notes a cloud container run at `dd9b222` producing seven stable failures from spawned-gateway port and timing conditions. Those conditions did not occur on this workstation; the baseline is green and the repair was produced from it.

**Toolchain deviation.** The Founder's instruction was to run `pnpm` from WSL. That is correct for IRIS Core, whose `node_modules` is a Linux install. It is not possible for this Command Center worktree, whose `node_modules` is a Windows install: WSL `vitest` aborts at startup with `Cannot find module '@rolldown/binding-wasm32-wasi'` because `@rolldown/binding-linux-x64-gnu` is not present. Every Command Center command in this record therefore ran from PowerShell through `corepack pnpm` 11.20.0 on Node 24.19.0. Every IRIS Core command ran from WSL on Node 24.19.0 through nvm, as instructed.

## Pre-repair reproduction of the misclassification

Run against the real `scripts/objective-classification.mjs` and `scripts/conversation-tools.mjs` at untouched `dd9b222`, replaying the three shortcut trigger patterns from `scripts/local-gateway.mjs:3296-3310`:

| Utterance | Structured | Shortcut eligible | Trigger | Terminal emitted |
| --------- | ---------- | ----------------- | ------- | ---------------- |
| `Tell me your current runtime status, active model, available capabilities, and restrictions.` | no | **yes** | `showStatus` | **`completed`** |
| `Objective: Canonical inspection and truthful status report of IRIS Core.` | yes | no | none | none |
| Reconstructed seven-item Test One objective (713 chars) | yes | no | none | none |
| `status` | no | yes | `showStatus` | **`completed`** |
| `What is your status?` | no | yes | `showStatus` | **`completed`** |
| `Show me your capability tree` | no | yes | `showCapabilities` | **`completed`** |
| `Emergency stop` | no | yes | `emergencyStop` | **`completed`** |
| `Objective: audit the runtime.\n1. Report status\n2. Report models` | yes | no | none | none |

Two facts follow, and the second corrects a reading of the Test One record that would otherwise be assumed.

1. All three shortcut triggers emitted `completed` at `dd9b222`.
2. The **exact Test One opener already reached objective construction at `dd9b222`**. The merged repair `3665ec5` (`fix: stop deterministic shortcuts reporting structured objectives complete`, an ancestor of `dd9b222`) had already excluded declared-section and enumerated-item objectives. The surviving defect is the *unstructured multi-requirement* request — a request that names several subjects in one short sentence, matches on a single token, and is collapsed and marked complete. That is the shape the amended test at `tests/local-gateway.test.ts` pinned, and it is the shape this repair removes.

## Survey of every deterministic shortcut

`scripts/local-gateway.mjs` contains exactly one caller-asserted operating-objective terminal, before and after.

| Trigger | Before (`dd9b222:3311-3324`) | After |
| ------- | ---------------------------- | ----- |
| `showCapabilities` — `/\b(?:show\|open\|display)\b[^.\n]{0,60}\b(?:skill\|capabilit\|tree)\b/iu` | `terminal.state: "completed"`, evidence `Canonical operating contract <digest> is loaded.` | **no terminal, no objective.** Answered before objective construction when the request is genuinely bare; otherwise constructed as an ordinary operating objective |
| `showStatus` — `/\b(?:status\|health\|what are you doing\|active workers)\b/iu` | `terminal.state: "completed"`, same canned evidence | **no terminal, no objective**, same rule |
| `emergencyStop` — `/\b(?:emergency stop\|pause all workers\|shut down workers)\b/iu` | `terminal.state: "completed"`, evidence `Founder emergency stop accepted and ordinary access revoked.` | **`terminal.state: "cancelled"`**, evidence `Founder emergency stop requested. This objective is cancelled and no requirement stated in it was performed.` |

Source-level confirmation after the repair: a search of `scripts/local-gateway.mjs` for `terminal:` returns exactly one operating-objective construction, at line 3351, with `state: "cancelled"`. No occurrence of `state: "completed"` remains anywhere in the file. The remaining occurrences of the word `completed` are unrelated to caller-asserted terminals: the cognitive presentation phase, worker lifecycle states, and test fixtures.

## Chosen approach and rationale

**Emergency stop — both channels, kept separate.** The revocation at `runDialogue` is unchanged and still runs first, before anything else in the turn. The objective now asserts terminal `cancelled`, which IRIS Core still accepts from a caller: the Founder stopped the work, and stopping is not finishing. The Founder-visible acknowledgement is composed in the gateway at the existing seam, from what the gateway itself performed, and is **not** read back out of `terminal.evidence`. Completion state and displayed text are therefore no longer the same channel, which was the third permitted action. The terminal evidence carries only what is true for every caller of `operatingObjectiveFor`; the revocation proof is rendered by the caller that performed the revocation.

The emergency-stop pattern is also **no longer gated by structure**. At `dd9b222`, `runDialogue` revoked access on the raw utterance while `operatingObjectiveFor` only produced the acknowledging terminal for short unstructured phrasing. A long or structured utterance containing `emergency stop` would therefore have revoked access and then fallen through to ordinary objective construction, which without an active grant fails closed with `OPERATING_EXECUTION_ACTIVE_GRANT_REQUIRED` — a silent, error-only stop on a safety path. Both sites now use the same `emergencyStopRequested` helper on the raw utterance, so no phrasing can reach the revocation without also reaching the acknowledgement.

**Status and capabilities — answered before an operating objective exists.** A pure-presentation utterance is answered in `runDialogue` before `operatingObjectiveFor` is called and without touching `controller.decide`. The answer is composed from the loaded canonical contract and the live access grant: contract digest, Founder Full access state, the 25 registered ordinary capabilities, and the 9 protected effects, followed by an explicit statement that no objective was constructed, nothing was executed, and nothing is claimed complete. It costs no model call and makes no completion claim, because there is no objective to claim anything about.

Routing this case through the controller was disproven in the task record and is not attempted: with no terminal, no protected effect, and no required capability, Core either throws `OPERATING_EXECUTION_ACTIVE_GRANT_REQUIRED` or returns `execute-now` and invokes a model.

**Narrowed classification.** A bare request is now one that (a) passes the existing `deterministicShortcutEligible` check, (b) carries no explicit requirement language (`must`, `acceptance`, `criteria`, `deliverable`, `requirement`, `prohibited`), and (c) names **at most one** subject, counted across seven subject groups: runtime status, capabilities, models, restrictions, repository facts, memory and planning artifacts, and providers and contracts. The four-part Test One-shaped request names four of these groups and is therefore an objective, not a question.

## Scope amendment authorized by the Founder

The design conclusion requires the presentation turn to carry no controller disposition. The browser reply contract at `src/conversation-client.ts` strictly required `controller.decision` to be one of the five canonical decision outcomes and `controllerDispositionId` to be a non-null identifier on **every** conversation reply, so such a turn could not be represented truthfully: borrowing `report-terminal` would launder gateway presentation into apparent Core authority, and omitting the fields would fail the strict parse and break the Founder interface.

Claude reported the conflict under permitted action seven rather than expanding scope. The Founder authorized a strictly additive widening in session on 2026-08-12, and the authorization is recorded in the task record itself:

- `controller.decision` accepts one further value, `no-controller-decision`, meaning **no controller was consulted**, not a sixth outcome.
- `controllerDispositionId` is nullable, because a turn with no disposition has no disposition identifier.

`src/conversation-client.ts` and `tests/conversation-client.test.ts` were added to `allowed_paths`. The canonical operating contract, its digest, the five decision outcomes, and the protected-effect boundaries are unchanged, and `src/App.tsx` never reads either field, so no interface change follows.

## Regression coverage

A regression test must fail against the pre-repair gateway and pass after it. Two mechanisms were added.

**1. The hermetic Core fixture now mirrors the Core invariant.** `tests/local-gateway.test.ts` writes a stand-in Core so the suite never reaches a real checkout. That stand-in accepted any terminal state, including `completed`, so the Command Center suite could have passed on a gateway that canonical Core refuses to serve. It now carries the same guard as `packages/kernel/src/operating-decision-engine.ts`:

```js
if (objective.terminal?.state === "completed") throw new Error("OPERATING_OBJECTIVE_TERMINAL_COMPLETION_NOT_ASSERTABLE");
```

This strengthens the fixture; it removes no assertion.

**2. Amended and added assertions.**

- `answers a bare status or capability request without claiming completion, and still stops on command` — replaces `still short-circuits a bare status, capability, or stop request`. Four bare utterances now return `controller.decision: "no-controller-decision"`, a null `controllerDispositionId`, and a reply containing the contract digest and the registered capabilities. Founder Full access is then confirmed active, an emergency stop is sent, and the test asserts the acknowledgement text, the `cancelled` terminal, and that `GET /v1/operator` reports `access: null` afterwards — the revocation and the acknowledgement, together.
- `answers a bare status question without a model, and works a multi-subject objective through the controller` — the amendment required at `tests/local-gateway.test.ts:4177`. The assertion that the four-part request yields `report-terminal` with zero model invocations was an assertion of the defect; it is replaced. The bare question is asserted to return a useful model-free answer, and the four-part request is asserted, with Founder Full access active, to reach `execute-now` and invoke a model. Removing that assertion removes a pin on the defect rather than weakening a guard, exactly as the Core counterpart at `tests/operating-decision-engine.test.ts` was inverted.
- `accepts a turn answered before any controller decision was made` in `tests/conversation-client.test.ts` — covers the widened reply contract so it cannot be silently narrowed back.

**Proof the regression coverage bites.** With the amended tests in place and `scripts/local-gateway.mjs` and `src/conversation-client.ts` restored to `dd9b222`:

```text
pnpm exec vitest run tests/local-gateway.test.ts
 × answers a bare status or capability request without claiming completion, and still stops on command
 × answers a bare status question without a model, and works a multi-subject objective through the controller
   AssertionError: expected 503 to be 200
Tests  2 failed | 68 passed | 1 skipped (71)
 exit  1
```

The pre-repair gateway is refused, because the Core-mirroring guard rejects its asserted `completed`. With the repair applied:

```text
pnpm exec vitest run tests/local-gateway.test.ts tests/conversation-client.test.ts
Test Files  2 passed (2)
     Tests  78 passed | 1 skipped (79)
      exit  0
```

## Behaviour against the canonical Core that contains the terminal repair

The exact operating-objective shapes the gateway constructs, before and after the repair, were put to the **real** canonical decision engine built from IRIS Core `a1c16c2` — not to the test fixture. Run from WSL against `/mnt/c/Projects/STOIC-IRIS/packages/kernel/dist/index.js`:

| Objective the gateway constructs | Asserted terminal | Active grant | Canonical Core result |
| -------------------------------- | ----------------- | ------------ | --------------------- |
| Pre-repair, status request | `completed` | none | **threw `OPERATING_OBJECTIVE_TERMINAL_COMPLETION_NOT_ASSERTABLE`** |
| Pre-repair, emergency stop | `completed` | none | **threw `OPERATING_OBJECTIVE_TERMINAL_COMPLETION_NOT_ASSERTABLE`** |
| Repaired, emergency stop | `cancelled` | none | `report-terminal`, `terminalState=cancelled` |
| Repaired, Test One wording | none | none | threw `OPERATING_EXECUTION_ACTIVE_GRANT_REQUIRED` |
| Repaired, Test One wording | none | active | `execute-now` |

This is the end-to-end demonstration required by the record: the Test One wording now reaches capability and grant evaluation — that is, objective construction and governed execution — instead of a canned report, and every pre-repair shortcut objective is rejected outright by the Core revision named above. It also confirms that the emergency stop keeps a terminal outcome Core accepts.

## Contract boundaries unchanged

```text
node scripts/dev/iris-dev.mjs contract inspect --json
  ok: true
  digest: sha256:9ba317acac51f3592fb16db0f7c1beef49b867eb5759f5803230964753b1327a
  coreRevision: a1c16c252794029a437d93b2795db6f158934396
```

`generated/iris-operating-contract.compiled.json` reports the same five `decisionOutcomes` — `execute-now`, `acquire-capability`, `request-protected-approval`, `repair-runtime`, `report-terminal` — and the same nine `protectedEffects`. Neither file was modified. The IRIS Core working tree carries no change other than this task's own allowed paths.

## Verification results

| Repository | Command | Exit | Result |
| ---------- | ------- | ---- | ------ |
| iris-founder-command-center | `pnpm exec vitest run tests/local-gateway.test.ts` (baseline, untouched `dd9b222`) | 0 | 70 passed, 1 skipped |
| iris-founder-command-center | `pnpm exec vitest run tests/local-gateway.test.ts tests/conversation-client.test.ts` | 0 | 78 passed, 1 skipped |
| iris-founder-command-center | `pnpm verify` | 1 | format, lint, typecheck, build pass. 321 passed, 1 failed, 9 skipped across 53 files; 2 files failed, both pre-existing — see below |
| stoic1712-IRIS/IRIS | `pnpm verify` | 1 | format, lint, typecheck, build pass. **546 passed, 1 failed (547)** across 65 files — exactly the 546/547 state the Founder recorded for this branch before the task began |

### Pre-existing IRIS Core failure

`tests/iris-dev-github.test.ts > redacts credential-bearing URI schemes without hiding declared log truncation` fails with `Test timed out in 15000ms`. It is a timeout in a GitHub evidence CLI test, unrelated to this repair, and it reproduces the count the Founder stated for this branch. No IRIS Core source, contract, generated artifact, or test was modified by this task.

### Pre-existing Command Center failures, exactly attributed

`pnpm verify` fails on two files, both with `IRIS_OPERATING_CONTRACT_MISMATCH`:

- `tests/operating-contract-runtime.test.mjs > loads and freezes the exact Core contract`
- `tests/operating-decision-controller.test.mjs` (suite-level failure)

These are **not** caused by this repair. Verified by restoring the working tree to untouched `dd9b222` and running the two files alone: the same two failures, with the same error. The cause is that the Command Center pins the Core module-tree digests in `scripts/operating-contract-runtime.mjs`, and IRIS Core is currently on the branch that carries the terminal repair, which changes `packages/kernel/dist`:

| Pinned package | Status against Core `a1c16c2` |
| -------------- | ----------------------------- |
| contracts, capabilities, model-gateway, orchestration, development, tool-gateway, workers | match |
| **kernel** | **mismatch** — expected `sha256:3e3d111e…`, actual `sha256:bb3e15f0…` |

The pinned Core contract revision `08f69f82…` is still an ancestor of Core HEAD, so only the kernel module-tree digest is stale. This is the fail-closed binding working as designed, not a defect. It is a required follow-up, described under Limitations.

## Changed paths

**stoic1712-IRIS/IRIS** (branch `claude/remote-control-v1owqp`)

- `.iris/coordination/tasks/gateway-status-shortcut-false-completion.json` — records the Founder-authorized allowed-path amendment
- `evidence/gateway-repair/status-shortcut-false-completion.md` — this record
- `.iris/coordination/handoffs/gateway-status-shortcut-false-completion.json` — the handoff

**stoic1712-IRIS/iris-founder-command-center** (branch `iris/gateway-status-shortcut-false-completion-repair`, based on `dd9b222`)

- `scripts/local-gateway.mjs`
- `src/conversation-client.ts`
- `tests/local-gateway.test.ts`
- `tests/conversation-client.test.ts`

## Limitations

1. **A live gateway run against the repaired Core is blocked by design and was not performed.** `loadGatewayOperatingContract` refuses to start when a pinned Core module-tree digest does not match, and the `kernel` digest is stale exactly because of the Core terminal repair. The behaviour against canonical Core was therefore demonstrated by driving the real Core decision engine with the exact objective shapes the gateway constructs, and the gateway's own behaviour was demonstrated through a running gateway process against the hermetic Core fixture, which now mirrors the Core invariant. A full live gateway-to-Core turn requires re-binding `expectedCoreModuleTreeDigests.kernel` in `scripts/operating-contract-runtime.mjs`. That file is outside this task's `allowed_paths`, and the re-bind should be made against the **merged** Core revision rather than an unmerged branch. **This is a required follow-up before Certification Test One can be re-attempted.**
2. `pnpm verify` in the Command Center cannot reach exit 0 while IRIS Core sits on the unmerged terminal-repair branch, for the same reason. Its two failures are attributed above and reproduce identically at untouched `dd9b222`.
3. **A multi-subject question now fails closed when Founder Full access is inactive.** Narrowing the shortcut means a request naming more than one subject is constructed as an ordinary operating objective. Without an active grant, canonical Core refuses it with `OPERATING_EXECUTION_ACTIVE_GRANT_REQUIRED` and the gateway returns 503. That is the pre-existing behaviour of every non-shortcut conversation turn without access, and it is the correct trade: the alternative was the false completion this repair removes. It is nonetheless a Founder-visible change for that class of request, and turning that refusal into a readable message is a separate improvement outside this task's scope.
4. The exact verbatim wording submitted in the failed Test One run is not preserved in `evidence/cycle-twelve/certification-test-one-2026-08-11.md`; the record holds the opening clause verbatim and a paraphrase of the seven items. The reconstruction used here is faithful to that description but is a reconstruction, and is labelled as one.
5. The post-repair classification is demonstrated end-to-end through a running gateway process rather than by a unit-level mirror of the classifier, so the evidence reflects real turn behaviour and cannot drift from the implementation.
6. Command Center commands ran on Windows rather than WSL, for the reason given under the baseline. The Command Center `node_modules` is a Windows install and its WSL counterpart is absent.
7. This repair permits a fresh Certification Test One attempt from a new exact proposal. It does not certify Test One, and it does not change the recorded Test One failure.
8. This record is producer-authored. It has not been independently reviewed.

## Unrelated pre-existing condition observed, not touched

The Command Center primary worktree `C:\Projects\iris-founder-command-center` is checked out on a local branch named `iris/gateway-status-shortcut-false-completion` at `b8c36ff`, an ancestor of `origin/main` roughly 35,000 lines behind it, and carries eight uncommitted modified files. That worktree was left untouched, and this repair used `C:\Projects\iris-founder-command-center-main`, which was clean at `dd9b222`. The Founder may wish to inspect it separately; it is outside this task's scope.

## Rollback

**Command Center.** The branch `iris/gateway-status-shortcut-false-completion-repair` is based on `dd9b222` and contains only the four changed files above. To discard the repair entirely:

```text
git -C C:\Projects\iris-founder-command-center-main checkout dd9b222 -- scripts/local-gateway.mjs src/conversation-client.ts tests/local-gateway.test.ts tests/conversation-client.test.ts
```

To discard the branch after it is no longer wanted, switch the worktree back to `main` and delete the branch. No remote branch, pull request, merge, or history rewrite was performed by this task.

**IRIS Core.** The three changed paths are additive records. Reverting them restores the task record's original `allowed_paths` and `permitted_actions` and removes this evidence file and the handoff. No IRIS Core source, contract, generated artifact, certification program document, or Test One failure record was modified.

**Worktree state to restore.** `C:\Projects\iris-founder-command-center-main` was on branch `main` at `dd9b222` before this task and was switched to the dedicated repair branch. `git switch main` in that worktree restores it.
