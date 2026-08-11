import { createHash } from "node:crypto";

import { z } from "zod";

const timestampSchema = z.iso.datetime();
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

export const ordinaryCapabilitySchema = z.enum([
  "goal.manage",
  "research.search",
  "browser.inspect",
  "connector.call-approved",
  "repository.inspect",
  "repository.edit-bounded",
  "terminal.run-approved",
  "dependencies.materialize-approved",
  "verification.run",
  "repair.execute-bounded",
  "repository.commit-candidate",
  "repository.push-branch",
  "repository.create-pull-request",
  "repository.monitor-ci",
  "repository.address-review",
  "repository.merge-reviewed-head",
  "repository.verify-remote",
  "repository.synchronize",
  "repository.rollback-history-preserving",
  "workspace.cleanup",
  "runtime.manage-local",
  "desktop.preview",
  "desktop.operate-bounded",
  "capability.acquire-approved",
  "notification.local",
]);
export type OrdinaryCapability = z.infer<typeof ordinaryCapabilitySchema>;

export const protectedCapabilitySchema = z.enum([
  "credential.read-secret",
  "spending.authorize",
  "deployment.execute",
  "network.expose-public-or-lan",
  "repository.administer",
  "repository.force-push",
  "repository.rewrite-history",
  "data.destroy",
  "phase-zero.graduate",
]);

const founderSessionBindingSchema = z
  .object({
    founderSessionId: z.string().regex(/^session_[a-z0-9-]{8,100}$/u),
    gatewayBootId: z.string().regex(/^boot_[a-z0-9-]{8,100}$/u),
  })
  .strict();

export const founderAccessRequestSchema = z
  .object({
    requestId: z.string().regex(/^access_[a-z0-9-]{8,100}$/u),
    founderId: z.literal("Founder"),
    authenticated: z.literal(true),
    profile: z.enum(["restricted-full-access", "founder-full-access"]),
    capabilities: z.array(ordinaryCapabilitySchema).min(1).max(32),
    sessionBinding: founderSessionBindingSchema.optional(),
    issuedAt: timestampSchema,
    expiresAt: timestampSchema.optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.profile === "founder-full-access" && request.sessionBinding === undefined) {
      context.addIssue({
        code: "custom",
        path: ["sessionBinding"],
        message: "Founder Full access requires an authenticated session binding.",
      });
    }
    if (request.profile === "restricted-full-access" && request.expiresAt === undefined) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "The legacy restricted access profile requires a bounded expiry.",
      });
    }
  });
export type FounderAccessRequest = z.infer<typeof founderAccessRequestSchema>;

export const founderAccessGrantSchema = founderAccessRequestSchema.extend({
  grantDigest: digestSchema,
  lifecycle: z.enum(["time-bounded", "session-bound"]),
  revokedAt: timestampSchema.optional(),
  invalidatedAt: timestampSchema.optional(),
  invalidationReason: z
    .enum(["logout", "emergency-stop", "session-invalidation", "gateway-replacement"])
    .optional(),
});
export type FounderAccessGrant = z.infer<typeof founderAccessGrantSchema>;

export const founderAccessAuditEventSchema = z
  .object({
    sequence: z.number().int().positive(),
    event: z.enum(["issued", "authorized", "denied", "revoked", "expired", "invalidated"]),
    requestId: z.string().regex(/^access_[a-z0-9-]{8,100}$/u),
    capability: ordinaryCapabilitySchema.optional(),
    occurredAt: timestampSchema,
    summary: z.string().min(1).max(500),
    previousDigest: digestSchema.optional(),
    digest: digestSchema,
  })
  .strict();
export type FounderAccessAuditEvent = z.infer<typeof founderAccessAuditEventSchema>;

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function unique(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}

export class FounderAccessRegistry {
  readonly #registered: ReadonlySet<OrdinaryCapability>;
  readonly #maximumDurationMs: number;
  readonly #now: () => Date;
  readonly #founderSessionId: string | undefined;
  readonly #gatewayBootId: string | undefined;
  readonly #grants = new Map<string, FounderAccessGrant>();
  readonly #events: FounderAccessAuditEvent[] = [];

  constructor(options: {
    registeredCapabilities: readonly OrdinaryCapability[];
    maximumDurationMs?: number;
    founderSessionId?: string;
    gatewayBootId?: string;
    now?: () => Date;
  }) {
    const registered = z
      .array(ordinaryCapabilitySchema)
      .min(1)
      .parse(options.registeredCapabilities);
    if (!unique(registered)) throw new Error("FOUNDER_ACCESS_REGISTERED_CAPABILITY_DUPLICATE");
    this.#registered = new Set(registered);
    this.#maximumDurationMs = z
      .number()
      .int()
      .min(60_000)
      .max(7 * 24 * 60 * 60 * 1_000)
      .parse(options.maximumDurationMs ?? 24 * 60 * 60 * 1_000);
    this.#founderSessionId = options.founderSessionId;
    this.#gatewayBootId = options.gatewayBootId;
    this.#now = options.now ?? (() => new Date());
  }

  issue(input: FounderAccessRequest): FounderAccessGrant {
    const request = founderAccessRequestSchema.parse(input);
    if (this.#grants.has(request.requestId)) throw new Error("FOUNDER_ACCESS_REQUEST_REPLAY");
    if (
      request.profile === "founder-full-access" &&
      (request.sessionBinding?.founderSessionId !== this.#founderSessionId ||
        request.sessionBinding?.gatewayBootId !== this.#gatewayBootId)
    )
      throw new Error("FOUNDER_ACCESS_SESSION_MISMATCH");
    if (!unique(request.capabilities)) throw new Error("FOUNDER_ACCESS_CAPABILITY_DUPLICATE");
    const issuedAt = Date.parse(request.issuedAt);
    const now = this.#now().getTime();
    if (issuedAt > now) throw new Error("FOUNDER_ACCESS_TIME_INVALID");
    if (request.profile === "restricted-full-access") {
      if (request.expiresAt === undefined) throw new Error("FOUNDER_ACCESS_TIME_INVALID");
      const expiresAt = Date.parse(request.expiresAt);
      if (expiresAt <= now) throw new Error("FOUNDER_ACCESS_TIME_INVALID");
      if (expiresAt - issuedAt > this.#maximumDurationMs)
        throw new Error("FOUNDER_ACCESS_DURATION_EXCEEDED");
    }
    for (const capability of request.capabilities)
      if (!this.#registered.has(capability))
        throw new Error(`FOUNDER_ACCESS_CAPABILITY_NOT_REGISTERED:${capability}`);
    if (
      request.profile === "founder-full-access" &&
      (request.capabilities.length !== this.#registered.size ||
        [...this.#registered].some((capability) => !request.capabilities.includes(capability)))
    )
      throw new Error("FOUNDER_FULL_ACCESS_CAPABILITY_SET_INCOMPLETE");
    const grant = founderAccessGrantSchema.parse({
      ...request,
      lifecycle: request.profile === "founder-full-access" ? "session-bound" : "time-bounded",
      grantDigest: digest(request),
    });
    this.#grants.set(grant.requestId, grant);
    this.#record(
      "issued",
      grant.requestId,
      grant.lifecycle === "session-bound"
        ? "Founder Full access session issued."
        : "Restricted time-bounded access session issued.",
    );
    return structuredClone(grant);
  }

  authorize(requestId: string, capability: OrdinaryCapability): FounderAccessGrant {
    const parsedCapability = ordinaryCapabilitySchema.parse(capability);
    const grant = this.#grants.get(requestId);
    if (grant === undefined) {
      this.#record("denied", requestId, "Access request was not found.", parsedCapability);
      throw new Error("FOUNDER_ACCESS_NOT_FOUND");
    }
    if (grant.revokedAt !== undefined) {
      this.#record("denied", requestId, "Access session is revoked.", parsedCapability);
      throw new Error("FOUNDER_ACCESS_REVOKED");
    }
    if (grant.invalidatedAt !== undefined) {
      this.#record("denied", requestId, "Founder session is invalidated.", parsedCapability);
      throw new Error("FOUNDER_ACCESS_SESSION_INVALIDATED");
    }
    if (
      grant.lifecycle === "session-bound" &&
      (grant.sessionBinding?.founderSessionId !== this.#founderSessionId ||
        grant.sessionBinding?.gatewayBootId !== this.#gatewayBootId)
    ) {
      this.#record("denied", requestId, "Founder session binding changed.", parsedCapability);
      throw new Error("FOUNDER_ACCESS_SESSION_MISMATCH");
    }
    if (
      grant.lifecycle === "time-bounded" &&
      grant.expiresAt !== undefined &&
      Date.parse(grant.expiresAt) <= this.#now().getTime()
    ) {
      this.#record("expired", requestId, "Access session expired.", parsedCapability);
      throw new Error("FOUNDER_ACCESS_EXPIRED");
    }
    if (!grant.capabilities.includes(parsedCapability)) {
      this.#record(
        "denied",
        requestId,
        "Capability is outside the session grant.",
        parsedCapability,
      );
      throw new Error("FOUNDER_ACCESS_CAPABILITY_DENIED");
    }
    this.#record("authorized", requestId, "Ordinary capability authorized.", parsedCapability);
    return structuredClone(grant);
  }

  revoke(requestId: string): FounderAccessGrant {
    const grant = this.#grants.get(requestId);
    if (grant === undefined) throw new Error("FOUNDER_ACCESS_NOT_FOUND");
    if (grant.revokedAt === undefined) {
      grant.revokedAt = this.#now().toISOString();
      this.#record("revoked", requestId, "Founder revoked the access session.");
    }
    return structuredClone(founderAccessGrantSchema.parse(grant));
  }

  invalidateSession(
    requestId: string,
    reason: "logout" | "emergency-stop" | "session-invalidation" | "gateway-replacement",
  ): FounderAccessGrant {
    const grant = this.#grants.get(requestId);
    if (grant === undefined) throw new Error("FOUNDER_ACCESS_NOT_FOUND");
    if (grant.lifecycle !== "session-bound")
      throw new Error("FOUNDER_ACCESS_SESSION_LIFECYCLE_REQUIRED");
    if (grant.invalidatedAt === undefined) {
      grant.invalidatedAt = this.#now().toISOString();
      grant.invalidationReason = reason;
      this.#record("invalidated", requestId, `Founder session invalidated: ${reason}.`);
    }
    return structuredClone(founderAccessGrantSchema.parse(grant));
  }

  grant(requestId: string): FounderAccessGrant | undefined {
    const grant = this.#grants.get(requestId);
    return grant === undefined ? undefined : structuredClone(grant);
  }

  audit(): FounderAccessAuditEvent[] {
    return structuredClone(this.#events);
  }

  auditVerified(): boolean {
    return this.#events.every((event, index) => {
      const { digest: actual, ...unsigned } = event;
      return (
        event.sequence === index + 1 &&
        unsigned.previousDigest === this.#events[index - 1]?.digest &&
        digest(unsigned) === actual
      );
    });
  }

  #record(
    event: FounderAccessAuditEvent["event"],
    requestId: string,
    summary: string,
    capability?: OrdinaryCapability,
  ): void {
    const unsigned = {
      sequence: this.#events.length + 1,
      event,
      requestId,
      ...(capability === undefined ? {} : { capability }),
      occurredAt: this.#now().toISOString(),
      summary,
      ...(this.#events.at(-1) === undefined ? {} : { previousDigest: this.#events.at(-1)?.digest }),
    };
    this.#events.push(
      founderAccessAuditEventSchema.parse({ ...unsigned, digest: digest(unsigned) }),
    );
  }
}
