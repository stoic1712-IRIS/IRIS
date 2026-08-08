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
    expiresAt: timestampSchema,
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
  });
export type FounderAccessRequest = z.infer<typeof founderAccessRequestSchema>;

export const founderAccessGrantSchema = founderAccessRequestSchema.extend({
  grantDigest: digestSchema,
  revokedAt: timestampSchema.optional(),
});
export type FounderAccessGrant = z.infer<typeof founderAccessGrantSchema>;

export const founderAccessAuditEventSchema = z
  .object({
    sequence: z.number().int().positive(),
    event: z.enum(["issued", "authorized", "denied", "revoked", "expired"]),
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
    const expiresAt = Date.parse(request.expiresAt);
    const now = this.#now().getTime();
    if (issuedAt > now || expiresAt <= now) throw new Error("FOUNDER_ACCESS_TIME_INVALID");
    if (expiresAt - issuedAt > this.#maximumDurationMs)
      throw new Error("FOUNDER_ACCESS_DURATION_EXCEEDED");
    for (const capability of request.capabilities)
      if (!this.#registered.has(capability))
        throw new Error(`FOUNDER_ACCESS_CAPABILITY_NOT_REGISTERED:${capability}`);
    const grant = founderAccessGrantSchema.parse({
      ...request,
      grantDigest: digest(request),
    });
    this.#grants.set(grant.requestId, grant);
    this.#record("issued", grant.requestId, "Restricted Founder Full access session issued.");
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
    if (Date.parse(grant.expiresAt) <= this.#now().getTime()) {
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
