import { z } from "zod";

import {
  canonicalIdSchema,
  sensitivitySchema,
  sha256DigestSchema,
  timestampSchema,
} from "./primitives.js";
import { provenanceSchema } from "./provenance.js";

export const evidenceCommandSchema = z
  .object({
    command: z.string().min(1).max(4000),
    exitCode: z.number().int(),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
  })
  .strict()
  .refine((command) => Date.parse(command.completedAt) >= Date.parse(command.startedAt), {
    message: "completedAt cannot precede startedAt.",
    path: ["completedAt"],
  });

export const evidenceRecordSchema = z
  .object({
    evidenceId: canonicalIdSchema.refine(
      (value) => value.startsWith("evidence_"),
      "Expected an evidence identifier.",
    ),
    subject: z.string().min(1).max(500),
    result: z.enum(["passed", "failed", "blocked", "limited"]),
    sensitivity: sensitivitySchema,
    revision: z.string().regex(/^[0-9a-f]{40}$/),
    tools: z.array(z.string().min(1).max(500)).min(1),
    commands: z.array(evidenceCommandSchema),
    failures: z.array(z.string().min(1).max(2000)),
    repairs: z.array(z.string().min(1).max(2000)),
    limitations: z.array(z.string().min(1).max(2000)),
    rollback: z.string().min(1).max(4000),
    cleanup: z.array(z.string().min(1).max(2000)),
    artifactDigest: sha256DigestSchema,
    provenance: provenanceSchema,
  })
  .strict();
export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;
