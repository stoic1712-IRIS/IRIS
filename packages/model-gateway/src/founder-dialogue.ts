import { z } from "zod";

import { canonicalIdSchema } from "@stoic-iris/contracts";

import {
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
repository changed unless the supplied state says so. You do not own authority; the IRIS controller may execute the supplied validated decision.
If the Founder requests an action, explain the proposed next step. Repository mutation,
worker activation, publication, deployment, credentials, spending, or provider changes
must remain a proposal requiring the governed approval path. Never reveal or repeat
credential-like material. Return only the required structured JSON.`;

function modelMessages(request: FounderDialogueRequest): ModelMessage[] {
  return [
    { role: "system", content: identityPrompt },
    {
      role: "system",
      content: `Current governed IRIS state: ${request.stateSummary}`,
    },
    ...request.history.map((turn) => ({
      role: turn.role === "founder" ? ("user" as const) : ("assistant" as const),
      content: turn.content,
    })),
    { role: "user", content: request.utterance },
  ];
}

export class FounderDialogueService {
  readonly #runtime: ModelRuntimeAdapter;

  constructor(runtime: ModelRuntimeAdapter) {
    this.#runtime = runtime;
  }

  async reply(candidate: unknown): Promise<FounderDialogueResponse> {
    const request = founderDialogueRequestSchema.parse(candidate);
    const gatewayRequest = modelGatewayRequestSchema.parse({
      requestId: request.requestId,
      model: request.model,
      messages: modelMessages(request),
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
    return dialogue;
  }
}
