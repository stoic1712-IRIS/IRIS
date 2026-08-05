import { z } from "zod";

import { canonicalIdSchema, sha256DigestSchema, timestampSchema } from "./primitives.js";

export const provenanceActorSchema = z
  .object({
    actorId: canonicalIdSchema,
    actorType: z.enum(["founder", "iris-core", "worker", "external-system"]),
    displayName: z.string().min(1).max(200),
  })
  .strict();

export const provenanceSchema = z
  .object({
    createdAt: timestampSchema,
    createdBy: provenanceActorSchema,
    sourceKind: z.enum(["founder-input", "iris-generated", "repository", "provider", "import"]),
    sourceReference: z.string().min(1).max(2048),
    contentDigest: sha256DigestSchema,
    parentEvidenceIds: z.array(canonicalIdSchema).default([]),
  })
  .strict();
export type Provenance = z.infer<typeof provenanceSchema>;
