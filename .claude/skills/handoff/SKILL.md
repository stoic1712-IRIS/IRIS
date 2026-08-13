---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work.

Two kinds of handoff exist in STOIC-IRIS — pick the right one:

- **Session-continuation handoff** (this skill's default): an ephemeral context-transfer document. Save it to the session scratchpad or OS temp directory — not the repository.
- **Producer handoff for material output**: if the conversation produced material work awaiting Founder review, the durable handoff belongs in the repository at `.iris/coordination/handoffs/` conforming to `.iris/coordination/handoff.schema.json`, addressed to the Founder — recording commands, exit codes, changed paths, limitations, rollback information, and what remains uncertified. Write that record through the normal bounded-objective workflow; this skill's ephemeral document can then simply point at it.

For the document itself:

- Include a "suggested skills" section, which suggests skills that the next agent should invoke.
- Cite the exact controlling governance, specification, and task-record paths (e.g. the `.iris/coordination/tasks/<task-id>.json` in play) so the next operator can reproduce the authority decision without relying on this conversation's memory.
- Do not duplicate content already captured in other artifacts (specs, plans, ADRs, task records, commits, diffs). Reference them by path or URL instead.
- State plainly what is uncertified, unverified, or uncertain — visible uncertainty over confident guessing. Never present the handoff as an approval: a producer cannot certify its own output.
- Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
