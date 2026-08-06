import { createHash } from "node:crypto";

import { timestampSchema } from "@stoic-iris/contracts";
import { z } from "zod";

export const liveWorkerKindSchema = z.enum([
  "complex-coding",
  "evidence-research",
  "learning-tutor",
  "website-builder",
]);
export type LiveWorkerKind = z.infer<typeof liveWorkerKindSchema>;

export const liveWorkerStateSchema = z.enum([
  "queued",
  "planning",
  "executing",
  "reviewing",
  "paused",
  "completed",
  "failed",
  "stopped",
]);
export type LiveWorkerState = z.infer<typeof liveWorkerStateSchema>;

export const standingWorkerGrantSchema = z
  .object({
    grantId: z.string().regex(/^grant_live-[a-z0-9-]{8,100}$/u),
    tools: z
      .array(z.enum(["filesystem.list", "filesystem.read", "research.search", "browser.inspect"]))
      .max(10),
    maximumSteps: z.number().int().min(1).max(12),
    timeoutMs: z.number().int().min(10_000).max(300_000),
    expiresAt: timestampSchema,
    budgetUsd: z.literal(0),
    externalMutation: z.literal(false),
    mayExpand: z.literal(false),
  })
  .strict();
export type StandingWorkerGrant = z.infer<typeof standingWorkerGrantSchema>;

export const activateLiveWorkerSchema = z
  .object({
    kind: liveWorkerKindSchema,
    objective: z.string().trim().min(10).max(5_000),
    grant: standingWorkerGrantSchema,
  })
  .strict();
export type ActivateLiveWorker = z.infer<typeof activateLiveWorkerSchema>;

export const liveWorkerRecordSchema = z
  .object({
    workerId: z.string().regex(/^worker_live-[a-z0-9-]{8,100}$/u),
    kind: liveWorkerKindSchema,
    objective: z.string().min(10).max(5_000),
    state: liveWorkerStateSchema,
    attempt: z.number().int().min(1).max(100),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    grant: standingWorkerGrantSchema,
    steering: z.array(z.string().trim().min(1).max(2_000)).max(20),
    model: z.string().min(1).max(200).nullable(),
    summary: z.string().max(12_000),
    deliverable: z.string().max(24_000),
    requiresApproval: z.boolean(),
  })
  .strict();
export type LiveWorkerRecord = z.infer<typeof liveWorkerRecordSchema>;

export const liveWorkerEventSchema = z
  .object({
    sequence: z.number().int().positive(),
    eventId: z.string().regex(/^event_live-[a-z0-9-]{8,100}$/u),
    workerId: z.string().regex(/^worker_live-[a-z0-9-]{8,100}$/u),
    type: z.enum([
      "activated",
      "state-changed",
      "progress",
      "steered",
      "paused",
      "resumed",
      "stopped",
      "completed",
      "failed",
    ]),
    state: liveWorkerStateSchema,
    occurredAt: timestampSchema,
    summary: z.string().min(1).max(2_000),
    previousDigest: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/u)
      .optional(),
    digest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  })
  .strict();
export type LiveWorkerEvent = z.infer<typeof liveWorkerEventSchema>;

export interface LiveWorkerExecutionResult {
  model: string;
  summary: string;
  deliverable: string;
  requiresApproval: boolean;
}

export interface LiveWorkerExecutor {
  execute(
    worker: LiveWorkerRecord,
    signal: AbortSignal,
    progress: (state: "planning" | "executing" | "reviewing", summary: string) => void,
  ): Promise<LiveWorkerExecutionResult>;
}

interface SupervisorOptions {
  executor: LiveWorkerExecutor;
  now?: () => Date;
  id?: (kind: "worker" | "event") => string;
  maximumWorkers?: number;
  maximumEvents?: number;
}

function digest(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function terminal(state: LiveWorkerState): boolean {
  return state === "completed" || state === "failed" || state === "stopped";
}

export class LiveWorkerSupervisor {
  readonly #executor: LiveWorkerExecutor;
  readonly #now: () => Date;
  readonly #id: NonNullable<SupervisorOptions["id"]>;
  readonly #maximumWorkers: number;
  readonly #maximumEvents: number;
  readonly #workers = new Map<string, LiveWorkerRecord>();
  readonly #events: LiveWorkerEvent[] = [];
  #eventAnchorDigest: string | undefined;
  #nextEventSequence = 1;
  readonly #controllers = new Map<string, AbortController>();
  readonly #running = new Set<string>();
  readonly #restart = new Set<string>();

  constructor(options: SupervisorOptions) {
    this.#executor = options.executor;
    this.#now = options.now ?? (() => new Date());
    this.#id = options.id ?? ((kind) => `${kind}_live-${crypto.randomUUID().toLowerCase()}`);
    this.#maximumWorkers = options.maximumWorkers ?? 20;
    this.#maximumEvents = options.maximumEvents ?? 1_000;
  }

  activate(candidate: unknown): LiveWorkerRecord {
    const input = activateLiveWorkerSchema.parse(candidate);
    if (Date.parse(input.grant.expiresAt) <= this.#now().getTime())
      throw new Error("LIVE_WORKER_GRANT_EXPIRED");
    if (
      [...this.#workers.values()].filter((worker) => !terminal(worker.state)).length >=
      this.#maximumWorkers
    )
      throw new Error("LIVE_WORKER_CAPACITY_REACHED");
    const occurredAt = timestampSchema.parse(this.#now().toISOString());
    const worker = liveWorkerRecordSchema.parse({
      workerId: this.#id("worker"),
      kind: input.kind,
      objective: input.objective,
      state: "queued",
      attempt: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      grant: input.grant,
      steering: [],
      model: null,
      summary: "Queued for IRIS supervision.",
      deliverable: "",
      requiresApproval: false,
    });
    this.#workers.set(worker.workerId, worker);
    this.#record(
      worker,
      "activated",
      "Worker activated under a zero-cost read-only standing grant.",
    );
    this.#schedule(worker.workerId);
    return structuredClone(worker);
  }

  workers(): LiveWorkerRecord[] {
    return [...this.#workers.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((worker) => structuredClone(worker));
  }

  worker(workerId: string): LiveWorkerRecord | undefined {
    const worker = this.#workers.get(workerId);
    return worker === undefined ? undefined : structuredClone(worker);
  }

  events(afterSequence = 0): LiveWorkerEvent[] {
    return this.#events
      .filter((event) => event.sequence > afterSequence)
      .map((event) => structuredClone(event));
  }

  pause(workerId: string): LiveWorkerRecord {
    const worker = this.#require(workerId);
    if (terminal(worker.state)) throw new Error("LIVE_WORKER_TERMINAL");
    worker.state = "paused";
    worker.updatedAt = timestampSchema.parse(this.#now().toISOString());
    worker.summary = "Paused by the Founder.";
    this.#restart.delete(workerId);
    this.#controllers.get(workerId)?.abort();
    this.#record(worker, "paused", worker.summary);
    return structuredClone(worker);
  }

  resume(workerId: string): LiveWorkerRecord {
    const worker = this.#require(workerId);
    if (worker.state !== "paused") throw new Error("LIVE_WORKER_NOT_PAUSED");
    if (Date.parse(worker.grant.expiresAt) <= this.#now().getTime())
      throw new Error("LIVE_WORKER_GRANT_EXPIRED");
    worker.state = "queued";
    worker.attempt += 1;
    worker.updatedAt = timestampSchema.parse(this.#now().toISOString());
    worker.summary = "Resumed under the unchanged standing grant.";
    this.#record(worker, "resumed", worker.summary);
    if (this.#running.has(workerId)) this.#restart.add(workerId);
    this.#schedule(workerId);
    return structuredClone(worker);
  }

  stop(workerId: string): LiveWorkerRecord {
    const worker = this.#require(workerId);
    if (terminal(worker.state)) return structuredClone(worker);
    worker.state = "stopped";
    worker.updatedAt = timestampSchema.parse(this.#now().toISOString());
    worker.summary = "Stopped by the Founder.";
    this.#restart.delete(workerId);
    this.#controllers.get(workerId)?.abort();
    this.#record(worker, "stopped", worker.summary);
    return structuredClone(worker);
  }

  steer(workerId: string, instruction: string): LiveWorkerRecord {
    const worker = this.#require(workerId);
    if (terminal(worker.state)) throw new Error("LIVE_WORKER_TERMINAL");
    const steering = z.string().trim().min(1).max(2_000).parse(instruction);
    if (worker.steering.length >= 20) throw new Error("LIVE_WORKER_STEERING_LIMIT");
    worker.steering.push(steering);
    worker.updatedAt = timestampSchema.parse(this.#now().toISOString());
    this.#record(worker, "steered", "Founder steering was appended without expanding authority.");
    if (worker.state !== "paused" && this.#running.has(workerId)) {
      worker.state = "queued";
      worker.attempt += 1;
      worker.summary = "Restarting from the latest Founder steering.";
      this.#restart.add(workerId);
      this.#controllers.get(workerId)?.abort();
    }
    return structuredClone(worker);
  }

  verifyEventChain(): boolean {
    return this.#events.every((event, index) => {
      const { digest: actual, ...unsigned } = event;
      return (
        unsigned.previousDigest ===
          (index === 0 ? this.#eventAnchorDigest : this.#events[index - 1]?.digest) &&
        digest(unsigned) === actual
      );
    });
  }

  #schedule(workerId: string): void {
    if (this.#running.has(workerId)) return;
    queueMicrotask(() => {
      void this.#run(workerId);
    });
  }

  async #run(workerId: string): Promise<void> {
    const worker = this.#require(workerId);
    if (this.#running.has(workerId) || worker.state !== "queued") return;
    if (Date.parse(worker.grant.expiresAt) <= this.#now().getTime()) {
      this.#fail(worker, "Standing grant expired before execution.");
      return;
    }
    this.#running.add(workerId);
    const controller = new AbortController();
    this.#controllers.set(workerId, controller);
    try {
      this.#transition(worker, "planning", "IRIS is planning the bounded worker run.");
      const result = await this.#executor.execute(
        structuredClone(worker),
        controller.signal,
        (state, summary) => {
          if (controller.signal.aborted || terminal(worker.state) || worker.state === "paused")
            return;
          this.#transition(worker, state, summary, "progress");
        },
      );
      if (controller.signal.aborted) return;
      this.#transition(worker, "reviewing", "IRIS is reviewing the worker deliverable.");
      worker.model = z.string().min(1).max(200).parse(result.model);
      worker.summary = z.string().min(1).max(12_000).parse(result.summary);
      worker.deliverable = z.string().min(1).max(24_000).parse(result.deliverable);
      worker.requiresApproval = result.requiresApproval;
      worker.state = "completed";
      worker.updatedAt = timestampSchema.parse(this.#now().toISOString());
      this.#record(worker, "completed", worker.summary.slice(0, 2_000));
    } catch (error) {
      if (!controller.signal.aborted)
        this.#fail(worker, error instanceof Error ? error.message : "Worker failed safely.");
    } finally {
      this.#controllers.delete(workerId);
      this.#running.delete(workerId);
      if (this.#restart.delete(workerId) && worker.state === "queued") this.#schedule(workerId);
    }
  }

  #transition(
    worker: LiveWorkerRecord,
    state: "planning" | "executing" | "reviewing",
    summary: string,
    type: LiveWorkerEvent["type"] = "state-changed",
  ): void {
    worker.state = state;
    worker.updatedAt = timestampSchema.parse(this.#now().toISOString());
    worker.summary = z.string().min(1).max(12_000).parse(summary);
    this.#record(worker, type, worker.summary.slice(0, 2_000));
  }

  #fail(worker: LiveWorkerRecord, summary: string): void {
    worker.state = "failed";
    worker.updatedAt = timestampSchema.parse(this.#now().toISOString());
    worker.summary = summary.slice(0, 12_000);
    this.#record(worker, "failed", worker.summary.slice(0, 2_000));
  }

  #require(workerId: string): LiveWorkerRecord {
    const worker = this.#workers.get(workerId);
    if (worker === undefined) throw new Error("LIVE_WORKER_NOT_FOUND");
    return worker;
  }

  #record(worker: LiveWorkerRecord, type: LiveWorkerEvent["type"], summary: string): void {
    const previousDigest = this.#events.at(-1)?.digest;
    const unsigned = {
      sequence: this.#nextEventSequence,
      eventId: this.#id("event"),
      workerId: worker.workerId,
      type,
      state: worker.state,
      occurredAt: timestampSchema.parse(this.#now().toISOString()),
      summary,
      ...(previousDigest === undefined ? {} : { previousDigest }),
    };
    this.#nextEventSequence += 1;
    this.#events.push(liveWorkerEventSchema.parse({ ...unsigned, digest: digest(unsigned) }));
    if (this.#events.length > this.#maximumEvents) {
      const removed = this.#events.splice(0, this.#events.length - this.#maximumEvents);
      this.#eventAnchorDigest = removed.at(-1)?.digest;
    }
  }
}
