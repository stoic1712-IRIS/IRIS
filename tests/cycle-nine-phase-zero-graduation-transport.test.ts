import { describe, expect, it } from "vitest";
import {
  createIdlePhaseZeroGraduationEnvelope,
  PhaseZeroGraduationReadinessController,
  phaseZeroGraduationApprovalEnvelopeSchema,
  phaseZeroGraduationEnvelopeSchema,
  phaseZeroGraduationResultTransportSchema,
  verifyPhaseZeroGraduationStageProgression,
} from "../packages/development/src/index.js";
import {
  graduationApprovalScope as kernelApprovalScope,
  graduationApprovalsPath as kernelApprovalsPath,
  graduationBodyDigest as kernelBodyDigest,
  graduationReadScope as kernelReadScope,
  graduationReadinessPath as kernelReadinessPath,
  graduationTransportAudience as kernelAudience,
  parseCoreGraduationRequest as kernelParse,
  signCoreGraduationRequest as kernelSign,
  verifyCoreGraduationBody as kernelVerifyBody,
  verifyCoreGraduationRequest as kernelVerify,
} from "../packages/kernel/src/index.js";

const key = "a".repeat(64);
const now = new Date("2026-08-07T05:30:00.000Z");

describe("Cycle Nine Core graduation transport", () => {
  it("publishes a strict expiring idle envelope", () => {
    const envelope = createIdlePhaseZeroGraduationEnvelope("b".repeat(40), now);
    expect(phaseZeroGraduationEnvelopeSchema.parse(envelope).state).toBe("idle");
    expect(Date.parse(envelope.expiresAt) - Date.parse(envelope.generatedAt)).toBe(30_000);
  });

  it("binds signed reads to the exact route, scope, and empty body", () => {
    const unsigned = {
      method: "GET" as const,
      path: kernelReadinessPath,
      requestId: `request_${"c".repeat(32)}`,
      timestamp: now.toISOString(),
      audience: kernelAudience,
      scope: kernelReadScope,
      bodyDigest: kernelBodyDigest(""),
    };
    const request = { ...unsigned, signature: kernelSign(key, unsigned) };
    expect(kernelVerify(key, request, now)).toBe(true);
    expect(kernelVerifyBody(request, "")).toBe(true);
    expect(kernelVerifyBody(request, " ")).toBe(false);
    expect(
      kernelParse("GET", kernelReadinessPath, {
        "x-iris-request-id": request.requestId,
        "x-iris-timestamp": request.timestamp,
        "x-iris-audience": request.audience,
        "x-iris-scope": request.scope,
        "x-iris-content-sha256": request.bodyDigest,
        "x-iris-signature": request.signature,
      }),
    ).toEqual(request);
  });

  it("binds approval signatures to the exact JSON body", () => {
    const body = JSON.stringify({ approvalType: "graduation" });
    const unsigned = {
      method: "POST" as const,
      path: kernelApprovalsPath,
      requestId: `request_${"d".repeat(32)}`,
      timestamp: now.toISOString(),
      audience: kernelAudience,
      scope: kernelApprovalScope,
      bodyDigest: kernelBodyDigest(body),
    };
    const request = { ...unsigned, signature: kernelSign(key, unsigned) };
    expect(kernelVerify(key, request, now)).toBe(true);
    expect(kernelVerifyBody(request, body)).toBe(true);
    expect(kernelVerifyBody(request, `${body} `)).toBe(false);
  });

  it("rejects incomplete approval envelopes", () => {
    expect(
      phaseZeroGraduationApprovalEnvelopeSchema.safeParse({
        approvalType: "graduation",
        approval: { typedStatement: "incomplete" },
      }).success,
    ).toBe(false);
  });

  it("rejects a durable receipt that does not bind the submitted approval", async () => {
    const proposalDigest = `sha256:${"e".repeat(64)}` as const;
    const controller = new PhaseZeroGraduationReadinessController(
      {
        read: () => Promise.resolve(createIdlePhaseZeroGraduationEnvelope("b".repeat(40), now)),
        consumeApproval: () =>
          Promise.resolve({
            approvalId: `approval_phase0-${"f".repeat(8)}`,
            graduationId: "graduation_phase0-transport-0001",
            proposalDigest,
            approvalType: "graduation",
            consumedBy: "IRIS",
            durableLedger: true,
            consumedAt: now.toISOString(),
          }),
      },
      () => now,
    );
    await expect(
      controller.consumeApproval({
        approvalType: "graduation",
        approval: {
          approvalId: "approval_phase0-transport-0001",
          graduationId: "graduation_phase0-transport-0001",
          proposalDigest,
          approvedBy: "Founder",
          authentication: {
            actorId: "Founder",
            sessionId: "founder.session",
            assurance: "founder-loopback-session",
            verified: true,
            evidenceDigest: `sha256:${"a".repeat(64)}`,
            authenticatedAt: now.toISOString(),
          },
          typedStatement: "exact statement",
          oneTime: true,
          issuedAt: now.toISOString(),
        },
      }),
    ).rejects.toThrow("PHASE_ZERO_APPROVAL_RECEIPT_MISMATCH");
  });

  it("rejects result events with invalid hashes even when stages are ordered", () => {
    expect(
      phaseZeroGraduationResultTransportSchema.safeParse({
        graduationId: "graduation_phase0-transport-0001",
        status: "failed",
        stage: "approval",
        failureStage: "approval",
        summary: "failed closed",
        approvalConsumed: false,
        mergeApprovalConsumed: false,
        canonicalRepositoryChanged: false,
        canonicalRepositoryChangeVerified: true,
        phase0GraduationEvidenceComplete: false,
        providerZeroVerified: false,
        events: [
          {
            sequence: 1,
            stage: "approval",
            summary: "invalid",
            evidence: {},
            evidenceDigest: `sha256:${"0".repeat(64)}`,
            previousDigest: null,
            digest: `sha256:${"1".repeat(64)}`,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects reordered or skipped successful stage chains", () => {
    expect(
      verifyPhaseZeroGraduationStageProgression([
        { stage: "approval" },
        { stage: "candidate" },
        { stage: "preflight" },
      ]),
    ).toBe(false);
    expect(
      verifyPhaseZeroGraduationStageProgression(
        [{ stage: "approval" }, { stage: "completed" }],
        true,
      ),
    ).toBe(false);
  });
});
