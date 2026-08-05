import { z } from "zod";

import { semanticVersionSchema } from "./primitives.js";

export const runtimeConfigurationSchema = z
  .object({
    schemaVersion: semanticVersionSchema,
    environment: z.enum(["development", "test", "staging", "production"]),
    logLevel: z.enum(["debug", "info", "warn", "error"]),
    providers: z
      .record(
        z.string().min(1),
        z
          .object({
            enabled: z.boolean(),
            adapter: z.string().min(1),
            timeoutMs: z.number().int().positive().max(300_000),
          })
          .strict(),
      )
      .default({}),
  })
  .strict();
export type RuntimeConfiguration = z.infer<typeof runtimeConfigurationSchema>;
