import { timestampSchema } from "@stoic-iris/contracts";
import { z } from "zod";

export const milestoneStates = ["planned", "ready", "in-progress", "blocked", "complete"] as const;
export type MilestoneState = (typeof milestoneStates)[number];

export const roadmapMilestoneSchema = z
  .object({
    milestoneId: z.string().regex(/^milestone_[a-z0-9][a-z0-9-]{2,99}$/),
    phaseId: z.string().regex(/^phase_[a-z0-9][a-z0-9-]{2,99}$/),
    title: z.string().min(1).max(300),
    state: z.enum(milestoneStates),
    capabilityDependencies: z.array(z.string().min(1).max(200)),
    blockers: z.array(z.string().min(1).max(2_000)),
    completionEvidence: z.array(z.string().min(1).max(2_000)),
    updatedAt: timestampSchema,
  })
  .strict();
export type RoadmapMilestone = z.infer<typeof roadmapMilestoneSchema>;

const allowedTransitions: Record<MilestoneState, MilestoneState[]> = {
  planned: ["ready", "blocked"],
  ready: ["in-progress", "blocked"],
  "in-progress": ["blocked", "complete"],
  blocked: ["ready", "in-progress"],
  complete: [],
};

export class RoadmapManager {
  readonly #milestones = new Map<string, RoadmapMilestone>();
  readonly #availableCapabilities = new Set<string>();

  register(input: RoadmapMilestone): RoadmapMilestone {
    const milestone = roadmapMilestoneSchema.parse(input);
    if (this.#milestones.has(milestone.milestoneId)) throw new Error("Milestone already exists.");
    this.#milestones.set(milestone.milestoneId, structuredClone(milestone));
    return structuredClone(milestone);
  }

  recordCapability(capability: string): void {
    if (capability.length === 0) throw new Error("Capability identifier is required.");
    this.#availableCapabilities.add(capability);
  }

  readiness(milestoneId: string): {
    ready: boolean;
    missingCapabilities: string[];
    blockers: string[];
  } {
    const milestone = this.#require(milestoneId);
    const missingCapabilities = milestone.capabilityDependencies.filter(
      (capability) => !this.#availableCapabilities.has(capability),
    );
    return {
      ready: missingCapabilities.length === 0 && milestone.blockers.length === 0,
      missingCapabilities,
      blockers: [...milestone.blockers],
    };
  }

  transition(input: {
    milestoneId: string;
    state: MilestoneState;
    updatedAt: string;
    completionEvidence?: string[];
  }): RoadmapMilestone {
    timestampSchema.parse(input.updatedAt);
    const milestone = this.#require(input.milestoneId);
    if (!allowedTransitions[milestone.state].includes(input.state))
      throw new Error(`Invalid milestone transition from ${milestone.state} to ${input.state}.`);
    if (
      ["ready", "in-progress", "complete"].includes(input.state) &&
      !this.readiness(input.milestoneId).ready
    )
      throw new Error("Milestone prerequisites or blockers are unresolved.");
    if (input.state === "complete" && (input.completionEvidence?.length ?? 0) === 0)
      throw new Error("Completion requires evidence.");
    milestone.state = input.state;
    milestone.updatedAt = input.updatedAt;
    if (input.completionEvidence !== undefined)
      milestone.completionEvidence = [...input.completionEvidence];
    return structuredClone(milestone);
  }

  replaceBlockers(milestoneId: string, blockers: string[]): RoadmapMilestone {
    const milestone = this.#require(milestoneId);
    milestone.blockers = [...blockers];
    return structuredClone(milestone);
  }

  listByPhase(phaseId: string): RoadmapMilestone[] {
    return [...this.#milestones.values()]
      .filter((milestone) => milestone.phaseId === phaseId)
      .sort((left, right) => left.milestoneId.localeCompare(right.milestoneId))
      .map((milestone) => structuredClone(milestone));
  }

  #require(milestoneId: string): RoadmapMilestone {
    const milestone = this.#milestones.get(milestoneId);
    if (milestone === undefined) throw new Error("Unknown milestone.");
    return milestone;
  }
}
