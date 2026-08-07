import { createHash } from "node:crypto";

import { z } from "zod";

import { sha256Schema } from "./contracts.js";

export type DeliveryOrdinaryCapability =
  | "repository.inspect"
  | "repository.edit-bounded"
  | "terminal.run-approved"
  | "repository.commit-candidate"
  | "repository.push-branch"
  | "repository.create-pull-request"
  | "repository.monitor-ci"
  | "repository.address-review"
  | "repository.verify-remote"
  | "workspace.cleanup";

export interface CompleteDeliveryAccessAuthorizer {
  authorize(requestId: string, capability: DeliveryOrdinaryCapability): unknown;
}

const timestampSchema = z.iso.datetime();
const commitSchema = z.string().regex(/^[a-f0-9]{40}$/u);
const repositorySchema = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u);
const safePathSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((path) => !path.startsWith("/") && !/^[A-Za-z]:/u.test(path))
  .refine((path) => !path.split(/[\\/]/u).includes(".."))
  .refine((path) => path !== ".git" && !path.startsWith(".git/"));

export const completeDeliveryObjectiveSchema = z
  .object({
    deliveryId: z.string().regex(/^delivery_[a-z0-9-]{8,100}$/u),
    accessRequestId: z.string().regex(/^access_[a-z0-9-]{8,100}$/u),
    repository: repositorySchema,
    baseRevision: commitSchema,
    branch: z.string().regex(/^iris\/[a-z0-9][a-z0-9/-]{7,180}$/u),
    objective: z.string().trim().min(10).max(5_000),
    readPaths: z.array(safePathSchema).min(1).max(100),
    writePaths: z.array(safePathSchema).min(1).max(50),
    verificationCommands: z
      .array(z.array(z.string().min(1).max(500)).min(1).max(30))
      .min(1)
      .max(20),
    maximumRepairAttempts: z.number().int().min(0).max(5),
    maximumChangedFiles: z.number().int().min(1).max(50),
    maximumChangedBytes: z.number().int().min(1).max(2_000_000),
    createdAt: timestampSchema,
    expiresAt: timestampSchema,
    budgetUsd: z.literal(0),
  })
  .strict();
export type CompleteDeliveryObjective = z.infer<typeof completeDeliveryObjectiveSchema>;

export const completeDeliveryStateSchema = z.enum([
  "received",
  "inspecting",
  "planning",
  "workspace-ready",
  "implementing",
  "verifying",
  "reviewing",
  "repairing",
  "committing",
  "pushing",
  "pull-request-created",
  "monitoring-ci",
  "addressing-review",
  "preparing-merge",
  "verifying-remote",
  "cleaning",
  "ready-for-merge-approval",
  "paused",
  "recovery-ready",
  "cancelled",
  "denied",
]);
export type CompleteDeliveryState = z.infer<typeof completeDeliveryStateSchema>;

export const completeDeliveryReviewSchema = z
  .object({
    reviewerId: z.string().min(1).max(200),
    verdict: z.enum(["pass", "repair"]),
    findings: z.array(z.string().min(1).max(2_000)).max(50),
  })
  .strict();
export type CompleteDeliveryReview = z.infer<typeof completeDeliveryReviewSchema>;

export const completeDeliveryEventSchema = z
  .object({
    sequence: z.number().int().positive(),
    state: completeDeliveryStateSchema,
    summary: z.string().min(1).max(2_000),
    occurredAt: timestampSchema,
    previousDigest: sha256Schema.optional(),
    digest: sha256Schema,
  })
  .strict();
export type CompleteDeliveryEvent = z.infer<typeof completeDeliveryEventSchema>;

export interface CompleteDeliverySession {
  objective: CompleteDeliveryObjective;
  state: CompleteDeliveryState;
  summary: string;
  repairAttempt: number;
  workerId?: string;
  reviewerId?: string;
  workspaceId?: string;
  changedPaths: string[];
  candidateCommit?: string;
  pullRequest?: { number: number; url: string; headCommit: string };
  ci?: { conclusion: "success" | "failure"; checks: string[] };
  remoteEqualityVerified: boolean;
  cleanupVerified: boolean;
  mergeApprovalStatement?: string;
  events: CompleteDeliveryEvent[];
  updatedAt: string;
}

export interface CompleteDeliveryStore {
  load(deliveryId: string): Promise<CompleteDeliverySession | null>;
  save(session: CompleteDeliverySession): Promise<void>;
}

export class MemoryCompleteDeliveryStore implements CompleteDeliveryStore {
  readonly #sessions = new Map<string, CompleteDeliverySession>();

  load(deliveryId: string): Promise<CompleteDeliverySession | null> {
    const session = this.#sessions.get(deliveryId);
    return Promise.resolve(session === undefined ? null : structuredClone(session));
  }

  save(session: CompleteDeliverySession): Promise<void> {
    this.#sessions.set(session.objective.deliveryId, structuredClone(session));
    return Promise.resolve();
  }
}

export interface CompleteDeliveryAdapter {
  inspect(
    objective: CompleteDeliveryObjective,
    signal: AbortSignal,
  ): Promise<{ contextDigest: string }>;
  plan(
    objective: CompleteDeliveryObjective,
    inspection: { contextDigest: string },
    signal: AbortSignal,
  ): Promise<{ planDigest: string; workerId: string }>;
  createWorkspace(objective: CompleteDeliveryObjective): Promise<{ workspaceId: string }>;
  implement(
    objective: CompleteDeliveryObjective,
    workspaceId: string,
    planDigest: string,
    signal: AbortSignal,
  ): Promise<{ changedPaths: string[]; changedBytes: number }>;
  verify(
    objective: CompleteDeliveryObjective,
    workspaceId: string,
    signal: AbortSignal,
  ): Promise<{ passed: boolean; checks: string[] }>;
  review(
    objective: CompleteDeliveryObjective,
    workspaceId: string,
    workerId: string,
    signal: AbortSignal,
  ): Promise<CompleteDeliveryReview>;
  repair(
    objective: CompleteDeliveryObjective,
    workspaceId: string,
    findings: string[],
    signal: AbortSignal,
  ): Promise<void>;
  commit(
    objective: CompleteDeliveryObjective,
    workspaceId: string,
    signal: AbortSignal,
  ): Promise<{ commit: string }>;
  pushBranch(
    objective: CompleteDeliveryObjective,
    workspaceId: string,
    commit: string,
    signal: AbortSignal,
  ): Promise<{ remoteCommit: string }>;
  createPullRequest(
    objective: CompleteDeliveryObjective,
    commit: string,
    signal: AbortSignal,
  ): Promise<{ number: number; url: string; headCommit: string }>;
  monitorCi(
    objective: CompleteDeliveryObjective,
    pullRequestNumber: number,
    signal: AbortSignal,
  ): Promise<{ conclusion: "success" | "failure"; checks: string[] }>;
  addressReview(
    objective: CompleteDeliveryObjective,
    workspaceId: string,
    pullRequestNumber: number,
    signal: AbortSignal,
  ): Promise<{ changed: boolean }>;
  prepareMerge(
    objective: CompleteDeliveryObjective,
    pullRequestNumber: number,
    expectedHeadCommit: string,
    signal: AbortSignal,
  ): Promise<{ mergeable: boolean; approvalStatement: string }>;
  verifyRemoteEquality(
    objective: CompleteDeliveryObjective,
    commit: string,
    signal: AbortSignal,
  ): Promise<boolean>;
  cleanup(objective: CompleteDeliveryObjective, workspaceId: string): Promise<boolean>;
}

const requiredCapabilities: readonly DeliveryOrdinaryCapability[] = [
  "repository.inspect",
  "repository.edit-bounded",
  "terminal.run-approved",
  "repository.commit-candidate",
  "repository.push-branch",
  "repository.create-pull-request",
  "repository.monitor-ci",
  "repository.address-review",
  "repository.verify-remote",
  "workspace.cleanup",
];

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

function within(path: string, roots: readonly string[]): boolean {
  return roots.some((root) => path === root || path.startsWith(`${root.replace(/\/$/u, "")}/`));
}

export class CompleteSoftwareDeliveryRuntime {
  readonly #access: CompleteDeliveryAccessAuthorizer;
  readonly #adapter: CompleteDeliveryAdapter;
  readonly #store: CompleteDeliveryStore;
  readonly #now: () => Date;

  constructor(options: {
    access: CompleteDeliveryAccessAuthorizer;
    adapter: CompleteDeliveryAdapter;
    store: CompleteDeliveryStore;
    now?: () => Date;
  }) {
    this.#access = options.access;
    this.#adapter = options.adapter;
    this.#store = options.store;
    this.#now = options.now ?? (() => new Date());
  }

  async start(
    input: CompleteDeliveryObjective,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<CompleteDeliverySession> {
    const objective = completeDeliveryObjectiveSchema.parse(input);
    if (await this.#store.load(objective.deliveryId)) throw new Error("DELIVERY_ID_REPLAY");
    const now = this.#now().getTime();
    if (Date.parse(objective.createdAt) > now || Date.parse(objective.expiresAt) <= now)
      throw new Error("DELIVERY_OBJECTIVE_EXPIRED");
    if (new Set(objective.writePaths).size !== objective.writePaths.length)
      throw new Error("DELIVERY_WRITE_PATH_DUPLICATE");
    for (const capability of requiredCapabilities)
      this.#access.authorize(objective.accessRequestId, capability);
    const session: CompleteDeliverySession = {
      objective,
      state: "received",
      summary: "Governed software-delivery objective received.",
      repairAttempt: 0,
      changedPaths: [],
      remoteEqualityVerified: false,
      cleanupVerified: false,
      events: [],
      updatedAt: this.#now().toISOString(),
    };
    await this.#transition(session, "received", session.summary);
    return this.#run(session, signal);
  }

  async resume(
    deliveryId: string,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<CompleteDeliverySession> {
    const session = await this.#store.load(deliveryId);
    if (session === null) throw new Error("DELIVERY_NOT_FOUND");
    if (!this.#eventsVerified(session.events)) throw new Error("DELIVERY_EVENT_CHAIN_INVALID");
    if (!new Set<CompleteDeliveryState>(["paused", "recovery-ready"]).has(session.state))
      throw new Error("DELIVERY_NOT_RESUMABLE");
    if (Date.parse(session.objective.expiresAt) <= this.#now().getTime())
      throw new Error("DELIVERY_OBJECTIVE_EXPIRED");
    for (const capability of requiredCapabilities)
      this.#access.authorize(session.objective.accessRequestId, capability);
    return this.#run(session, signal);
  }

  async cancel(deliveryId: string): Promise<CompleteDeliverySession> {
    const session = await this.#store.load(deliveryId);
    if (session === null) throw new Error("DELIVERY_NOT_FOUND");
    if (session.workspaceId !== undefined && !session.cleanupVerified)
      session.cleanupVerified = await this.#adapter.cleanup(session.objective, session.workspaceId);
    await this.#transition(
      session,
      "cancelled",
      "Founder cancelled delivery; cleanup was attempted.",
    );
    return structuredClone(session);
  }

  session(deliveryId: string): Promise<CompleteDeliverySession | null> {
    return this.#store.load(deliveryId);
  }

  async #run(
    session: CompleteDeliverySession,
    signal: AbortSignal,
  ): Promise<CompleteDeliverySession> {
    try {
      if (isAborted(signal)) return await this.#pause(session);
      await this.#transition(session, "inspecting", "Inspecting the exact repository boundary.");
      const inspection = await this.#adapter.inspect(session.objective, signal);
      sha256Schema.parse(inspection.contextDigest);
      if (isAborted(signal)) return await this.#pause(session);

      await this.#transition(session, "planning", "Planning the bounded implementation.");
      const plan = await this.#adapter.plan(session.objective, inspection, signal);
      sha256Schema.parse(plan.planDigest);
      session.workerId = z.string().min(1).max(200).parse(plan.workerId);

      if (session.workspaceId === undefined) {
        const workspace = await this.#adapter.createWorkspace(session.objective);
        session.workspaceId = z.string().min(1).max(300).parse(workspace.workspaceId);
      }
      await this.#transition(session, "workspace-ready", "Disposable workspace is ready.");

      for (;;) {
        if (isAborted(signal)) return await this.#pause(session);
        await this.#transition(
          session,
          session.repairAttempt === 0 ? "implementing" : "repairing",
          session.repairAttempt === 0
            ? "Implementing the bounded plan."
            : `Applying governed repair ${String(session.repairAttempt)}.`,
        );
        const implementation = await this.#adapter.implement(
          session.objective,
          session.workspaceId,
          plan.planDigest,
          signal,
        );
        const changedPaths = [...new Set(implementation.changedPaths)].sort();
        if (
          changedPaths.length === 0 ||
          changedPaths.length > session.objective.maximumChangedFiles
        )
          throw new Error("DELIVERY_CHANGED_FILE_LIMIT");
        if (implementation.changedBytes > session.objective.maximumChangedBytes)
          throw new Error("DELIVERY_CHANGED_BYTE_LIMIT");
        for (const path of changedPaths)
          if (!within(path, session.objective.writePaths))
            throw new Error(`DELIVERY_CHANGED_PATH_DENIED:${path}`);
        session.changedPaths = changedPaths;

        await this.#transition(session, "verifying", "Running every exact verification command.");
        const verification = await this.#adapter.verify(
          session.objective,
          session.workspaceId,
          signal,
        );
        if (!verification.passed) {
          if (session.repairAttempt >= session.objective.maximumRepairAttempts)
            throw new Error("DELIVERY_VERIFICATION_REPAIR_LIMIT");
          session.repairAttempt += 1;
          await this.#adapter.repair(
            session.objective,
            session.workspaceId,
            ["Automated verification failed."],
            signal,
          );
          continue;
        }

        await this.#transition(
          session,
          "reviewing",
          "Independent reviewer is inspecting the exact candidate.",
        );
        const review = completeDeliveryReviewSchema.parse(
          await this.#adapter.review(
            session.objective,
            session.workspaceId,
            session.workerId,
            signal,
          ),
        );
        if (review.reviewerId === session.workerId) throw new Error("DELIVERY_SELF_REVIEW_DENIED");
        session.reviewerId = review.reviewerId;
        if (review.verdict === "repair") {
          if (session.repairAttempt >= session.objective.maximumRepairAttempts)
            throw new Error("DELIVERY_REVIEW_REPAIR_LIMIT");
          session.repairAttempt += 1;
          await this.#adapter.repair(
            session.objective,
            session.workspaceId,
            review.findings,
            signal,
          );
          continue;
        }
        break;
      }

      await this.#transition(session, "committing", "Creating a local candidate commit.");
      const committed = await this.#adapter.commit(session.objective, session.workspaceId, signal);
      session.candidateCommit = commitSchema.parse(committed.commit);

      await this.#transition(
        session,
        "pushing",
        "Publishing the exact candidate branch non-force.",
      );
      const pushed = await this.#adapter.pushBranch(
        session.objective,
        session.workspaceId,
        session.candidateCommit,
        signal,
      );
      if (pushed.remoteCommit !== session.candidateCommit)
        throw new Error("DELIVERY_PUSH_REMOTE_MISMATCH");

      await this.#transition(session, "pull-request-created", "Creating the bounded pull request.");
      session.pullRequest = await this.#adapter.createPullRequest(
        session.objective,
        session.candidateCommit,
        signal,
      );
      if (session.pullRequest.headCommit !== session.candidateCommit)
        throw new Error("DELIVERY_PULL_REQUEST_HEAD_MISMATCH");

      await this.#transition(session, "monitoring-ci", "Monitoring pull-request checks.");
      session.ci = await this.#adapter.monitorCi(
        session.objective,
        session.pullRequest.number,
        signal,
      );
      if (session.ci.conclusion !== "success") throw new Error("DELIVERY_CI_FAILED");

      await this.#transition(session, "addressing-review", "Checking provider review state.");
      const addressed = await this.#adapter.addressReview(
        session.objective,
        session.workspaceId,
        session.pullRequest.number,
        signal,
      );
      if (addressed.changed) throw new Error("DELIVERY_REVIEW_CHANGED_HEAD_REQUIRES_NEW_BOUND_RUN");

      await this.#transition(
        session,
        "preparing-merge",
        "Preparing, but not executing, the protected merge.",
      );
      const prepared = await this.#adapter.prepareMerge(
        session.objective,
        session.pullRequest.number,
        session.candidateCommit,
        signal,
      );
      if (!prepared.mergeable) throw new Error("DELIVERY_NOT_MERGEABLE");
      session.mergeApprovalStatement = z
        .string()
        .min(1)
        .max(10_000)
        .parse(prepared.approvalStatement);

      await this.#transition(
        session,
        "verifying-remote",
        "Verifying provider-authoritative branch equality.",
      );
      session.remoteEqualityVerified = await this.#adapter.verifyRemoteEquality(
        session.objective,
        session.candidateCommit,
        signal,
      );
      if (!session.remoteEqualityVerified) throw new Error("DELIVERY_REMOTE_EQUALITY_FAILED");

      await this.#transition(
        session,
        "cleaning",
        "Removing the disposable implementation workspace.",
      );
      session.cleanupVerified = await this.#adapter.cleanup(session.objective, session.workspaceId);
      if (!session.cleanupVerified) throw new Error("DELIVERY_CLEANUP_FAILED");

      await this.#transition(
        session,
        "ready-for-merge-approval",
        "Ordinary delivery is complete; protected merge awaits separate exact approval.",
      );
      return structuredClone(session);
    } catch (error) {
      if (isAborted(signal)) return await this.#pause(session);
      await this.#transition(
        session,
        session.workspaceId === undefined ? "denied" : "recovery-ready",
        error instanceof Error ? error.message : "Delivery failed safely.",
      );
      return structuredClone(session);
    }
  }

  async #pause(session: CompleteDeliverySession): Promise<CompleteDeliverySession> {
    await this.#transition(session, "paused", "Delivery paused with resumable evidence preserved.");
    return structuredClone(session);
  }

  async #transition(
    session: CompleteDeliverySession,
    state: CompleteDeliveryState,
    summary: string,
  ): Promise<void> {
    session.state = state;
    session.summary = summary;
    session.updatedAt = this.#now().toISOString();
    const unsigned = {
      sequence: session.events.length + 1,
      state,
      summary,
      occurredAt: session.updatedAt,
      ...(session.events.at(-1) === undefined
        ? {}
        : { previousDigest: session.events.at(-1)?.digest }),
    };
    session.events.push(
      completeDeliveryEventSchema.parse({ ...unsigned, digest: digest(unsigned) }),
    );
    await this.#store.save(session);
  }

  #eventsVerified(events: readonly CompleteDeliveryEvent[]): boolean {
    return events.every((event, index) => {
      const { digest: actual, ...unsigned } = event;
      return unsigned.previousDigest === events[index - 1]?.digest && digest(unsigned) === actual;
    });
  }
}
