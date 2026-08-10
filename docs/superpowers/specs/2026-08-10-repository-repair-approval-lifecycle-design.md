# Repository Repair Approval Lifecycle Design

**Status:** Founder approved for implementation, verification, publication, merge, restart, and smoke testing on 2026-08-10

## Problem

Repository-repair proposals expire after two minutes. Copying the exact statement and one-time terminal code can legitimately exceed that window. The Core correctly rejects the expired approval, but the Command Center retains the expired in-memory proposal and refuses a replacement until the gateway restarts. The UI shows an absolute timestamp without a countdown or a direct recovery path.

## Decision

1. IRIS Core owns a ten-minute approval window for repository-repair proposals.
2. The Command Center retires an in-memory repair proposal only when it is expired or already consumed. A live unconsumed proposal remains non-replaceable.
3. The Founder UI shows the remaining approval time and disables activation after local expiry.
4. After expiry, the Founder receives a visible control that clears the stale presentation and returns to the prefilled proposal form. The next proposal request succeeds because the gateway independently retires the expired server state.
5. The server clock remains authoritative. Client countdown state never grants authority.

## Preserved controls

- exact digest-bound statement;
- authenticated loopback Founder session and CSRF;
- one-time eight-digit terminal code bound through an in-memory secret;
- five failed-attempt ceiling;
- exact repository revision equality and allowlisted paths;
- real local `qwen3:8b` candidate generation;
- disposable candidate workspace and automatic cleanup;
- no canonical write, GitHub, network, credential, deployment, or spending authority;
- no automatic repair or Phase 0 graduation approval or execution.

## Verification

Core tests prove the exact ten-minute boundary and continued expiry rejection. Command Center tests prove that an expired proposal is replaceable without restart, a live proposal is not replaceable, consumed state is retired for the next proposal, and the UI countdown/replacement state is deterministic. Both repositories must pass focused and full verification before publication.
