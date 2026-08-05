import { describe, expect, it } from "vitest";

import {
  PolicyRegistry,
  actorIdentityContextSchema,
  calculateProposalDigest,
  cognitiveIdentityRecordSchema,
  createCanonicalPolicyRegistry,
  evaluatePermission,
  hasFounderAuthority,
  type ActorIdentityContext,
} from "../packages/kernel/src/index.js";

const founderIdentityId = "identity_01936f3a-8b5c-7def-8abc-0123456789ab";
const objectiveId = "objective_01936f3a-8b5c-7def-8abc-0123456789ab";
const founder: ActorIdentityContext = {
  identityId: founderIdentityId,
  identityType: "founder" as const,
  displayName: "Founder",
  authenticated: true,
  authorityScopes: ["read", "propose", "approve-r2", "approve-r3"],
};
const identityRecord = {
  identityId: "identity_02936f3a-8b5c-7def-8abc-0123456789ab",
  displayName: "STOIC-IRIS",
  mission: "Operate as a Founder-governed cognitive platform.",
  coreValues: ["Founder intent first", "Evidence over assertion"],
  founderAuthority: {
    founderIdentityId,
    protectedDecisionDomains: ["R2 approvals", "R3 approvals", "identity amendments"],
  },
  constitutionalVersion: "1.0.0",
  reasoningFrameworkVersion: "1.0.0",
  memoryPolicyVersion: "0.0.0",
  approvalPolicyVersion: "1.0.0",
  voiceProfile: ["clear", "evidence-led"],
  prohibitedClaims: ["A model is IRIS Core", "Technical capability creates authority"],
  effectiveAt: "2026-08-04T20:00:00-06:00",
  provenance: ["Founder approval", "canonical repository history"],
};

describe("Kernel identity and policy evaluation", () => {
  it("recognizes only the exact authenticated Founder authority", () => {
    expect(cognitiveIdentityRecordSchema.safeParse(identityRecord).success).toBe(true);
    expect(hasFounderAuthority(identityRecord, founder, "approve-r3")).toBe(true);
    expect(
      hasFounderAuthority(
        identityRecord,
        { ...founder, identityId: "identity_03936f3a-8b5c-7def-8abc-0123456789ab" },
        "approve-r3",
      ),
    ).toBe(false);
  });

  it("rejects approval authority assigned to a worker or unauthenticated actor", () => {
    expect(
      actorIdentityContextSchema.safeParse({ ...founder, identityType: "worker" }).success,
    ).toBe(false);
    expect(actorIdentityContextSchema.safeParse({ ...founder, authenticated: false }).success).toBe(
      false,
    );
  });

  it("allows authenticated R0 read authority and requires approval for R1", () => {
    const registry = createCanonicalPolicyRegistry();
    expect(
      evaluatePermission(registry, {
        actor: founder,
        classification: {
          objectiveId,
          riskClass: "R0",
          authorizationRequirement: "existing-read-authority",
          reasons: ["Read-only."],
        },
      }).decision,
    ).toBe("allow");
    expect(
      evaluatePermission(registry, {
        actor: { ...founder, authorityScopes: ["local-change"] },
        classification: {
          objectiveId,
          riskClass: "R1",
          authorizationRequirement: "explicit-task-approval",
          reasons: ["Local change."],
        },
      }).decision,
    ).toBe("require-approval");
  });

  it("requires an exact protected action and digest-bound proposal for R3", () => {
    const registry = createCanonicalPolicyRegistry();
    const proposalPayload = '{"target":"stoic1712-IRIS/IRIS","action":"push"}';
    const request = {
      actor: founder,
      classification: {
        objectiveId,
        riskClass: "R3" as const,
        authorizationRequirement: "typed-protected-approval" as const,
        reasons: ["Protected action."],
      },
      protectedAction: "push" as const,
      proposalPayload,
      proposalDigest: calculateProposalDigest(proposalPayload),
    };
    expect(evaluatePermission(registry, request).decision).toBe("require-approval");
    expect(
      evaluatePermission(registry, { ...request, proposalPayload: `${proposalPayload} ` }).decision,
    ).toBe("deny");
    const requestWithoutAction = {
      actor: request.actor,
      classification: request.classification,
      proposalPayload: request.proposalPayload,
      proposalDigest: request.proposalDigest,
    };
    expect(evaluatePermission(registry, requestWithoutAction).decision).toBe("deny");
  });

  it("denies contradictory classifications and every R4 request", () => {
    const registry = createCanonicalPolicyRegistry();
    expect(
      evaluatePermission(registry, {
        actor: founder,
        classification: {
          objectiveId,
          riskClass: "R0",
          authorizationRequirement: "typed-protected-approval",
          reasons: ["Contradictory."],
        },
      }).decision,
    ).toBe("deny");
    expect(
      evaluatePermission(registry, {
        actor: founder,
        classification: {
          objectiveId,
          riskClass: "R4",
          authorizationRequirement: "deny",
          reasons: ["Prohibited."],
        },
      }).decision,
    ).toBe("deny");
  });

  it("rejects duplicate risk policies and returns defensive copies", () => {
    const registry = createCanonicalPolicyRegistry();
    const first = registry.list()[0];
    if (first === undefined) throw new Error("Expected a canonical policy rule.");
    first.reason = "mutated";
    expect(registry.find("R0").reason).not.toBe("mutated");
    expect(() => new PolicyRegistry([registry.find("R0"), registry.find("R0")])).toThrow();
  });
});
