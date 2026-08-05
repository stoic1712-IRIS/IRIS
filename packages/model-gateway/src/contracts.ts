import { z } from "zod";

import { canonicalIdSchema, timestampSchema } from "@stoic-iris/contracts";

export const modelMessageSchema = z
  .object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().min(1).max(100_000),
  })
  .strict();
export type ModelMessage = z.infer<typeof modelMessageSchema>;

export const modelGatewayRequestSchema = z
  .object({
    requestId: canonicalIdSchema.refine(
      (value) => value.startsWith("request_"),
      "Expected a request identifier.",
    ),
    model: z.string().min(1).max(200),
    messages: z.array(modelMessageSchema).min(1).max(100),
    outputSchema: z.record(z.string(), z.unknown()),
    temperature: z.number().min(0).max(2).default(0),
    seed: z.number().int().min(0).max(2_147_483_647).default(0),
    contextTokens: z.number().int().positive().max(131_072),
    timeoutMs: z.number().int().positive().max(300_000),
    keepAlive: z.union([z.literal(0), z.string().regex(/^\d+[smh]$/)]).default(0),
  })
  .strict();
export type ModelGatewayRequest = z.infer<typeof modelGatewayRequestSchema>;

export const modelUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalDurationNanoseconds: z.number().int().nonnegative(),
    loadDurationNanoseconds: z.number().int().nonnegative(),
  })
  .strict();
export type ModelUsage = z.infer<typeof modelUsageSchema>;

export const modelGatewayResponseSchema = z
  .object({
    requestId: canonicalIdSchema,
    provider: z.literal("ollama"),
    model: z.string().min(1).max(200),
    createdAt: timestampSchema,
    output: z.unknown(),
    usage: modelUsageSchema,
    doneReason: z.string().min(1).max(200),
    authority: z.literal("none"),
  })
  .strict();
export type ModelGatewayResponse = z.infer<typeof modelGatewayResponseSchema>;

export type StructuredOutputValidator<Output> = z.ZodType<Output>;

export interface ModelRuntimeAdapter {
  readonly provider: string;
  invoke<Output>(
    request: ModelGatewayRequest,
    outputValidator: StructuredOutputValidator<Output>,
    signal?: AbortSignal,
  ): Promise<ModelGatewayResponse & { output: Output }>;
}
