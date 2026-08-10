import {
  liveCapabilityEvidenceSchema,
  liveCapabilitySnapshotSchema,
} from "@stoic-iris/capabilities";
import {
  compiledIrisOperatingContractSchema,
  operatingDecisionKindSchema,
  sha256DigestSchema,
} from "@stoic-iris/contracts";
import { z } from "zod";

import {
  operatingDecisionSchema,
  operatingObjectiveSchema,
  type OperatingDecision,
  type OperatingObjective,
} from "./operating-decision-engine.js";

export const operatingEvidenceReferenceSchema = z
  .object({
    reference: z.string().min(1).max(2_048),
    digest: sha256DigestSchema,
  })
  .strict();

export const operatingContextSliceSchema = z
  .object({
    contract: z
      .object({
        version: z.literal("1.0.0"),
        digest: sha256DigestSchema,
        decisionOutcomes: z.tuple([
          z.literal("execute-now"),
          z.literal("acquire-capability"),
          z.literal("request-protected-approval"),
          z.literal("repair-runtime"),
          z.literal("report-terminal"),
        ]),
      })
      .strict(),
    identity: z.literal("IRIS"),
    founderRelationship: z.literal("Founder-operated"),
    objective: operatingObjectiveSchema,
    decision: operatingDecisionSchema,
    applicableCapabilities: z.array(liveCapabilityEvidenceSchema).max(32),
    protectedEffects: z.array(z.string().min(1).max(200)).max(16),
    exactEvidence: z.array(operatingEvidenceReferenceSchema).max(100),
    modelAuthority: z.literal("none"),
  })
  .strict();
export type OperatingContextSlice = z.infer<typeof operatingContextSliceSchema>;

export function assembleOperatingContext(input: {
  contract: unknown;
  objective: OperatingObjective;
  decision: OperatingDecision;
  snapshot: unknown;
  exactEvidence: readonly z.infer<typeof operatingEvidenceReferenceSchema>[];
}): OperatingContextSlice {
  const contract = compiledIrisOperatingContractSchema.parse(input.contract);
  const objective = operatingObjectiveSchema.parse(input.objective);
  const decision = operatingDecisionSchema.parse(input.decision);
  const snapshot = liveCapabilitySnapshotSchema.parse(input.snapshot);
  const exactEvidence = z
    .array(operatingEvidenceReferenceSchema)
    .max(100)
    .parse(input.exactEvidence);

  if (snapshot.contractDigest !== contract.contractDigest)
    throw new Error("OPERATING_CONTEXT_CONTRACT_MISMATCH");
  if (decision.objectiveId !== objective.objectiveId)
    throw new Error("OPERATING_CONTEXT_OBJECTIVE_MISMATCH");
  if (!contract.decisionOutcomes.includes(operatingDecisionKindSchema.parse(decision.kind)))
    throw new Error("OPERATING_CONTEXT_DECISION_UNKNOWN");

  const required = new Set(objective.requiredCapabilities);
  const applicableCapabilities = snapshot.capabilities.filter((entry) =>
    required.has(entry.capability),
  );
  if (applicableCapabilities.length !== required.size)
    throw new Error("OPERATING_CONTEXT_CAPABILITY_EVIDENCE_MISSING");

  const protectedEffects = new Set(contract.protectedEffects);
  for (const effect of objective.protectedEffects)
    if (!protectedEffects.has(effect))
      throw new Error(`OPERATING_CONTEXT_EFFECT_UNKNOWN:${effect}`);

  return operatingContextSliceSchema.parse({
    contract: {
      version: contract.version,
      digest: contract.contractDigest,
      decisionOutcomes: contract.decisionOutcomes,
    },
    identity: "IRIS",
    founderRelationship: "Founder-operated",
    objective,
    decision,
    applicableCapabilities,
    protectedEffects: objective.protectedEffects,
    exactEvidence,
    modelAuthority: "none",
  });
}
