import { describe, expect, it } from "vitest";

import {
  approvalRecordSchema,
  authorizationDecisionSchema,
  canonicalIdSchema,
  evidenceRecordSchema,
  runtimeConfigurationSchema,
} from "../packages/contracts/src/index.js";

const ids = {
  approval: "approval_01936f3a-8b5c-7def-8abc-0123456789ab",
  evidence: "evidence_01936f3a-8b5c-7def-8abc-0123456789ab",
  identity: "identity_01936f3a-8b5c-7def-8abc-0123456789ab",
  policy: "policy_01936f3a-8b5c-7def-8abc-0123456789ab",
  proposal: "proposal_01936f3a-8b5c-7def-8abc-0123456789ab",
  request: "request_01936f3a-8b5c-7def-8abc-0123456789ab",
  worker: "worker_01936f3a-8b5c-7def-8abc-0123456789ab",
} as const;

const digest = `sha256:${"a".repeat(64)}`;

describe("Wave 3 shared contracts", () => {
  it("accepts governed canonical identifiers and rejects unknown kinds", () => {
    expect(canonicalIdSchema.parse(ids.request)).toBe(ids.request);
    expect(canonicalIdSchema.parse(ids.identity)).toBe(ids.identity);
    expect(canonicalIdSchema.parse(ids.policy)).toBe(ids.policy);
    expect(
      canonicalIdSchema.safeParse("provider_01936f3a-8b5c-7def-8abc-0123456789ab").success,
    ).toBe(false);
  });

  it("requires consumed approvals to record their consumption time", () => {
    const approval = {
      approvalId: ids.approval,
      approverIdentity: "authenticated-founder",
      requestId: ids.request,
      proposalId: ids.proposal,
      riskClass: "R3",
      actionType: "merge",
      payloadDigest: digest,
      target: "stoic1712-IRIS/IRIS#4",
      allowedExecutor: "codex",
      allowedTools: ["github"],
      preconditions: ["verified head revision"],
      exclusions: ["delete source branch"],
      issuedAt: "2026-08-04T19:00:00-06:00",
      oneTimeUse: true,
      requiredVerification: ["remote main contains the merge commit"],
      requiredCleanup: [],
      state: "consumed",
    };

    expect(approvalRecordSchema.safeParse(approval).success).toBe(false);
    expect(
      approvalRecordSchema.safeParse({ ...approval, consumedAt: "2026-08-04T19:01:00-06:00" })
        .success,
    ).toBe(true);
  });

  it("denies any attempt to allow an R4 action", () => {
    expect(
      authorizationDecisionSchema.safeParse({
        decision: "allow",
        riskClass: "R4",
        reasons: ["technical capability exists"],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown configuration keys and invalid provider timeouts", () => {
    expect(
      runtimeConfigurationSchema.safeParse({
        schemaVersion: "1.0.0",
        environment: "development",
        logLevel: "info",
        providers: { ollama: { enabled: true, adapter: "ollama", timeoutMs: 0 } },
        hiddenAuthority: true,
      }).success,
    ).toBe(false);
  });

  it("accepts complete public evidence and rejects secret-classified repository evidence", () => {
    const evidence = {
      evidenceId: ids.evidence,
      subject: "shared-contract verification",
      result: "passed",
      sensitivity: "public",
      revision: "b".repeat(40),
      tools: ["pnpm 11.20.0"],
      commands: [],
      failures: [],
      repairs: [],
      limitations: [],
      rollback: "Revert the bounded commit.",
      cleanup: [],
      artifactDigest: digest,
      provenance: {
        createdAt: "2026-08-04T19:00:00-06:00",
        createdBy: { actorId: ids.worker, actorType: "worker", displayName: "contract verifier" },
        sourceKind: "repository",
        sourceReference: "packages/contracts",
        contentDigest: digest,
        parentEvidenceIds: [],
      },
    };

    expect(evidenceRecordSchema.safeParse(evidence).success).toBe(true);
    expect(evidenceRecordSchema.safeParse({ ...evidence, unreviewedSecret: "value" }).success).toBe(
      false,
    );
  });
});
