# Cycle One: Operational Delivery Completion

**State:** Local implementation authorized; provider execution not authorized

## Objective

Complete the fixed adapter boundary between the verified Release Eight delivery orchestrator, disposable Git workspace controller, and ephemeral GitHub provider controller.

## Acceptance

- checkpoint push is always first and never forced;
- checkpoint equality is required before target push;
- target equality is required before draft pull-request creation;
- the pull request is draft, targets `main`, and disables maintainer modification;
- credential material is owned only by the provider boundary and is cleared;
- mismatch produces explicit partial-failure evidence with no retry or deletion;
- no merge, ready-for-review, deployment, spending, or canonical-memory authority exists.

## Protected Completion Gate

Actual credentials, checkpoint creation, target push, and draft pull-request creation require a new exact R3 proposal. Publication and merge of this implementation remain separately authorized GitHub actions.
