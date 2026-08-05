import { z } from "zod";

import {
  canonicalIdSchema,
  correlationSchema,
  riskClassSchema,
  sensitivitySchema,
  sha256DigestSchema,
  timestampSchema,
} from "./primitives.js";
import { provenanceActorSchema } from "./provenance.js";

export const auditEventSchema = z
  .object({
    eventId: canonicalIdSchema.refine(
      (value) => value.startsWith("audit_"),
      "Expected an audit identifier.",
    ),
    eventType: z.string().regex(/^[A-Z][A-Za-z0-9]+$/),
    occurredAt: timestampSchema,
    recordedAt: timestampSchema,
    actor: provenanceActorSchema,
    correlation: correlationSchema,
    riskClass: riskClassSchema,
    outcome: z.enum(["succeeded", "failed", "denied", "pending"]),
    sensitivity: sensitivitySchema,
    summary: z.string().min(1).max(2000),
    evidenceIds: z.array(
      canonicalIdSchema.refine(
        (value) => value.startsWith("evidence_"),
        "Expected an evidence identifier.",
      ),
    ),
    previousEventDigest: sha256DigestSchema.optional(),
  })
  .strict()
  .refine((event) => Date.parse(event.recordedAt) >= Date.parse(event.occurredAt), {
    message: "recordedAt cannot precede occurredAt.",
    path: ["recordedAt"],
  });
export type AuditEvent = z.infer<typeof auditEventSchema>;
