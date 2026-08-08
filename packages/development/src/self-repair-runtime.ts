import { createHash } from "node:crypto";

import {
  capabilityAcquisitionProposalSchema,
  classifyCapabilityGap,
  prepareCapabilityAcquisition,
  verifyCapabilityAcquisitionApproval,
  type CapabilityAcquisitionProposal,
  type CapabilityGap,
  type CapabilityGapEvidence,
  type PreparedCapabilityAcquisition,
} from "@stoic-iris/capabilities";
import { z } from "zod";

export type { CapabilityAcquisitionProposal } from "@stoic-iris/capabilities";

const timestampSchema = z.iso.datetime();
const sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const commitSchema = z.string().regex(/^[a-f0-9]{40}$/u);

export const selfRepairObjectiveSchema = z
  .object({
    repairId: z.string().regex(/^repair_[a-z0-9-]{8,100}$/u),
    accessRequestId: z.string().regex(/^access_[a-z0-9-]{8,100}$/u),
    objective: z.string().trim().min(10).max(8_000),
    objectiveDigest: sha256Schema,
    modelPolicyDigest: sha256Schema,
    repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u),
    baseRevision: commitSchema,
    maximumAttempts: z.number().int().min(1).max(5),
    createdAt: timestampSchema,
    expiresAt: timestampSchema,
    budgetUsd: z.literal(0),
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.expiresAt) <= Date.parse(value.createdAt))
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Self-repair objective must expire after creation.",
      });
  });
export type SelfRepairObjective = z.infer<typeof selfRepairObjectiveSchema>;

export const selfRepairStateSchema = z.enum([
  "received",
  "observing",
  "reproducing",
  "diagnosing",
  "capability-required",
  "acquisition-awaiting-approval",
  "acquiring",
  "capability-verified",
  "resuming",
  "completed",
  "unsupported",
  "protected-stop",
  "recovery-ready",
  "cancelled",
]);
export type SelfRepairState = z.infer<typeof selfRepairStateSchema>;

export const selfRepairEventSchema = z
  .object({
    repairId: selfRepairObjectiveSchema.shape.repairId,
    sequence: z.number().int().positive(),
    state: selfRepairStateSchema,
    summary: z.string().min(1).max(2_000),
    occurredAt: timestampSchema,
    previousDigest: sha256Schema.optional(),
    digest: sha256Schema,
  })
  .strict();
export type SelfRepairEvent = z.infer<typeof selfRepairEventSchema>;

export interface SelfRepairSession {
  objective: SelfRepairObjective;
  state: SelfRepairState;
  summary: string;
  gap?: CapabilityGap;
  acquisition?: PreparedCapabilityAcquisition;
  workspaceId?: string;
  acquisitionEvidenceDigest?: string;
  verificationEvidenceDigest?: string;
  registryRevision?: string;
  resumedObjectiveDigest?: string;
  outcomeDigest?: string;
  cleanupVerified: boolean;
  events: SelfRepairEvent[];
  updatedAt: string;
}

export interface SelfRepairStore {
  load(repairId: string): Promise<SelfRepairSession | null>;
  save(session: SelfRepairSession): Promise<void>;
}

export class MemorySelfRepairStore implements SelfRepairStore {
  readonly #sessions = new Map<string, SelfRepairSession>();

  load(repairId: string): Promise<SelfRepairSession | null> {
    const value = this.#sessions.get(repairId);
    return Promise.resolve(value === undefined ? null : structuredClone(value));
  }

  save(session: SelfRepairSession): Promise<void> {
    this.#sessions.set(session.objective.repairId, structuredClone(session));
    return Promise.resolve();
  }
}

export interface SelfRepairAccessAuthorizer {
  authorize(requestId: string, capability: string): unknown;
}

export interface SelfRepairAdapter {
  observe(objective: SelfRepairObjective): Promise<{ evidence: string[] }>;
  reproduce(
    objective: SelfRepairObjective,
    observation: { evidence: string[] },
  ): Promise<{ reproduced: boolean; evidence: string[] }>;
  diagnose(
    objective: SelfRepairObjective,
    evidence: readonly string[],
  ): Promise<CapabilityGapEvidence>;
  researchAcquisition(
    objective: SelfRepairObjective,
    gap: CapabilityGap,
  ): Promise<CapabilityAcquisitionProposal>;
  createWorkspace(
    objective: SelfRepairObjective,
    proposal: PreparedCapabilityAcquisition,
  ): Promise<{ workspaceId: string }>;
  acquire(
    objective: SelfRepairObjective,
    workspaceId: string,
    proposal: PreparedCapabilityAcquisition,
  ): Promise<{ evidenceDigest: string }>;
  verifyCapability(
    objective: SelfRepairObjective,
    workspaceId: string,
    proposal: PreparedCapabilityAcquisition,
  ): Promise<{ passed: boolean; evidenceDigest: string }>;
  registerCapability(
    objective: SelfRepairObjective,
    proposal: PreparedCapabilityAcquisition,
    verificationEvidenceDigest: string,
  ): Promise<{ registryRevision: string }>;
  resumeObjective(
    objective: SelfRepairObjective,
    binding: {
      objectiveDigest: string;
      modelPolicyDigest: string;
      acquisitionDigest: string;
      verificationEvidenceDigest: string;
      registryRevision: string;
    },
  ): Promise<{ outcomeDigest: string }>;
  cleanup(objective: SelfRepairObjective, workspaceId: string): Promise<boolean>;
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

export class SelfRepairRuntime {
  readonly #adapter: SelfRepairAdapter;
  readonly #access: SelfRepairAccessAuthorizer;
  readonly #store: SelfRepairStore;
  readonly #now: () => Date;

  constructor(options: {
    adapter: SelfRepairAdapter;
    access: SelfRepairAccessAuthorizer;
    store: SelfRepairStore;
    now?: () => Date;
  }) {
    this.#adapter = options.adapter;
    this.#access = options.access;
    this.#store = options.store;
    this.#now = options.now ?? (() => new Date());
  }

  async start(input: unknown): Promise<SelfRepairSession> {
    const objective = selfRepairObjectiveSchema.parse(input);
    if (await this.#store.load(objective.repairId)) throw new Error("SELF_REPAIR_ID_REPLAY");
    const now = this.#now().getTime();
    if (Date.parse(objective.createdAt) > now || Date.parse(objective.expiresAt) <= now)
      throw new Error("SELF_REPAIR_OBJECTIVE_EXPIRED");
    const session: SelfRepairSession = {
      objective,
      state: "received",
      summary: "Self-repair objective received.",
      cleanupVerified: false,
      events: [],
      updatedAt: this.#now().toISOString(),
    };
    await this.#transition(session, "received", session.summary);
    try {
      this.#access.authorize(objective.accessRequestId, "repository.inspect");
      await this.#transition(session, "observing", "Observing the exact failed behavior.");
      const observation = await this.#adapter.observe(objective);
      await this.#transition(session, "reproducing", "Reproducing the failure without mutation.");
      const reproduction = await this.#adapter.reproduce(objective, observation);
      if (!reproduction.reproduced) throw new Error("SELF_REPAIR_FAILURE_NOT_REPRODUCED");
      await this.#transition(session, "diagnosing", "Classifying the exact capability gap.");
      session.gap = classifyCapabilityGap(
        await this.#adapter.diagnose(objective, [
          ...observation.evidence,
          ...reproduction.evidence,
        ]),
      );
      await this.#store.save(session);
      await this.#transition(
        session,
        "capability-required",
        `Capability ${session.gap.capability} requires ${session.gap.type}.`,
      );
      if (session.gap.type === "unsupported-after-research") {
        await this.#transition(
          session,
          "unsupported",
          `Capability ${session.gap.capability} is unsupported after primary-source research: ${session.gap.evidence.join("; ")}`,
        );
        return structuredClone(session);
      }
      if (session.gap.type === "protected-effect-required") {
        await this.#transition(
          session,
          "protected-stop",
          `Capability ${session.gap.capability} requires a separately approved protected effect.`,
        );
        return structuredClone(session);
      }
      this.#access.authorize(objective.accessRequestId, "capability.acquire-approved");
      const proposal = capabilityAcquisitionProposalSchema.parse(
        await this.#adapter.researchAcquisition(objective, session.gap),
      );
      if (proposal.objectiveDigest !== objective.objectiveDigest)
        throw new Error("SELF_REPAIR_OBJECTIVE_DIGEST_MISMATCH");
      session.acquisition = prepareCapabilityAcquisition(proposal);
      await this.#store.save(session);
      await this.#transition(
        session,
        "acquisition-awaiting-approval",
        `Capability acquisition ${session.acquisition.proposalId} awaits exact approval.`,
      );
      return structuredClone(session);
    } catch (error) {
      await this.#transition(
        session,
        "recovery-ready",
        error instanceof Error ? error.message : "SELF_REPAIR_FAILED",
      );
      return structuredClone(session);
    }
  }

  async approveAcquisition(repairId: string, statement: string): Promise<SelfRepairSession> {
    const session = await this.#store.load(repairId);
    if (session === null) throw new Error("SELF_REPAIR_NOT_FOUND");
    if (!this.#eventsVerified(session.events, repairId))
      throw new Error("SELF_REPAIR_EVENT_CHAIN_INVALID");
    if (session.state !== "acquisition-awaiting-approval" || session.acquisition === undefined)
      throw new Error("SELF_REPAIR_NOT_AWAITING_ACQUISITION_APPROVAL");
    if (!verifyCapabilityAcquisitionApproval(session.acquisition, statement, this.#now()))
      throw new Error("SELF_REPAIR_ACQUISITION_APPROVAL_INVALID");
    if (session.acquisition.objectiveDigest !== session.objective.objectiveDigest)
      throw new Error("SELF_REPAIR_OBJECTIVE_DIGEST_MISMATCH");
    try {
      this.#access.authorize(session.objective.accessRequestId, "capability.acquire-approved");
      await this.#transition(session, "acquiring", "Creating a disposable acquisition workspace.");
      const workspace = await this.#adapter.createWorkspace(session.objective, session.acquisition);
      session.workspaceId = z.string().min(1).max(300).parse(workspace.workspaceId);
      await this.#store.save(session);
      const acquired = await this.#adapter.acquire(
        session.objective,
        session.workspaceId,
        session.acquisition,
      );
      session.acquisitionEvidenceDigest = sha256Schema.parse(acquired.evidenceDigest);
      const verification = await this.#adapter.verifyCapability(
        session.objective,
        session.workspaceId,
        session.acquisition,
      );
      session.verificationEvidenceDigest = sha256Schema.parse(verification.evidenceDigest);
      if (!verification.passed) throw new Error("SELF_REPAIR_CAPABILITY_VERIFICATION_FAILED");
      await this.#transition(
        session,
        "capability-verified",
        `Capability ${session.acquisition.capability} passed exact verification.`,
      );
      const registration = await this.#adapter.registerCapability(
        session.objective,
        session.acquisition,
        session.verificationEvidenceDigest,
      );
      session.registryRevision = commitSchema.parse(registration.registryRevision);
      await this.#transition(session, "resuming", "Resuming the exact original objective.");
      const resumed = await this.#adapter.resumeObjective(session.objective, {
        objectiveDigest: session.objective.objectiveDigest,
        modelPolicyDigest: session.objective.modelPolicyDigest,
        acquisitionDigest: session.acquisition.digest,
        verificationEvidenceDigest: session.verificationEvidenceDigest,
        registryRevision: session.registryRevision,
      });
      session.resumedObjectiveDigest = session.objective.objectiveDigest;
      session.outcomeDigest = sha256Schema.parse(resumed.outcomeDigest);
      session.cleanupVerified = await this.#adapter.cleanup(session.objective, session.workspaceId);
      if (!session.cleanupVerified) throw new Error("SELF_REPAIR_CLEANUP_FAILED");
      await this.#transition(session, "completed", "Capability acquired and objective resumed.");
      return structuredClone(session);
    } catch (error) {
      if (session.workspaceId !== undefined && !session.cleanupVerified) {
        try {
          session.cleanupVerified = await this.#adapter.cleanup(
            session.objective,
            session.workspaceId,
          );
        } catch {
          session.cleanupVerified = false;
        }
      }
      await this.#transition(
        session,
        "recovery-ready",
        error instanceof Error ? error.message : "SELF_REPAIR_ACQUISITION_FAILED",
      );
      return structuredClone(session);
    }
  }

  async cancel(repairId: string): Promise<SelfRepairSession> {
    const session = await this.#store.load(repairId);
    if (session === null) throw new Error("SELF_REPAIR_NOT_FOUND");
    if (new Set<SelfRepairState>(["completed", "unsupported", "cancelled"]).has(session.state))
      throw new Error("SELF_REPAIR_TERMINAL");
    if (session.workspaceId !== undefined && !session.cleanupVerified)
      session.cleanupVerified = await this.#adapter.cleanup(session.objective, session.workspaceId);
    await this.#transition(session, "cancelled", "Founder cancelled self-repair.");
    return structuredClone(session);
  }

  session(repairId: string): Promise<SelfRepairSession | null> {
    return this.#store.load(repairId);
  }

  async #transition(
    session: SelfRepairSession,
    state: SelfRepairState,
    summary: string,
  ): Promise<void> {
    session.state = state;
    session.summary = summary;
    session.updatedAt = this.#now().toISOString();
    const unsigned = {
      repairId: session.objective.repairId,
      sequence: session.events.length + 1,
      state,
      summary,
      occurredAt: session.updatedAt,
      ...(session.events.at(-1) === undefined
        ? {}
        : { previousDigest: session.events.at(-1)?.digest }),
    };
    session.events.push(selfRepairEventSchema.parse({ ...unsigned, digest: digest(unsigned) }));
    await this.#store.save(session);
  }

  #eventsVerified(events: readonly SelfRepairEvent[], repairId: string): boolean {
    return events.every((event, index) => {
      const { digest: actual, ...unsigned } = event;
      return (
        event.repairId === repairId &&
        event.sequence === index + 1 &&
        event.previousDigest === events[index - 1]?.digest &&
        digest(unsigned) === actual
      );
    });
  }
}
