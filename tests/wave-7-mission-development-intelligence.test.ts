import { describe, expect, it } from "vitest";

import {
  RoadmapManager,
  founderOverride,
  planMission,
  recommendDevelopment,
  type DevelopmentCandidate,
  type MissionPlan,
  type RoadmapMilestone,
} from "../packages/planning/src/index.js";

const timestamp = "2026-08-05T09:00:00-06:00";

function mission(): MissionPlan {
  return {
    missionId: "mission_wave-7",
    objective: "Complete a governed fictional capability.",
    createdAt: timestamp,
    tasks: [
      {
        taskId: "task_verify",
        title: "Verify capability",
        objective: "Run bounded verification and preserve evidence.",
        dependsOn: ["task_implement"],
        requiredEvidence: ["test output", "resource cleanup"],
        approvalCheckpoint: "founder-before-canonicalization",
        workerRecommendation: {
          workerClass: "read-only-specialist",
          rationale: "Verification requires no write authority.",
          maximumPermissions: ["read disposable workspace", "run tests"],
        },
      },
      {
        taskId: "task_implement",
        title: "Implement capability",
        objective: "Build the bounded capability.",
        dependsOn: ["task_specify"],
        requiredEvidence: ["source diff"],
        approvalCheckpoint: "founder-before-action",
        workerRecommendation: {
          workerClass: "bounded-coding-worker",
          rationale: "Implementation requires scoped workspace writes.",
          maximumPermissions: ["write disposable workspace"],
        },
      },
      {
        taskId: "task_specify",
        title: "Specify capability",
        objective: "Define the exact acceptance boundary.",
        dependsOn: [],
        requiredEvidence: ["approved specification"],
        approvalCheckpoint: "none",
        workerRecommendation: {
          workerClass: "iris-core",
          rationale: "IRIS Core owns planning.",
          maximumPermissions: ["read canonical governance"],
        },
      },
    ],
  };
}

function milestone(overrides: Partial<RoadmapMilestone> = {}): RoadmapMilestone {
  return {
    milestoneId: "milestone_wave-7",
    phaseId: "phase_development-independence",
    title: "Wave 7",
    state: "planned",
    capabilityDependencies: ["canonical-memory", "repository-intelligence"],
    blockers: [],
    completionEvidence: [],
    updatedAt: timestamp,
    ...overrides,
  };
}

function candidate(overrides: Partial<DevelopmentCandidate> = {}): DevelopmentCandidate {
  return {
    candidateId: "candidate_reusable-foundation",
    title: "Reusable foundation",
    capabilityReturn: 9,
    reuseMultiplier: 10,
    prerequisiteUnlocks: 4,
    risk: 2,
    effort: 6,
    technicalDebtReduction: 5,
    dependencies: ["canonical-memory"],
    evidence: ["repository:docs/architecture/master-dependency-graph.md"],
    domainSpecific: false,
    strengthensIrisCore: true,
    ...overrides,
  };
}

describe("Wave 7 Mission Planner", () => {
  it("orders prerequisites before dependent tasks and exposes evidence and approvals", () => {
    const planned = planMission(mission());
    expect(planned.executionOrder).toEqual(["task_specify", "task_implement", "task_verify"]);
    expect(planned.approvalCheckpoints).toEqual([
      { taskId: "task_verify", checkpoint: "founder-before-canonicalization" },
      { taskId: "task_implement", checkpoint: "founder-before-action" },
    ]);
    expect(
      planned.evidenceRequirements.find((item) => item.taskId === "task_verify")?.evidence,
    ).toContain("resource cleanup");
  });

  it("rejects missing dependencies", () => {
    const input = mission();
    input.tasks[0]?.dependsOn.push("task_missing");
    expect(() => planMission(input)).toThrow(/missing dependency/);
  });

  it("rejects dependency cycles", () => {
    const input = mission();
    input.tasks[2]?.dependsOn.push("task_verify");
    expect(() => planMission(input)).toThrow(/cycle/);
  });
});

describe("Wave 7 Roadmap Manager", () => {
  it("blocks readiness until every capability dependency exists", () => {
    const roadmap = new RoadmapManager();
    roadmap.register(milestone());
    roadmap.recordCapability("canonical-memory");
    expect(roadmap.readiness("milestone_wave-7")).toEqual({
      ready: false,
      missingCapabilities: ["repository-intelligence"],
      blockers: [],
    });
    expect(() =>
      roadmap.transition({ milestoneId: "milestone_wave-7", state: "ready", updatedAt: timestamp }),
    ).toThrow(/prerequisites/);
  });

  it("tracks blockers and permits progress only after they are resolved", () => {
    const roadmap = new RoadmapManager();
    roadmap.register(milestone({ blockers: ["Founder decision pending"] }));
    roadmap.recordCapability("canonical-memory");
    roadmap.recordCapability("repository-intelligence");
    expect(roadmap.readiness("milestone_wave-7").ready).toBe(false);
    roadmap.replaceBlockers("milestone_wave-7", []);
    expect(
      roadmap.transition({ milestoneId: "milestone_wave-7", state: "ready", updatedAt: timestamp })
        .state,
    ).toBe("ready");
  });

  it("requires completion evidence and preserves phase records", () => {
    const roadmap = new RoadmapManager();
    roadmap.register(milestone());
    roadmap.recordCapability("canonical-memory");
    roadmap.recordCapability("repository-intelligence");
    roadmap.transition({ milestoneId: "milestone_wave-7", state: "ready", updatedAt: timestamp });
    roadmap.transition({
      milestoneId: "milestone_wave-7",
      state: "in-progress",
      updatedAt: timestamp,
    });
    expect(() =>
      roadmap.transition({
        milestoneId: "milestone_wave-7",
        state: "complete",
        updatedAt: timestamp,
      }),
    ).toThrow(/evidence/);
    const complete = roadmap.transition({
      milestoneId: "milestone_wave-7",
      state: "complete",
      updatedAt: timestamp,
      completionEvidence: ["repository:test-results"],
    });
    expect(complete.completionEvidence).toEqual(["repository:test-results"]);
    expect(roadmap.listByPhase("phase_development-independence")).toHaveLength(1);
  });
});

describe("Wave 7 Development Intelligence", () => {
  it("prioritizes reusable prerequisite multipliers over isolated features", () => {
    const isolated = candidate({
      candidateId: "candidate_isolated-feature",
      title: "Isolated feature",
      capabilityReturn: 10,
      reuseMultiplier: 1,
      prerequisiteUnlocks: 0,
      effort: 3,
      risk: 1,
      technicalDebtReduction: 0,
      domainSpecific: true,
      strengthensIrisCore: false,
    });
    const recommendations = recommendDevelopment([isolated, candidate()]);
    expect(recommendations.map((item) => item.candidateId)).toEqual([
      "candidate_reusable-foundation",
      "candidate_isolated-feature",
    ]);
    expect(recommendations[0]).toMatchObject({
      classification: "iris-core",
      dependencies: ["canonical-memory"],
      evidence: [expect.stringContaining("master-dependency-graph")],
    });
    expect(recommendations[1]?.classification).toBe("layer-4");
  });

  it("explains risks, dependencies, evidence, and scoring", () => {
    const recommendation = recommendDevelopment([candidate()])[0];
    expect(recommendation?.risks).toEqual(["Risk score 2/10 requires mitigation."]);
    expect(recommendation?.rationale).toMatch(/reuse.*prerequisite.*risk.*effort/i);
  });

  it("reserves strategic-priority overrides exclusively for the Founder", () => {
    const recommendations = recommendDevelopment([
      candidate(),
      candidate({
        candidateId: "candidate_founder-priority",
        title: "Founder priority",
        capabilityReturn: 1,
        reuseMultiplier: 0,
        prerequisiteUnlocks: 0,
      }),
    ]);
    expect(() =>
      founderOverride({
        recommendations,
        selectedCandidateId: "candidate_founder-priority",
        actorType: "iris-core",
        rationale: "Model preference",
      }),
    ).toThrow(/Founder/);
    expect(
      founderOverride({
        recommendations,
        selectedCandidateId: "candidate_founder-priority",
        actorType: "founder",
        rationale: "Founder strategic direction",
      })[0]?.candidateId,
    ).toBe("candidate_founder-priority");
  });
});
