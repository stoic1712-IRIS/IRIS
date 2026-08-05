import { z } from "zod";

import { canonicalIdSchema, riskClassSchema, timestampSchema } from "@stoic-iris/contracts";

export const objectiveInputSchema = z
  .object({
    objectiveId: canonicalIdSchema.refine(
      (value) => value.startsWith("objective_"),
      "Expected an objective identifier.",
    ),
    submittedAt: timestampSchema,
    summary: z.string().min(1).max(500),
    requestedOutcome: z.string().min(1).max(4000),
    mode: z.enum(["read", "local-change", "protected-action", "prohibited"]),
    externalEffects: z.boolean(),
    destructive: z.boolean(),
    usesSecrets: z.boolean(),
    createsCost: z.boolean(),
  })
  .strict();
export type ObjectiveInput = z.infer<typeof objectiveInputSchema>;

export const objectiveClassificationSchema = z
  .object({
    objectiveId: canonicalIdSchema,
    riskClass: riskClassSchema,
    authorizationRequirement: z.enum([
      "existing-read-authority",
      "explicit-task-approval",
      "typed-protected-approval",
      "deny",
    ]),
    reasons: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type ObjectiveClassification = z.infer<typeof objectiveClassificationSchema>;

export function classifyObjective(input: ObjectiveInput): ObjectiveClassification {
  const objective = objectiveInputSchema.parse(input);

  if (objective.mode === "prohibited") {
    return {
      objectiveId: objective.objectiveId,
      riskClass: "R4",
      authorizationRequirement: "deny",
      reasons: ["The requested mode is constitutionally prohibited."],
    };
  }
  if (
    objective.mode === "protected-action" ||
    objective.externalEffects ||
    objective.destructive ||
    objective.usesSecrets ||
    objective.createsCost
  ) {
    return {
      objectiveId: objective.objectiveId,
      riskClass: "R3",
      authorizationRequirement: "typed-protected-approval",
      reasons: ["The objective includes a protected action or external effect."],
    };
  }
  if (objective.mode === "local-change") {
    return {
      objectiveId: objective.objectiveId,
      riskClass: "R1",
      authorizationRequirement: "explicit-task-approval",
      reasons: ["The objective changes an authorized local workspace."],
    };
  }
  return {
    objectiveId: objective.objectiveId,
    riskClass: "R0",
    authorizationRequirement: "existing-read-authority",
    reasons: ["The objective is read-only and has no external effects."],
  };
}
