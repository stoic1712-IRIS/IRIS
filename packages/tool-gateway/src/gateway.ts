import { createHash } from "node:crypto";

import {
  governedToolRequestSchema,
  governedToolResultSchema,
  toolEffects,
  toolGrantSchema,
  toolProviderResultSchema,
  type GovernedToolRequest,
  type GovernedToolResult,
  type GovernedToolName,
  type ToolGrant,
  type ToolProvider,
} from "./contracts.js";

const secretPatterns = [
  /github_pat_[a-z0-9_]{20,}/iu,
  /gh[pousr]_[a-z0-9]{20,}/iu,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bxox[baprs]-[a-z0-9-]+/iu,
];

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function digest(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`;
}

export function governedToolRequestDigest(
  request: Omit<GovernedToolRequest, "authorization">,
): `sha256:${string}` {
  return digest(request);
}

function targetAllowed(target: string, grant: ToolGrant): boolean {
  if (grant.targetPrefixes.some((prefix) => target === prefix || target.startsWith(`${prefix}/`)))
    return true;
  if (target.startsWith("https://")) {
    try {
      return grant.allowedHosts.includes(new URL(target).hostname.toLowerCase());
    } catch {
      return false;
    }
  }
  return grant.allowedRepositories.some(
    (repository) => target === repository || target.startsWith(`${repository}/`),
  );
}

function containsSecret(value: unknown): boolean {
  const serialized = stable(value);
  return secretPatterns.some((pattern) => pattern.test(serialized));
}

interface ToolAuditEntry {
  sequence: number;
  requestId: string;
  tool: GovernedToolName;
  target: string;
  outcome: "succeeded" | "failed" | "denied";
  previousDigest?: string;
  digest: string;
}

export class GovernedToolGateway {
  readonly #providers = new Map<GovernedToolName, ToolProvider>();
  readonly #grants = new Map<string, ToolGrant>();
  readonly #audit: ToolAuditEntry[] = [];
  readonly #now: () => Date;

  constructor(options: { providers: ToolProvider[]; grants: ToolGrant[]; now?: () => Date }) {
    this.#now = options.now ?? (() => new Date());
    for (const provider of options.providers)
      for (const tool of provider.tools) {
        if (this.#providers.has(tool)) throw new Error("TOOL_PROVIDER_DUPLICATE");
        this.#providers.set(tool, provider);
      }
    for (const candidate of options.grants) {
      const grant = toolGrantSchema.parse(candidate);
      if (this.#grants.has(grant.grantId)) throw new Error("TOOL_GRANT_DUPLICATE");
      this.#grants.set(grant.grantId, grant);
    }
  }

  async execute(candidate: unknown): Promise<GovernedToolResult> {
    const request = governedToolRequestSchema.parse(candidate);
    const grant = this.#grants.get(request.grantId);
    const denial = this.#denial(request, grant);
    if (denial !== undefined) {
      this.#record(request, "denied");
      throw new Error(denial);
    }
    if (grant === undefined) throw new Error("TOOL_GRANT_MISSING");
    const provider = this.#providers.get(request.tool);
    if (provider === undefined) {
      this.#record(request, "denied");
      throw new Error("TOOL_PROVIDER_UNAVAILABLE");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, grant.timeoutMs);
    let recorded = false;
    try {
      const providerResult = toolProviderResultSchema.parse(
        await provider.execute(request, grant, controller.signal),
      );
      if (providerResult.bytes > grant.maximumResponseBytes)
        throw new Error("TOOL_RESPONSE_OVERSIZED");
      if (containsSecret(providerResult.content)) throw new Error("TOOL_SECRET_OUTPUT_DENIED");
      const effect = toolEffects[request.tool];
      if (providerResult.externalMutation !== (effect === "external-mutation"))
        throw new Error("TOOL_EFFECT_MISMATCH");
      const auditDigest = this.#record(
        request,
        providerResult.status === "succeeded" ? "succeeded" : "failed",
      );
      recorded = true;
      return governedToolResultSchema.parse({
        ...providerResult,
        requestId: request.requestId,
        tool: request.tool,
        provider: provider.name,
        effect,
        auditDigest,
      });
    } catch (error) {
      if (!recorded) this.#record(request, "failed");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  audit(): ToolAuditEntry[] {
    return structuredClone(this.#audit);
  }

  verifyAudit(): boolean {
    return this.#audit.every((entry, index) => {
      const { digest: actual, ...unsigned } = entry;
      return (
        unsigned.previousDigest === this.#audit[index - 1]?.digest && digest(unsigned) === actual
      );
    });
  }

  #denial(request: GovernedToolRequest, grant: ToolGrant | undefined): string | undefined {
    if (grant === undefined) return "TOOL_GRANT_MISSING";
    if (grant.subject !== request.subject || !grant.tools.includes(request.tool))
      return "TOOL_NOT_GRANTED";
    if (Date.parse(grant.expiresAt) <= this.#now().getTime()) return "TOOL_GRANT_EXPIRED";
    if (!targetAllowed(request.target, grant)) return "TOOL_TARGET_DENIED";
    if (containsSecret(request.arguments)) return "TOOL_SECRET_INPUT_DENIED";
    const effect = toolEffects[request.tool];
    if (effect === "write-disposable" || effect === "external-mutation") {
      const authorization = request.authorization;
      const unsigned = {
        requestId: request.requestId,
        subject: request.subject,
        grantId: request.grantId,
        tool: request.tool,
        target: request.target,
        arguments: request.arguments,
      };
      if (authorization === undefined) return "TOOL_AUTHORIZATION_DENIED";
      if (
        authorization.tool !== request.tool ||
        authorization.target !== request.target ||
        authorization.requestDigest !== governedToolRequestDigest(unsigned) ||
        Date.parse(authorization.expiresAt) <= this.#now().getTime()
      )
        return "TOOL_AUTHORIZATION_DENIED";
    }
    return undefined;
  }

  #record(request: GovernedToolRequest, outcome: ToolAuditEntry["outcome"]): string {
    const previousDigest = this.#audit.at(-1)?.digest;
    const unsigned = {
      sequence: this.#audit.length + 1,
      requestId: request.requestId,
      tool: request.tool,
      target: request.target,
      outcome,
      ...(previousDigest === undefined ? {} : { previousDigest }),
    };
    const entry = { ...unsigned, digest: digest(unsigned) };
    this.#audit.push(entry);
    return entry.digest;
  }
}
