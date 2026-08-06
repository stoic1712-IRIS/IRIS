# Cycle Seven Live Worker Operations

**Status:** Locally implemented; publication pending

## Objective

Cycle Seven turns IRIS worker specifications into visible, interruptible local operations. The Founder can activate one bounded read-only worker, observe its lifecycle and deliverable, pause it, resume it, stop it, or steer it without granting new authority.

## Version 1 worker cohort

- Complex Coding Worker: analyzes architecture, code, tests, and repair approaches without writing.
- Evidence Research Worker: uses bounded local search or browser evidence and distinguishes sources from instructions.
- Learning Tutor: explains material and prepares worked guidance without impersonating the Founder.
- Website Builder: prepares structure, interface, component, and implementation plans without deployment.

## Standing grant

An authenticated Founder click may activate one local zero-cost run under an explicit standing grant. The grant fixes the worker, allowed read tools, maximum steps, timeout, expiry, USD 0 budget, no external mutation, and no authority expansion. It does not authorize filesystem writes, GitHub mutation, deployment, messages, advertising, payments, credentials, provider resources, or spending.

## Lifecycle

`queued -> planning -> executing -> reviewing -> completed`

The Founder may move a non-terminal worker to `paused` or `stopped`. Resume reuses the unchanged grant. Steering is appended to the worker context; it cannot add tools, time, budget, hosts, repositories, credentials, or mutation authority. Steering during execution cancels the current attempt and restarts under the unchanged boundary.

Every state change produces a bounded hash-chained event. IRIS retains responsibility for selecting the local model, reviewing the deliverable, reporting whether a later action needs approval, and exposing truthful failure evidence.

## Decision gate

Cycle Seven passes locally when strict schemas reject expanded grants, a real local model completes a worker run, pause/resume/stop/steer behavior is deterministic, the event chain verifies, the Command Center presents live state and controls, and the full repository suites pass.
