import { describe, expect, it } from "vitest";

import {
  cognitiveDelegationEnvelopeSchema,
  cognitiveReviewArtifactSchema,
  cognitiveSpecialistArtifactSchema,
  cognitiveSynthesisSchema,
  cognitiveTurnRequestSchema,
  validateCognitiveDelegation,
} from "../packages/model-gateway/src/cognitive-turn-contracts.js";
import { cognitiveTurnErrorCodes } from "../packages/model-gateway/src/cognitive-turn-errors.js";
import { routeIrisModel } from "../packages/model-gateway/src/model-router.js";

const objectiveId = "objective_0198a6cf-7c74-7ae0-8f8d-92c13db44d7a";
const requestId = "request_0198a6d0-07ca-7b32-a021-98b267ca44ef";
const digest = `sha256:${"a".repeat(64)}`;
const artifactDigest = `sha256:${"c".repeat(64)}`;
const allModels = new Set(["qwen3:8b", "qwen3.6:27b", "gpt-oss:20b", "qwen3-coder:30b"]);

function request() {
  return cognitiveTurnRequestSchema.parse({
    requestId,
    correlationId: requestId,
    sessionId: "founder_session_0198a6d0-51ac-7cc0-b10b-42f16616dc84",
    objectiveId,
    objectiveDigest: digest,
    utterance: "Refactor this TypeScript repository and run the test suite.",
    riskClass: "R2",
    repositoryScope: ["stoic1712-IRIS/IRIS"],
    pathScope: ["packages/model-gateway/src/**", "tests/**"],
    availableModels: [...allModels],
    hasImage: false,
    occurredAt: "2026-08-08T21:39:25.124Z",
  });
}

function policy(protectedEffectStop = false) {
  return {
    allowedCapabilities: ["repository.inspect", "repository.edit-bounded"],
    protectedEffectStop,
    requiredReviewPurposes: ["agentic-coding", "deep-reasoning", "research-review"],
  } as const;
}

function delegation(overrides: Record<string, unknown> = {}) {
  return {
    mode: "delegated",
    objectiveId,
    objectiveDigest: digest,
    requestedCapabilities: ["repository.inspect", "repository.edit-bounded"],
    specialistPurpose: "agentic-coding",
    rationale: "The objective requires repository implementation.",
    authority: "none",
    ...overrides,
  };
}

describe("Qwen primary cognitive contracts", () => {
  it("rejects request extras and objective-binding drift", () => {
    const input = request();
    expect(() => cognitiveTurnRequestSchema.parse({ ...input, extra: true })).toThrow();
    const route = routeIrisModel({
      utterance: input.utterance,
      availableModels: allModels,
    });
    expect(() =>
      validateCognitiveDelegation(
        delegation({ objectiveDigest: `sha256:${"b".repeat(64)}` }),
        input,
        route,
        policy(),
      ),
    ).toThrow("COGNITIVE_OBJECTIVE_BINDING_MISMATCH");
  });

  it("accepts only registered capabilities and the deterministic specialist purpose", () => {
    const input = request();
    const route = routeIrisModel({
      utterance: input.utterance,
      availableModels: allModels,
    });
    const validated = validateCognitiveDelegation(delegation(), input, route, policy());
    expect(validated.route).toEqual(route);
    expect(validated.requiresIndependentReview).toBe(true);
    expect(validated.envelope.requestedCapabilities).toEqual([
      "repository.inspect",
      "repository.edit-bounded",
    ]);
  });

  it("fails closed on duplicate, unregistered, stopped, and mismatched delegations", () => {
    const input = request();
    const route = routeIrisModel({
      utterance: input.utterance,
      availableModels: allModels,
    });
    expect(() =>
      validateCognitiveDelegation(
        delegation({
          requestedCapabilities: ["repository.inspect", "repository.inspect"],
        }),
        input,
        route,
        policy(),
      ),
    ).toThrow("COGNITIVE_CAPABILITY_NOT_ALLOWED");
    expect(() =>
      validateCognitiveDelegation(
        delegation({ requestedCapabilities: ["repository.admin"] }),
        input,
        route,
        policy(),
      ),
    ).toThrow("COGNITIVE_CAPABILITY_NOT_ALLOWED");
    expect(() => validateCognitiveDelegation(delegation(), input, route, policy(true))).toThrow(
      "COGNITIVE_PROTECTED_EFFECT_STOP",
    );
    expect(() =>
      validateCognitiveDelegation(
        delegation({ specialistPurpose: "deep-reasoning" }),
        input,
        route,
        policy(),
      ),
    ).toThrow("COGNITIVE_ROUTE_MISMATCH");
    expect(() =>
      validateCognitiveDelegation(
        {
          mode: "direct",
          objectiveId,
          objectiveDigest: digest,
          narrative: "I will do the coding myself.",
          requestedCapabilities: [],
          specialistPurpose: null,
          authority: "none",
        },
        input,
        route,
        policy(),
      ),
    ).toThrow("COGNITIVE_ROUTE_MISMATCH");
  });

  it("strictly rejects extra fields on every provider-produced envelope", () => {
    const route = routeIrisModel({
      utterance: request().utterance,
      availableModels: allModels,
    });
    const evidence = {
      evidenceId: "evidence_0198a6d1-5969-7983-a3c2-8468cff0be10",
      kind: "artifact",
      label: "Verified worker artifact",
      exactValue: "artifact://candidate/verified",
      contentDigest: artifactDigest,
      requiredInPresentation: true,
    } as const;
    expect(() =>
      cognitiveDelegationEnvelopeSchema.parse({ ...delegation(), extra: true }),
    ).toThrow();
    expect(() =>
      cognitiveSpecialistArtifactSchema.parse({
        requestId,
        objectiveId,
        objectiveDigest: digest,
        route,
        status: "passed",
        summary: "Implementation and verification passed.",
        evidence: [evidence],
        artifactDigest,
        occurredAt: "2026-08-08T21:39:25.124Z",
        authority: "none",
        extra: true,
      }),
    ).toThrow();
    expect(() =>
      cognitiveReviewArtifactSchema.parse({
        requestId,
        objectiveId,
        objectiveDigest: digest,
        specialistArtifactDigest: artifactDigest,
        reviewerModel: "gpt-oss:20b",
        verdict: "pass",
        findings: [],
        evidence: [evidence],
        occurredAt: "2026-08-08T21:39:25.124Z",
        authority: "none",
        extra: true,
      }),
    ).toThrow();
    expect(() =>
      cognitiveSynthesisSchema.parse({
        narrative: "The verified implementation is ready for Founder review.",
        acknowledgedEvidenceIds: [evidence.evidenceId],
        authority: "none",
        extra: true,
      }),
    ).toThrow();
  });

  it("exposes a closed set of safe cognitive error codes", () => {
    expect(cognitiveTurnErrorCodes).toContain("COGNITIVE_OBJECTIVE_BINDING_MISMATCH");
    expect(cognitiveTurnErrorCodes).toContain("MODEL_LEASE_RELEASE_FAILED");
    expect(new Set(cognitiveTurnErrorCodes).size).toBe(cognitiveTurnErrorCodes.length);
  });
});
