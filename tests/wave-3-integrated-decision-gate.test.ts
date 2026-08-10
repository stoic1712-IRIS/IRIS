import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { AuditEvent } from "../packages/contracts/src/index.js";

import type {
  ModelGatewayRequest,
  ModelGatewayResponse,
  ModelRuntimeAdapter,
  StructuredOutputValidator,
} from "../packages/model-gateway/src/index.js";
import { ModelGatewayError } from "../packages/model-gateway/src/index.js";
import {
  IntegratedDecisionGate,
  auditEventDigest,
  calculateProposalDigest,
  type IntegratedDecisionInput,
} from "../packages/kernel/src/index.js";

const requestId = "request_01936f3a-8b5c-7def-8abc-0123456789ab";
const outputValidator = z.object({ answer: z.string().min(1) }).strict();
const outputSchema = {
  type: "object",
  properties: { answer: { type: "string" } },
  required: ["answer"],
  additionalProperties: false,
};
const modelRequest: ModelGatewayRequest = {
  requestId,
  model: "qwen3:8b",
  messages: [{ role: "user", content: "Explain the governed result without taking action." }],
  outputSchema,
  temperature: 0,
  seed: 0,
  contextTokens: 4096,
  timeoutMs: 5_000,
  keepAlive: 0,
};
const actor = {
  identityId: "identity_01936f3a-8b5c-7def-8abc-0123456789ab",
  identityType: "founder" as const,
  displayName: "Founder",
  authenticated: true,
  authorityScopes: ["read", "local-change", "propose", "approve-r3"] as const,
};
const auditContext = {
  correlationId: requestId,
  eventIds: Array.from(
    { length: 10 },
    (_, index) => `audit_01936f3a-8b5c-7def-8abc-${String(index + 1).padStart(12, "0")}`,
  ),
  occurredAt: "2026-08-04T22:00:00-06:00",
  recordedAt: "2026-08-04T22:00:00-06:00",
  actor: {
    actorId: "worker_01936f3a-8b5c-7def-8abc-0123456789ab",
    actorType: "iris-core" as const,
    displayName: "IRIS Kernel",
  },
};
const readObjective = {
  objectiveId: "objective_01936f3a-8b5c-7def-8abc-0123456789ab",
  submittedAt: "2026-08-04T22:00:00-06:00",
  summary: "Explain repository state",
  requestedOutcome: "Return a read-only explanation.",
  mode: "read" as const,
  externalEffects: false,
  destructive: false,
  usesSecrets: false,
  createsCost: false,
};

class StubAdapter implements ModelRuntimeAdapter {
  readonly provider = "ollama";
  calls = 0;
  readonly #result: ModelGatewayResponse & { output: unknown };
  readonly #error: ModelGatewayError | undefined;

  constructor(result: ModelGatewayResponse & { output: unknown }, error?: ModelGatewayError) {
    this.#result = result;
    this.#error = error;
  }

  invoke<Output>(
    request: ModelGatewayRequest,
    validator: StructuredOutputValidator<Output>,
    signal?: AbortSignal,
  ): Promise<ModelGatewayResponse & { output: Output }> {
    void request;
    void validator;
    void signal;
    this.calls += 1;
    if (this.#error !== undefined) return Promise.reject(this.#error);
    return Promise.resolve(this.#result as ModelGatewayResponse & { output: Output });
  }
}

function successfulResponse(): ModelGatewayResponse & { output: { answer: string } } {
  return {
    requestId,
    provider: "ollama",
    model: "qwen3:8b",
    createdAt: "2026-08-04T22:00:01-06:00",
    output: { answer: "The objective is read-only." },
    usage: {
      inputTokens: 12,
      outputTokens: 8,
      totalDurationNanoseconds: 100,
      loadDurationNanoseconds: 10,
    },
    doneReason: "stop",
    modelAuthority: "none",
  };
}

function inputFor(objective: IntegratedDecisionInput["objective"]): IntegratedDecisionInput {
  return {
    objective,
    actor: { ...actor, authorityScopes: [...actor.authorityScopes] },
    audit: auditContext,
    modelRequest,
  };
}

function expectValidAuditChain(auditEvents: readonly AuditEvent[]): void {
  for (let index = 1; index < auditEvents.length; index += 1) {
    const previous = auditEvents[index - 1];
    const current = auditEvents[index];
    if (previous === undefined || current === undefined)
      throw new Error("Expected an audit event.");
    expect(current.previousEventDigest).toBe(auditEventDigest(previous));
    expect(current.correlation.correlationId).toBe(requestId);
  }
}

describe("Wave 3 integrated decision gate", () => {
  it("completes an authenticated R0 request through the model with a correlated audit chain", async () => {
    const adapter = new StubAdapter(successfulResponse());
    const result = await new IntegratedDecisionGate(adapter).execute(
      inputFor(readObjective),
      outputValidator,
    );
    expect(result.status).toBe("completed");
    expect(result.classification.riskClass).toBe("R0");
    expect(result.modelResponse?.modelAuthority).toBe("none");
    expect(adapter.calls).toBe(1);
    expect(result.auditEvents.map((event) => event.eventType)).toEqual([
      "ObjectiveClassified",
      "PermissionEvaluated",
      "ModelResponded",
      "DecisionCompleted",
    ]);
    expectValidAuditChain(result.auditEvents);
  });

  it("stops R1 and unapproved R3 objectives before model invocation", async () => {
    const adapter = new StubAdapter(successfulResponse());
    const local = await new IntegratedDecisionGate(adapter).execute(
      inputFor({ ...readObjective, mode: "local-change" }),
      outputValidator,
    );
    expect(local.status).toBe("awaiting-approval");

    const proposalPayload = '{"action":"push","target":"stoic1712-IRIS/IRIS"}';
    const protectedResult = await new IntegratedDecisionGate(adapter).execute(
      {
        ...inputFor({ ...readObjective, mode: "protected-action" }),
        protectedAction: "push",
        proposalPayload,
        proposalDigest: calculateProposalDigest(proposalPayload),
      },
      outputValidator,
    );
    expect(protectedResult.status).toBe("awaiting-approval");
    expect(adapter.calls).toBe(0);
  });

  it("denies R4 before model invocation", async () => {
    const adapter = new StubAdapter(successfulResponse());
    const result = await new IntegratedDecisionGate(adapter).execute(
      inputFor({ ...readObjective, mode: "prohibited" }),
      outputValidator,
    );
    expect(result.status).toBe("denied");
    expect(result.classification.riskClass).toBe("R4");
    expect(adapter.calls).toBe(0);
  });

  it("consumes an exact R3 approval once before governed model reasoning", async () => {
    const adapter = new StubAdapter(successfulResponse());
    const proposalPayload = '{"action":"push","target":"stoic1712-IRIS/IRIS"}';
    const proposalDigest = calculateProposalDigest(proposalPayload);
    const approval = {
      approvalId: "approval_01936f3a-8b5c-7def-8abc-0123456789ab",
      approverIdentity: "founder-authenticated",
      requestId,
      proposalId: "proposal_01936f3a-8b5c-7def-8abc-0123456789ab",
      riskClass: "R3" as const,
      actionType: "push" as const,
      payloadDigest: proposalDigest,
      target: "stoic1712-IRIS/IRIS:iris/wave-3-integrated-decision-gate",
      allowedExecutor: "iris-kernel",
      allowedTools: ["model-gateway"],
      preconditions: [],
      exclusions: ["execute push"],
      issuedAt: "2026-08-04T21:55:00-06:00",
      expiresAt: "2026-08-04T22:30:00-06:00",
      oneTimeUse: true,
      requiredVerification: ["audit chain"],
      requiredCleanup: ["unload model"],
      state: "issued" as const,
    };
    const approvalEvaluation = {
      authenticatedApproverIdentity: "founder-authenticated",
      actionType: "push" as const,
      payloadDigest: proposalDigest,
      target: approval.target,
      executor: "iris-kernel",
      tool: "model-gateway",
      evaluatedAt: "2026-08-04T22:00:00-06:00",
      previouslyConsumedApprovalIds: [],
    };
    const result = await new IntegratedDecisionGate(adapter).execute(
      {
        ...inputFor({ ...readObjective, mode: "protected-action" }),
        protectedAction: "push",
        proposalPayload,
        proposalDigest,
        approval,
        approvalEvaluation,
      },
      outputValidator,
    );
    expect(result.status).toBe("completed");
    expect(result.consumedApproval?.state).toBe("consumed");
    expect(result.auditEvents.some((event) => event.eventType === "ApprovalConsumed")).toBe(true);
    expect(adapter.calls).toBe(1);

    const altered = await new IntegratedDecisionGate(adapter).execute(
      {
        ...inputFor({ ...readObjective, mode: "protected-action" }),
        protectedAction: "push",
        proposalPayload,
        proposalDigest,
        approval: { ...approval, target: "other-target" },
        approvalEvaluation,
      },
      outputValidator,
    );
    expect(altered.status).toBe("denied");
    expect(altered.auditEvents.at(-1)?.eventType).toBe("DecisionDenied");
  });

  it("preserves provider failure, malformed output, and timeout as audited failures", async () => {
    for (const code of [
      "PROVIDER_UNAVAILABLE",
      "INVALID_STRUCTURED_OUTPUT",
      "PROVIDER_TIMEOUT",
    ] as const) {
      const adapter = new StubAdapter(
        successfulResponse(),
        new ModelGatewayError(code, "Safe gateway failure.", code !== "INVALID_STRUCTURED_OUTPUT"),
      );
      const result = await new IntegratedDecisionGate(adapter).execute(
        inputFor(readObjective),
        outputValidator,
      );
      expect(result.status).toBe("failed");
      expect(result.failure?.code).toBe(code);
      expect(result.auditEvents.at(-1)?.eventType).toBe("ModelFailed");
      expectValidAuditChain(result.auditEvents);
    }
  });
});
