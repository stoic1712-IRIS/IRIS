import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  FileGoalStore,
  GoalOrchestrator,
  MemoryGoalStore,
  compactGoalContext,
  validateGoalDefinition,
  verifyGoalEventChain,
  type GoalDefinition,
  type GoalReviewerRunner,
  type GoalTask,
  type GoalWorkerRequest,
  type GoalWorkerRunner,
} from "../packages/orchestration/src/index.js";

const createdAt = "2026-08-07T12:30:00.000Z";
const expiresAt = "2026-08-07T13:30:00.000Z";
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

function definition(overrides: Partial<GoalDefinition> = {}): GoalDefinition {
  return {
    goalId: "goal_cycle-nine-orchestration",
    objective: "Complete a fictional bounded multi-worker objective.",
    createdAt,
    expiresAt,
    completionCriteria: ["Every task is independently verified."],
    maxParallel: 2,
    contextBudgetChars: 1_000,
    tasks: [
      {
        taskId: "task_research",
        title: "Research",
        objective: "Collect bounded evidence.",
        dependsOn: [],
        workerRole: "researcher",
        requiredCapabilities: ["research.search"],
        readPaths: ["docs"],
        writePaths: ["work/research.json"],
        context: [{ sourceId: "source_research", kind: "governance", text: "Research safely." }],
        completionCriteria: ["Evidence is cited."],
        reviewerRequired: true,
        maxAttempts: 2,
      },
      {
        taskId: "task_implement",
        title: "Implement",
        objective: "Create one bounded candidate.",
        dependsOn: [],
        workerRole: "coder",
        requiredCapabilities: ["repository.edit"],
        readPaths: ["src"],
        writePaths: ["work/implementation.ts"],
        context: [
          { sourceId: "source_implementation", kind: "repository", text: "Implement safely." },
        ],
        completionCriteria: ["Candidate passes tests."],
        reviewerRequired: true,
        maxAttempts: 2,
      },
      {
        taskId: "task_integrate",
        title: "Integrate",
        objective: "Integrate verified results.",
        dependsOn: ["task_research", "task_implement"],
        workerRole: "integrator",
        requiredCapabilities: ["repository.edit"],
        readPaths: ["work"],
        writePaths: ["work/final.ts"],
        context: [
          { sourceId: "source_integration", kind: "evidence", text: "Use verified results." },
        ],
        completionCriteria: ["Integrated result passes."],
        reviewerRequired: true,
        maxAttempts: 2,
      },
    ],
    ...overrides,
  };
}

function firstTask(): GoalTask {
  const task = definition().tasks[0];
  if (task === undefined) {
    throw new Error("Cycle Nine fixture is missing its first task.");
  }
  return task;
}

function result(request: GoalWorkerRequest) {
  return {
    outcome: "succeeded" as const,
    workerActorId: `worker_${request.task.taskId}`,
    safeSummary: `${request.task.title} completed.`,
    changedPaths: request.task.writePaths.slice(0, 1),
    evidence: [`evidence:${request.task.taskId}:passed`],
    outputDigest: `sha256:${"a".repeat(64)}`,
  };
}

function passingReviewer(): GoalReviewerRunner {
  return {
    review: (request) =>
      Promise.resolve({
        verdict: "pass",
        reviewerActorId: `reviewer_${request.task.taskId}`,
        findings: [],
        evidence: [`review:${request.task.taskId}:passed`],
      }),
  };
}

function orchestrator(worker: GoalWorkerRunner, reviewer = passingReviewer()) {
  return new GoalOrchestrator({
    store: new MemoryGoalStore(),
    worker,
    reviewer,
    availableCapabilities: ["research.search", "repository.edit"],
    maximumParallelWorkers: 4,
    now: () => new Date(createdAt),
  });
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("Cycle Nine additive goal and multi-agent orchestration", () => {
  it("preflights capabilities before accepting a persistent goal", async () => {
    const runtime = new GoalOrchestrator({
      store: new MemoryGoalStore(),
      worker: { execute: (request) => Promise.resolve(result(request)) },
      reviewer: passingReviewer(),
      availableCapabilities: ["repository.edit"],
      maximumParallelWorkers: 2,
      now: () => new Date(createdAt),
    });
    await expect(runtime.create(definition())).rejects.toThrow(
      "GOAL_CAPABILITY_PREFLIGHT_FAILED:research.search",
    );
  });

  it("rejects missing dependencies, cycles, and unordered overlapping writes", () => {
    const missing = definition();
    missing.tasks[0]?.dependsOn.push("task_missing");
    expect(() => validateGoalDefinition(missing)).toThrow("GOAL_DEPENDENCY_MISSING");

    const cycle = definition();
    cycle.tasks[0]?.dependsOn.push("task_integrate");
    expect(() => validateGoalDefinition(cycle)).toThrow("GOAL_DEPENDENCY_CYCLE");

    const conflict = definition();
    if (conflict.tasks[1]) conflict.tasks[1].writePaths = ["work/research.json"];
    expect(() => validateGoalDefinition(conflict)).toThrow(
      "GOAL_WRITE_CONFLICT:task_research:task_implement",
    );
  });

  it("runs independent workers in parallel and dependencies afterward", async () => {
    let active = 0;
    let maximumActive = 0;
    const order: string[] = [];
    const runtime = orchestrator({
      execute: async (request) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        order.push(`start:${request.task.taskId}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        order.push(`end:${request.task.taskId}`);
        return result(request);
      },
    });
    await runtime.create(definition());
    const completed = await runtime.run("goal_cycle-nine-orchestration");
    expect(completed.status).toBe("completed");
    expect(maximumActive).toBe(2);
    expect(order.indexOf("start:task_integrate")).toBeGreaterThan(
      order.indexOf("end:task_implement"),
    );
    expect(verifyGoalEventChain(completed.events)).toBe(true);
  });

  it("gives each worker separate compacted context", async () => {
    const contexts = new Map<string, string>();
    const runtime = orchestrator({
      execute: (request) => {
        contexts.set(request.task.taskId, request.context.summary);
        return Promise.resolve(result(request));
      },
    });
    await runtime.create(definition({ contextBudgetChars: 500 }));
    await runtime.run("goal_cycle-nine-orchestration");
    expect(contexts.get("task_research")).toContain("Research safely");
    expect(contexts.get("task_research")).not.toContain("Implement safely");
    expect(contexts.get("task_implement")).toContain("Implement safely");
    expect(compactGoalContext(definition().tasks[0]?.context ?? [], 10).truncated).toBe(true);
  });

  it("repairs a reviewer finding and prohibits producer self-review", async () => {
    let reviews = 0;
    const reviewer: GoalReviewerRunner = {
      review: (request) => {
        reviews += 1;
        return Promise.resolve({
          verdict: reviews === 1 ? ("revise" as const) : ("pass" as const),
          reviewerActorId: `reviewer_${request.task.taskId}`,
          findings: reviews === 1 ? ["Add deterministic evidence."] : [],
          evidence: [`review:${String(reviews)}`],
        });
      },
    };
    const runtime = orchestrator(
      { execute: (request) => Promise.resolve(result(request)) },
      reviewer,
    );
    const single = definition({ tasks: [firstTask()] });
    await runtime.create(single);
    const completed = await runtime.run(single.goalId);
    expect(completed.status).toBe("completed");
    expect(completed.tasks[0]).toMatchObject({ attempts: 2, status: "completed" });
    expect(completed.tasks[0]?.steering).toContain("Reviewer finding: Add deterministic evidence.");

    const selfReview = orchestrator(
      { execute: (request) => Promise.resolve(result(request)) },
      {
        review: (request) =>
          Promise.resolve({
            verdict: "pass",
            reviewerActorId: `worker_${request.task.taskId}`,
            findings: [],
            evidence: ["invalid:self-review"],
          }),
      },
    );
    const oneAttempt = definition({
      goalId: "goal_self-review-denial",
      tasks: [{ ...firstTask(), maxAttempts: 1 }],
    });
    await selfReview.create(oneAttempt);
    expect((await selfReview.run(oneAttempt.goalId)).status).toBe("failed");
  });

  it("pauses, steers, resumes, and cancels without widening scope", async () => {
    let calls = 0;
    const seenSteering: string[][] = [];
    const runtime = orchestrator({
      execute: (request, signal) => {
        calls += 1;
        seenSteering.push(request.steering);
        if (calls > 1) return Promise.resolve(result(request));
        return new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
      },
    });
    const single = definition({ tasks: [firstTask()] });
    await runtime.create(single);
    const firstRun = runtime.run(single.goalId);
    await settle();
    await runtime.pause(single.goalId);
    await firstRun;
    await runtime.steer(single.goalId, "Prefer the smaller verified source set.", "task_research");
    const completed = await runtime.resume(single.goalId);
    expect(completed.status).toBe("completed");
    expect(seenSteering[1]).toEqual(["Prefer the smaller verified source set."]);

    const cancellable = definition({ goalId: "goal_cancellable", tasks: [firstTask()] });
    await runtime.create(cancellable);
    expect((await runtime.cancel(cancellable.goalId)).status).toBe("cancelled");
  });

  it("fails closed when a worker reports a write outside its declared scope", async () => {
    const runtime = orchestrator({
      execute: (request) =>
        Promise.resolve({ ...result(request), changedPaths: ["outside/unauthorized.ts"] }),
    });
    const single = definition({
      tasks: [{ ...firstTask(), maxAttempts: 1 }],
    });
    await runtime.create(single);
    const failed = await runtime.run(single.goalId);
    expect(failed.status).toBe("failed");
    expect(failed.tasks[0]?.lastError).toMatch(/out-of-scope/);
  });

  it("recovers interrupted work from an atomic file-backed snapshot", async () => {
    const directory = await mkdtemp(join(tmpdir(), "iris-goal-store-"));
    temporaryDirectories.push(directory);
    const store = new FileGoalStore(directory);
    const runtime = new GoalOrchestrator({
      store,
      worker: { execute: (request) => Promise.resolve(result(request)) },
      reviewer: passingReviewer(),
      availableCapabilities: ["research.search", "repository.edit"],
      maximumParallelWorkers: 4,
      now: () => new Date(createdAt),
    });
    const single = definition({ tasks: [firstTask()] });
    const created = await runtime.create(single);
    created.status = "running";
    const firstCreatedTask = created.tasks[0];
    if (firstCreatedTask === undefined) {
      throw new Error("Created goal is missing its first task.");
    }
    firstCreatedTask.status = "running";
    await store.save(created);

    const restored = await runtime.restore(single.goalId);
    expect(restored.status).toBe("paused");
    expect(restored.tasks[0]?.status).toBe("recovery-ready");
    expect(verifyGoalEventChain(restored.events)).toBe(true);
    expect((await runtime.resume(single.goalId)).status).toBe("completed");
  });

  it("rejects credential-like context and steering before model exposure", async () => {
    expect(() =>
      compactGoalContext(
        [{ sourceId: "source_secret", kind: "memory", text: "api_key=do-not-send" }],
        500,
      ),
    ).toThrow("GOAL_CONTEXT_SECRET_LIKE_TEXT_DENIED");
    const runtime = orchestrator({ execute: (request) => Promise.resolve(result(request)) });
    await runtime.create(definition());
    await expect(runtime.steer(definition().goalId, "password=do-not-send")).rejects.toThrow(
      "GOAL_STEERING_SECRET_LIKE_TEXT_DENIED",
    );
  });
});
