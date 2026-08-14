# Defect-Class Repair Gate

**Status:** Founder-approved development control; authority begins with the first merge to `main` containing this exact revision

**Version:** 1.0.0

**Recorded:** 2026-08-14

**Owner:** Founder and IRIS Core

## 1. What this control exists to stop

Between 2026-08-10 and 2026-08-13 the two repositories merged 84 pull requests. Thirty-nine of the non-merge commits were `fix:` against fifteen features, and there were **zero reverts**. Nothing was undone. The same defect classes were repaired one site at a time, and each repair unblocked exactly one step of a path that then failed at the next instance of the same class.

The clearest cases are recorded rather than summarized, because they are the evidence this control is built on:

- Founder Command Center pull requests **#87, #88, and #96** each repaired one instance of a single class — *the delivery worker was not given context it needs to succeed*. It could not see why verification failed, then could not see the repository's conventions, then could not see the repository's layout. Three pull requests, hours apart, one defect.
- Founder Command Center **#55 and #61** repaired two shapes of one shortcut defect seventeen hours apart. #61's own body records that #55 had already excluded the declared-section and enumerated shapes, leaving the unstructured shape alive.
- `scripts/complete-delivery-adapter.mjs` took **fourteen commits in a single day** and grew twenty percent, while the delivery path it exists to serve still did not complete.

## 2. Why the existing principle was not enough

The governing rule already existed and already bound every operator. `docs/governance/worker-reasoning-framework-and-cognitive-identity.md` version 1.0.0, principle 2:

> **Understanding before expansion:** Do not increase complexity beyond the ability to inspect, test, govern, and remove it.

It was loaded into every operator session for the whole period through `AGENTS.md`, and it did not bind. The reason is structural rather than a lapse of attention: inside a repair loop, with a failing check and an obvious local fix and a mandate to continue to completion, every individual step is locally correct. Fourteen locally correct steps produced a file nobody could govern.

A completion mandate and principle 2 pull in opposite directions inside a repair loop, and until now nothing in the process resolved that conflict. Operator judgment resolved it, wrongly, every time.

**This control therefore does not depend on an operator remembering the principle.** It fails the build instead.

## 3. The rule

Every commit whose subject begins with `fix:` must record, in its commit message body, the class of defect it belongs to and where else that class was looked for:

```text
Defect-class: <the class of defect, not this one instance>
Class-scan: fixed | <path> [note]
Class-scan: clear | <path> [note]
Class-scan: follow-up | <path to a task record> [note]
```

The verdicts mean:

| Verdict | Meaning |
| --- | --- |
| `fixed` | This site is an instance of the class and this commit repairs it. |
| `clear` | This site was examined and the class does not occur there. |
| `follow-up` | This site is an instance of the class, is deliberately out of scope, and is recorded in the named task record. |

The gate enforces:

1. exactly one `Defect-class:` line, non-empty — a commit repairs one class;
2. at least one `Class-scan:` line;
3. every verdict is `fixed`, `clear`, or `follow-up`;
4. **at least one scanned path lies outside the commit's own changed paths**, because a scan that only looks at the files just edited is not a scan;
5. every `follow-up` path exists at that commit, so a deferral must name a record that really exists rather than an intention.

`revert:` commits and merge commits are not checked.

## 4. What this control does not do

Stated plainly, because overstating it would recreate the problem it addresses.

A mechanical check cannot make the analysis correct. An operator can satisfy every rule above with a shallow scan and a class named too narrowly. What the gate does is force the question to be asked at authoring time, put the answer in permanent history where a reviewer can challenge it, and make skipping the question a build failure rather than an invisible omission.

Its second effect matters as much as the first: the class analysis becomes recoverable. Reconstructing why a repair was scoped the way it was previously required reading pull request bodies across two repositories. It now lives in `git log`.

The gate is a floor, not a substitute for review. The Founder remains the independent reviewer of every material repair.

## 5. Scope and adoption

This control binds IRIS Core from the revision that merges it, enforced by `pnpm gate:defect-class` inside `pnpm verify` and by the `Verify` workflow on every pull request.

`scripts/dev/defect-class-gate.mjs` has **no dependencies** so it can be adopted by copying one file. The Founder Command Center — where the churn recorded in section 1 actually happened — has no continuous integration of any kind, so adopting this control there requires standing up a workflow first. That is tracked separately in `.iris/coordination/tasks/command-center-defect-class-gate-adoption.json` and is not complete merely because this document exists.

## 6. Relationship to existing authority

This is an additive development control. It does not delete, weaken, reinterpret, or supersede any existing principle, policy, capability, security boundary, or evidence record. It implements principle 2 of the canonical reasoning framework at the point of commit; it does not amend it, and the framework remains the authority on what the principle means.

It is not a digest-bound operating-contract source. It governs how the project repairs itself, not what IRIS may do at runtime.
