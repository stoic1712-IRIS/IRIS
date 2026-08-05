import {
  RoadmapManager,
  founderOverride,
  planMission,
  recommendDevelopment,
} from "../../packages/planning/dist/index.js";

const timestamp = "2026-08-05T09:00:00-06:00";
const plan = planMission({
  missionId: "mission_wave-8-read-only-lifecycle",
  objective: "Prepare the governed read-only worker lifecycle before any coding worker exists.",
  createdAt: timestamp,
  tasks: [
    {
      taskId: "task_verify-read-only-lifecycle",
      title: "Verify read-only lifecycle",
      objective:
        "Prove identity, minimum permissions, output collection, termination, and cleanup.",
      dependsOn: ["task_specify-worker-contract"],
      requiredEvidence: ["read-only lifecycle result", "cleanup result", "zero-resource result"],
      approvalCheckpoint: "founder-before-canonicalization",
      workerRecommendation: {
        workerClass: "read-only-specialist",
        rationale: "The first lifecycle must not receive write authority.",
        maximumPermissions: ["read synthetic workspace", "publish bounded result"],
      },
    },
    {
      taskId: "task_specify-worker-contract",
      title: "Specify worker contract",
      objective:
        "Define identity, mission, reasoning, permissions, memory, tools, resources, success, and cleanup.",
      dependsOn: [],
      requiredEvidence: ["approved worker contract specification"],
      approvalCheckpoint: "founder-before-action",
      workerRecommendation: {
        workerClass: "iris-core",
        rationale: "IRIS Core owns worker authorization boundaries.",
        maximumPermissions: ["read canonical governance", "draft proposal"],
      },
    },
  ],
});

const recommendations = recommendDevelopment([
  {
    candidateId: "candidate_worker-contract-foundation",
    title: "Worker contract and read-only lifecycle",
    capabilityReturn: 10,
    reuseMultiplier: 10,
    prerequisiteUnlocks: 7,
    risk: 4,
    effort: 7,
    technicalDebtReduction: 5,
    dependencies: ["canonical-memory", "mission-planner", "roadmap-manager"],
    evidence: ["repository:docs/architecture/master-dependency-graph.md"],
    domainSpecific: false,
    strengthensIrisCore: true,
  },
  {
    candidateId: "candidate_isolated-domain-app",
    title: "Fictional isolated domain application",
    capabilityReturn: 8,
    reuseMultiplier: 1,
    prerequisiteUnlocks: 0,
    risk: 3,
    effort: 5,
    technicalDebtReduction: 0,
    dependencies: [],
    evidence: ["repository:docs/governance/governing-architecture-reconciliation.md"],
    domainSpecific: true,
    strengthensIrisCore: false,
  },
]);

const roadmap = new RoadmapManager();
roadmap.register({
  milestoneId: "milestone_wave-8-read-only-lifecycle",
  phaseId: "phase_development-independence",
  title: "Wave 8 read-only worker lifecycle",
  state: "planned",
  capabilityDependencies: ["canonical-memory", "mission-planner", "roadmap-manager"],
  blockers: [],
  completionEvidence: [],
  updatedAt: timestamp,
});
for (const capability of ["canonical-memory", "mission-planner", "roadmap-manager"])
  roadmap.recordCapability(capability);

process.stdout.write(
  `${JSON.stringify(
    {
      status: "ready",
      nextMission: plan.objective,
      executionOrder: plan.executionOrder,
      approvals: plan.approvalCheckpoints,
      roadmapReadiness: roadmap.readiness("milestone_wave-8-read-only-lifecycle"),
      recommendations,
      founderAuthorityProof: founderOverride({
        recommendations,
        selectedCandidateId: recommendations[0].candidateId,
        actorType: "founder",
        rationale: "Founder retains strategic priority authority.",
      })[0].candidateId,
    },
    null,
    2,
  )}\n`,
);
