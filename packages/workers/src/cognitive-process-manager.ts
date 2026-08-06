import {
  workerSpecificationDigest,
  workerSpecificationSchema,
  type WorkerContext,
  type WorkerSpecification,
} from "./worker-contracts.js";
import {
  verifyCodingWorkerAuthorization,
  type CodingWorkerAuthorization,
} from "./coding-worker-authorization.js";

export interface WorkerRuntimeResult {
  status: "succeeded" | "failed";
  output: Record<string, unknown>;
  reportedTools: string[];
  reportedPaths: string[];
  summary: string;
}
export interface WorkerRuntimeAdapter {
  readonly provider: string;
  prepare(
    specification: WorkerSpecification,
  ): Promise<{ workspaceId: string; readOnly: boolean; disposable: boolean }>;
  launch(
    specification: WorkerSpecification,
    context: WorkerContext,
    workspaceId: string,
    signal: AbortSignal,
  ): Promise<WorkerRuntimeResult>;
  terminate(workerId: string): Promise<void>;
  cleanup(workspaceId: string): Promise<boolean>;
}
export type WorkerLifecycleEventType =
  | "WorkerSpecified"
  | "WorkerStarted"
  | "WorkerOutputCollected"
  | "WorkerDenied"
  | "WorkerFailed"
  | "WorkerTerminated"
  | "WorkerCleanupVerified";
export interface WorkerLifecycleEvent {
  type: WorkerLifecycleEventType;
  workerId: string;
  occurredAt: string;
  summary: string;
}
export interface WorkerExecutionResult {
  status: "succeeded" | "failed" | "denied" | "timed-out" | "revoked";
  output: Record<string, unknown>;
  cleanupVerified: boolean;
  summary: string;
}

export class CognitiveProcessManager {
  readonly #adapter: WorkerRuntimeAdapter;
  readonly #now: () => string;
  readonly #publish: (event: WorkerLifecycleEvent) => Promise<void>;
  readonly #revoked = new Set<string>();

  constructor(options: {
    adapter: WorkerRuntimeAdapter;
    now: () => string;
    publish: (event: WorkerLifecycleEvent) => Promise<void>;
  }) {
    this.#adapter = options.adapter;
    this.#now = options.now;
    this.#publish = options.publish;
  }

  revoke(workerId: string): void {
    this.#revoked.add(workerId);
  }

  async execute(
    specificationInput: WorkerSpecification,
    context: WorkerContext,
    codingApproval?: {
      authorization: CodingWorkerAuthorization;
      typedStatement: string;
      now?: Date;
    },
  ): Promise<WorkerExecutionResult> {
    const specification = workerSpecificationSchema.parse(specificationInput);
    const approvedDigest = workerSpecificationDigest(specification);
    await this.#emit(
      "WorkerSpecified",
      specification.workerId,
      `Specification fixed at ${approvedDigest}.`,
    );
    if (this.#revoked.has(specification.workerId))
      return this.#denied(
        specification.workerId,
        "Worker authorization was revoked before launch.",
        "revoked",
      );
    if (
      specification.workerClass === "coding" &&
      (codingApproval === undefined ||
        !verifyCodingWorkerAuthorization({
          specification,
          authorization: codingApproval.authorization,
          typedStatement: codingApproval.typedStatement,
          ...(codingApproval.now === undefined ? {} : { now: codingApproval.now }),
        }))
    )
      return this.#denied(
        specification.workerId,
        "Coding worker approval did not exactly match the fixed specification.",
      );
    const workspace = await this.#adapter.prepare(structuredClone(specification));
    let cleanupVerified: boolean;
    let outcome: Omit<WorkerExecutionResult, "cleanupVerified">;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (
        !workspace.disposable ||
        (specification.workerClass === "read-only" && !workspace.readOnly) ||
        (specification.workerClass === "coding" && workspace.readOnly)
      )
        throw new Error("Worker workspace mode does not match the fixed specification.");
      await this.#emit(
        "WorkerStarted",
        specification.workerId,
        `Started through ${this.#adapter.provider}.`,
      );
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("WORKER_TIMEOUT"));
        }, specification.resources.timeoutMs);
      });
      const result = await Promise.race([
        this.#adapter.launch(
          structuredClone(specification),
          structuredClone(context),
          workspace.workspaceId,
          controller.signal,
        ),
        timeout,
      ]);
      if (this.#revoked.has(specification.workerId)) {
        outcome = {
          status: "revoked",
          output: {},
          summary: "Worker authorization was revoked during execution.",
        };
      } else {
        if (workerSpecificationDigest(specification) !== approvedDigest)
          throw new Error("Worker specification changed during execution.");
        if (result.reportedTools.some((tool) => !specification.permissions.tools.includes(tool)))
          throw new Error("Worker reported a tool outside its permissions.");
        if (
          result.reportedPaths.some(
            (path) =>
              ![
                ...specification.permissions.readPaths,
                ...specification.permissions.writePaths,
              ].some(
                (allowed) => path === allowed || path.startsWith(`${allowed.replace(/\/$/, "")}/`),
              ),
          )
        )
          throw new Error("Worker reported a path outside its permissions.");
        if (specification.success.requiredOutputFields.some((field) => !(field in result.output)))
          throw new Error("Worker output omitted a required field.");
        await this.#emit("WorkerOutputCollected", specification.workerId, result.summary);
        outcome = {
          status: result.status,
          output: structuredClone(result.output),
          summary: result.summary,
        };
      }
    } catch (error) {
      const timedOut = error instanceof Error && error.message === "WORKER_TIMEOUT";
      await this.#emit(
        "WorkerFailed",
        specification.workerId,
        timedOut ? "Worker exceeded its timeout." : "Worker failed within its governed boundary.",
      );
      outcome = {
        status: timedOut ? "timed-out" : "failed",
        output: {},
        summary: timedOut ? "Worker exceeded its timeout." : "Worker failed safely.",
      };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      await this.#adapter.terminate(specification.workerId);
      await this.#emit("WorkerTerminated", specification.workerId, "Worker terminated.");
      cleanupVerified = await this.#adapter.cleanup(workspace.workspaceId);
      if (cleanupVerified)
        await this.#emit(
          "WorkerCleanupVerified",
          specification.workerId,
          "Disposable workspace cleanup verified.",
        );
    }
    if (!cleanupVerified)
      return {
        status: "failed",
        output: {},
        cleanupVerified: false,
        summary: "Worker workspace cleanup could not be verified.",
      };
    return { ...outcome, cleanupVerified };
  }

  async #denied(
    workerId: string,
    summary: string,
    status: "denied" | "revoked" = "denied",
  ): Promise<WorkerExecutionResult> {
    await this.#emit("WorkerDenied", workerId, summary);
    return { status, output: {}, cleanupVerified: true, summary };
  }

  #emit(type: WorkerLifecycleEventType, workerId: string, summary: string): Promise<void> {
    return this.#publish({ type, workerId, occurredAt: this.#now(), summary });
  }
}
