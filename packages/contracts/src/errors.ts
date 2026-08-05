import { z } from "zod";

import { canonicalIdSchema, riskClassSchema, timestampSchema } from "./primitives.js";

export const irisErrorSchema = z
  .object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]+$/),
    message: z.string().min(1).max(2000),
    occurredAt: timestampSchema,
    correlationId: canonicalIdSchema,
    riskClass: riskClassSchema,
    retryable: z.boolean(),
    safeDetails: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  })
  .strict();
export type IrisError = z.infer<typeof irisErrorSchema>;
