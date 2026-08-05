import { describe, expect, it } from "vitest";

import {
  InMemoryAppendOnlyAuditStore,
  auditEventDigest,
  consumeApproval,
  createAuditEvent,
  evaluateApproval,
} from "../packages/kernel/src/index.js";

const digest = `sha256:${"a".repeat(64)}` as const;
const approval = {
  approvalId: "approval_01936f3a-8b5c-7def-8abc-0123456789ab",
  approverIdentity: "founder-authenticated",
  requestId: "request_01936f3a-8b5c-7def-8abc-0123456789ab",
  proposalId: "proposal_01936f3a-8b5c-7def-8abc-0123456789ab",
  riskClass: "R3" as const,
  actionType: "merge" as const,
  payloadDigest: digest,
  target: "stoic1712-IRIS/IRIS#7",
  allowedExecutor: "iris-kernel",
  allowedTools: ["github"],
  preconditions: [],
  exclusions: [],
  issuedAt: "2026-08-04T20:00:00-06:00",
  expiresAt: "2026-08-04T21:00:00-06:00",
  oneTimeUse: true,
  requiredVerification: ["remote equality"],
  requiredCleanup: [],
  state: "issued" as const,
};
const evaluation = {
  authenticatedApproverIdentity: "founder-authenticated",
  actionType: "merge" as const,
  payloadDigest: digest,
  target: "stoic1712-IRIS/IRIS#7",
  executor: "iris-kernel",
  tool: "github",
  evaluatedAt: "2026-08-04T20:30:00-06:00",
  previouslyConsumedApprovalIds: [],
};

describe("Kernel approval and audit", () => {
  it("allows only an exactly bound authenticated approval", () => {
    expect(evaluateApproval(approval, evaluation).decision).toBe("allow");
    expect(evaluateApproval(approval, { ...evaluation, target: "other" }).decision).toBe("deny");
  });

  it("consumes an issued approval once", () => {
    expect(consumeApproval(approval, "2026-08-04T20:31:00-06:00").state).toBe("consumed");
    expect(() =>
      consumeApproval({ ...approval, state: "revoked" }, "2026-08-04T20:31:00-06:00"),
    ).toThrow();
  });

  it("preserves a deterministic append-only audit chain", () => {
    const store = new InMemoryAppendOnlyAuditStore();
    const first = createAuditEvent({
      eventId: "audit_01936f3a-8b5c-7def-8abc-0123456789ab",
      eventType: "ApprovalEvaluated",
      occurredAt: "2026-08-04T20:30:00-06:00",
      recordedAt: "2026-08-04T20:30:00-06:00",
      actor: {
        actorId: "worker_01936f3a-8b5c-7def-8abc-0123456789ab",
        actorType: "iris-core",
        displayName: "IRIS Kernel",
      },
      correlation: { correlationId: "request_01936f3a-8b5c-7def-8abc-0123456789ab" },
      riskClass: "R3",
      outcome: "succeeded",
      sensitivity: "public",
      summary: "Approval evaluated.",
      evidenceIds: [],
    });
    store.append(first);
    const second = {
      ...first,
      eventId: "audit_02936f3a-8b5c-7def-8abc-0123456789ab",
      eventType: "ApprovalConsumed",
      previousEventDigest: auditEventDigest(first),
    };
    store.append(second);
    expect(store.list()).toHaveLength(2);
    expect(() =>
      store.append({
        ...second,
        eventId: "audit_03936f3a-8b5c-7def-8abc-0123456789ab",
        previousEventDigest: digest,
      }),
    ).toThrow();
  });
});
