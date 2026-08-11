import { z } from "zod";

import {
  operatingCapabilityNameSchema as capabilitySchema,
  operatingControllerDecisionSchema,
  operatingGapSchema as gapSchema,
  operatingGrantIdSchema as grantIdSchema,
  operatingObjectiveIdSchema as objectiveIdSchema,
  type OperatingControllerDecision,
} from "@stoic-iris/contracts";

export const operatingObjectiveSchema = z
  .object({
    objectiveId: objectiveIdSchema,
    requiredCapabilities: z.array(capabilitySchema),
    protectedEffects: z.array(capabilitySchema),
    terminal: z
      .object({
        state: z.enum(["completed", "failed", "cancelled", "unsupported", "physically-impossible"]),
        evidence: z.array(z.string().min(1).max(2_000)).min(1).max(100),
      })
      .strict()
      .optional(),
  })
  .strict();
export type OperatingObjective = z.infer<typeof operatingObjectiveSchema>;

const decisionSnapshotSchema = z
  .object({
    activeGrantId: grantIdSchema.nullable(),
    capabilities: z.array(
      z.looseObject({
        capability: capabilitySchema,
        status: z.enum([
          "ready",
          "needs-access",
          "needs-provider-repair",
          "needs-acquisition",
          "unsupported",
        ]),
        gap: gapSchema.optional(),
      }),
    ),
    protectedEffects: z.array(capabilitySchema),
  })
  .loose();

export const operatingDecisionSchema = operatingControllerDecisionSchema;
export type OperatingDecision = OperatingControllerDecision;

function unique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length)
    throw new Error(`OPERATING_OBJECTIVE_DUPLICATE:${label}`);
}

export function decideOperatingAction(input: {
  objective: OperatingObjective;
  snapshot: unknown;
  activeGrantId?: string;
}): OperatingDecision {
  const objective = operatingObjectiveSchema.parse(input.objective);
  const snapshot = decisionSnapshotSchema.parse(input.snapshot);
  unique(objective.requiredCapabilities, "requiredCapabilities");
  unique(objective.protectedEffects, "protectedEffects");

  if (objective.terminal !== undefined)
    return operatingDecisionSchema.parse({
      kind: "report-terminal",
      objectiveId: objective.objectiveId,
      terminalState: objective.terminal.state,
      evidence: objective.terminal.evidence,
    });

  const protectedSet = new Set(snapshot.protectedEffects);
  const protectedEffect = objective.protectedEffects[0];
  if (protectedEffect !== undefined) {
    if (!protectedSet.has(protectedEffect))
      throw new Error(`OPERATING_OBJECTIVE_PROTECTED_EFFECT_UNKNOWN:${protectedEffect}`);
    return operatingDecisionSchema.parse({
      kind: "request-protected-approval",
      objectiveId: objective.objectiveId,
      effect: protectedEffect,
      proposalRequired: true,
    });
  }

  const entries = new Map(snapshot.capabilities.map((entry) => [entry.capability, entry]));
  const required = new Set(objective.requiredCapabilities);
  for (const capability of required)
    if (!entries.has(capability))
      throw new Error(`OPERATING_OBJECTIVE_CAPABILITY_UNKNOWN:${capability}`);
  const orderedRequired = snapshot.capabilities.filter((entry) => required.has(entry.capability));
  for (const entry of orderedRequired) {
    const { capability } = entry;
    if (entry.status === "ready") continue;
    if (entry.gap === undefined) throw new Error(`OPERATING_CAPABILITY_GAP_MISSING:${capability}`);
    if (entry.status === "needs-provider-repair")
      return operatingDecisionSchema.parse({
        kind: "repair-runtime",
        objectiveId: objective.objectiveId,
        capability,
        gap: entry.gap,
        repairRequired: true,
      });
    if (entry.status === "unsupported")
      return operatingDecisionSchema.parse({
        kind: "report-terminal",
        objectiveId: objective.objectiveId,
        terminalState: "unsupported",
        evidence: entry.gap.evidence,
      });
    return operatingDecisionSchema.parse({
      kind: "acquire-capability",
      objectiveId: objective.objectiveId,
      gap: entry.gap,
      acquisitionRequired: true,
    });
  }

  if (snapshot.activeGrantId === null) throw new Error("OPERATING_EXECUTION_ACTIVE_GRANT_REQUIRED");
  if (input.activeGrantId !== undefined && input.activeGrantId !== snapshot.activeGrantId)
    throw new Error("OPERATING_EXECUTION_ACTIVE_GRANT_MISMATCH");
  return operatingDecisionSchema.parse({
    kind: "execute-now",
    objectiveId: objective.objectiveId,
    capabilities: orderedRequired.map((entry) => entry.capability),
    grantId: snapshot.activeGrantId,
    nextAction: "dispatch-governed-controller",
  });
}
