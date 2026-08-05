import { createHash, timingSafeEqual } from "node:crypto";

import {
  canonicalIdSchema,
  correlationSchema,
  provenanceActorSchema,
  timestampSchema,
  type Correlation,
} from "@stoic-iris/contracts";
import type { JsonValue } from "@stoic-iris/coordination";
import { z } from "zod";

const safeRelativePathSchema = z
  .string()
  .min(1)
  .max(1000)
  .refine((value) => !value.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(value))
  .refine((value) => !value.replaceAll("\\", "/").split("/").includes(".."));
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const executionRequestSchema = z
  .object({
    requestId: canonicalIdSchema.refine((value) => value.startsWith("request_")),
    correlation: correlationSchema,
    requestedBy: provenanceActorSchema,
    objective: z.string().min(1).max(4000),
    idempotencyKey: z.string().min(1).max(500),
    workspace: safeRelativePathSchema,
    permittedTools: z
      .array(z.string().regex(/^[a-z][a-z0-9-]{0,99}$/))
      .min(1)
      .max(20),
    permittedPaths: z.array(safeRelativePathSchema).min(1).max(100),
    timeoutMs: z.number().int().min(10).max(300_000),
    network: z.literal("none"),
    browser: z.literal(false),
    elevated: z.literal(false),
    dockerSocket: z.literal(false),
    canonicalRepositoryMounted: z.literal(false),
    syntheticDataOnly: z.literal(true),
    input: z.record(z.string(), jsonValueSchema),
  })
  .strict();
export type ExecutionRequest = z.infer<typeof executionRequestSchema>;

export const executionActionSchema = z
  .object({
    tool: z.string().regex(/^[a-z][a-z0-9-]{0,99}$/),
    target: safeRelativePathSchema,
    outcome: z.enum(["succeeded", "failed", "denied"]),
    summary: z.string().min(1).max(1000),
  })
  .strict();
export type ExecutionAction = z.infer<typeof executionActionSchema>;

export interface ExecutorResult {
  status: "succeeded" | "failed";
  output: Record<string, JsonValue>;
  actions: ExecutionAction[];
  safeSummary: string;
}

export interface ExecutorAdapter {
  readonly provider: string;
  readonly version: string;
  health(): Promise<{ status: "ready" | "unavailable"; safeSummary: string }>;
  execute(request: ExecutionRequest, signal: AbortSignal): Promise<ExecutorResult>;
  cancel(requestId: string): Promise<void>;
}

export interface OrchestrationLifecycleEvent {
  type: "ExecutionStarted" | "ExecutionCompleted" | "ExecutionDenied" | "ExecutionFailed";
  requestId: string;
  correlation: Correlation;
  provider: string;
  occurredAt: string;
  summary: string;
}

export interface OrchestrationAuditEntry extends OrchestrationLifecycleEvent {
  sequence: number;
  outcome: "succeeded" | "failed" | "denied";
  previousDigest?: string;
  digest: string;
}

export interface GovernedExecutionResult {
  status: "succeeded" | "failed" | "denied" | "timed-out" | "duplicate";
  requestId: string;
  provider: string;
  output: Record<string, JsonValue>;
  actions: ExecutionAction[];
  safeSummary: string;
}

export interface BootstrapOrchestratorOptions {
  adapter: ExecutorAdapter;
  gatewayToken: string;
  allowedTools: string[];
  allowedWorkspacePrefix: string;
  now: () => string;
  publishLifecycle: (event: OrchestrationLifecycleEvent) => Promise<void>;
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

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`;
}

function tokensMatch(expected: string, supplied: string): boolean {
  const expectedDigest = createHash("sha256").update(expected).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

class ExecutionTimeoutError extends Error {}

function pathWithin(target: string, permitted: string): boolean {
  const normalizedTarget = target.replaceAll("\\", "/");
  const normalizedPermitted = permitted.replaceAll("\\", "/").replace(/\/$/, "");
  return (
    normalizedTarget === normalizedPermitted ||
    normalizedTarget.startsWith(`${normalizedPermitted}/`)
  );
}

export class BootstrapOrchestrator {
  readonly #adapter: ExecutorAdapter;
  readonly #gatewayToken: string;
  readonly #allowedTools: Set<string>;
  readonly #allowedWorkspacePrefix: string;
  readonly #now: () => string;
  readonly #publishLifecycle: BootstrapOrchestratorOptions["publishLifecycle"];
  readonly #audit: OrchestrationAuditEntry[] = [];
  readonly #completed = new Map<string, GovernedExecutionResult>();

  constructor(options: BootstrapOrchestratorOptions) {
    if (options.gatewayToken.length < 16) throw new Error("Gateway token is too short.");
    this.#adapter = options.adapter;
    this.#gatewayToken = options.gatewayToken;
    this.#allowedTools = new Set(options.allowedTools);
    this.#allowedWorkspacePrefix = safeRelativePathSchema.parse(options.allowedWorkspacePrefix);
    this.#now = options.now;
    this.#publishLifecycle = options.publishLifecycle;
  }

  async execute(suppliedToken: string, input: ExecutionRequest): Promise<GovernedExecutionResult> {
    const request = executionRequestSchema.parse(input);
    const existing = this.#completed.get(request.idempotencyKey);
    if (existing !== undefined) return { ...structuredClone(existing), status: "duplicate" };
    if (!tokensMatch(this.#gatewayToken, suppliedToken)) {
      return this.#finish(request, "denied", "Gateway authentication failed.", [], {}, false);
    }
    const denial = this.#policyDenial(request);
    if (denial !== undefined) return this.#finish(request, "denied", denial, [], {});
    const health = await this.#adapter.health();
    if (health.status !== "ready") {
      return this.#finish(request, "failed", "Execution provider is unavailable.", [], {});
    }
    await this.#emit(
      request,
      "ExecutionStarted",
      "Execution accepted by IRIS policy.",
      "succeeded",
    );
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutResult = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new ExecutionTimeoutError("IRIS execution timeout."));
          controller.abort();
        }, request.timeoutMs);
      });
      const providerResult = await Promise.race([
        this.#adapter.execute(structuredClone(request), controller.signal),
        timeoutResult,
      ]);
      const validatedActions = providerResult.actions.map((action) =>
        executionActionSchema.parse(action),
      );
      const invalidAction = validatedActions.find(
        (action) =>
          !request.permittedTools.includes(action.tool) ||
          !request.permittedPaths.some((permitted) => pathWithin(action.target, permitted)),
      );
      if (invalidAction !== undefined) {
        await this.#adapter.cancel(request.requestId);
        return await this.#finish(
          request,
          "denied",
          "Provider reported an action outside the approved tool or path boundary.",
          validatedActions,
          {},
        );
      }
      return await this.#finish(
        request,
        providerResult.status,
        providerResult.safeSummary,
        validatedActions,
        providerResult.output,
      );
    } catch (error) {
      await this.#adapter.cancel(request.requestId);
      const timedOut = error instanceof ExecutionTimeoutError;
      return await this.#finish(
        request,
        timedOut ? "timed-out" : "failed",
        timedOut
          ? "Execution terminated at the IRIS timeout boundary."
          : "Execution provider failed safely.",
        [],
        {},
      );
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  audit(): OrchestrationAuditEntry[] {
    return structuredClone(this.#audit);
  }

  verifyAuditChain(): boolean {
    return this.#audit.every((entry, index) => {
      const previous = this.#audit[index - 1];
      const { digest: actual, ...unsigned } = entry;
      return unsigned.previousDigest === previous?.digest && digest(unsigned) === actual;
    });
  }

  #policyDenial(request: ExecutionRequest): string | undefined {
    if (!pathWithin(request.workspace, this.#allowedWorkspacePrefix))
      return "Workspace is outside the task-scoped orchestration root.";
    if (request.permittedTools.some((tool) => !this.#allowedTools.has(tool)))
      return "Request includes a tool not approved for the bootstrap runtime.";
    if (request.permittedPaths.some((path) => !pathWithin(path, request.workspace)))
      return "Request includes a path outside its task-scoped workspace.";
    return undefined;
  }

  async #finish(
    request: ExecutionRequest,
    status: GovernedExecutionResult["status"],
    safeSummary: string,
    actions: ExecutionAction[],
    output: Record<string, JsonValue>,
    cache = true,
  ): Promise<GovernedExecutionResult> {
    const result = {
      status,
      requestId: request.requestId,
      provider: this.#adapter.provider,
      output,
      actions,
      safeSummary,
    };
    const type =
      status === "succeeded"
        ? "ExecutionCompleted"
        : status === "denied"
          ? "ExecutionDenied"
          : "ExecutionFailed";
    await this.#emit(
      request,
      type,
      safeSummary,
      status === "denied" ? "denied" : status === "succeeded" ? "succeeded" : "failed",
    );
    if (cache && (status === "succeeded" || status === "denied"))
      this.#completed.set(request.idempotencyKey, structuredClone(result));
    return result;
  }

  async #emit(
    request: ExecutionRequest,
    type: OrchestrationLifecycleEvent["type"],
    summary: string,
    outcome: OrchestrationAuditEntry["outcome"],
  ): Promise<void> {
    const lifecycle = {
      type,
      requestId: request.requestId,
      correlation: request.correlation,
      provider: this.#adapter.provider,
      occurredAt: timestampSchema.parse(this.#now()),
      summary,
    };
    await this.#publishLifecycle(lifecycle);
    const previousDigest = this.#audit.at(-1)?.digest;
    const unsigned = {
      ...lifecycle,
      sequence: this.#audit.length + 1,
      outcome,
      ...(previousDigest === undefined ? {} : { previousDigest }),
    };
    this.#audit.push({ ...unsigned, digest: digest(unsigned) });
  }
}
