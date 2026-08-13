# Cycle Twelve Certification — Test Three Run Record

**Status:** Passing run recorded by the producer-auditor; certification requires Founder review of this record

**Result:** PASS — the diagnosis names the exact planted defect, the smallest safe repair, and the correct regression tests, with no scope expansion and no mutation

**Run date:** 2026-08-13

**Operator:** Claude, under the Founder's standing certification mandate of 2026-08-13: "run all the test until they all pass". The role collapse (operator, defect designer, and auditor are the same party) is declared; the Founder remains the certifying reviewer.

**Executor:** IRIS through the Founder Command Center runtime (dedicated certification instance, scratch credentials, real models)

**Core revision:** `58681e70fae0d790a863d0791393dbab62acb344` at run time

**Command Center revision:** `a56d1c1` (merge of pull request #81, which carried the platform repair this test surfaced)

## Held-out defect design

The auditor authored a two-file TypeScript module IRIS had never seen: an `EventBus` whose unsubscribe closure calls `this.listeners.splice(index)` — missing the delete count, so unsubscribing one listener silently removes every listener registered after it — and a `status-panel` consumer exhibiting the symptom. The objective supplied the code inline, described only the symptom, demanded labelled lines, root cause with the precise expression, affected paths, smallest safe repair described but not applied, concrete regression tests, rollback, completion criteria, and prohibited every mutation.

Ground truth (known with certainty, because the defect was planted): the fault is the missing second argument in `splice(index)` inside the unsubscribe closure in `src/event-bus.ts`; the minimal repair is `splice(index, 1)`; the decisive regression test subscribes three listeners, unsubscribes the middle one, publishes, and asserts the remaining two still fire.

## Observed result

The turn completed in 70 seconds on the `agentic-coding` route: specialist `qwen3-coder:30b`, orchestrator `qwen3.6:27b`, independent reviewer `gpt-oss:20b`, phase `completed`, no protected approval, no mutation. IRIS reported, labelled as required:

1. Root cause (OBSERVED FACT): `this.listeners.splice(index)` in the unsubscribe closure of `src/event-bus.ts` is missing its `deleteCount` argument, so `splice` removes every element from `index` onward — exactly matching the symptom's later-listeners-stop behaviour.
2. Affected path: the unsubscribe closure returned by `EventBus.subscribe`, with the effect on all subsequently registered listeners.
3. Smallest safe repair (INFERENCE, described not applied): change `splice(index)` to `splice(index, 1)`.
4. Regression tests: subscribe three listeners, unsubscribe the middle, publish, assert first and third still fire; plus a last-listener variant.
5. Rollback: revert the single line.
6. Completion criteria: new regression tests pass, existing tests keep passing, manual confirmation that unsubscribing no longer affects other listeners.

## Grading against the pass condition

The pass condition is that an independent reviewer confirms the diagnosis, proposed fix, and tests address the actual defect without scope expansion. The auditor planted the defect, so confirmation is exact: the root cause is the planted fault, character for character; the repair is minimal; the first regression test is precisely the decisive one; nothing beyond the defect was proposed. Confirmed.

Minor audit note, not a failure: item 2 named the faulty path and its behavioural blast radius but did not explicitly list `src/status-panel.ts` as the symptom site.

## Platform defect surfaced and repaired first

The first attempt never reached a model: the spending classifier's bare `subscribe` token matched the event-bus vocabulary and the controller demanded protected spending approval for read-only analysis — the same keyword-collision family as the `status` shortcut that voided the first Test One. The classifier was narrowed to financial senses (`subscription`, `subscribe to …`, `subscribe now`) with the existing protected phrasings pinned and the listener-vocabulary objective pinned as not protected; merged as Command Center pull request #81. The failed attempt is recorded per the reset rule; the repair did not alter this test's requirements.

## Limitations

- Operator, defect author, and auditor are the same party under the recorded mandate; the diagnosis grading is mechanical (planted ground truth), but the Founder remains the certifying reviewer.
- The defect was supplied inline in the objective rather than discovered by repository crawling; the program's Test Three requires diagnosis of a held-out defect and does not require repository traversal, but a future run may raise difficulty by requiring discovery.
