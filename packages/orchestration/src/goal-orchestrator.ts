import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { timestampSchema } from "@stoic-iris/contracts";
import { z } from "zod";

const identifierSchema = z.string().regex(/^[a-z][a-z0-9._-]{2,127}$/);
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const safeRelativePathSchema = z
  .string()
  .min(1)
  .max(1000)
  .transform((value) => value.replaceAll("\\", "/").replace(/^\.\//, ""))
  .refine((value) => !value.startsWith("/") && !/^[A-Za-z]:\//.test(value))
  .refine((value) => !value.split("/").includes(".."));
const boundedTextSchema = z.string().trim().min(1).max(4000);
const capabilitySchema = z.string().regex(/^[a-z][a-z0-9.-]{1,99}$/);

export const goalContextItemSchema = z.strictObject({
  sourceId: identifierSchema,
  kind: z.enum(["governance", "repository", "memory", "evidence", "steering"]),
  text: z.string().min(1).max(50_000),
});
export type GoalContextItem = z.infer<typeof goalContextItemSchema>;

export const goalTaskSchema = z.strictObject({
  taskId: identifierSchema,
  title: z.string().trim().min(1).max(200),
  objective: boundedTextSchema,
  dependsOn: z.array(identifierSchema).max(50),
  workerRole: z.string().trim().min(1).max(100),
  requiredCapabilities: z.array(capabilitySchema).max(30),
  readPaths: z.array(safeRelativePathSchema).max(100),
  writePaths: z.array(safeRelativePathSchema).max(100),
  context: z.array(goalContextItemSchema).max(100),
  completionCriteria: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
  reviewerRequired: z.boolean(),
  maxAttempts: z.number().int().min(1).max(5),
});
export type GoalTask = z.infer<typeof goalTaskSchema>;

export const goalDefinitionSchema = z.strictObject({
  goalId: identifierSchema,
  objective: boundedTextSchema,
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
  completionCriteria: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
  maxParallel: z.number().int().min(1).max(8),
  contextBudgetChars: z.number().int().min(500).max(50_000),
  tasks: z.array(goalTaskSchema).min(1).max(100),
});
export type GoalDefinition = z.infer<typeof goalDefinitionSchema>;

export const goalStatusSchema = z.enum([
  "queued",
  "running",
  "paused",
  "blocked",
  "completed",
  "cancelled",
  "failed",
]);
export type GoalStatus = z.infer<typeof goalStatusSchema>;

export const goalTaskStatusSchema = z.enum([
  "pending",
  "running",
  "reviewing",
  "recovery-ready",
  "completed",
  "cancelled",
  "failed",
]);
export type GoalTaskStatus = z.infer<typeof goalTaskStatusSchema>;

export const compactedContextSchema = z.strictObject({
  summary: z.string().max(50_000),
  sourceCount: z.number().int().nonnegative(),
  retainedCharacters: z.number().int().nonnegative(),
  truncated: z.boolean(),
  digest: digestSchema,
});
export type CompactedContext = z.infer<typeof compactedContextSchema>;

export const goalWorkerResultSchema = z.strictObject({
  outcome: z.enum(["succeeded", "failed"]),
  workerActorId: identifierSchema,
  safeSummary: z.string().trim().min(1).max(2000),
  changedPaths: z.array(safeRelativePathSchema).max(100),
  evidence: z.array(z.string().trim().min(1).max(1000)).min(1).max(100),
  outputDigest: digestSchema,
});
export type GoalWorkerResult = z.infer<typeof goalWorkerResultSchema>;

export const goalReviewResultSchema = z.strictObject({
  verdict: z.enum(["pass", "revise"]),
  reviewerActorId: identifierSchema,
  findings: z.array(z.string().trim().min(1).max(1000)).max(50),
  evidence: z.array(z.string().trim().min(1).max(1000)).min(1).max(100),
});
export type GoalReviewResult = z.infer<typeof goalReviewResultSchema>;

export interface GoalWorkerRequest {
  goalId: string;
  goalObjective: string;
  task: GoalTask;
  attempt: number;
  context: CompactedContext;
  steering: string[];
}

export interface GoalWorkerRunner {
  execute(request: GoalWorkerRequest, signal: AbortSignal): Promise<GoalWorkerResult>;
}

export interface GoalReviewerRequest {
  goalId: string;
  task: GoalTask;
  attempt: number;
  workerResult: GoalWorkerResult;
  completionCriteria: string[];
}

export interface GoalReviewerRunner {
  review(request: GoalReviewerRequest, signal: AbortSignal): Promise<GoalReviewResult>;
}

export const goalEventSchema = z.strictObject({
  sequence: z.number().int().positive(),
  eventId: identifierSchema,
  type: z.enum([
    "GoalCreated",
    "GoalStarted",
    "GoalPaused",
    "GoalResumed",
    "GoalSteered",
    "GoalCancelled",
    "GoalBlocked",
    "GoalCompleted",
    "GoalFailed",
    "TaskStarted",
    "TaskRetryScheduled",
    "TaskReviewStarted",
    "TaskCompleted",
    "TaskFailed",
    "TaskInterrupted",
  ]),
  goalId: identifierSchema,
  taskId: identifierSchema.optional(),
  occurredAt: timestampSchema,
  summary: z.string().trim().min(1).max(2000),
  previousDigest: digestSchema.optional(),
  digest: digestSchema,
});
export type GoalEvent = z.infer<typeof goalEventSchema>;

export const goalTaskRuntimeSchema = z.strictObject({
  definition: goalTaskSchema,
  status: goalTaskStatusSchema,
  attempts: z.number().int().nonnegative().max(5),
  steering: z.array(z.string().trim().min(1).max(500)).max(20),
  contextDigest: digestSchema.optional(),
  workerActorId: identifierSchema.optional(),
  reviewerActorId: identifierSchema.optional(),
  safeSummary: z.string().max(2000).optional(),
  changedPaths: z.array(safeRelativePathSchema).max(100),
  evidence: z.array(z.string().trim().min(1).max(1000)).max(200),
  lastError: z.string().max(2000).optional(),
});
export type GoalTaskRuntime = z.infer<typeof goalTaskRuntimeSchema>;

export const goalSnapshotSchema = z.strictObject({
  definition: goalDefinitionSchema,
  status: goalStatusSchema,
  tasks: z.array(goalTaskRuntimeSchema).min(1).max(100),
  preflight: z.strictObject({
    accepted: z.boolean(),
    availableCapabilities: z.array(capabilitySchema).max(200),
    requiredCapabilities: z.array(capabilitySchema).max(200),
  }),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  events: z.array(goalEventSchema).max(20_000),
});
export type GoalSnapshot = z.infer<typeof goalSnapshotSchema>;

export interface GoalStore {
  load(goalId: string): Promise<GoalSnapshot | undefined>;
  save(snapshot: GoalSnapshot): Promise<void>;
}

export class MemoryGoalStore implements GoalStore {
  readonly #snapshots = new Map<string, GoalSnapshot>();

  load(goalId: string): Promise<GoalSnapshot | undefined> {
    const snapshot = this.#snapshots.get(goalId);
    return Promise.resolve(snapshot === undefined ? undefined : structuredClone(snapshot));
  }

  save(snapshot: GoalSnapshot): Promise<void> {
    this.#snapshots.set(snapshot.definition.goalId, structuredClone(snapshot));
    return Promise.resolve();
  }
}

export class FileGoalStore implements GoalStore {
  readonly #root: string;

  constructor(root: string) {
    this.#root = resolve(root);
  }

  async load(goalId: string): Promise<GoalSnapshot | undefined> {
    const path = this.#path(goalId);
    try {
      return goalSnapshotSchema.parse(JSON.parse(await readFile(path, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async save(snapshot: GoalSnapshot): Promise<void> {
    const parsed = goalSnapshotSchema.parse(snapshot);
    await mkdir(this.#root, { recursive: true });
    const path = this.#path(parsed.definition.goalId);
    const temporary = `${path}.${String(process.pid)}.tmp`;
    await writeFile(temporary, `${JSON.stringify(parsed, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, path);
  }

  #path(goalId: string): string {
    return join(this.#root, `${identifierSchema.parse(goalId)}.json`);
  }
}

export interface GoalOrchestratorOptions {
  store: GoalStore;
  worker: GoalWorkerRunner;
  reviewer?: GoalReviewerRunner;
  availableCapabilities: string[];
  maximumParallelWorkers: number;
  now: () => Date;
  id?: (kind: "event") => string;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`;
}

function normalizedPath(value: string): string {
  return safeRelativePathSchema.parse(value).replace(/\/$/, "");
}

function pathWithin(target: string, permitted: string): boolean {
  const normalizedTarget = normalizedPath(target);
  const normalizedPermitted = normalizedPath(permitted);
  return (
    normalizedTarget === normalizedPermitted ||
    normalizedTarget.startsWith(`${normalizedPermitted}/`)
  );
}

function pathsOverlap(left: string, right: string): boolean {
  return pathWithin(left, right) || pathWithin(right, left);
}

function secretLike(value: string): boolean {
  return /github_pat_|ghp_[A-Za-z0-9]{20,}|(?:password|api[_-]?key|access[_-]?token)\s*[:=]/i.test(
    value,
  );
}

export function compactGoalContext(items: GoalContextItem[], budget: number): CompactedContext {
  const parsed = items.map((item) => goalContextItemSchema.parse(item));
  let remaining = Math.max(0, budget);
  const summaries: string[] = [];
  let retainedCharacters = 0;
  let truncated = false;
  for (const item of parsed) {
    if (secretLike(item.text)) throw new Error("GOAL_CONTEXT_SECRET_LIKE_TEXT_DENIED");
    const prefix = `[${item.kind}:${item.sourceId}] `;
    if (remaining <= prefix.length) {
      truncated = true;
      continue;
    }
    const normalized = item.text.replace(/\s+/g, " ").trim();
    const retained = normalized.slice(0, Math.max(0, remaining - prefix.length));
    summaries.push(`${prefix}${retained}`);
    retainedCharacters += retained.length;
    remaining -= prefix.length + retained.length + 1;
    if (retained.length < normalized.length) truncated = true;
  }
  const summary = summaries.join("\n");
  return compactedContextSchema.parse({
    summary,
    sourceCount: parsed.length,
    retainedCharacters,
    truncated,
    digest: digest({ sources: parsed.map((item) => item.sourceId), summary }),
  });
}

function dependencyClosure(
  tasks: GoalTask[],
  taskId: string,
  seen = new Set<string>(),
): Set<string> {
  const task = tasks.find((candidate) => candidate.taskId === taskId);
  if (task === undefined) return seen;
  for (const dependency of task.dependsOn) {
    if (!seen.has(dependency)) {
      seen.add(dependency);
      dependencyClosure(tasks, dependency, seen);
    }
  }
  return seen;
}

export function validateGoalDefinition(input: GoalDefinition): GoalDefinition {
  const definition = goalDefinitionSchema.parse(input);
  if (Date.parse(definition.expiresAt) <= Date.parse(definition.createdAt))
    throw new Error("GOAL_EXPIRY_INVALID");
  const identifiers = new Set(definition.tasks.map((task) => task.taskId));
  if (identifiers.size !== definition.tasks.length) throw new Error("GOAL_TASK_ID_DUPLICATE");
  for (const task of definition.tasks) {
    if (task.dependsOn.includes(task.taskId)) throw new Error("GOAL_DEPENDENCY_CYCLE");
    if (task.dependsOn.some((dependency) => !identifiers.has(dependency)))
      throw new Error("GOAL_DEPENDENCY_MISSING");
  }
  for (const task of definition.tasks) {
    const closure = dependencyClosure(definition.tasks, task.taskId);
    if (closure.has(task.taskId)) throw new Error("GOAL_DEPENDENCY_CYCLE");
  }
  for (let leftIndex = 0; leftIndex < definition.tasks.length; leftIndex += 1) {
    const left = definition.tasks[leftIndex];
    if (left === undefined) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < definition.tasks.length; rightIndex += 1) {
      const right = definition.tasks[rightIndex];
      if (right === undefined) continue;
      const overlap = left.writePaths.some((leftPath) =>
        right.writePaths.some((rightPath) => pathsOverlap(leftPath, rightPath)),
      );
      const ordered =
        dependencyClosure(definition.tasks, left.taskId).has(right.taskId) ||
        dependencyClosure(definition.tasks, right.taskId).has(left.taskId);
      if (overlap && !ordered)
        throw new Error(`GOAL_WRITE_CONFLICT:${left.taskId}:${right.taskId}`);
    }
  }
  return definition;
}

export function verifyGoalEventChain(events: GoalEvent[]): boolean {
  return events.every((entry, index) => {
    const previous = events[index - 1];
    const { digest: actual, ...unsigned } = entry;
    return unsigned.previousDigest === previous?.digest && digest(unsigned) === actual;
  });
}

export class GoalOrchestrator {
  readonly #store: GoalStore;
  readonly #worker: GoalWorkerRunner;
  readonly #reviewer: GoalReviewerRunner | undefined;
  readonly #availableCapabilities: Set<string>;
  readonly #maximumParallelWorkers: number;
  readonly #now: () => Date;
  readonly #id: (kind: "event") => string;
  readonly #controllers = new Map<string, AbortController>();
  readonly #runs = new Map<string, Promise<GoalSnapshot>>();

  constructor(options: GoalOrchestratorOptions) {
    if (!Number.isInteger(options.maximumParallelWorkers) || options.maximumParallelWorkers < 1)
      throw new Error("GOAL_PARALLEL_LIMIT_INVALID");
    this.#store = options.store;
    this.#worker = options.worker;
    this.#reviewer = options.reviewer;
    this.#availableCapabilities = new Set(
      options.availableCapabilities.map((capability) => capabilitySchema.parse(capability)),
    );
    this.#maximumParallelWorkers = Math.min(options.maximumParallelWorkers, 8);
    this.#now = options.now;
    let sequence = 0;
    this.#id = options.id ?? (() => `event_goal-${String(++sequence).padStart(8, "0")}`);
  }

  async create(input: GoalDefinition): Promise<GoalSnapshot> {
    const definition = validateGoalDefinition(input);
    if (await this.#store.load(definition.goalId)) throw new Error("GOAL_ALREADY_EXISTS");
    if (definition.maxParallel > this.#maximumParallelWorkers)
      throw new Error("GOAL_PARALLEL_LIMIT_EXCEEDED");
    if (Date.parse(definition.expiresAt) <= this.#now().getTime()) throw new Error("GOAL_EXPIRED");
    const requiredCapabilities = [
      ...new Set(definition.tasks.flatMap((task) => task.requiredCapabilities)),
    ].sort();
    const missing = requiredCapabilities.filter(
      (capability) => !this.#availableCapabilities.has(capability),
    );
    if (missing.length > 0)
      throw new Error(`GOAL_CAPABILITY_PREFLIGHT_FAILED:${missing.join(",")}`);
    const now = this.#timestamp();
    const snapshot: GoalSnapshot = {
      definition,
      status: "queued",
      tasks: definition.tasks.map((task) => ({
        definition: task,
        status: "pending",
        attempts: 0,
        steering: [],
        changedPaths: [],
        evidence: [],
      })),
      preflight: {
        accepted: true,
        availableCapabilities: [...this.#availableCapabilities].sort(),
        requiredCapabilities,
      },
      createdAt: now,
      updatedAt: now,
      events: [],
    };
    this.#appendEvent(snapshot, "GoalCreated", "Goal accepted after capability preflight.");
    await this.#save(snapshot);
    return structuredClone(snapshot);
  }

  async state(goalId: string): Promise<GoalSnapshot> {
    const snapshot = await this.#required(goalId);
    if (!verifyGoalEventChain(snapshot.events)) throw new Error("GOAL_EVENT_CHAIN_INVALID");
    return structuredClone(snapshot);
  }

  async restore(goalId: string): Promise<GoalSnapshot> {
    const snapshot = await this.#required(goalId);
    if (!verifyGoalEventChain(snapshot.events)) throw new Error("GOAL_EVENT_CHAIN_INVALID");
    let recovered = false;
    for (const task of snapshot.tasks) {
      if (task.status === "running" || task.status === "reviewing") {
        task.status = "recovery-ready";
        task.lastError = "Interrupted process recovered from durable state.";
        recovered = true;
      }
    }
    if (snapshot.status === "running") {
      snapshot.status = "paused";
      recovered = true;
    }
    if (recovered) {
      this.#appendEvent(snapshot, "GoalPaused", "Interrupted goal recovered in a paused state.");
      await this.#save(snapshot);
    }
    return structuredClone(snapshot);
  }

  run(goalId: string): Promise<GoalSnapshot> {
    const existing = this.#runs.get(goalId);
    if (existing !== undefined) return existing;
    const running = this.#drive(goalId).finally(() => this.#runs.delete(goalId));
    this.#runs.set(goalId, running);
    return running;
  }

  async pause(goalId: string): Promise<GoalSnapshot> {
    const snapshot = await this.#required(goalId);
    if (snapshot.status !== "running") throw new Error("GOAL_NOT_RUNNING");
    snapshot.status = "paused";
    this.#appendEvent(snapshot, "GoalPaused", "Founder paused the goal.");
    this.#abortGoal(goalId);
    await this.#save(snapshot);
    return structuredClone(snapshot);
  }

  async resume(goalId: string): Promise<GoalSnapshot> {
    const snapshot = await this.#required(goalId);
    if (snapshot.status !== "paused" && snapshot.status !== "blocked")
      throw new Error("GOAL_NOT_RESUMABLE");
    if (Date.parse(snapshot.definition.expiresAt) <= this.#now().getTime())
      throw new Error("GOAL_EXPIRED");
    for (const task of snapshot.tasks) {
      if (task.status === "recovery-ready") task.status = "pending";
    }
    snapshot.status = "running";
    this.#appendEvent(snapshot, "GoalResumed", "Founder resumed the goal.");
    await this.#save(snapshot);
    return await this.run(goalId);
  }

  async cancel(goalId: string): Promise<GoalSnapshot> {
    const snapshot = await this.#required(goalId);
    if (["completed", "cancelled", "failed"].includes(snapshot.status))
      return structuredClone(snapshot);
    snapshot.status = "cancelled";
    for (const task of snapshot.tasks) {
      if (!["completed", "failed"].includes(task.status)) task.status = "cancelled";
    }
    this.#appendEvent(snapshot, "GoalCancelled", "Founder cancelled the goal.");
    this.#abortGoal(goalId);
    await this.#save(snapshot);
    return structuredClone(snapshot);
  }

  async steer(goalId: string, instruction: string, taskId?: string): Promise<GoalSnapshot> {
    const bounded = z.string().trim().min(1).max(500).parse(instruction);
    if (secretLike(bounded)) throw new Error("GOAL_STEERING_SECRET_LIKE_TEXT_DENIED");
    const snapshot = await this.#required(goalId);
    if (!["running", "paused", "blocked"].includes(snapshot.status))
      throw new Error("GOAL_NOT_STEERABLE");
    const targets =
      taskId === undefined
        ? snapshot.tasks.filter((task) => task.status !== "completed")
        : snapshot.tasks.filter((task) => task.definition.taskId === taskId);
    if (targets.length === 0) throw new Error("GOAL_TASK_NOT_FOUND");
    for (const task of targets) {
      if (task.steering.length >= 20) throw new Error("GOAL_STEERING_LIMIT_EXCEEDED");
      task.steering.push(bounded);
      if (task.status === "running" || task.status === "reviewing")
        this.#controllers.get(this.#controllerKey(goalId, task.definition.taskId))?.abort();
    }
    this.#appendEvent(
      snapshot,
      "GoalSteered",
      taskId === undefined ? "Founder steered remaining goal tasks." : "Founder steered one task.",
      taskId,
    );
    await this.#save(snapshot);
    return structuredClone(snapshot);
  }

  async #drive(goalId: string): Promise<GoalSnapshot> {
    let snapshot = await this.#required(goalId);
    if (snapshot.status === "queued") {
      snapshot.status = "running";
      this.#appendEvent(snapshot, "GoalStarted", "Goal execution started.");
      await this.#save(snapshot);
    }
    while (snapshot.status === "running") {
      if (Date.parse(snapshot.definition.expiresAt) <= this.#now().getTime()) {
        snapshot.status = "failed";
        this.#appendEvent(snapshot, "GoalFailed", "Goal expired before completion.");
        await this.#save(snapshot);
        break;
      }
      const incomplete = snapshot.tasks.filter((task) => task.status !== "completed");
      if (incomplete.length === 0) {
        snapshot.status = "completed";
        this.#appendEvent(snapshot, "GoalCompleted", "Every task and review completed.");
        await this.#save(snapshot);
        break;
      }
      if (incomplete.some((task) => task.status === "failed")) {
        snapshot.status = "failed";
        this.#appendEvent(snapshot, "GoalFailed", "A task exhausted its bounded repair attempts.");
        await this.#save(snapshot);
        break;
      }
      const completed = new Set(
        snapshot.tasks
          .filter((task) => task.status === "completed")
          .map((task) => task.definition.taskId),
      );
      const ready = snapshot.tasks.filter(
        (task) =>
          (task.status === "pending" || task.status === "recovery-ready") &&
          task.definition.dependsOn.every((dependency) => completed.has(dependency)),
      );
      if (ready.length === 0) {
        snapshot.status = "blocked";
        this.#appendEvent(snapshot, "GoalBlocked", "No task can advance within the current graph.");
        await this.#save(snapshot);
        break;
      }
      const selected = ready.slice(0, snapshot.definition.maxParallel);
      await Promise.all(selected.map((task) => this.#executeTask(goalId, task.definition.taskId)));
      snapshot = await this.#required(goalId);
    }
    return structuredClone(snapshot);
  }

  async #executeTask(goalId: string, taskId: string): Promise<void> {
    let snapshot = await this.#required(goalId);
    if (snapshot.status !== "running") return;
    let task = this.#task(snapshot, taskId);
    task.status = "running";
    task.attempts += 1;
    task.lastError = undefined;
    const context = compactGoalContext(
      task.definition.context,
      snapshot.definition.contextBudgetChars,
    );
    task.contextDigest = context.digest;
    this.#appendEvent(
      snapshot,
      "TaskStarted",
      `Task attempt ${String(task.attempts)} started.`,
      taskId,
    );
    await this.#save(snapshot);
    const controller = new AbortController();
    const key = this.#controllerKey(goalId, taskId);
    this.#controllers.set(key, controller);
    try {
      const result = goalWorkerResultSchema.parse(
        await this.#worker.execute(
          {
            goalId,
            goalObjective: snapshot.definition.objective,
            task: task.definition,
            attempt: task.attempts,
            context,
            steering: [...task.steering],
          },
          controller.signal,
        ),
      );
      snapshot = await this.#required(goalId);
      task = this.#task(snapshot, taskId);
      if (snapshot.status !== "running") return;
      const unauthorizedPath = result.changedPaths.find(
        (path) => !task.definition.writePaths.some((allowed) => pathWithin(path, allowed)),
      );
      if (unauthorizedPath !== undefined) {
        await this.#retryOrFail(snapshot, task, "Worker reported an out-of-scope write.");
        return;
      }
      if (result.outcome === "failed") {
        await this.#retryOrFail(snapshot, task, result.safeSummary);
        return;
      }
      task.workerActorId = result.workerActorId;
      task.safeSummary = result.safeSummary;
      task.changedPaths = result.changedPaths;
      task.evidence.push(...result.evidence);
      if (task.definition.reviewerRequired) {
        if (this.#reviewer === undefined) {
          await this.#retryOrFail(snapshot, task, "Independent reviewer is unavailable.");
          return;
        }
        task.status = "reviewing";
        this.#appendEvent(snapshot, "TaskReviewStarted", "Independent review started.", taskId);
        await this.#save(snapshot);
        const review = goalReviewResultSchema.parse(
          await this.#reviewer.review(
            {
              goalId,
              task: task.definition,
              attempt: task.attempts,
              workerResult: result,
              completionCriteria: task.definition.completionCriteria,
            },
            controller.signal,
          ),
        );
        snapshot = await this.#required(goalId);
        task = this.#task(snapshot, taskId);
        if (review.reviewerActorId === result.workerActorId) {
          await this.#retryOrFail(snapshot, task, "Producer cannot independently review itself.");
          return;
        }
        task.reviewerActorId = review.reviewerActorId;
        task.evidence.push(...review.evidence);
        if (review.verdict === "revise") {
          for (const finding of review.findings) {
            if (task.steering.length < 20) task.steering.push(`Reviewer finding: ${finding}`);
          }
          await this.#retryOrFail(snapshot, task, "Independent review requested revision.");
          return;
        }
      }
      task.status = "completed";
      task.lastError = undefined;
      this.#appendEvent(snapshot, "TaskCompleted", "Task completed with evidence.", taskId);
      await this.#save(snapshot);
    } catch (error) {
      snapshot = await this.#required(goalId);
      task = this.#task(snapshot, taskId);
      if (controller.signal.aborted) {
        if (snapshot.status === "running") task.status = "recovery-ready";
        else if (snapshot.status === "paused") task.status = "recovery-ready";
        this.#appendEvent(
          snapshot,
          "TaskInterrupted",
          "Task interrupted for safe recovery.",
          taskId,
        );
        await this.#save(snapshot);
        return;
      }
      await this.#retryOrFail(
        snapshot,
        task,
        error instanceof Error ? error.message : "Worker failed safely.",
      );
    } finally {
      this.#controllers.delete(key);
    }
  }

  async #retryOrFail(
    snapshot: GoalSnapshot,
    task: GoalTaskRuntime,
    message: string,
  ): Promise<void> {
    task.lastError = message.slice(0, 2000);
    if (task.attempts < task.definition.maxAttempts && snapshot.status === "running") {
      task.status = "pending";
      this.#appendEvent(
        snapshot,
        "TaskRetryScheduled",
        "Task scheduled for bounded repair.",
        task.definition.taskId,
      );
    } else {
      task.status = "failed";
      this.#appendEvent(
        snapshot,
        "TaskFailed",
        "Task exhausted its bounded attempts.",
        task.definition.taskId,
      );
    }
    await this.#save(snapshot);
  }

  #appendEvent(
    snapshot: GoalSnapshot,
    type: GoalEvent["type"],
    summary: string,
    taskId?: string,
  ): void {
    const previousDigest = snapshot.events.at(-1)?.digest;
    const unsigned = {
      sequence: snapshot.events.length + 1,
      eventId: identifierSchema.parse(this.#id("event")),
      type,
      goalId: snapshot.definition.goalId,
      ...(taskId === undefined ? {} : { taskId }),
      occurredAt: this.#timestamp(),
      summary,
      ...(previousDigest === undefined ? {} : { previousDigest }),
    };
    snapshot.events.push(goalEventSchema.parse({ ...unsigned, digest: digest(unsigned) }));
    snapshot.updatedAt = unsigned.occurredAt;
  }

  async #save(snapshot: GoalSnapshot): Promise<void> {
    if (!verifyGoalEventChain(snapshot.events)) throw new Error("GOAL_EVENT_CHAIN_INVALID");
    await this.#store.save(goalSnapshotSchema.parse(snapshot));
  }

  async #required(goalId: string): Promise<GoalSnapshot> {
    const snapshot = await this.#store.load(identifierSchema.parse(goalId));
    if (snapshot === undefined) throw new Error("GOAL_NOT_FOUND");
    return goalSnapshotSchema.parse(snapshot);
  }

  #task(snapshot: GoalSnapshot, taskId: string): GoalTaskRuntime {
    const task = snapshot.tasks.find((candidate) => candidate.definition.taskId === taskId);
    if (task === undefined) throw new Error("GOAL_TASK_NOT_FOUND");
    return task;
  }

  #abortGoal(goalId: string): void {
    for (const [key, controller] of this.#controllers) {
      if (key.startsWith(`${goalId}:`)) controller.abort();
    }
  }

  #controllerKey(goalId: string, taskId: string): string {
    return `${goalId}:${taskId}`;
  }

  #timestamp(): string {
    return timestampSchema.parse(this.#now().toISOString());
  }
}
