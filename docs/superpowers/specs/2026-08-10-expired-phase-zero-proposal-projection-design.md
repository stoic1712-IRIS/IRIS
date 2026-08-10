# Expired Phase Zero Proposal Projection Design

## Problem

The Phase 0 coordinator refreshes the transport envelope timestamp every time its state is read, even after the persisted proposal's one-hour authorization window has expired. The Founder Command Center therefore continues to render the expired proposal and accepts exact text entry, while Core correctly rejects the newly issued approval because it falls outside the proposal window.

## Design

When `FilePhaseZeroGraduationCoordinator.read()` loads an unapproved proposal whose `proposal.expiresAt` is at or before the current time, it returns a fresh strict `idle` envelope instead of refreshing the stale `presented` envelope. The persisted proposal record is not deleted or altered by a read, preserving audit evidence. A later explicit `prepareProposal()` request remains the only operation that removes the expired record and creates a new real-model, digest-bound proposal.

Approved, consumed, activating, and concluded records retain their existing restart and recovery behavior. No approval is submitted, no proposal is generated, and no graduation execution is started by this repair or its smoke test.

## Testing

Add a regression that creates a proposal, advances the injected clock beyond its expiry, calls `read()`, and asserts that Core returns a valid `idle` envelope while the durable record remains present. Then assert that an explicit fresh proposal request replaces the expired workflow with a different graduation ID.

