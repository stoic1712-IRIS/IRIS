import { timestampSchema } from "@stoic-iris/contracts";
import { z } from "zod";

const taskIdSchema = z.string().regex(/^task_[a-z0-9][a-z0-9-]{2,99}$/);

export const missionTaskSchema = z
  .object({
    taskId: taskIdSchema,
    title: z.string().min(1).max(300),
    objective: z.string().min(1).max(5_000),
    dependsOn: z.array(taskIdSchema),
    requiredEvidence: z.array(z.string().min(1).max(1_000)).min(1),
    approvalCheckpoint: z.enum([
      "none",
      "founder-before-action",
      "founder-before-canonicalization",
    ]),
    workerRecommendation: z
      .object({
        workerClass: z.enum(["iris-core", "read-only-specialist", "bounded-coding-worker"]),
        rationale: z.string().min(1).max(2_000),
        maximumPermissions: z.array(z.string().min(1).max(200)),
      })
      .strict(),
  })
  .strict();
export type MissionTask = z.infer<typeof missionTaskSchema>;

export const missionPlanSchema = z
  .object({
    missionId: z.string().regex(/^mission_[a-z0-9][a-z0-9-]{2,99}$/),
    objective: z.string().min(1).max(10_000),
    createdAt: timestampSchema,
    tasks: z.array(missionTaskSchema).min(1),
  })
  .strict();
export type MissionPlan = z.infer<typeof missionPlanSchema>;

export interface PlannedMission extends MissionPlan {
  executionOrder: string[];
  approvalCheckpoints: { taskId: string; checkpoint: MissionTask["approvalCheckpoint"] }[];
  evidenceRequirements: { taskId: string; evidence: string[] }[];
}

export function planMission(input: MissionPlan): PlannedMission {
  const plan = missionPlanSchema.parse(input);
  const tasks = new Map(plan.tasks.map((task) => [task.taskId, task]));
  if (tasks.size !== plan.tasks.length) throw new Error("Mission task identifiers must be unique.");
  for (const task of plan.tasks)
    for (const dependency of task.dependsOn)
      if (!tasks.has(dependency))
        throw new Error(`Task ${task.taskId} has missing dependency ${dependency}.`);

  const permanent = new Set<string>();
  const temporary = new Set<string>();
  const executionOrder: string[] = [];
  const visit = (taskId: string): void => {
    if (permanent.has(taskId)) return;
    if (temporary.has(taskId)) throw new Error("Mission task dependencies contain a cycle.");
    temporary.add(taskId);
    const task = tasks.get(taskId);
    if (task === undefined) throw new Error("Mission task disappeared during planning.");
    for (const dependency of [...task.dependsOn].sort()) visit(dependency);
    temporary.delete(taskId);
    permanent.add(taskId);
    executionOrder.push(taskId);
  };
  for (const taskId of [...tasks.keys()].sort()) visit(taskId);

  return {
    ...structuredClone(plan),
    executionOrder,
    approvalCheckpoints: plan.tasks
      .filter((task) => task.approvalCheckpoint !== "none")
      .map((task) => ({ taskId: task.taskId, checkpoint: task.approvalCheckpoint })),
    evidenceRequirements: plan.tasks.map((task) => ({
      taskId: task.taskId,
      evidence: [...task.requiredEvidence],
    })),
  };
}
