import { z } from "zod";

export const canonicalIdKinds = [
  "approval",
  "audit",
  "evidence",
  "mission",
  "objective",
  "proposal",
  "request",
  "worker",
] as const;

export const canonicalIdKindSchema = z.enum(canonicalIdKinds);
export type CanonicalIdKind = z.infer<typeof canonicalIdKindSchema>;

const canonicalIdPattern =
  /^(approval|audit|evidence|mission|objective|proposal|request|worker)_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const canonicalIdSchema = z.string().regex(canonicalIdPattern, {
  message: "Expected a canonical IRIS identifier with a governed kind prefix and UUID.",
});
export type CanonicalId = z.infer<typeof canonicalIdSchema>;

export const timestampSchema = z.iso.datetime({ offset: true });
export type Timestamp = z.infer<typeof timestampSchema>;

export const semanticVersionSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/, {
    message: "Expected a semantic version.",
  });
export type SemanticVersion = z.infer<typeof semanticVersionSchema>;

export const sha256DigestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/, {
  message: "Expected a lowercase SHA-256 digest prefixed with sha256:.",
});
export type Sha256Digest = z.infer<typeof sha256DigestSchema>;

export const riskClassSchema = z.enum(["R0", "R1", "R2", "R3", "R4"]);
export type RiskClass = z.infer<typeof riskClassSchema>;

export const sensitivitySchema = z.enum([
  "public",
  "internal",
  "sensitive",
  "secret",
  "recovery-authority",
]);
export type Sensitivity = z.infer<typeof sensitivitySchema>;

export const correlationSchema = z
  .object({
    correlationId: canonicalIdSchema,
    causationId: canonicalIdSchema.optional(),
  })
  .strict();
export type Correlation = z.infer<typeof correlationSchema>;
