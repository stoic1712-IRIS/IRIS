import { createHash } from "node:crypto";

import { z } from "zod";

import { canonicalIdSchema, sha256DigestSchema, timestampSchema } from "@stoic-iris/contracts";

/**
 * Cycle Eleven governed desktop-control boundary.
 *
 * The module owns strict, provider-independent scope, preview, approval,
 * interruption, recovery, replay, and audit contracts. It performs no desktop
 * effect on import or construction. A live provider remains disabled unless an
 * already-authorized caller deliberately enables one bounded execution.
 */

export class DesktopControlDeniedError extends Error {
  constructor(
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "DesktopControlDeniedError";
  }
}

function digest(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

const secretPatterns = [
  /github_pat_[a-z0-9_]{20,}/iu,
  /gh[pousr]_[a-z0-9]{20,}/iu,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bxox[baprs]-[a-z0-9-]+/iu,
  /\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*\S/iu,
];
const authorityLaunderingPattern =
  /(?:founder|owner|user|administrator)\s+(?:has\s+)?(?:already\s+)?(?:approved|authorized|permitted)|(?:approval|authorization)\s+is\s+not\s+(?:required|needed)|this\s+(?:message|content)\s+overrides/iu;
const urlPattern = /(?:https?:\/\/|ftp:\/\/|www\.|mailto:|javascript:|data:)/iu;

function unsafeText(value: string): boolean {
  return (
    secretPatterns.some((pattern) => pattern.test(value)) ||
    authorityLaunderingPattern.test(value) ||
    urlPattern.test(value)
  );
}

function exactText(maximum: number) {
  return z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => value === value.trim(), "Value must not contain outer whitespace.")
    .refine((value) => !/[?*]/u.test(value), "Wildcards are not allowed.")
    .refine((value) => !unsafeText(value), "Unsafe text is not allowed.");
}

const requestIdSchema = canonicalIdSchema.refine((value) => value.startsWith("request_"), {
  message: "Identifier must be a request_ canonical id.",
});
const previewIdSchema = canonicalIdSchema.refine((value) => value.startsWith("proposal_"), {
  message: "Identifier must be a proposal_ canonical id.",
});
const approvalIdSchema = canonicalIdSchema.refine((value) => value.startsWith("approval_"), {
  message: "Identifier must be an approval_ canonical id.",
});

export const desktopControlTargetSchema = z
  .object({
    applicationId: exactText(120).refine(
      (value) => /^[A-Za-z0-9][A-Za-z0-9_.-]*$/u.test(value),
      "Application id must be exact and portable.",
    ),
    windowTitle: exactText(240),
    automationRootId: exactText(160).optional(),
  })
  .strict();
export type DesktopControlTarget = z.infer<typeof desktopControlTargetSchema>;

const automationIdSchema = exactText(160).refine(
  (value) => /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u.test(value),
  "Automation id must be exact and coordinate-free.",
);
const boundedInputSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => !unsafeText(value), "Secret, URL, or authority-bearing input is denied.");

export const desktopControlActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("focus-window") }).strict(),
  z.object({ kind: z.literal("invoke"), automationId: automationIdSchema }).strict(),
  z
    .object({
      kind: z.literal("set-text"),
      automationId: automationIdSchema,
      text: boundedInputSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("select-option"),
      automationId: automationIdSchema,
      option: boundedInputSchema.max(160),
    })
    .strict(),
  z
    .object({
      kind: z.literal("keypress"),
      key: z.enum(["Enter", "Escape", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]),
    })
    .strict(),
]);
export type DesktopControlAction = z.infer<typeof desktopControlActionSchema>;

const maximumRequestLifetimeMs = 5 * 60 * 1_000;
const maximumExecutionMs = 30_000;

export const desktopControlPlanSchema = z
  .object({
    requestId: requestIdSchema,
    target: desktopControlTargetSchema,
    actions: z.array(desktopControlActionSchema).min(1).max(20),
    requestedAt: timestampSchema,
    expiresAt: timestampSchema,
    maximumDurationMs: z.number().int().min(1).max(maximumExecutionMs),
    recovery: z.literal("refocus-target"),
  })
  .strict()
  .superRefine((plan, context) => {
    const requested = Date.parse(plan.requestedAt);
    const expires = Date.parse(plan.expiresAt);
    if (expires <= requested || expires - requested > maximumRequestLifetimeMs)
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Desktop-control request window is invalid.",
      });
  });
export type DesktopControlPlan = z.infer<typeof desktopControlPlanSchema>;

export function desktopControlPlanDigest(plan: DesktopControlPlan): `sha256:${string}` {
  return digest(desktopControlPlanSchema.parse(plan));
}

function actionSummary(action: DesktopControlAction): string {
  switch (action.kind) {
    case "focus-window":
      return "Focus the exact approved window";
    case "invoke":
      return `Invoke automation element ${action.automationId}`;
    case "set-text":
      return `Set bounded non-secret text on ${action.automationId} (${String(action.text.length)} characters)`;
    case "select-option":
      return `Select one exact option on ${action.automationId}`;
    case "keypress":
      return `Press bounded key ${action.key}`;
  }
}

export function desktopControlApprovalStatement(
  previewId: string,
  planDigest: string,
  target: DesktopControlTarget,
): string {
  return `I approve desktop control ${previewId} at ${planDigest} for one bounded execution in ${target.applicationId} window "${target.windowTitle}".`;
}

export const desktopControlPreviewSchema = z
  .object({
    previewId: previewIdSchema,
    requestId: requestIdSchema,
    target: desktopControlTargetSchema,
    actionSummaries: z.array(z.string().min(1).max(240)).min(1).max(20),
    actionCount: z.number().int().min(1).max(20),
    planDigest: sha256DigestSchema,
    createdAt: timestampSchema,
    expiresAt: timestampSchema,
    requiredApprovalStatement: z.string().min(1).max(700),
    provider: z.literal("windows-ui-automation"),
    enabled: z.literal(false),
    authority: z.literal("none"),
  })
  .strict();
export type DesktopControlPreview = z.infer<typeof desktopControlPreviewSchema>;

export const desktopControlApprovalSchema = z
  .object({
    approvalId: approvalIdSchema,
    previewId: previewIdSchema,
    planDigest: sha256DigestSchema,
    statement: z.string().min(1).max(700),
    approver: z.literal("Founder"),
    issuedAt: timestampSchema,
    expiresAt: timestampSchema,
    oneTime: z.literal(true),
  })
  .strict()
  .superRefine((approval, context) => {
    if (Date.parse(approval.expiresAt) <= Date.parse(approval.issuedAt))
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Desktop-control approval window is invalid.",
      });
  });
export type DesktopControlApproval = z.infer<typeof desktopControlApprovalSchema>;

export const desktopControlAuditEntrySchema = z
  .object({
    sequence: z.number().int().positive(),
    requestId: z.string().min(1).max(200),
    previewId: z.string().min(1).max(200).optional(),
    outcome: z.enum(["previewed", "accepted", "denied", "cancelled", "recovered"]),
    detail: z.string().min(1).max(200),
    previousDigest: sha256DigestSchema.optional(),
    digest: sha256DigestSchema,
  })
  .strict();
export type DesktopControlAuditEntry = z.infer<typeof desktopControlAuditEntrySchema>;

export interface DesktopControlDecisionRecorder {
  record(
    requestId: string,
    previewId: string | undefined,
    outcome: DesktopControlAuditEntry["outcome"],
    detail: string,
  ): DesktopControlAuditEntry;
}

export class DesktopControlAudit implements DesktopControlDecisionRecorder {
  readonly #entries: DesktopControlAuditEntry[] = [];

  record(
    requestId: string,
    previewId: string | undefined,
    outcome: DesktopControlAuditEntry["outcome"],
    detail: string,
  ): DesktopControlAuditEntry {
    const previousDigest = this.#entries.at(-1)?.digest;
    const unsigned = {
      sequence: this.#entries.length + 1,
      requestId: requestId.slice(0, 200),
      ...(previewId === undefined ? {} : { previewId: previewId.slice(0, 200) }),
      outcome,
      detail: detail.slice(0, 200),
      ...(previousDigest === undefined ? {} : { previousDigest }),
    };
    const entry = desktopControlAuditEntrySchema.parse({ ...unsigned, digest: digest(unsigned) });
    this.#entries.push(entry);
    return entry;
  }

  entries(): DesktopControlAuditEntry[] {
    return structuredClone(this.#entries);
  }

  verify(): boolean {
    return this.#entries.every((entry, index) => {
      const { digest: actual, ...unsigned } = entry;
      return (
        unsigned.previousDigest === this.#entries[index - 1]?.digest && digest(unsigned) === actual
      );
    });
  }
}

function recordDecision(
  recorder: DesktopControlDecisionRecorder,
  requestId: string,
  previewId: string | undefined,
  outcome: DesktopControlAuditEntry["outcome"],
  detail: string,
): DesktopControlAuditEntry {
  try {
    return desktopControlAuditEntrySchema.parse(
      recorder.record(requestId, previewId, outcome, detail),
    );
  } catch {
    throw new DesktopControlDeniedError("DESKTOP_CONTROL_AUDIT_FAILED");
  }
}

function safeIdentifier(input: unknown, key: "requestId" | "previewId", fallback: string): string {
  if (typeof input === "object" && input !== null && key in input) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length > 0) return value.slice(0, 200);
  }
  return fallback;
}

function errorCode(error: unknown): string {
  return error instanceof DesktopControlDeniedError
    ? error.code
    : "DESKTOP_CONTROL_OPERATION_FAILED";
}

function assertLive(
  value: { requestedAt?: string; issuedAt?: string; expiresAt: string },
  now: Date,
): void {
  const startsAt = Date.parse(value.requestedAt ?? value.issuedAt ?? "");
  const expiresAt = Date.parse(value.expiresAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt) || startsAt > now.getTime())
    throw new DesktopControlDeniedError("DESKTOP_CONTROL_WINDOW_INVALID");
  if (expiresAt <= now.getTime()) throw new DesktopControlDeniedError("DESKTOP_CONTROL_EXPIRED");
}

export interface DesktopControlPreviewOptions {
  previewId: string;
  audit: DesktopControlDecisionRecorder;
  now?: Date;
}

export function createDesktopControlPreview(
  input: unknown,
  options: DesktopControlPreviewOptions,
): DesktopControlPreview {
  const requestId = safeIdentifier(input, "requestId", "unparseable-request");
  try {
    const plan = desktopControlPlanSchema.parse(input);
    const now = options.now ?? new Date();
    assertLive(plan, now);
    const previewId = previewIdSchema.parse(options.previewId);
    const planDigest = desktopControlPlanDigest(plan);
    const preview = desktopControlPreviewSchema.parse({
      previewId,
      requestId: plan.requestId,
      target: plan.target,
      actionSummaries: plan.actions.map(actionSummary),
      actionCount: plan.actions.length,
      planDigest,
      createdAt: now.toISOString(),
      expiresAt: plan.expiresAt,
      requiredApprovalStatement: desktopControlApprovalStatement(
        previewId,
        planDigest,
        plan.target,
      ),
      provider: "windows-ui-automation",
      enabled: false,
      authority: "none",
    });
    recordDecision(options.audit, plan.requestId, preview.previewId, "previewed", "preview sealed");
    return preview;
  } catch (error) {
    recordDecision(
      options.audit,
      requestId,
      safeIdentifier(options, "previewId", "unparseable-preview"),
      "denied",
      errorCode(error),
    );
    throw error;
  }
}

export interface DesktopControlReplayGuard {
  claim(previewId: string, planDigest: string, expiresAt: string, now: Date): void;
}

export class InMemoryDesktopControlReplayGuard implements DesktopControlReplayGuard {
  readonly #claims = new Map<string, number>();

  constructor(readonly maximumClaims = 10_000) {
    if (!Number.isInteger(maximumClaims) || maximumClaims < 1 || maximumClaims > 10_000)
      throw new DesktopControlDeniedError("DESKTOP_CONTROL_REPLAY_GUARD_INVALID");
  }

  claim(previewId: string, planDigest: string, expiresAt: string, now: Date): void {
    for (const [key, expiry] of this.#claims) if (expiry <= now.getTime()) this.#claims.delete(key);
    const key = `${previewId}:${planDigest}`;
    if (this.#claims.has(key))
      throw new DesktopControlDeniedError("DESKTOP_CONTROL_APPROVAL_REPLAYED");
    if (this.#claims.size >= this.maximumClaims)
      throw new DesktopControlDeniedError("DESKTOP_CONTROL_REPLAY_GUARD_CAPACITY");
    this.#claims.set(key, Date.parse(expiresAt));
  }
}

export const desktopControlAdapterResultSchema = z
  .object({ completedAt: timestampSchema, result: z.literal("completed") })
  .strict();
export type DesktopControlAdapterResult = z.infer<typeof desktopControlAdapterResultSchema>;

export const desktopControlRecoveryResultSchema = z
  .object({ recoveredAt: timestampSchema, result: z.literal("recovered") })
  .strict();
export type DesktopControlRecoveryResult = z.infer<typeof desktopControlRecoveryResultSchema>;

export interface DesktopControlAdapter {
  name: string;
  perform(
    target: DesktopControlTarget,
    action: DesktopControlAction,
    signal: AbortSignal,
  ): Promise<DesktopControlAdapterResult>;
  recover(
    target: DesktopControlTarget,
    reason: "action-failed",
    signal: AbortSignal,
  ): Promise<DesktopControlRecoveryResult>;
}

export interface WindowsUiAutomationRunner {
  perform(
    target: DesktopControlTarget,
    action: DesktopControlAction,
    signal: AbortSignal,
  ): Promise<DesktopControlAdapterResult>;
  recover(
    target: DesktopControlTarget,
    reason: "action-failed",
    signal: AbortSignal,
  ): Promise<DesktopControlRecoveryResult>;
}

/** Replaceable Windows UI Automation adapter; inert until `perform` or `recover`. */
export class WindowsUiAutomationAdapter implements DesktopControlAdapter {
  readonly name = "windows-ui-automation";

  constructor(readonly runner: WindowsUiAutomationRunner) {}

  perform(
    target: DesktopControlTarget,
    action: DesktopControlAction,
    signal: AbortSignal,
  ): Promise<DesktopControlAdapterResult> {
    return this.runner.perform(target, action, signal);
  }

  recover(
    target: DesktopControlTarget,
    reason: "action-failed",
    signal: AbortSignal,
  ): Promise<DesktopControlRecoveryResult> {
    return this.runner.recover(target, reason, signal);
  }
}

export const desktopControlReceiptSchema = z
  .object({
    requestId: requestIdSchema,
    previewId: previewIdSchema,
    planDigest: sha256DigestSchema,
    targetDigest: sha256DigestSchema,
    adapter: z.string().min(1).max(120),
    actionCount: z.number().int().min(1).max(20),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    finalAuditDigest: sha256DigestSchema,
    authority: z.literal("none"),
  })
  .strict();
export type DesktopControlReceipt = z.infer<typeof desktopControlReceiptSchema>;

export interface DesktopControlExecutionOptions {
  enabled?: boolean;
  audit: DesktopControlDecisionRecorder;
  replayGuard: DesktopControlReplayGuard;
  signal?: AbortSignal;
  now?: Date;
  clock?: () => Date;
  timeoutMs?: number;
}

function operationNow(options: Pick<DesktopControlExecutionOptions, "clock" | "now">): Date {
  return options.clock?.() ?? options.now ?? new Date();
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new DesktopControlDeniedError("DESKTOP_CONTROL_CANCELLED");
}

async function awaitBounded<T>(
  invoke: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<T> {
  assertNotAborted(signal);
  const controller = new AbortController();
  const combined =
    signal === undefined ? controller.signal : AbortSignal.any([signal, controller.signal]);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => {
        controller.abort();
        reject(new DesktopControlDeniedError("DESKTOP_CONTROL_TIMEOUT"));
      },
      Math.min(Math.max(timeoutMs, 1), maximumExecutionMs),
    );
  });
  const cancellationPromise = new Promise<never>((_resolve, reject) => {
    if (signal === undefined) return;
    abortListener = () => {
      controller.abort();
      reject(new DesktopControlDeniedError("DESKTOP_CONTROL_CANCELLED"));
    };
    signal.addEventListener("abort", abortListener, { once: true });
  });
  try {
    return await Promise.race([invoke(combined), timeoutPromise, cancellationPromise]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    if (abortListener !== undefined) signal?.removeEventListener("abort", abortListener);
  }
}

function assertExactBinding(
  plan: DesktopControlPlan,
  preview: DesktopControlPreview,
  approval: DesktopControlApproval,
): void {
  const planDigest = desktopControlPlanDigest(plan);
  const expectedStatement = desktopControlApprovalStatement(
    preview.previewId,
    planDigest,
    plan.target,
  );
  if (
    preview.requestId !== plan.requestId ||
    preview.planDigest !== planDigest ||
    preview.expiresAt !== plan.expiresAt ||
    preview.actionCount !== plan.actions.length ||
    JSON.stringify(preview.target) !== JSON.stringify(plan.target) ||
    JSON.stringify(preview.actionSummaries) !== JSON.stringify(plan.actions.map(actionSummary)) ||
    preview.requiredApprovalStatement !== expectedStatement ||
    approval.previewId !== preview.previewId ||
    approval.planDigest !== planDigest ||
    approval.statement !== expectedStatement
  )
    throw new DesktopControlDeniedError("DESKTOP_CONTROL_BINDING_INVALID");
}

export async function executeDesktopControl(
  planInput: unknown,
  previewInput: unknown,
  approvalInput: unknown,
  adapter: DesktopControlAdapter,
  options: DesktopControlExecutionOptions,
): Promise<DesktopControlReceipt> {
  const requestId = safeIdentifier(planInput, "requestId", "unparseable-request");
  const previewId = safeIdentifier(previewInput, "previewId", "unparseable-preview");
  try {
    const plan = desktopControlPlanSchema.parse(planInput);
    const preview = desktopControlPreviewSchema.parse(previewInput);
    const approval = desktopControlApprovalSchema.parse(approvalInput);
    const now = operationNow(options);
    if (options.enabled !== true) throw new DesktopControlDeniedError("DESKTOP_CONTROL_DISABLED");
    assertNotAborted(options.signal);
    assertLive(plan, now);
    assertLive(approval, now);
    if (Date.parse(preview.expiresAt) <= now.getTime())
      throw new DesktopControlDeniedError("DESKTOP_CONTROL_EXPIRED");
    assertExactBinding(plan, preview, approval);
    options.replayGuard.claim(preview.previewId, preview.planDigest, approval.expiresAt, now);

    const startedAt = now.toISOString();
    const started = Date.now();
    const totalTimeout = Math.min(
      plan.maximumDurationMs,
      Math.max(options.timeoutMs ?? plan.maximumDurationMs, 1),
      maximumExecutionMs,
    );
    for (const action of plan.actions) {
      assertNotAborted(options.signal);
      const remaining = totalTimeout - (Date.now() - started);
      if (remaining <= 0) throw new DesktopControlDeniedError("DESKTOP_CONTROL_TIMEOUT");
      try {
        const result = await awaitBounded(
          (signal) => adapter.perform(plan.target, action, signal),
          options.signal,
          remaining,
        );
        if (!desktopControlAdapterResultSchema.safeParse(result).success)
          throw new DesktopControlDeniedError("DESKTOP_CONTROL_ADAPTER_RESULT_INVALID");
      } catch (error) {
        if (
          error instanceof DesktopControlDeniedError &&
          ["DESKTOP_CONTROL_CANCELLED", "DESKTOP_CONTROL_TIMEOUT"].includes(error.code)
        )
          throw error;
        const recoveryRemaining = totalTimeout - (Date.now() - started);
        if (recoveryRemaining <= 0) throw new DesktopControlDeniedError("DESKTOP_CONTROL_TIMEOUT");
        try {
          const recovery = await awaitBounded(
            (signal) => adapter.recover(plan.target, "action-failed", signal),
            options.signal,
            Math.min(recoveryRemaining, 5_000),
          );
          desktopControlRecoveryResultSchema.parse(recovery);
          recordDecision(
            options.audit,
            plan.requestId,
            preview.previewId,
            "recovered",
            "target recovery completed",
          );
        } catch (recoveryError) {
          if (
            recoveryError instanceof DesktopControlDeniedError &&
            recoveryError.code === "DESKTOP_CONTROL_AUDIT_FAILED"
          )
            throw recoveryError;
          throw new DesktopControlDeniedError("DESKTOP_CONTROL_RECOVERY_FAILED", {
            cause: recoveryError,
          });
        }
        throw new DesktopControlDeniedError("DESKTOP_CONTROL_ACTION_FAILED", { cause: error });
      }
      assertNotAborted(options.signal);
      assertLive(plan, operationNow(options));
    }

    const accepted = recordDecision(
      options.audit,
      plan.requestId,
      preview.previewId,
      "accepted",
      "bounded desktop control completed",
    );
    return desktopControlReceiptSchema.parse({
      requestId: plan.requestId,
      previewId: preview.previewId,
      planDigest: preview.planDigest,
      targetDigest: digest(plan.target),
      adapter: adapter.name,
      actionCount: plan.actions.length,
      startedAt,
      completedAt: operationNow(options).toISOString(),
      finalAuditDigest: accepted.digest,
      authority: "none",
    });
  } catch (error) {
    const outcome =
      error instanceof DesktopControlDeniedError && error.code === "DESKTOP_CONTROL_CANCELLED"
        ? "cancelled"
        : "denied";
    recordDecision(options.audit, requestId, previewId, outcome, errorCode(error));
    throw error;
  }
}
