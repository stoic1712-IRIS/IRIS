import { createHash } from "node:crypto";

import { z } from "zod";

import { sha256Schema } from "./contracts.js";

const timestampSchema = z.iso.datetime();

export const operatorProtectedEffectSchema = z.enum([
  "credentials",
  "spending",
  "deployment",
  "public-or-lan-exposure",
  "repository-administration",
  "force-push-or-history-rewrite",
  "destructive-data-operation",
  "phase-zero-graduation",
]);

export const operatorObjectiveSchema = z
  .object({
    operatorId: z.string().regex(/^operator_[a-z0-9-]{8,100}$/u),
    accessRequestId: z.string().regex(/^access_[a-z0-9-]{8,100}$/u),
    objective: z.string().trim().min(10).max(8_000),
    category: z.enum(["software-delivery", "research", "general"]),
    requiredCapabilities: z.array(z.string().min(1).max(200)).min(1).max(32),
    protectedEffects: z.array(operatorProtectedEffectSchema).max(8),
    maximumAttempts: z.number().int().min(1).max(5),
    timeoutMs: z
      .number()
      .int()
      .min(30_000)
      .max(24 * 60 * 60 * 1_000),
    budgetUsd: z.literal(0),
    createdAt: timestampSchema,
    expiresAt: timestampSchema,
    presentGraduationProposal: z.boolean().default(false),
  })
  .strict();
export type OperatorObjective = z.infer<typeof operatorObjectiveSchema>;

export const operatorModelSchema = z
  .object({
    model: z.string().min(1).max(200),
    capabilities: z.array(z.string().min(1).max(200)).min(1).max(100),
    approved: z.boolean(),
    local: z.boolean(),
  })
  .strict();
export type OperatorModel = z.infer<typeof operatorModelSchema>;

export const operatorPlanSchema = z
  .object({
    route: z.enum(["software-delivery", "research", "general"]),
    model: z.string().min(1).max(200),
    tools: z.array(z.string().min(1).max(200)).max(32),
    workerId: z.string().min(1).max(200),
    reviewerId: z.string().min(1).max(200),
    steps: z.array(z.string().min(1).max(1_000)).min(1).max(50),
    digest: sha256Schema,
  })
  .strict();
export type OperatorPlan = z.infer<typeof operatorPlanSchema>;

export const operatorStateSchema = z.enum([
  "received",
  "capability-preflight",
  "planned",
  "running",
  "verifying",
  "repairing",
  "completed",
  "protected-stop",
  "paused",
  "recovery-ready",
  "cancelled",
  "denied",
]);
export type OperatorState = z.infer<typeof operatorStateSchema>;

export const operatorEventSchema = z
  .object({
    sequence: z.number().int().positive(),
    state: operatorStateSchema,
    summary: z.string().min(1).max(2_000),
    occurredAt: timestampSchema,
    previousDigest: sha256Schema.optional(),
    digest: sha256Schema,
  })
  .strict();
export type OperatorEvent = z.infer<typeof operatorEventSchema>;

export const operatorOutcomeSchema = z
  .object({
    summary: z.string().min(1).max(24_000),
    evidence: z.array(z.string().min(1).max(2_000)).min(1).max(100),
    requiresProtectedAction: z.boolean(),
  })
  .strict();
export type OperatorOutcome = z.infer<typeof operatorOutcomeSchema>;

export interface OperatorSession {
  objective: OperatorObjective;
  state: OperatorState;
  summary: string;
  attempt: number;
  plan?: OperatorPlan;
  outcome?: OperatorOutcome;
  protectedApprovalStatement?: string;
  graduationApprovalStatement?: string;
  events: OperatorEvent[];
  updatedAt: string;
}

export interface OperatorSessionStore {
  load(operatorId: string): Promise<OperatorSession | null>;
  save(session: OperatorSession): Promise<void>;
}

export class MemoryOperatorSessionStore implements OperatorSessionStore {
  readonly #sessions = new Map<string, OperatorSession>();

  load(operatorId: string): Promise<OperatorSession | null> {
    const session = this.#sessions.get(operatorId);
    return Promise.resolve(session === undefined ? null : structuredClone(session));
  }

  save(session: OperatorSession): Promise<void> {
    this.#sessions.set(session.objective.operatorId, structuredClone(session));
    return Promise.resolve();
  }
}

export interface OperatorCapabilityAuthorizer {
  authorize(requestId: string, capability: string): unknown;
}

export interface OperatorExecutionAdapter {
  run(
    objective: OperatorObjective,
    plan: OperatorPlan,
    attempt: number,
    signal: AbortSignal,
  ): Promise<OperatorOutcome>;
  verify(
    objective: OperatorObjective,
    plan: OperatorPlan,
    outcome: OperatorOutcome,
    signal: AbortSignal,
  ): Promise<{ reviewerId: string; passed: boolean; findings: string[] }>;
  repair(
    objective: OperatorObjective,
    plan: OperatorPlan,
    outcome: OperatorOutcome,
    findings: string[],
    signal: AbortSignal,
  ): Promise<void>;
  cancel(operatorId: string): Promise<void>;
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

function graduationStatement(objective: OperatorObjective, plan: OperatorPlan): string {
  const proposalDigest = digest({
    operatorId: objective.operatorId,
    objective: objective.objective,
    planDigest: plan.digest,
    boundary: "final-phase-zero-self-upgrade",
  });
  return `I approve proposal_phase-0-graduation at ${proposalDigest} for IRIS execution exactly as proposed.`;
}

export class OperatorParityRuntime {
  readonly #access: OperatorCapabilityAuthorizer;
  readonly #adapter: OperatorExecutionAdapter;
  readonly #store: OperatorSessionStore;
  readonly #models: readonly OperatorModel[];
  readonly #tools: ReadonlySet<string>;
  readonly #now: () => Date;

  constructor(options: {
    access: OperatorCapabilityAuthorizer;
    adapter: OperatorExecutionAdapter;
    store: OperatorSessionStore;
    models: readonly OperatorModel[];
    tools: readonly string[];
    now?: () => Date;
  }) {
    this.#access = options.access;
    this.#adapter = options.adapter;
    this.#store = options.store;
    this.#models = z.array(operatorModelSchema).min(1).parse(options.models);
    this.#tools = new Set(z.array(z.string().min(1).max(200)).parse(options.tools));
    this.#now = options.now ?? (() => new Date());
  }

  async start(
    input: OperatorObjective,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<OperatorSession> {
    const objective = operatorObjectiveSchema.parse(input);
    if (await this.#store.load(objective.operatorId)) throw new Error("OPERATOR_ID_REPLAY");
    const now = this.#now().getTime();
    if (Date.parse(objective.createdAt) > now || Date.parse(objective.expiresAt) <= now)
      throw new Error("OPERATOR_OBJECTIVE_EXPIRED");
    const session: OperatorSession = {
      objective,
      state: "received",
      summary: "Founder operator objective received.",
      attempt: 0,
      events: [],
      updatedAt: this.#now().toISOString(),
    };
    await this.#transition(session, "received", session.summary);
    return this.#run(session, signal);
  }

  async resume(
    operatorId: string,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<OperatorSession> {
    const session = await this.#store.load(operatorId);
    if (session === null) throw new Error("OPERATOR_NOT_FOUND");
    if (!this.#eventsVerified(session.events)) throw new Error("OPERATOR_EVENT_CHAIN_INVALID");
    if (session.state !== "paused" && session.state !== "recovery-ready")
      throw new Error("OPERATOR_NOT_RESUMABLE");
    if (Date.parse(session.objective.expiresAt) <= this.#now().getTime())
      throw new Error("OPERATOR_OBJECTIVE_EXPIRED");
    return this.#run(session, signal);
  }

  async cancel(operatorId: string): Promise<OperatorSession> {
    const session = await this.#store.load(operatorId);
    if (session === null) throw new Error("OPERATOR_NOT_FOUND");
    await this.#adapter.cancel(operatorId);
    await this.#transition(session, "cancelled", "Founder cancelled the operator session.");
    return structuredClone(session);
  }

  session(operatorId: string): Promise<OperatorSession | null> {
    return this.#store.load(operatorId);
  }

  async #run(session: OperatorSession, signal: AbortSignal): Promise<OperatorSession> {
    try {
      if (isAborted(signal)) return await this.#pause(session);
      if (session.objective.protectedEffects.length > 0) {
        const statement = `I approve ${session.objective.operatorId} for the separately governed protected effects: ${session.objective.protectedEffects.join(", ")}.`;
        session.protectedApprovalStatement = statement;
        await this.#transition(
          session,
          "protected-stop",
          "Objective requires a separately authorized protected action; no provider was called.",
        );
        return structuredClone(session);
      }

      await this.#transition(
        session,
        "capability-preflight",
        "Checking every registered capability.",
      );
      for (const capability of session.objective.requiredCapabilities) {
        if (!this.#tools.has(capability))
          throw new Error(`OPERATOR_CAPABILITY_UNAVAILABLE:${capability}`);
        this.#access.authorize(session.objective.accessRequestId, capability);
      }

      const model = this.#models.find(
        (candidate) =>
          candidate.approved &&
          session.objective.requiredCapabilities.every((capability) =>
            candidate.capabilities.includes(capability),
          ),
      );
      if (model === undefined) throw new Error("OPERATOR_MODEL_UNAVAILABLE");
      const unsignedPlan = {
        route: session.objective.category,
        model: model.model,
        tools: [...session.objective.requiredCapabilities].sort(),
        workerId: `worker_${createHash("sha256").update(`${session.objective.operatorId}:worker`).digest("hex").slice(0, 16)}`,
        reviewerId: `reviewer_${createHash("sha256").update(`${session.objective.operatorId}:reviewer`).digest("hex").slice(0, 16)}`,
        steps: [
          "Confirm exact authority and capability availability.",
          "Execute the bounded objective with the selected specialist.",
          "Independently verify the exact result.",
          "Repair within limits or preserve resumable evidence.",
          "Stop before any protected effect.",
        ],
      };
      session.plan = operatorPlanSchema.parse({ ...unsignedPlan, digest: digest(unsignedPlan) });
      if (session.plan.workerId === session.plan.reviewerId)
        throw new Error("OPERATOR_SELF_REVIEW_DENIED");
      await this.#transition(session, "planned", "Bounded model and tool plan created.");

      while (session.attempt < session.objective.maximumAttempts) {
        if (isAborted(signal)) return await this.#pause(session);
        session.attempt += 1;
        await this.#transition(
          session,
          session.attempt === 1 ? "running" : "repairing",
          session.attempt === 1
            ? "Specialist worker is executing the bounded plan."
            : `Specialist worker is executing repair attempt ${String(session.attempt)}.`,
        );
        const outcome = operatorOutcomeSchema.parse(
          await this.#adapter.run(
            session.objective,
            session.plan,
            session.attempt,
            AbortSignal.any([signal, AbortSignal.timeout(session.objective.timeoutMs)]),
          ),
        );
        if (outcome.requiresProtectedAction) {
          session.outcome = outcome;
          session.protectedApprovalStatement = `I approve ${session.objective.operatorId} to continue with its separately governed protected next action.`;
          await this.#transition(
            session,
            "protected-stop",
            "Worker reached a protected boundary; execution stopped before the effect.",
          );
          return structuredClone(session);
        }
        await this.#transition(
          session,
          "verifying",
          "Independent reviewer is checking the exact outcome.",
        );
        const review = await this.#adapter.verify(session.objective, session.plan, outcome, signal);
        if (review.reviewerId !== session.plan.reviewerId)
          throw new Error("OPERATOR_REVIEWER_IDENTITY_MISMATCH");
        if (review.passed) {
          session.outcome = outcome;
          if (session.objective.presentGraduationProposal)
            session.graduationApprovalStatement = graduationStatement(
              session.objective,
              session.plan,
            );
          await this.#transition(
            session,
            "completed",
            "Objective completed with independent verification and preserved evidence.",
          );
          return structuredClone(session);
        }
        if (session.attempt >= session.objective.maximumAttempts)
          throw new Error("OPERATOR_REPAIR_LIMIT_REACHED");
        await this.#adapter.repair(
          session.objective,
          session.plan,
          outcome,
          review.findings,
          signal,
        );
      }
      throw new Error("OPERATOR_REPAIR_LIMIT_REACHED");
    } catch (error) {
      if (isAborted(signal)) return await this.#pause(session);
      await this.#transition(
        session,
        session.plan === undefined ? "denied" : "recovery-ready",
        error instanceof Error ? error.message : "Operator session failed safely.",
      );
      return structuredClone(session);
    }
  }

  async #pause(session: OperatorSession): Promise<OperatorSession> {
    await this.#transition(session, "paused", "Operator session paused with resumable evidence.");
    return structuredClone(session);
  }

  async #transition(
    session: OperatorSession,
    state: OperatorState,
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
    session.events.push(operatorEventSchema.parse({ ...unsigned, digest: digest(unsigned) }));
    await this.#store.save(session);
  }

  #eventsVerified(events: readonly OperatorEvent[]): boolean {
    return events.every((event, index) => {
      const { digest: actual, ...unsigned } = event;
      return unsigned.previousDigest === events[index - 1]?.digest && digest(unsigned) === actual;
    });
  }
}
