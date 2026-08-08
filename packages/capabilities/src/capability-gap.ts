import { z } from "zod";

export const capabilityGapTypeSchema = z.enum([
  "capability-not-registered",
  "provider-not-installed",
  "provider-not-running",
  "provider-version-incompatible",
  "authorization-not-granted",
  "credential-reference-required",
  "network-or-source-unavailable",
  "hardware-insufficient",
  "unsupported-after-research",
  "protected-effect-required",
]);

export const capabilityGapEvidenceSchema = z
  .object({
    capability: z.string().regex(/^[a-z][a-z0-9.-]{2,199}$/u),
    registered: z.boolean(),
    providerInstalled: z.boolean(),
    providerRunning: z.boolean(),
    providerCompatible: z.boolean(),
    authorized: z.boolean(),
    credentialReferenceAvailable: z.boolean(),
    sourceReachable: z.boolean(),
    hardwareSufficient: z.boolean(),
    supportedAfterResearch: z.boolean(),
    protectedEffectRequired: z.boolean(),
    evidence: z.array(z.string().min(1).max(2_000)).min(1).max(100),
  })
  .strict();
export type CapabilityGapEvidence = z.infer<typeof capabilityGapEvidenceSchema>;

export const capabilityGapSchema = z
  .object({
    capability: capabilityGapEvidenceSchema.shape.capability,
    type: capabilityGapTypeSchema,
    evidence: capabilityGapEvidenceSchema.shape.evidence,
  })
  .strict();
export type CapabilityGap = z.infer<typeof capabilityGapSchema>;

export function classifyCapabilityGap(input: CapabilityGapEvidence): CapabilityGap {
  const value = capabilityGapEvidenceSchema.parse(input);
  const type = value.protectedEffectRequired
    ? "protected-effect-required"
    : !value.supportedAfterResearch
      ? "unsupported-after-research"
      : !value.hardwareSufficient
        ? "hardware-insufficient"
        : !value.sourceReachable
          ? "network-or-source-unavailable"
          : !value.credentialReferenceAvailable
            ? "credential-reference-required"
            : !value.authorized
              ? "authorization-not-granted"
              : !value.providerCompatible
                ? "provider-version-incompatible"
                : !value.providerRunning
                  ? "provider-not-running"
                  : !value.providerInstalled
                    ? "provider-not-installed"
                    : !value.registered
                      ? "capability-not-registered"
                      : null;
  if (type === null) throw new Error("CAPABILITY_GAP_NOT_FOUND");
  return capabilityGapSchema.parse({
    capability: value.capability,
    type,
    evidence: value.evidence,
  });
}
