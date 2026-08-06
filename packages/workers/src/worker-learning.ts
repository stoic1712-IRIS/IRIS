import { createHash } from "node:crypto";
import { z } from "zod";

export const workerEvaluationSchema = z.strictObject({
  evaluationId: z.string().regex(/^evaluation_[a-f0-9]{12}$/u),
  workerId: z.string(),
  workerDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  missionId: z.string(),
  outcome: z.enum(["accepted", "rejected", "needs-repair"]),
  passedChecks: z.array(z.string()),
  failedChecks: z.array(z.string()),
  founderFeedback: z.string().max(4_000),
  evidenceDigests: z.array(z.string().regex(/^sha256:[a-f0-9]{64}$/u)).min(1),
  canonicalMemoryMutation: z.literal(false),
  status: z.literal("pending-founder-approval"),
});
export type WorkerEvaluation = z.infer<typeof workerEvaluationSchema>;

export function createWorkerEvaluation(
  input: Omit<WorkerEvaluation, "evaluationId" | "canonicalMemoryMutation" | "status">,
): WorkerEvaluation {
  const suffix = createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 12);
  return workerEvaluationSchema.parse({
    ...input,
    evaluationId: `evaluation_${suffix}`,
    canonicalMemoryMutation: false,
    status: "pending-founder-approval",
  });
}
