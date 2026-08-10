import {
  compiledIrisOperatingContractSchema,
  sha256DigestSchema,
  timestampSchema,
} from "@stoic-iris/contracts";
import { z } from "zod";

const capabilityNameSchema = z.string().regex(/^[a-z][a-z0-9.-]+$/u);

export const liveCapabilityStatusSchema = z.enum([
  "ready",
  "needs-access",
  "needs-provider-repair",
  "needs-acquisition",
  "protected",
  "unsupported",
]);
export type LiveCapabilityStatus = z.infer<typeof liveCapabilityStatusSchema>;

export const liveCapabilityProviderEvidenceSchema = z
  .object({
    capability: capabilityNameSchema,
    registered: z.boolean(),
    providerInstalled: z.boolean(),
    providerRunning: z.boolean(),
    providerCompatible: z.boolean(),
    credentialReferenceAvailable: z.boolean(),
    sourceReachable: z.boolean(),
    hardwareSufficient: z.boolean(),
    supportedAfterResearch: z.boolean(),
    evidence: z.array(z.string().min(1).max(1_000)).min(1).max(100),
  })
  .strict();
export type LiveCapabilityProviderEvidence = z.infer<typeof liveCapabilityProviderEvidenceSchema>;

export const liveCapabilityEvidenceSchema = liveCapabilityProviderEvidenceSchema
  .extend({
    authorized: z.boolean(),
    protected: z.literal(false),
    status: liveCapabilityStatusSchema.exclude(["protected"]),
    capturedAt: timestampSchema,
  })
  .strict();
export type LiveCapabilityEvidence = z.infer<typeof liveCapabilityEvidenceSchema>;

export const liveCapabilitySnapshotSchema = z
  .object({
    contractDigest: sha256DigestSchema,
    capabilities: z.array(liveCapabilityEvidenceSchema).min(1),
    protectedEffects: z.array(capabilityNameSchema).min(1),
    capturedAt: timestampSchema,
  })
  .strict();
export type LiveCapabilitySnapshot = z.infer<typeof liveCapabilitySnapshotSchema>;

function deriveStatus(
  evidence: LiveCapabilityProviderEvidence,
  authorized: boolean,
): LiveCapabilityEvidence["status"] {
  if (!evidence.registered || !evidence.providerInstalled)
    return evidence.supportedAfterResearch ? "needs-acquisition" : "unsupported";
  if (
    !evidence.providerRunning ||
    !evidence.providerCompatible ||
    !evidence.sourceReachable ||
    !evidence.hardwareSufficient
  )
    return "needs-provider-repair";
  if (!authorized || !evidence.credentialReferenceAvailable) return "needs-access";
  return "ready";
}

export function buildLiveCapabilitySnapshot(input: {
  contract: unknown;
  providers: readonly LiveCapabilityProviderEvidence[];
  activeGrant?: { capabilities: readonly string[] };
  capturedAt: string;
}): LiveCapabilitySnapshot {
  const contract = compiledIrisOperatingContractSchema.parse(input.contract);
  const capturedAt = timestampSchema.parse(input.capturedAt);
  const providers = z.array(liveCapabilityProviderEvidenceSchema).parse(input.providers);
  const ordinary = new Set(contract.ordinaryCapabilities);
  const protectedEffects = new Set(contract.protectedEffects);
  const providerMap = new Map<string, LiveCapabilityProviderEvidence>();

  for (const provider of providers) {
    if (providerMap.has(provider.capability))
      throw new Error(`LIVE_CAPABILITY_EVIDENCE_DUPLICATE:${provider.capability}`);
    if (protectedEffects.has(provider.capability))
      throw new Error(`LIVE_CAPABILITY_EVIDENCE_PROTECTED:${provider.capability}`);
    if (!ordinary.has(provider.capability))
      throw new Error(`LIVE_CAPABILITY_EVIDENCE_UNKNOWN:${provider.capability}`);
    providerMap.set(provider.capability, provider);
  }

  const missing = contract.ordinaryCapabilities.find((capability) => !providerMap.has(capability));
  if (missing !== undefined) throw new Error(`LIVE_CAPABILITY_EVIDENCE_MISSING:${missing}`);

  const granted = new Set(input.activeGrant?.capabilities ?? []);
  for (const capability of granted) {
    if (protectedEffects.has(capability))
      throw new Error(`LIVE_CAPABILITY_GRANT_PROTECTED:${capability}`);
    if (!ordinary.has(capability)) throw new Error(`LIVE_CAPABILITY_GRANT_UNKNOWN:${capability}`);
  }

  const capabilities = contract.ordinaryCapabilities.map((capability) => {
    const provider = providerMap.get(capability);
    if (provider === undefined) throw new Error(`LIVE_CAPABILITY_EVIDENCE_MISSING:${capability}`);
    const authorized = granted.has(capability);
    return liveCapabilityEvidenceSchema.parse({
      ...provider,
      authorized,
      protected: false,
      status: deriveStatus(provider, authorized),
      capturedAt,
    });
  });

  return liveCapabilitySnapshotSchema.parse({
    contractDigest: contract.contractDigest,
    capabilities,
    protectedEffects: [...contract.protectedEffects],
    capturedAt,
  });
}
