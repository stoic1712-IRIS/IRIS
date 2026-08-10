# Persistent Repository-Repair Approval Design

## Decision

Repository-repair proposals do not expire merely because time passes. An active proposal remains available until it is consumed once, explicitly replaced or revoked, or invalidated because its bound canonical or remote revision no longer matches current verified state.

## Preserved controls

- The proposal digest binds the complete proposal content.
- The Founder must submit the exact typed statement.
- The eight-digit terminal code remains HMAC-bound to the exact proposal digest.
- A proposal can be consumed only once; replay remains denied.
- Base and expected remote revisions remain exact and are rechecked before candidate generation.
- Candidate generation remains disposable, allowlisted, local-only, zero-cost, and unable to modify canonical repositories or GitHub.

## Contract and interface

`expiresAt` is removed from the repository-repair proposal schema in IRIS Core and the Founder Command Center. The digest no longer includes an expiry timestamp. The Command Center removes the countdown, interval, expired state, and replacement prompt caused only by elapsed time. Failed candidate generation may still offer a replacement proposal.

Execution remains bounded independently by `maximumRuntimeSeconds`; removing proposal expiry does not authorize an unbounded running process.

## Testing

- Core tests prove the same exact approval remains valid after the former ten-minute window.
- Core tests continue to reject altered statements, invalid codes, invalid bindings, revision drift, and consumed/replayed proposals.
- Command Center transport tests reject an invented `expiresAt` field.
- Command Center rendering tests prove no countdown or timer is present and that failed runs still provide a replacement path.
