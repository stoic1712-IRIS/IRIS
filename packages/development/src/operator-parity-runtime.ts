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
    operatorId: z.string().regex(/^operator_[a-z0-9-]{8,100}$/u),
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

class OperatorRunSuperseded extends Error {
  constructor() {
    super("OPERATOR_RUN_SUPERSEDED");
  }
}

class OperatorEffectAborted extends Error {
  constructor() {
    super("OPERATOR_EFFECT_ABORTED");
  }
}

export class OperatorParityRuntime {
  readonly #access: OperatorCapabilityAuthorizer;
  readonly #adapter: OperatorExecutionAdapter;
  readonly #store: OperatorSessionStore;
  readonly #models: readonly OperatorModel[];
  readonly #tools: ReadonlySet<string>;
  readonly #now: () => Date;
  readonly #maximumEffectTimeoutMs: number;
  readonly #controllers = new Map<string, AbortController>();
  readonly #versions = new Map<string, number>();
  readonly #terminalSessions = new Map<string, OperatorSession>();

  constructor(options: {
    access: OperatorCapabilityAuthorizer;
    adapter: OperatorExecutionAdapter;
    store: OperatorSessionStore;
    models: readonly OperatorModel[];
    tools: readonly string[];
    now?: () => Date;
    maximumEffectTimeoutMs?: number;
  }) {
    this.#access = options.access;
    this.#adapter = options.adapter;
    this.#store = options.store;
    this.#models = z.array(operatorModelSchema).min(1).parse(options.models);
    this.#tools = new Set(z.array(z.string().min(1).max(200)).parse(options.tools));
    this.#now = options.now ?? (() => new Date());
    this.#maximumEffectTimeoutMs = z
      .number()
      .int()
      .positive()
      .max(24 * 60 * 60 * 1_000)
      .parse(options.maximumEffectTimeoutMs ?? 24 * 60 * 60 * 1_000);
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
    return this.#begin(session, signal);
  }

  async resume(
    operatorId: string,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<OperatorSession> {
    const session = await this.#store.load(operatorId);
    if (session === null) throw new Error("OPERATOR_NOT_FOUND");
    if (!this.#eventsVerified(session.events, operatorId))
      throw new Error("OPERATOR_EVENT_CHAIN_INVALID");
    if (session.state !== "paused" && session.state !== "recovery-ready")
      throw new Error("OPERATOR_NOT_RESUMABLE");
    if (Date.parse(session.objective.expiresAt) <= this.#now().getTime())
      throw new Error("OPERATOR_OBJECTIVE_EXPIRED");
    return this.#begin(session, signal);
  }

  async cancel(operatorId: string): Promise<OperatorSession> {
    const session = await this.#store.load(operatorId);
    if (session === null) throw new Error("OPERATOR_NOT_FOUND");
    if (
      new Set<OperatorState>(["completed", "protected-stop", "cancelled", "denied"]).has(
        session.state,
      )
    )
      throw new Error("OPERATOR_TERMINAL");
    this.#controllers.get(operatorId)?.abort();
    this.#versions.set(operatorId, (this.#versions.get(operatorId) ?? 0) + 1);
    const cancelled = this.#transition(
      session,
      "cancelled",
      "Founder cancelled the operator session; bounded provider stop is pending.",
    );
    this.#terminalSessions.set(operatorId, structuredClone(session));
    await cancelled;
    try {
      await this.#boundedCancellation(session);
      await this.#transition(
        session,
        "cancelled",
        "Founder cancelled the operator session; bounded provider stop completed.",
      );
    } catch (error) {
      await this.#transition(
        session,
        "cancelled",
        `Founder cancelled the operator session; provider stop remains unverified: ${error instanceof Error ? error.message : "OPERATOR_CANCELLATION_FAILED"}`,
      );
    }
    this.#terminalSessions.set(operatorId, structuredClone(session));
    return structuredClone(session);
  }

  session(operatorId: string): Promise<OperatorSession | null> {
    return this.#store.load(operatorId);
  }

  async #begin(session: OperatorSession, externalSignal: AbortSignal): Promise<OperatorSession> {
    const operatorId = session.objective.operatorId;
    if (this.#controllers.has(operatorId)) throw new Error("OPERATOR_RUN_ALREADY_ACTIVE");
    const controller = new AbortController();
    const version = (this.#versions.get(operatorId) ?? 0) + 1;
    this.#versions.set(operatorId, version);
    this.#controllers.set(operatorId, controller);
    try {
      return await this.#run(
        session,
        AbortSignal.any([externalSignal, controller.signal]),
        version,
      );
    } finally {
      if (this.#versions.get(operatorId) === version) this.#controllers.delete(operatorId);
    }
  }

  async #run(
    session: OperatorSession,
    signal: AbortSignal,
    version: number,
  ): Promise<OperatorSession> {
    try {
      this.#assertCurrent(session, version);
      if (isAborted(signal)) return await this.#pause(session, version);
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

      if (session.plan === undefined) {
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
      } else {
        session.plan = operatorPlanSchema.parse(session.plan);
      }
      if (session.plan.workerId === session.plan.reviewerId)
        throw new Error("OPERATOR_SELF_REVIEW_DENIED");
      const plan = session.plan;
      await this.#transition(session, "planned", "Bounded model and tool plan created.");

      for (; session.attempt < session.objective.maximumAttempts;) {
        this.#assertCurrent(session, version);
        if (isAborted(signal)) return await this.#pause(session, version);
        session.attempt += 1;
        await this.#transition(
          session,
          session.attempt === 1 ? "running" : "repairing",
          session.attempt === 1
            ? "Specialist worker is executing the bounded plan."
            : `Specialist worker is executing repair attempt ${String(session.attempt)}.`,
        );
        const outcome = operatorOutcomeSchema.parse(
          await this.#boundedEffect(session, version, signal, (effectSignal) =>
            this.#adapter.run(session.objective, plan, session.attempt, effectSignal),
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
        const review = await this.#boundedEffect(session, version, signal, (effectSignal) =>
          this.#adapter.verify(session.objective, plan, outcome, effectSignal),
        );
        if (review.reviewerId !== plan.reviewerId)
          throw new Error("OPERATOR_REVIEWER_IDENTITY_MISMATCH");
        if (review.passed) {
          session.outcome = outcome;
          if (session.objective.presentGraduationProposal)
            session.graduationApprovalStatement = graduationStatement(session.objective, plan);
          await this.#transition(
            session,
            "completed",
            "Objective completed with independent verification and preserved evidence.",
          );
          return structuredClone(session);
        }
        if (session.attempt >= session.objective.maximumAttempts)
          throw new Error("OPERATOR_REPAIR_LIMIT_REACHED");
        await this.#boundedEffect(session, version, signal, (effectSignal) =>
          this.#adapter.repair(session.objective, plan, outcome, review.findings, effectSignal),
        );
      }
      throw new Error("OPERATOR_REPAIR_LIMIT_REACHED");
    } catch (error) {
      if (
        error instanceof OperatorRunSuperseded ||
        this.#versions.get(session.objective.operatorId) !== version
      ) {
        const terminal = this.#terminalSessions.get(session.objective.operatorId);
        if (terminal !== undefined) return structuredClone(terminal);
        const latest = await this.#store.load(session.objective.operatorId);
        if (latest === null) throw new Error("OPERATOR_NOT_FOUND", { cause: error });
        return latest;
      }
      if (isAborted(signal) || error instanceof OperatorEffectAborted)
        return await this.#pause(session, version);
      await this.#transition(
        session,
        session.plan === undefined ? "denied" : "recovery-ready",
        error instanceof Error ? error.message : "Operator session failed safely.",
      );
      return structuredClone(session);
    }
  }

  async #pause(session: OperatorSession, version: number): Promise<OperatorSession> {
    this.#assertCurrent(session, version);
    await this.#transition(session, "paused", "Operator session paused with resumable evidence.");
    return structuredClone(session);
  }

  async #boundedEffect<T>(
    session: OperatorSession,
    version: number,
    signal: AbortSignal,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    this.#assertCurrent(session, version);
    for (const capability of session.objective.requiredCapabilities)
      this.#access.authorize(session.objective.accessRequestId, capability);

    const effectController = new AbortController();
    const effectSignal = AbortSignal.any([signal, effectController.signal]);
    const timeoutMs = Math.min(session.objective.timeoutMs, this.#maximumEffectTimeoutMs);
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let abortHandler: (() => void) | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        effectController.abort();
        reject(new Error("OPERATOR_EFFECT_TIMEOUT"));
      }, timeoutMs);
    });
    const aborted = new Promise<never>((_resolve, reject) => {
      abortHandler = () => {
        reject(new OperatorEffectAborted());
      };
      if (isAborted(signal)) abortHandler();
      else signal.addEventListener("abort", abortHandler, { once: true });
    });
    try {
      const result = await Promise.race([operation(effectSignal), timeout, aborted]);
      this.#assertCurrent(session, version);
      return result;
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      if (abortHandler !== undefined) signal.removeEventListener("abort", abortHandler);
    }
  }

  async #boundedCancellation(session: OperatorSession): Promise<void> {
    for (const capability of session.objective.requiredCapabilities)
      this.#access.authorize(session.objective.accessRequestId, capability);
    const timeoutMs = Math.min(session.objective.timeoutMs, this.#maximumEffectTimeoutMs);
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error("OPERATOR_CANCELLATION_TIMEOUT"));
      }, timeoutMs);
    });
    try {
      await Promise.race([this.#adapter.cancel(session.objective.operatorId), timeout]);
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  }

  #assertCurrent(session: OperatorSession, version: number): void {
    if (this.#versions.get(session.objective.operatorId) !== version)
      throw new OperatorRunSuperseded();
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
      operatorId: session.objective.operatorId,
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

  #eventsVerified(events: readonly OperatorEvent[], operatorId: string): boolean {
    return events.every((event, index) => {
      const { digest: actual, ...unsigned } = event;
      return (
        event.operatorId === operatorId &&
        event.sequence === index + 1 &&
        unsigned.previousDigest === events[index - 1]?.digest &&
        digest(unsigned) === actual
      );
    });
  }
}
