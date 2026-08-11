import { z } from "zod";

import {
  canonicalIdSchema,
  verifyControllerDisposition,
  type ControllerDisposition,
} from "@stoic-iris/contracts";

import {
  attachControllerProjection,
  controllerProjectionSchema,
  modelGatewayRequestSchema,
  type ModelMessage,
  type ModelRuntimeAdapter,
} from "./contracts.js";

export const founderDialogueTurnSchema = z
  .object({
    role: z.enum(["founder", "iris"]),
    content: z.string().trim().min(1).max(6_000),
  })
  .strict();
export type FounderDialogueTurn = z.infer<typeof founderDialogueTurnSchema>;

export const founderDialogueRequestSchema = z
  .object({
    requestId: canonicalIdSchema.refine((value) => value.startsWith("request_")),
    source: z.enum(["text", "voice"]),
    utterance: z.string().trim().min(1).max(4_000),
    history: z.array(founderDialogueTurnSchema).max(24),
    stateSummary: z.string().trim().min(1).max(4_000),
    controllerDispositionId: z.string().regex(/^disposition_[a-z0-9-]{8,100}$/u),
    model: z.string().min(1).max(200).default("qwen3:8b"),
  })
  .strict();
export type FounderDialogueRequest = z.infer<typeof founderDialogueRequestSchema>;

export const founderDialogueResponseSchema = z
  .object({
    reply: z.string().trim().min(1).max(6_000),
    intent: z.enum([
      "conversation",
      "show-capabilities",
      "show-status",
      "emergency-stop",
      "propose-mission",
    ]),
    proposedAction: z.enum([
      "none",
      "show-capabilities",
      "show-status",
      "emergency-stop",
      "mission-proposal",
    ]),
    requiresApproval: z.boolean(),
    modelAuthority: z.literal("none"),
  })
  .strict();
export type FounderDialogueResponse = z.infer<typeof founderDialogueResponseSchema>;

export const founderControlledDialogueResponseSchema = founderDialogueResponseSchema
  .extend({
    controller: controllerProjectionSchema,
    controllerDispositionId: z.string().regex(/^disposition_[a-z0-9-]{8,100}$/u),
  })
  .strict();
export type FounderControlledDialogueResponse = z.infer<
  typeof founderControlledDialogueResponseSchema
>;

const dialogueOutputSchema = {
  type: "object",
  properties: {
    reply: { type: "string" },
    intent: {
      type: "string",
      enum: [
        "conversation",
        "show-capabilities",
        "show-status",
        "emergency-stop",
        "propose-mission",
      ],
    },
    proposedAction: {
      type: "string",
      enum: ["none", "show-capabilities", "show-status", "emergency-stop", "mission-proposal"],
    },
    requiresApproval: { type: "boolean" },
    modelAuthority: { type: "string", enum: ["none"] },
  },
  required: ["reply", "intent", "proposedAction", "requiresApproval", "modelAuthority"],
  additionalProperties: false,
} as const;

const identityPrompt = `You are IRIS, the Founder-facing cognitive coordinator for STOIC-IRIS.
Hold a natural, coherent conversation and use the supplied recent turns for continuity.
Be concise, truthful, evidence-led, warm, and direct. Never claim that a worker ran or a
repository changed unless the supplied state says so. You do not own authority. Follow the
supplied validated IRIS controller disposition exactly: execute-now means ordinary bounded
execution is already authorized by its active grant; acquire-capability identifies the missing
capability; request-protected-approval presents the exact protected approval need;
repair-runtime identifies the failed dependency and recovery; report-terminal reports the
terminal outcome. Never invent, widen, or override that disposition. Never reveal or repeat
credential-like material. Return only the required structured JSON.`;

function modelMessages(
  request: FounderDialogueRequest,
  disposition: ControllerDisposition,
): ModelMessage[] {
  return [
    { role: "system", content: identityPrompt },
    {
      role: "system",
      content: `Current governed IRIS state: ${request.stateSummary}`,
    },
    {
      role: "system",
      content: `Validated IRIS controller disposition: ${JSON.stringify(disposition.decision)}`,
    },
    ...request.history.map((turn) => ({
      role: turn.role === "founder" ? ("user" as const) : ("assistant" as const),
      content: turn.content,
    })),
    { role: "user", content: request.utterance },
  ];
}

function controllerReply(disposition: ControllerDisposition): string {
  const { decision } = disposition;
  if (decision.kind === "execute-now")
    return `I am dispatching the governed controller for ${decision.objectiveId} under active grant ${decision.grantId}.`;
  if (decision.kind === "acquire-capability")
    return `I am missing ${decision.gap.capability} because ${decision.gap.type}. I will prepare its digest-bound capability-acquisition proposal.`;
  if (decision.kind === "request-protected-approval")
    return `The protected effect ${decision.effect} requires your exact approval: ${disposition.protectedApproval?.exactStatement ?? ""}`.trim();
  if (decision.kind === "repair-runtime")
    return `The controller selected governed runtime repair for ${decision.capability} because ${decision.gap.type}.`;
  return `The objective ${decision.objectiveId} is ${decision.terminalState}. Evidence: ${decision.evidence.join(" ")}`;
}

export interface FounderDialogueController {
  resolve(dispositionId: string): unknown;
}

export class FounderDialogueService {
  readonly #runtime: ModelRuntimeAdapter;
  readonly #controller: FounderDialogueController;

  constructor(runtime: ModelRuntimeAdapter, controller: FounderDialogueController) {
    this.#runtime = runtime;
    this.#controller = controller;
  }

  async reply(candidate: unknown): Promise<FounderControlledDialogueResponse> {
    const request = founderDialogueRequestSchema.parse(candidate);
    const disposition = verifyControllerDisposition(
      this.#controller.resolve(request.controllerDispositionId),
    );
    if (disposition.dispositionId !== request.controllerDispositionId)
      throw new Error("CONTROLLER_DISPOSITION_ID_MISMATCH");
    const gatewayRequest = modelGatewayRequestSchema.parse({
      requestId: request.requestId,
      model: request.model,
      messages: modelMessages(request, disposition),
      outputSchema: dialogueOutputSchema,
      temperature: 0.3,
      seed: 17,
      contextTokens: 32_768,
      timeoutMs: 120_000,
      keepAlive: "5m",
    });
    const response = await this.#runtime.invoke(gatewayRequest, founderDialogueResponseSchema);
    const dialogue = founderDialogueResponseSchema.parse(response.output);
    if (dialogue.proposedAction === "mission-proposal" && !dialogue.requiresApproval)
      throw new Error("DIALOGUE_APPROVAL_REQUIRED");
    if (disposition.decision.kind === "execute-now" && dialogue.requiresApproval)
      throw new Error("DIALOGUE_CONTROLLER_DECISION_MISMATCH");
    if (disposition.decision.kind === "request-protected-approval" && !dialogue.requiresApproval)
      throw new Error("DIALOGUE_CONTROLLER_DECISION_MISMATCH");
    const controlled = attachControllerProjection(response, {
      decision: disposition.decision.kind,
      activeGrantId:
        disposition.decision.kind === "execute-now" ? disposition.decision.grantId : null,
    });
    return founderControlledDialogueResponseSchema.parse({
      ...dialogue,
      reply: controllerReply(disposition),
      controller: controlled.controller,
      controllerDispositionId: disposition.dispositionId,
    });
  }
}
