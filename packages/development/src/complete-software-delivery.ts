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
  | "repository.merge-reviewed-head"
  | "repository.synchronize"
  | "repository.rollback-history-preserving"
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
    // Deterministic repository-owned formatters and fixers, run over the changed paths after a
    // model mutation and before verification — the same stage the sibling executable-worker
    // contract already defines. A language model cannot reliably imitate a linter, and asking it
    // to spends the repair budget on mechanical style instead of on defects; the repository's own
    // tool does that work exactly. Verification still runs afterward and must pass on its own, so
    // normalization can never mask a failure.
    normalizationCommands: z
      .array(z.array(z.string().min(1).max(500)).min(1).max(30))
      .max(5)
      .optional(),
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
  "merging",
  "synchronizing",
  "completed",
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
    deliveryId: z.string().regex(/^delivery_[a-z0-9-]{8,100}$/u),
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
  planDigest?: string;
  workspaceId?: string;
  changedPaths: string[];
  candidateCommit?: string;
  pushedCommit?: string;
  mutationKeys: {
    commit?: string;
    push?: string;
    pullRequest?: string;
  };
  pullRequest?: { number: number; url: string; headCommit: string };
  ci?: { conclusion: "success" | "failure"; checks: string[] };
  remoteEqualityVerified: boolean;
  cleanupVerified: boolean;
  mergeApprovalStatement?: string;
  mergedCommit?: string;
  canonicalEqualityVerified?: boolean;
  rollbackEvidenceDigest?: string;
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
  ): Promise<{ passed: boolean; checks: string[][] }>;
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
  ): Promise<{ changedPaths: string[]; changedBytes: number }>;
  commit(
    objective: CompleteDeliveryObjective,
    workspaceId: string,
    idempotencyKey: string,
    signal: AbortSignal,
  ): Promise<{ commit: string }>;
  pushBranch(
    objective: CompleteDeliveryObjective,
    workspaceId: string,
    commit: string,
    idempotencyKey: string,
    signal: AbortSignal,
  ): Promise<{ remoteCommit: string }>;
  createPullRequest(
    objective: CompleteDeliveryObjective,
    commit: string,
    idempotencyKey: string,
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
  ): Promise<{ mergeable: boolean }>;
  verifyRemoteEquality(
    objective: CompleteDeliveryObjective,
    commit: string,
    signal: AbortSignal,
  ): Promise<boolean>;
  cleanup(objective: CompleteDeliveryObjective, workspaceId: string): Promise<boolean>;
  mergeReviewedHead?(
    objective: CompleteDeliveryObjective,
    pullRequestNumber: number,
    expectedHeadCommit: string,
  ): Promise<{
    expectedHeadCommit: string;
    mergeCommit: string;
    providerMainRevision: string;
    branchProtectionHonored: boolean;
    adminBypassUsed: boolean;
    forceUsed: boolean;
  }>;
  synchronizeCanonicalMain?(
    objective: CompleteDeliveryObjective,
    mergeCommit: string,
  ): Promise<{ localMainRevision: string; remoteMainRevision: string }>;
  captureRollbackEvidence?(
    objective: CompleteDeliveryObjective,
    mergeCommit: string,
  ): Promise<{ evidenceDigest: string; historyPreserving: boolean }>;
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

class DeliveryRunSuperseded extends Error {
  constructor() {
    super("DELIVERY_RUN_SUPERSEDED");
  }
}

class DeliveryEffectAborted extends Error {
  constructor() {
    super("DELIVERY_EFFECT_ABORTED");
  }
}

export class CompleteSoftwareDeliveryRuntime {
  readonly #access: CompleteDeliveryAccessAuthorizer;
  readonly #adapter: CompleteDeliveryAdapter;
  readonly #store: CompleteDeliveryStore;
  readonly #now: () => Date;
  readonly #terminationTimeoutMs: number;
  readonly #controllers = new Map<string, AbortController>();
  readonly #versions = new Map<string, number>();
  readonly #terminalSessions = new Map<string, CompleteDeliverySession>();

  constructor(options: {
    access: CompleteDeliveryAccessAuthorizer;
    adapter: CompleteDeliveryAdapter;
    store: CompleteDeliveryStore;
    now?: () => Date;
    terminationTimeoutMs?: number;
  }) {
    this.#access = options.access;
    this.#adapter = options.adapter;
    this.#store = options.store;
    this.#now = options.now ?? (() => new Date());
    this.#terminationTimeoutMs = z
      .number()
      .int()
      .positive()
      .max(5 * 60 * 1_000)
      .parse(options.terminationTimeoutMs ?? 30_000);
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
      mutationKeys: {},
      remoteEqualityVerified: false,
      cleanupVerified: false,
      events: [],
      updatedAt: this.#now().toISOString(),
    };
    await this.#transition(session, "received", session.summary);
    return this.#begin(session, signal);
  }

  async resume(
    deliveryId: string,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<CompleteDeliverySession> {
    const session = await this.#store.load(deliveryId);
    if (session === null) throw new Error("DELIVERY_NOT_FOUND");
    if (!this.#eventsVerified(session.events, deliveryId))
      throw new Error("DELIVERY_EVENT_CHAIN_INVALID");
    if (!new Set<CompleteDeliveryState>(["paused", "recovery-ready"]).has(session.state))
      throw new Error("DELIVERY_NOT_RESUMABLE");
    if (Date.parse(session.objective.expiresAt) <= this.#now().getTime())
      throw new Error("DELIVERY_OBJECTIVE_EXPIRED");
    for (const capability of requiredCapabilities)
      this.#access.authorize(session.objective.accessRequestId, capability);
    return this.#begin(session, signal);
  }

  async cancel(deliveryId: string): Promise<CompleteDeliverySession> {
    const session = await this.#store.load(deliveryId);
    if (session === null) throw new Error("DELIVERY_NOT_FOUND");
    if (
      new Set<CompleteDeliveryState>(["ready-for-merge-approval", "cancelled", "denied"]).has(
        session.state,
      )
    )
      throw new Error("DELIVERY_TERMINAL");
    this.#controllers.get(deliveryId)?.abort();
    this.#versions.set(deliveryId, (this.#versions.get(deliveryId) ?? 0) + 1);
    const cancelled = this.#transition(
      session,
      "cancelled",
      "Founder cancelled delivery; bounded cleanup is pending.",
    );
    this.#terminalSessions.set(deliveryId, structuredClone(session));
    await cancelled;
    if (session.workspaceId !== undefined && !session.cleanupVerified) {
      try {
        session.cleanupVerified = await this.#boundedTermination(session, "workspace.cleanup", () =>
          this.#adapter.cleanup(session.objective, session.workspaceId ?? ""),
        );
        await this.#transition(
          session,
          "cancelled",
          session.cleanupVerified
            ? "Founder cancelled delivery; bounded cleanup verified."
            : "Founder cancelled delivery; bounded cleanup was not verified.",
        );
      } catch (error) {
        await this.#transition(
          session,
          "cancelled",
          `Founder cancelled delivery; cleanup remains unverified: ${error instanceof Error ? error.message : "DELIVERY_TERMINATION_FAILED"}`,
        );
      }
      this.#terminalSessions.set(deliveryId, structuredClone(session));
    }
    return structuredClone(session);
  }

  session(deliveryId: string): Promise<CompleteDeliverySession | null> {
    return this.#store.load(deliveryId);
  }

  async completeUnderFounderAccess(
    deliveryId: string,
    expectedHeadCommit: string,
  ): Promise<CompleteDeliverySession> {
    const session = await this.#store.load(deliveryId);
    if (session === null) throw new Error("DELIVERY_NOT_FOUND");
    if (!this.#eventsVerified(session.events, deliveryId))
      throw new Error("DELIVERY_EVENT_CHAIN_INVALID");
    if (session.state !== "ready-for-merge-approval")
      throw new Error("DELIVERY_NOT_READY_FOR_MERGE");
    commitSchema.parse(expectedHeadCommit);
    if (
      session.candidateCommit !== expectedHeadCommit ||
      session.pushedCommit !== expectedHeadCommit ||
      session.pullRequest?.headCommit !== expectedHeadCommit
    )
      throw new Error("DELIVERY_REVIEWED_HEAD_MISMATCH");
    if (session.ci?.conclusion !== "success") throw new Error("DELIVERY_CI_NOT_SUCCESSFUL");
    if (!session.remoteEqualityVerified || !session.cleanupVerified)
      throw new Error("DELIVERY_PREMERGE_EVIDENCE_INCOMPLETE");
    if (
      this.#adapter.mergeReviewedHead === undefined ||
      this.#adapter.synchronizeCanonicalMain === undefined ||
      this.#adapter.captureRollbackEvidence === undefined
    )
      throw new Error("DELIVERY_FOUNDER_COMPLETION_ADAPTER_UNAVAILABLE");
    try {
      this.#access.authorize(session.objective.accessRequestId, "repository.merge-reviewed-head");
      await this.#transition(session, "merging", "Merging the exact reviewed and pushed head.");
      const merged = await this.#adapter.mergeReviewedHead(
        session.objective,
        session.pullRequest.number,
        expectedHeadCommit,
      );
      if (merged.expectedHeadCommit !== expectedHeadCommit)
        throw new Error("DELIVERY_MERGE_HEAD_MISMATCH");
      if (merged.adminBypassUsed || merged.forceUsed || !merged.branchProtectionHonored)
        throw new Error("DELIVERY_BRANCH_PROTECTION_BYPASS_DENIED");
      session.mergedCommit = commitSchema.parse(merged.mergeCommit);
      if (merged.providerMainRevision !== session.mergedCommit)
        throw new Error("DELIVERY_PROVIDER_MAIN_MISMATCH");
      this.#access.authorize(session.objective.accessRequestId, "repository.synchronize");
      await this.#transition(session, "synchronizing", "Synchronizing canonical local main.");
      const equality = await this.#adapter.synchronizeCanonicalMain(
        session.objective,
        session.mergedCommit,
      );
      session.canonicalEqualityVerified =
        equality.localMainRevision === session.mergedCommit &&
        equality.remoteMainRevision === session.mergedCommit;
      if (!session.canonicalEqualityVerified) throw new Error("DELIVERY_CANONICAL_EQUALITY_FAILED");
      this.#access.authorize(
        session.objective.accessRequestId,
        "repository.rollback-history-preserving",
      );
      const rollback = await this.#adapter.captureRollbackEvidence(
        session.objective,
        session.mergedCommit,
      );
      if (!rollback.historyPreserving)
        throw new Error("DELIVERY_HISTORY_PRESERVING_ROLLBACK_REQUIRED");
      session.rollbackEvidenceDigest = sha256Schema.parse(rollback.evidenceDigest);
      await this.#transition(
        session,
        "completed",
        "Exact reviewed head merged, synchronized, and rollback evidence preserved.",
      );
      return structuredClone(session);
    } catch (error) {
      await this.#transition(
        session,
        "recovery-ready",
        error instanceof Error ? error.message : "DELIVERY_FOUNDER_COMPLETION_FAILED",
      );
      throw error;
    }
  }

  async #begin(
    session: CompleteDeliverySession,
    externalSignal: AbortSignal,
  ): Promise<CompleteDeliverySession> {
    const deliveryId = session.objective.deliveryId;
    if (this.#controllers.has(deliveryId)) throw new Error("DELIVERY_RUN_ALREADY_ACTIVE");
    const controller = new AbortController();
    const version = (this.#versions.get(deliveryId) ?? 0) + 1;
    this.#versions.set(deliveryId, version);
    this.#controllers.set(deliveryId, controller);
    try {
      return await this.#run(
        session,
        AbortSignal.any([externalSignal, controller.signal]),
        version,
      );
    } finally {
      if (this.#versions.get(deliveryId) === version) this.#controllers.delete(deliveryId);
    }
  }

  async #run(
    session: CompleteDeliverySession,
    signal: AbortSignal,
    version: number,
  ): Promise<CompleteDeliverySession> {
    try {
      this.#assertCurrent(session, version);
      if (isAborted(signal)) return await this.#pause(session, version);
      if (session.planDigest === undefined || session.workerId === undefined) {
        await this.#transition(session, "inspecting", "Inspecting the exact repository boundary.");
        const inspection = await this.#effect(session, version, "repository.inspect", signal, () =>
          this.#adapter.inspect(session.objective, signal),
        );
        sha256Schema.parse(inspection.contextDigest);
        if (isAborted(signal)) return await this.#pause(session, version);

        await this.#transition(session, "planning", "Planning the bounded implementation.");
        const plan = await this.#effect(session, version, "repository.inspect", signal, () =>
          this.#adapter.plan(session.objective, inspection, signal),
        );
        session.planDigest = sha256Schema.parse(plan.planDigest);
        session.workerId = z.string().min(1).max(200).parse(plan.workerId);
        await this.#store.save(session);
      }

      if (session.workspaceId === undefined) {
        const workspace = await this.#effect(
          session,
          version,
          "repository.edit-bounded",
          signal,
          () => this.#adapter.createWorkspace(session.objective),
        );
        session.workspaceId = z.string().min(1).max(300).parse(workspace.workspaceId);
        await this.#store.save(session);
      }
      await this.#transition(session, "workspace-ready", "Disposable workspace is ready.");

      if (session.changedPaths.length === 0) {
        await this.#transition(session, "implementing", "Implementing the bounded plan.");
        const implementation = await this.#effect(
          session,
          version,
          "repository.edit-bounded",
          signal,
          () =>
            this.#adapter.implement(
              session.objective,
              session.workspaceId ?? "",
              session.planDigest ?? "",
              signal,
            ),
        );
        session.changedPaths = this.#validatedChanges(session, implementation);
        await this.#store.save(session);
      }

      for (;;) {
        this.#assertCurrent(session, version);
        if (isAborted(signal)) return await this.#pause(session, version);

        await this.#transition(session, "verifying", "Running every exact verification command.");
        const verification = await this.#effect(
          session,
          version,
          "terminal.run-approved",
          signal,
          () => this.#adapter.verify(session.objective, session.workspaceId ?? "", signal),
        );
        if (
          JSON.stringify(verification.checks) !==
          JSON.stringify(session.objective.verificationCommands)
        )
          throw new Error("DELIVERY_VERIFICATION_COMMAND_MISMATCH");
        if (!verification.passed) {
          if (session.repairAttempt >= session.objective.maximumRepairAttempts)
            throw new Error("DELIVERY_VERIFICATION_REPAIR_LIMIT");
          session.repairAttempt += 1;
          await this.#transition(
            session,
            "repairing",
            `Applying governed repair ${String(session.repairAttempt)}.`,
          );
          const repaired = await this.#effect(
            session,
            version,
            "repository.edit-bounded",
            signal,
            () =>
              this.#adapter.repair(
                session.objective,
                session.workspaceId ?? "",
                ["Automated verification failed."],
                signal,
              ),
          );
          session.changedPaths = this.#validatedChanges(session, repaired);
          await this.#store.save(session);
          continue;
        }

        await this.#transition(
          session,
          "reviewing",
          "Independent reviewer is inspecting the exact candidate.",
        );
        const review = completeDeliveryReviewSchema.parse(
          await this.#effect(session, version, "repository.inspect", signal, () =>
            this.#adapter.review(
              session.objective,
              session.workspaceId ?? "",
              session.workerId ?? "",
              signal,
            ),
          ),
        );
        if (review.reviewerId === session.workerId) throw new Error("DELIVERY_SELF_REVIEW_DENIED");
        session.reviewerId = review.reviewerId;
        if (review.verdict === "repair") {
          if (session.repairAttempt >= session.objective.maximumRepairAttempts)
            throw new Error("DELIVERY_REVIEW_REPAIR_LIMIT");
          session.repairAttempt += 1;
          await this.#transition(
            session,
            "repairing",
            `Applying governed review repair ${String(session.repairAttempt)}.`,
          );
          const repaired = await this.#effect(
            session,
            version,
            "repository.edit-bounded",
            signal,
            () =>
              this.#adapter.repair(
                session.objective,
                session.workspaceId ?? "",
                review.findings,
                signal,
              ),
          );
          session.changedPaths = this.#validatedChanges(session, repaired);
          await this.#store.save(session);
          continue;
        }
        break;
      }

      if (session.candidateCommit === undefined) {
        await this.#transition(session, "committing", "Creating a local candidate commit.");
        session.mutationKeys.commit ??= this.#mutationKey(session, "commit");
        await this.#store.save(session);
        const committed = await this.#effect(
          session,
          version,
          "repository.commit-candidate",
          signal,
          () =>
            this.#adapter.commit(
              session.objective,
              session.workspaceId ?? "",
              session.mutationKeys.commit ?? "",
              signal,
            ),
        );
        session.candidateCommit = commitSchema.parse(committed.commit);
        await this.#store.save(session);
      }

      if (session.pushedCommit === undefined) {
        await this.#transition(
          session,
          "pushing",
          "Publishing the exact candidate branch non-force.",
        );
        session.mutationKeys.push ??= this.#mutationKey(session, "push");
        await this.#store.save(session);
        const pushed = await this.#effect(session, version, "repository.push-branch", signal, () =>
          this.#adapter.pushBranch(
            session.objective,
            session.workspaceId ?? "",
            session.candidateCommit ?? "",
            session.mutationKeys.push ?? "",
            signal,
          ),
        );
        if (pushed.remoteCommit !== session.candidateCommit)
          throw new Error("DELIVERY_PUSH_REMOTE_MISMATCH");
        session.pushedCommit = commitSchema.parse(pushed.remoteCommit);
        await this.#store.save(session);
      }

      if (session.pullRequest === undefined) {
        await this.#transition(
          session,
          "pull-request-created",
          "Creating the bounded pull request.",
        );
        session.mutationKeys.pullRequest ??= this.#mutationKey(session, "pull-request");
        await this.#store.save(session);
        session.pullRequest = await this.#effect(
          session,
          version,
          "repository.create-pull-request",
          signal,
          () =>
            this.#adapter.createPullRequest(
              session.objective,
              session.candidateCommit ?? "",
              session.mutationKeys.pullRequest ?? "",
              signal,
            ),
        );
        if (session.pullRequest.headCommit !== session.candidateCommit)
          throw new Error("DELIVERY_PULL_REQUEST_HEAD_MISMATCH");
        await this.#store.save(session);
      }

      await this.#transition(session, "monitoring-ci", "Monitoring pull-request checks.");
      session.ci = await this.#effect(session, version, "repository.monitor-ci", signal, () =>
        this.#adapter.monitorCi(session.objective, session.pullRequest?.number ?? 0, signal),
      );
      if (session.ci.conclusion !== "success") throw new Error("DELIVERY_CI_FAILED");

      await this.#transition(session, "addressing-review", "Checking provider review state.");
      const addressed = await this.#effect(
        session,
        version,
        "repository.address-review",
        signal,
        () =>
          this.#adapter.addressReview(
            session.objective,
            session.workspaceId ?? "",
            session.pullRequest?.number ?? 0,
            signal,
          ),
      );
      if (addressed.changed) throw new Error("DELIVERY_REVIEW_CHANGED_HEAD_REQUIRES_NEW_BOUND_RUN");

      await this.#transition(
        session,
        "preparing-merge",
        "Preparing, but not executing, the protected merge.",
      );
      const prepared = await this.#effect(session, version, "repository.monitor-ci", signal, () =>
        this.#adapter.prepareMerge(
          session.objective,
          session.pullRequest?.number ?? 0,
          session.candidateCommit ?? "",
          signal,
        ),
      );
      if (!prepared.mergeable) throw new Error("DELIVERY_NOT_MERGEABLE");
      session.mergeApprovalStatement = `I approve merging pull request ${String(session.pullRequest.number)} in ${session.objective.repository} at ${session.candidateCommit} into main.`;

      await this.#transition(
        session,
        "verifying-remote",
        "Verifying provider-authoritative branch equality.",
      );
      session.remoteEqualityVerified = await this.#effect(
        session,
        version,
        "repository.verify-remote",
        signal,
        () =>
          this.#adapter.verifyRemoteEquality(
            session.objective,
            session.candidateCommit ?? "",
            signal,
          ),
      );
      if (!session.remoteEqualityVerified) throw new Error("DELIVERY_REMOTE_EQUALITY_FAILED");

      await this.#transition(
        session,
        "cleaning",
        "Removing the disposable implementation workspace.",
      );
      session.cleanupVerified = await this.#effect(
        session,
        version,
        "workspace.cleanup",
        signal,
        () => this.#adapter.cleanup(session.objective, session.workspaceId ?? ""),
      );
      if (!session.cleanupVerified) throw new Error("DELIVERY_CLEANUP_FAILED");

      await this.#transition(
        session,
        "ready-for-merge-approval",
        "Ordinary delivery is complete; protected merge awaits separate exact approval.",
      );
      return structuredClone(session);
    } catch (error) {
      if (
        error instanceof DeliveryRunSuperseded ||
        this.#versions.get(session.objective.deliveryId) !== version
      ) {
        const terminal = this.#terminalSessions.get(session.objective.deliveryId);
        if (terminal !== undefined) return structuredClone(terminal);
        const latest = await this.#store.load(session.objective.deliveryId);
        if (latest === null) throw new Error("DELIVERY_NOT_FOUND", { cause: error });
        return latest;
      }
      if (isAborted(signal) || error instanceof DeliveryEffectAborted)
        return await this.#pause(session, version);
      await this.#transition(
        session,
        session.workspaceId === undefined ? "denied" : "recovery-ready",
        error instanceof Error ? error.message : "Delivery failed safely.",
      );
      return structuredClone(session);
    }
  }

  async #pause(
    session: CompleteDeliverySession,
    version: number,
  ): Promise<CompleteDeliverySession> {
    this.#assertCurrent(session, version);
    await this.#transition(session, "paused", "Delivery paused with resumable evidence preserved.");
    return structuredClone(session);
  }

  #validatedChanges(
    session: CompleteDeliverySession,
    evidence: { changedPaths: string[]; changedBytes: number },
  ): string[] {
    const changedPaths = [...new Set(evidence.changedPaths)].sort();
    if (changedPaths.length === 0 || changedPaths.length > session.objective.maximumChangedFiles)
      throw new Error("DELIVERY_CHANGED_FILE_LIMIT");
    if (evidence.changedBytes < 0 || evidence.changedBytes > session.objective.maximumChangedBytes)
      throw new Error("DELIVERY_CHANGED_BYTE_LIMIT");
    for (const path of changedPaths) {
      safePathSchema.parse(path);
      if (!within(path, session.objective.writePaths))
        throw new Error(`DELIVERY_CHANGED_PATH_DENIED:${path}`);
    }
    return changedPaths;
  }

  #mutationKey(session: CompleteDeliverySession, effect: string): string {
    return digest({
      deliveryId: session.objective.deliveryId,
      repository: session.objective.repository,
      branch: session.objective.branch,
      candidateCommit: session.candidateCommit,
      effect,
    });
  }

  async #boundedTermination<T>(
    session: CompleteDeliverySession,
    capability: DeliveryOrdinaryCapability,
    operation: () => Promise<T>,
  ): Promise<T> {
    this.#access.authorize(session.objective.accessRequestId, capability);
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error("DELIVERY_TERMINATION_TIMEOUT"));
      }, this.#terminationTimeoutMs);
    });
    try {
      return await Promise.race([operation(), timeout]);
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  }

  async #effect<T>(
    session: CompleteDeliverySession,
    version: number,
    capability: DeliveryOrdinaryCapability,
    signal: AbortSignal,
    operation: () => Promise<T>,
  ): Promise<T> {
    this.#assertCurrent(session, version);
    if (isAborted(signal)) throw new DeliveryEffectAborted();
    this.#access.authorize(session.objective.accessRequestId, capability);
    const result = await operation();
    this.#assertCurrent(session, version);
    if (isAborted(signal)) throw new DeliveryEffectAborted();
    return result;
  }

  #assertCurrent(session: CompleteDeliverySession, version: number): void {
    if (this.#versions.get(session.objective.deliveryId) !== version)
      throw new DeliveryRunSuperseded();
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
      deliveryId: session.objective.deliveryId,
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

  #eventsVerified(events: readonly CompleteDeliveryEvent[], deliveryId: string): boolean {
    return events.every((event, index) => {
      const { digest: actual, ...unsigned } = event;
      return (
        event.deliveryId === deliveryId &&
        event.sequence === index + 1 &&
        unsigned.previousDigest === events[index - 1]?.digest &&
        digest(unsigned) === actual
      );
    });
  }
}
