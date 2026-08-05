import { z } from "zod";

import {
  approvalRecordSchema,
  auditEventSchema,
  canonicalIdSchema,
  provenanceActorSchema,
  protectedActionTypeSchema,
  sha256DigestSchema,
  timestampSchema,
  type ApprovalRecord,
  type AuditEvent,
  type AuthorizationDecision,
} from "@stoic-iris/contracts";
import {
  modelGatewayErrorCodes,
  modelGatewayRequestSchema,
  type ModelGatewayResponse,
  type ModelRuntimeAdapter,
  type StructuredOutputValidator,
} from "@stoic-iris/model-gateway";

import {
  approvalEvaluationRequestSchema,
  consumeApproval,
  evaluateApproval,
} from "./approval-evaluator.js";
import { InMemoryAppendOnlyAuditStore, auditEventDigest } from "./audit-store.js";
import { actorIdentityContextSchema } from "./identity.js";
import { classifyObjective, objectiveInputSchema } from "./objective-intake.js";
import {
  createCanonicalPolicyRegistry,
  evaluatePermission,
  type PermissionEvaluationRequest,
} from "./policy-registry.js";

const auditIdSchema = canonicalIdSchema.refine(
  (value) => value.startsWith("audit_"),
  "Expected an audit identifier.",
);

export const integratedAuditContextSchema = z
  .object({
    correlationId: canonicalIdSchema,
    eventIds: z.array(auditIdSchema).min(3).max(10),
    occurredAt: timestampSchema,
    recordedAt: timestampSchema,
    actor: provenanceActorSchema,
  })
  .strict();

export const integratedDecisionInputSchema = z
  .object({
    objective: objectiveInputSchema,
    actor: actorIdentityContextSchema,
    audit: integratedAuditContextSchema,
    protectedAction: protectedActionTypeSchema.optional(),
    proposalPayload: z.string().min(1).optional(),
    proposalDigest: sha256DigestSchema.optional(),
    approval: approvalRecordSchema.optional(),
    approvalEvaluation: approvalEvaluationRequestSchema.optional(),
    modelRequest: modelGatewayRequestSchema,
  })
  .strict();
export type IntegratedDecisionInput = z.infer<typeof integratedDecisionInputSchema>;

export interface IntegratedDecisionFailure {
  code: string;
  message: string;
  retryable: boolean;
  safeDetails: Readonly<Record<string, string | number | boolean | null>>;
}

export interface IntegratedDecisionResult<Output> {
  status: "completed" | "awaiting-approval" | "denied" | "failed";
  classification: ReturnType<typeof classifyObjective>;
  authorization: AuthorizationDecision;
  consumedApproval?: ApprovalRecord;
  modelResponse?: ModelGatewayResponse & { output: Output };
  failure?: IntegratedDecisionFailure;
  auditEvents: readonly AuditEvent[];
}

function isModelGatewayFailure(error: unknown): error is IntegratedDecisionFailure {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as Record<string, unknown>;
  const safeDetails = candidate.safeDetails;
  const hasSafeDetails =
    typeof safeDetails === "object" &&
    safeDetails !== null &&
    Object.values(safeDetails).every(
      (value) =>
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean",
    );
  return (
    typeof candidate.code === "string" &&
    modelGatewayErrorCodes.some((code) => code === candidate.code) &&
    typeof candidate.message === "string" &&
    typeof candidate.retryable === "boolean" &&
    hasSafeDetails
  );
}

function permissionRequest(input: IntegratedDecisionInput): PermissionEvaluationRequest {
  return {
    actor: input.actor,
    classification: classifyObjective(input.objective),
    ...(input.protectedAction === undefined ? {} : { protectedAction: input.protectedAction }),
    ...(input.proposalPayload === undefined ? {} : { proposalPayload: input.proposalPayload }),
    ...(input.proposalDigest === undefined ? {} : { proposalDigest: input.proposalDigest }),
  };
}

export class IntegratedDecisionGate {
  readonly #modelAdapter: ModelRuntimeAdapter;

  constructor(modelAdapter: ModelRuntimeAdapter) {
    this.#modelAdapter = modelAdapter;
  }

  async execute<Output>(
    candidate: IntegratedDecisionInput,
    outputValidator: StructuredOutputValidator<Output>,
    signal?: AbortSignal,
  ): Promise<IntegratedDecisionResult<Output>> {
    const input = integratedDecisionInputSchema.parse(candidate);
    const classification = classifyObjective(input.objective);
    const authorization = evaluatePermission(
      createCanonicalPolicyRegistry(),
      permissionRequest(input),
    );
    const auditStore = new InMemoryAppendOnlyAuditStore();
    let nextEventIndex = 0;

    const appendAudit = (
      eventType: string,
      outcome: AuditEvent["outcome"],
      summary: string,
    ): void => {
      const eventId = input.audit.eventIds[nextEventIndex];
      if (eventId === undefined)
        throw new Error("The integration audit context has insufficient event identifiers.");
      const previous = auditStore.list().at(-1);
      auditStore.append(
        auditEventSchema.parse({
          eventId,
          eventType,
          occurredAt: input.audit.occurredAt,
          recordedAt: input.audit.recordedAt,
          actor: input.audit.actor,
          correlation: { correlationId: input.audit.correlationId },
          riskClass: classification.riskClass,
          outcome,
          sensitivity: "public",
          summary,
          evidenceIds: [],
          ...(previous === undefined ? {} : { previousEventDigest: auditEventDigest(previous) }),
        }),
      );
      nextEventIndex += 1;
    };

    appendAudit(
      "ObjectiveClassified",
      "succeeded",
      `Objective classified as ${classification.riskClass}.`,
    );
    appendAudit(
      "PermissionEvaluated",
      authorization.decision === "deny" ? "denied" : "succeeded",
      `Permission evaluation returned ${authorization.decision}.`,
    );

    if (authorization.decision === "deny") {
      appendAudit(
        "DecisionDenied",
        "denied",
        "The governed pipeline denied the objective before model invocation.",
      );
      return { status: "denied", classification, authorization, auditEvents: auditStore.list() };
    }

    let finalAuthorization = authorization;
    let consumedApproval: ApprovalRecord | undefined;
    if (authorization.decision === "require-approval") {
      if (
        classification.riskClass !== "R3" ||
        input.approval === undefined ||
        input.approvalEvaluation === undefined
      ) {
        appendAudit(
          "ApprovalRequired",
          "pending",
          "The objective stopped at its required approval boundary.",
        );
        return {
          status: "awaiting-approval",
          classification,
          authorization,
          auditEvents: auditStore.list(),
        };
      }
      finalAuthorization = evaluateApproval(input.approval, input.approvalEvaluation);
      appendAudit(
        "ApprovalEvaluated",
        finalAuthorization.decision === "allow" ? "succeeded" : "denied",
        `Typed approval evaluation returned ${finalAuthorization.decision}.`,
      );
      if (finalAuthorization.decision !== "allow") {
        appendAudit(
          "DecisionDenied",
          "denied",
          "The typed approval did not match the protected request.",
        );
        return {
          status: "denied",
          classification,
          authorization: finalAuthorization,
          auditEvents: auditStore.list(),
        };
      }
      consumedApproval = consumeApproval(input.approval, input.approvalEvaluation.evaluatedAt);
      appendAudit(
        "ApprovalConsumed",
        "succeeded",
        "The exactly bound one-time approval was consumed.",
      );
    }

    try {
      const modelResponse = await this.#modelAdapter.invoke(
        input.modelRequest,
        outputValidator,
        signal,
      );
      appendAudit(
        "ModelResponded",
        "succeeded",
        "The model gateway returned schema-validated output with no authority.",
      );
      appendAudit(
        "DecisionCompleted",
        "succeeded",
        "The governed reasoning pipeline completed without external action.",
      );
      return {
        status: "completed",
        classification,
        authorization: finalAuthorization,
        ...(consumedApproval === undefined ? {} : { consumedApproval }),
        modelResponse,
        auditEvents: auditStore.list(),
      };
    } catch (error: unknown) {
      const failure = isModelGatewayFailure(error)
        ? {
            code: error.code,
            message: error.message,
            retryable: error.retryable,
            safeDetails: error.safeDetails,
          }
        : {
            code: "INTEGRATION_FAILURE",
            message: "The governed reasoning pipeline failed safely.",
            retryable: false,
            safeDetails: {},
          };
      appendAudit("ModelFailed", "failed", `The model gateway failed safely with ${failure.code}.`);
      return {
        status: "failed",
        classification,
        authorization: finalAuthorization,
        ...(consumedApproval === undefined ? {} : { consumedApproval }),
        failure,
        auditEvents: auditStore.list(),
      };
    }
  }
}
