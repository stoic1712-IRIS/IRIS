# Core Terminal Completion Verification

**Status:** Implemented under task `core-terminal-completion-verification`; candidate for canonical status until merged into `main`

**Prepared:** 2026-08-12

**Base:** `stoic1712-IRIS/IRIS` `main` @ `08f69f82846e40d1a428f4238da5f14918965fa1`

## The defect

`packages/kernel/src/operating-decision-engine.ts` short-circuited to `report-terminal` whenever an objective carried a `terminal` field, relaying the caller's `state` and `evidence` without verifying either:

```ts
if (objective.terminal !== undefined)
  return operatingDecisionSchema.parse({
    kind: "report-terminal",
    objectiveId: objective.objectiveId,
    terminalState: objective.terminal.state,
    evidence: objective.terminal.evidence,
  });
```

A repository-wide search confirmed that nothing in Core verified a terminal claim. IRIS Core, which owns Completion Integrity as Core Reasoning Principle 12, therefore delegated the determination of completion to its caller — and its caller was a keyword regex in the Founder Command Center, a repository the project defines as a non-authoritative consumer.

Certification Test One failed 0 of 7 through exactly this path. A structured objective containing the token `status` matched a gateway shortcut, which returned a canned objective carrying `terminal: { state: "completed", … }`. Core reported completion for seven requirements it never addressed.

## Terminal emission sites in Core

| Site | Kind | Source of the claim |
| --- | --- | --- |
| `operating-decision-engine.ts:66` (pre-repair) | **caller-asserted** | the caller's `objective.terminal` field, unverified |
| `operating-decision-engine.ts:105` | **Core-derived** | `unsupported`, from the capability snapshot's own gap evidence |

Those are the only two. `packages/contracts/src/operating-contract.ts` and `packages/kernel/src/operating-context.ts` declare or validate the `report-terminal` outcome but never originate one. The `report-terminal` reference in `packages/model-gateway/src/founder-dialogue.ts` is explanatory prose.

The Core-derived site is legitimate and is preserved unchanged: its evidence comes from IRIS's own snapshot, not from an assertion.

## Chosen design

**A caller may report that work stopped. It may never assert that work finished.**

`completed` is removed from the terminal states a caller can express. The objective schema now accepts only `failed`, `cancelled`, `unsupported`, and `physically-impossible` from a caller, and Core derives `completed` from execution alone. An asserted completion is rejected before parsing with the named error `OPERATING_OBJECTIVE_TERMINAL_COMPLETION_NOT_ASSERTABLE`, so the violation is legible rather than an opaque enum mismatch; the narrowed schema is the backstop.

The distinction that makes this the right cut is direction of risk. `completed` is the only terminal state that claims the objective's requirements were satisfied. The other four report non-performance — honest by default, and visible to the operator. Only the success claim can silently convert unperformed work into a completion, so only the success claim needs to be unforgeable.

### Alternatives considered

- **Remove caller-supplied `terminal` entirely.** Closes the class but also removes legitimate upstream reporting: a gateway that observes a genuine cancellation or an impossible request has real information Core cannot reconstruct. Rejected as over-broad.
- **Require per-requirement evidence that Core verifies before accepting `completed`.** Strictly stronger and the eventual ideal, but the objective contract has no representation of stated requirements — `requiredCapabilities` is a capability list, not a requirement list. Adding one is a contract change with its own review surface. **Recorded as the follow-on**, not abandoned; the chosen design is a strict subset of it, so it does not have to be undone first.

Making the claim unrepresentable in the schema was preferred over filtering it at one caller. Filtering the Command Center gateway would fix the instance; removing the state from what a caller can express fixes the class for every present and future caller.

## Interaction with the gateway repair

The sibling task `gateway-status-shortcut-false-completion` repairs the keyword shortcut in `scripts/local-gateway.mjs` and explicitly excludes this file. The two repairs compose and neither weakens the other: the gateway repair stops the shortcut from firing on structured objectives; this repair stops any caller from asserting completion at all.

**Operationally important, and it must be read before merge.** This repair converts a silent false completion into a loud failure. Until the gateway repair ships, a Founder utterance containing `status`, `health`, `what are you doing`, or `active workers` will reach the shortcut, which still asserts `terminal: { state: "completed" }`, and Core will now throw `OPERATING_OBJECTIVE_TERMINAL_COMPLETION_NOT_ASSERTABLE` instead of returning a canned report.

That is the intended direction — fail closed rather than lie, consistent with the fail-closed behavior the Founder recorded as correct in `52b0c41` — but it is a visible runtime behavior change. The gateway repair should follow promptly, and the Founder should decide the merge order.

## Verification

- Two new regression tests fail against the pre-repair engine and pass after it.
- The Core-derived `unsupported` path is unchanged in behavior and its existing test passes untouched.
- The compiled operating contract digest is unchanged at `sha256:9ba317acac51f3592fb16db0f7c1beef49b867eb5759f5803230964753b1327a`; the five decision outcomes and the protected-effect set are untouched.

## Amended test

`tests/operating-decision-engine.test.ts` previously contained "reports a terminal objective before considering any requested effect", asserting that a caller-supplied `completed` was relayed verbatim. That test encoded the defect as intended behavior, so a correct repair could not leave it standing.

It is **inverted, not deleted**: the same scenario now asserts that Core refuses the claim. A second case covers an asserted completion with no requirements addressed, mirroring the Test One shape. A third proves a caller-asserted `cancelled` still reports correctly, so the change is a narrowing rather than a removal of caller reporting. Net test count rises by two. No guard was weakened; the assertion that replaced it is stronger than the one it replaced.

## Authority references

- Task record: `.iris/coordination/tasks/core-terminal-completion-verification.json`
- Evidence: `evidence/operating-contract/core-terminal-completion-verification.md`
- Failure record: `evidence/cycle-twelve/certification-test-one-2026-08-11.md`
- Sibling repair: `.iris/coordination/tasks/gateway-status-shortcut-false-completion.json`
