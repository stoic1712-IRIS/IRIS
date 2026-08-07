import { createHash } from "node:crypto";

import { z } from "zod";

import { canonicalIdSchema, sha256DigestSchema, timestampSchema } from "@stoic-iris/contracts";

/**
 * Cycle Ten C local-workstation capability governance.
 *
 * Provider-independent Core safety contracts for three Founder-directed local
 * workstation capabilities:
 *
 *   - ephemeral, redaction-attested screenshot capture;
 *   - opaque operating-system credential references;
 *   - local-only, non-networked native notifications.
 *
 * IRIS owns these contracts. Providers are injected adapters and are never an
 * authority. Every contract is additive, strict-schema validated, bounded,
 * cancellable, auditable, replaceable, and fails closed. No contract here
 * invokes a real operating-system, browser, credential store, notification
 * service, or desktop effect, and none exposes raw secrets, screenshot bytes,
 * or notification payloads to logs, evidence, canonical memory, or model
 * context. Windows desktop control is deliberately not provided and remains
 * blocked pending a separate Founder-approved ADR.
 */

export class LocalWorkstationDeniedError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "LocalWorkstationDeniedError";
  }
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

function scanForSecret(value: unknown): boolean {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return secretPatterns.some((pattern) => pattern.test(serialized));
}

function scanForAuthorityLaundering(text: string): boolean {
  return authorityLaunderingPattern.test(text);
}

function scanForUrl(text: string): boolean {
  return urlPattern.test(text);
}

function digest(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

const maximumRequestLifetimeMs = 5 * 60 * 1_000;

function assertLive(request: { requestedAt: string; expiresAt: string }, now: Date): void {
  const requested = Date.parse(request.requestedAt);
  const expires = Date.parse(request.expiresAt);
  if (!Number.isFinite(requested) || !Number.isFinite(expires) || expires <= requested)
    throw new LocalWorkstationDeniedError("LOCAL_WORKSTATION_REQUEST_WINDOW_INVALID");
  if (requested > now.getTime() || expires - requested > maximumRequestLifetimeMs)
    throw new LocalWorkstationDeniedError("LOCAL_WORKSTATION_REQUEST_WINDOW_INVALID");
  if (expires <= now.getTime())
    throw new LocalWorkstationDeniedError("LOCAL_WORKSTATION_REQUEST_EXPIRED");
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true)
    throw new LocalWorkstationDeniedError("LOCAL_WORKSTATION_CANCELLED");
}

/* -------------------------------------------------------------------------- */
/* Auditable hash-chained decisions                                           */
/* -------------------------------------------------------------------------- */

export const localWorkstationDecisionSchema = z
  .object({
    sequence: z.number().int().positive(),
    capability: z.enum(["screenshot", "credential-reference", "local-notification"]),
    requestId: z.string().min(1).max(200),
    outcome: z.enum(["accepted", "denied"]),
    detail: z.string().min(1).max(200),
    previousDigest: sha256DigestSchema.optional(),
    digest: sha256DigestSchema,
  })
  .strict();
export type LocalWorkstationDecision = z.infer<typeof localWorkstationDecisionSchema>;
type LocalWorkstationCapability = LocalWorkstationDecision["capability"];
type LocalWorkstationOutcome = LocalWorkstationDecision["outcome"];

export interface LocalWorkstationDecisionRecorder {
  record(
    capability: LocalWorkstationCapability,
    requestId: string,
    outcome: LocalWorkstationOutcome,
    detail: string,
  ): LocalWorkstationDecision;
}

/** A minimal, append-only, hash-chained audit of accept/deny decisions. */
export class LocalWorkstationAudit {
  readonly #entries: LocalWorkstationDecision[] = [];

  record(
    capability: LocalWorkstationDecision["capability"],
    requestId: string,
    outcome: LocalWorkstationDecision["outcome"],
    detail: string,
  ): LocalWorkstationDecision {
    const previousDigest = this.#entries.at(-1)?.digest;
    const unsigned = {
      sequence: this.#entries.length + 1,
      capability,
      requestId: requestId.slice(0, 200),
      outcome,
      detail: detail.slice(0, 200),
      ...(previousDigest === undefined ? {} : { previousDigest }),
    };
    const entry = localWorkstationDecisionSchema.parse({
      ...unsigned,
      digest: digest(unsigned),
    });
    this.#entries.push(entry);
    return entry;
  }

  entries(): LocalWorkstationDecision[] {
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

export interface LocalWorkstationReplayGuard {
  claim(
    capability: LocalWorkstationCapability,
    requestId: string,
    expiresAt: string,
    now: Date,
  ): void;
}

/** In-memory, provider-independent one-shot request guard. */
export class InMemoryLocalWorkstationReplayGuard implements LocalWorkstationReplayGuard {
  readonly #claims = new Map<string, number>();

  constructor(readonly maximumClaims = 10_000) {
    if (!Number.isInteger(maximumClaims) || maximumClaims < 1 || maximumClaims > 10_000)
      throw new LocalWorkstationDeniedError("LOCAL_WORKSTATION_REPLAY_GUARD_INVALID");
  }

  claim(
    capability: LocalWorkstationCapability,
    requestId: string,
    expiresAt: string,
    now: Date,
  ): void {
    for (const [key, expiry] of this.#claims) if (expiry <= now.getTime()) this.#claims.delete(key);
    const key = `${capability}:${requestId}`;
    if (this.#claims.has(key))
      throw new LocalWorkstationDeniedError("LOCAL_WORKSTATION_REQUEST_REPLAYED");
    if (this.#claims.size >= this.maximumClaims)
      throw new LocalWorkstationDeniedError("LOCAL_WORKSTATION_REPLAY_GUARD_CAPACITY");
    this.#claims.set(key, Date.parse(expiresAt));
  }
}

function safeDecisionId(input: unknown): string {
  if (typeof input === "object" && input !== null && "requestId" in input) {
    const value = (input as { requestId?: unknown }).requestId;
    if (typeof value === "string" && value.length > 0) return value.slice(0, 200);
  }
  return "unparseable-request";
}

function recordDecision(
  recorder: LocalWorkstationDecisionRecorder,
  capability: LocalWorkstationCapability,
  requestId: string,
  outcome: LocalWorkstationOutcome,
  detail: string,
): void {
  try {
    localWorkstationDecisionSchema.parse(recorder.record(capability, requestId, outcome, detail));
  } catch {
    throw new LocalWorkstationDeniedError("LOCAL_WORKSTATION_AUDIT_FAILED");
  }
}

function denialDetail(error: unknown): string {
  return error instanceof LocalWorkstationDeniedError
    ? error.code
    : "LOCAL_WORKSTATION_OPERATION_FAILED";
}

async function auditedOperation<T>(
  recorder: LocalWorkstationDecisionRecorder,
  capability: LocalWorkstationCapability,
  requestId: string,
  acceptedDetail: string,
  operation: () => Promise<T>,
): Promise<T> {
  let result: T;
  try {
    result = await operation();
  } catch (error) {
    recordDecision(recorder, capability, requestId, "denied", denialDetail(error));
    throw error;
  }
  recordDecision(recorder, capability, requestId, "accepted", acceptedDetail);
  return result;
}

function auditedGuard(
  recorder: LocalWorkstationDecisionRecorder,
  capability: LocalWorkstationCapability,
  requestId: string,
  acceptedDetail: string,
  operation: () => void,
): void {
  try {
    operation();
  } catch (error) {
    recordDecision(recorder, capability, requestId, "denied", denialDetail(error));
    throw error;
  }
  recordDecision(recorder, capability, requestId, "accepted", acceptedDetail);
}

interface ProviderOperationOptions {
  audit: LocalWorkstationDecisionRecorder;
  replayGuard: LocalWorkstationReplayGuard;
  signal?: AbortSignal;
  now?: Date;
  clock?: () => Date;
  timeoutMs?: number;
}

function operationNow(options: Pick<ProviderOperationOptions, "clock" | "now">): Date {
  return options.clock?.() ?? options.now ?? new Date();
}

async function awaitBoundedProvider<T>(
  invoke: (signal: AbortSignal) => Promise<T>,
  options: Pick<ProviderOperationOptions, "signal" | "timeoutMs">,
): Promise<T> {
  assertNotAborted(options.signal);
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 30_000, 1), 30_000);
  const controller = new AbortController();
  const signal =
    options.signal === undefined
      ? controller.signal
      : AbortSignal.any([options.signal, controller.signal]);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new LocalWorkstationDeniedError("LOCAL_WORKSTATION_TIMEOUT"));
    }, timeoutMs);
  });
  const cancellationPromise = new Promise<never>((_resolve, reject) => {
    if (options.signal === undefined) return;
    abortListener = () => {
      controller.abort();
      reject(new LocalWorkstationDeniedError("LOCAL_WORKSTATION_CANCELLED"));
    };
    options.signal.addEventListener("abort", abortListener, { once: true });
  });
  try {
    return await Promise.race([invoke(signal), timeoutPromise, cancellationPromise]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    if (abortListener !== undefined) options.signal?.removeEventListener("abort", abortListener);
  }
}

/* -------------------------------------------------------------------------- */
/* Screenshot capture — ephemeral, bounded, redaction-attested                */
/* -------------------------------------------------------------------------- */

const requestId = canonicalIdSchema.refine((value) => value.startsWith("request_"), {
  message: "Identifier must be a request_ canonical id.",
});

export const screenshotTargetSchema = z
  .object({
    kind: z.enum(["browser-page", "named-window", "screen-region"]),
    // Exact target scope. A capture is bound to one explicit target; there is
    // no whole-desktop or wildcard capture.
    descriptor: z.string().min(1).max(500),
  })
  .strict();
export type ScreenshotTarget = z.infer<typeof screenshotTargetSchema>;

export const screenshotRequestSchema = z
  .object({
    requestId,
    target: screenshotTargetSchema,
    maximumBytes: z.number().int().min(1).max(4_194_304),
    maximumWidthPx: z.number().int().min(1).max(8_192),
    maximumHeightPx: z.number().int().min(1).max(8_192),
    requestedAt: timestampSchema,
    expiresAt: timestampSchema,
  })
  .strict();
export type ScreenshotRequest = z.infer<typeof screenshotRequestSchema>;

const redactionFields = {
  method: z.enum(["deterministic-mask", "region-blur", "solid-fill"]),
  redactedRegionCount: z.number().int().nonnegative().max(1_000),
  attestationDigest: sha256DigestSchema,
};

/**
 * What an adapter reports about redaction. `attested` is a boolean: an honest
 * adapter that could not redact reports `false`, and the contract then refuses
 * to release the capture. This keeps redaction enforcement in the contract, not
 * only in a schema literal.
 */
export const redactionReportSchema = z
  .object({ attested: z.boolean(), ...redactionFields })
  .strict();
export type RedactionReport = z.infer<typeof redactionReportSchema>;

/** The redaction record on a released handle is always attested. */
export const redactionAttestationSchema = z
  .object({ attested: z.literal(true), ...redactionFields })
  .strict();
export type RedactionAttestation = z.infer<typeof redactionAttestationSchema>;

/**
 * What an adapter returns. Deliberately metadata-only: the adapter performs the
 * capture and redaction and reports it, but never hands raw image bytes to the
 * contract, so bytes cannot flow into a result, log, or model context.
 */
export const screenshotCaptureSchema = z
  .object({
    widthPx: z.number().int().min(1).max(8_192),
    heightPx: z.number().int().min(1).max(8_192),
    byteLength: z.number().int().min(1).max(4_194_304),
    contentDigest: sha256DigestSchema,
    redaction: redactionReportSchema,
  })
  .strict();
export type ScreenshotCapture = z.infer<typeof screenshotCaptureSchema>;

export const screenshotRedactionAttestationPayloadSchema = z
  .object({
    requestId,
    target: screenshotTargetSchema,
    widthPx: z.number().int().min(1).max(8_192),
    heightPx: z.number().int().min(1).max(8_192),
    byteLength: z.number().int().min(1).max(4_194_304),
    contentDigest: sha256DigestSchema,
    method: redactionFields.method,
    redactedRegionCount: redactionFields.redactedRegionCount,
  })
  .strict();
export type ScreenshotRedactionAttestationPayload = z.infer<
  typeof screenshotRedactionAttestationPayloadSchema
>;

/** Computes the exact Core-owned digest an adapter must attest. */
export function screenshotRedactionAttestationDigest(
  request: ScreenshotRequest,
  capture: Pick<ScreenshotCapture, "widthPx" | "heightPx" | "byteLength" | "contentDigest"> & {
    redaction: Pick<RedactionReport, "method" | "redactedRegionCount">;
  },
): `sha256:${string}` {
  const payload = screenshotRedactionAttestationPayloadSchema.parse({
    requestId: request.requestId,
    target: request.target,
    widthPx: capture.widthPx,
    heightPx: capture.heightPx,
    byteLength: capture.byteLength,
    contentDigest: capture.contentDigest,
    method: capture.redaction.method,
    redactedRegionCount: capture.redaction.redactedRegionCount,
  });
  return digest(payload);
}

export const screenshotHandleSchema = z
  .object({
    screenshotId: z.string().regex(/^screenshot_[a-f0-9]{16}$/u),
    target: screenshotTargetSchema,
    capturedAt: timestampSchema,
    expiresAt: timestampSchema,
    widthPx: z.number().int().min(1).max(8_192),
    heightPx: z.number().int().min(1).max(8_192),
    byteLength: z.number().int().min(1).max(4_194_304),
    contentDigest: sha256DigestSchema,
    redaction: redactionAttestationSchema,
    // Structural guarantees: the image is ephemeral and unpersistable through
    // this contract, and it carries no authority.
    ephemeral: z.literal(true),
    persisted: z.literal(false),
    authority: z.literal("none"),
  })
  .strict();
export type ScreenshotHandle = z.infer<typeof screenshotHandleSchema>;

export interface ScreenshotCaptureAdapter {
  readonly name: string;
  capture(request: ScreenshotRequest, signal: AbortSignal): Promise<ScreenshotCapture>;
}

/**
 * Captures one ephemeral, redaction-attested screenshot handle. The handle is
 * released only when the adapter attests redaction and the capture is within
 * the request's exact byte and dimension bounds. No bytes, path, or persistence
 * field can exist on the handle.
 */
export async function captureRedactedScreenshot(
  input: unknown,
  adapter: ScreenshotCaptureAdapter,
  options: ProviderOperationOptions,
): Promise<ScreenshotHandle> {
  const decisionId = safeDecisionId(input);
  return auditedOperation(
    options.audit,
    "screenshot",
    decisionId,
    "redacted handle released",
    async () => {
      const request = screenshotRequestSchema.parse(input);
      const startedAt = operationNow(options);
      assertLive(request, startedAt);
      assertNotAborted(options.signal);
      if (scanForSecret(request.target.descriptor) || scanForUrl(request.target.descriptor))
        throw new LocalWorkstationDeniedError("SCREENSHOT_TARGET_UNSAFE");
      options.replayGuard.claim("screenshot", request.requestId, request.expiresAt, startedAt);
      const capture = screenshotCaptureSchema.parse(
        await awaitBoundedProvider((signal) => adapter.capture(request, signal), options),
      );
      assertNotAborted(options.signal);
      const completedAt = operationNow(options);
      assertLive(request, completedAt);
      if (!capture.redaction.attested)
        throw new LocalWorkstationDeniedError("SCREENSHOT_NOT_REDACTED");
      if (
        capture.redaction.attestationDigest !==
        screenshotRedactionAttestationDigest(request, capture)
      )
        throw new LocalWorkstationDeniedError("SCREENSHOT_ATTESTATION_INVALID");
      if (
        capture.byteLength > request.maximumBytes ||
        capture.widthPx > request.maximumWidthPx ||
        capture.heightPx > request.maximumHeightPx
      )
        throw new LocalWorkstationDeniedError("SCREENSHOT_BOUNDS_EXCEEDED");
      return screenshotHandleSchema.parse({
        screenshotId: `screenshot_${createHash("sha256")
          .update(`${request.requestId}:${capture.contentDigest}`)
          .digest("hex")
          .slice(0, 16)}`,
        target: request.target,
        capturedAt: completedAt.toISOString(),
        expiresAt: request.expiresAt,
        widthPx: capture.widthPx,
        heightPx: capture.heightPx,
        byteLength: capture.byteLength,
        contentDigest: capture.contentDigest,
        redaction: capture.redaction,
        ephemeral: true,
        persisted: false,
        authority: "none",
      });
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Credential references — opaque, provider-qualified, never resolved here     */
/* -------------------------------------------------------------------------- */

export const credentialProviderSchema = z.literal("windows-credential-manager");

export const credentialReferenceSchema = z
  .object({
    referenceId: z.string().regex(/^credential_[a-f0-9]{16}$/u),
    provider: credentialProviderSchema,
    // Opaque, provider-qualified pointer. Never a value: a `wcm://` locator
    // that names a stored item without revealing anything about it.
    reference: z.string().regex(/^wcm:\/\/[A-Za-z0-9._/-]{1,200}$/u),
    label: z.string().min(1).max(120),
    createdAt: timestampSchema,
    // Structural guarantee that this object is a pointer, not material.
    holdsValue: z.literal(false),
  })
  .strict();
export type CredentialReference = z.infer<typeof credentialReferenceSchema>;

export const credentialReferenceInputSchema = z
  .object({
    provider: credentialProviderSchema,
    reference: z.string().regex(/^wcm:\/\/[A-Za-z0-9._/-]{1,200}$/u),
    label: z.string().min(1).max(120),
  })
  .strict();

/**
 * Registers an opaque credential reference. A registration that carries a
 * secret-like value, a raw value field (rejected by strict parsing), or
 * secret-like metadata is refused. No credential store is touched.
 */
export function registerCredentialReference(
  input: unknown,
  options: { now?: Date } = {},
): CredentialReference {
  const now = options.now ?? new Date();
  const parsed = credentialReferenceInputSchema.parse(input);
  if (scanForSecret(parsed.label) || scanForSecret(parsed.reference))
    throw new LocalWorkstationDeniedError("CREDENTIAL_SECRET_LIKE_INPUT");
  return credentialReferenceSchema.parse({
    referenceId: `credential_${createHash("sha256")
      .update(`${parsed.provider}:${parsed.reference}`)
      .digest("hex")
      .slice(0, 16)}`,
    provider: parsed.provider,
    reference: parsed.reference,
    label: parsed.label,
    createdAt: now.toISOString(),
    holdsValue: false,
  });
}

/** Returns only safe metadata. There is no field through which a value flows. */
export function describeCredentialReference(reference: CredentialReference): {
  referenceId: string;
  provider: string;
  reference: string;
  label: string;
} {
  const parsed = credentialReferenceSchema.parse(reference);
  return {
    referenceId: parsed.referenceId,
    provider: parsed.provider,
    reference: parsed.reference,
    label: parsed.label,
  };
}

/** Enumeration is never permitted: listing stored credentials is refused. */
export function denyCredentialEnumeration(options: {
  audit: LocalWorkstationDecisionRecorder;
}): never {
  auditedGuard(
    options.audit,
    "credential-reference",
    "credential-enumeration",
    "unreachable",
    () => {
      throw new LocalWorkstationDeniedError("CREDENTIAL_ENUMERATION_DENIED");
    },
  );
  throw new LocalWorkstationDeniedError("CREDENTIAL_ENUMERATION_DENIED");
}

export const credentialResolutionOperationSchema = z.literal("resolve-credential-reference");

export const credentialResolutionAuthorizationPayloadSchema = z
  .object({
    referenceId: z.string().regex(/^credential_[a-f0-9]{16}$/u),
    provider: credentialProviderSchema,
    reference: z.string().regex(/^wcm:\/\/[A-Za-z0-9._/-]{1,200}$/u),
    operation: credentialResolutionOperationSchema,
    approvedBy: z.literal("Founder"),
    approvedAt: timestampSchema,
    expiresAt: timestampSchema,
  })
  .strict();
export type CredentialResolutionAuthorizationPayload = z.infer<
  typeof credentialResolutionAuthorizationPayloadSchema
>;

export function credentialResolutionRequestDigest(
  reference: CredentialReference,
  authorization: Pick<
    CredentialResolutionAuthorizationPayload,
    "operation" | "approvedBy" | "approvedAt" | "expiresAt"
  >,
): `sha256:${string}` {
  const parsedReference = credentialReferenceSchema.parse(reference);
  return digest(
    credentialResolutionAuthorizationPayloadSchema.parse({
      referenceId: parsedReference.referenceId,
      provider: parsedReference.provider,
      reference: parsedReference.reference,
      ...authorization,
    }),
  );
}

export const credentialResolutionAuthorizationSchema = z
  .object({
    referenceId: z.string().regex(/^credential_[a-f0-9]{16}$/u),
    operation: credentialResolutionOperationSchema,
    approvedBy: z.literal("Founder"),
    approvedAt: timestampSchema,
    requestDigest: sha256DigestSchema,
    expiresAt: timestampSchema,
  })
  .strict();
export type CredentialResolutionAuthorization = z.infer<
  typeof credentialResolutionAuthorizationSchema
>;

/**
 * Guards credential resolution. Resolution — retrieving a real secret value —
 * is out of scope for this tranche and is never performed here, but the guard
 * proves the requirement: without an exact, unexpired, reference-bound Founder
 * authorization, resolution is denied; with one, resolution remains
 * unavailable, so no secret is ever accessed in this contract.
 */
export function assertCredentialResolutionAuthorized(
  reference: CredentialReference,
  authorization: unknown,
  options: {
    audit: LocalWorkstationDecisionRecorder;
    replayGuard: LocalWorkstationReplayGuard;
    now?: Date;
    clock?: () => Date;
  },
): void {
  auditedGuard(
    options.audit,
    "credential-reference",
    reference.referenceId,
    "exact resolution authorization accepted",
    () => {
      const parsedReference = credentialReferenceSchema.parse(reference);
      const parsed = credentialResolutionAuthorizationSchema.safeParse(authorization);
      if (!parsed.success)
        throw new LocalWorkstationDeniedError("CREDENTIAL_AUTHORIZATION_REQUIRED");
      const current = options.clock?.() ?? options.now ?? new Date();
      assertLive(
        { requestedAt: parsed.data.approvedAt, expiresAt: parsed.data.expiresAt },
        current,
      );
      const expectedDigest = credentialResolutionRequestDigest(parsedReference, {
        operation: parsed.data.operation,
        approvedBy: parsed.data.approvedBy,
        approvedAt: parsed.data.approvedAt,
        expiresAt: parsed.data.expiresAt,
      });
      if (
        parsed.data.referenceId !== parsedReference.referenceId ||
        parsed.data.requestDigest !== expectedDigest
      )
        throw new LocalWorkstationDeniedError("CREDENTIAL_AUTHORIZATION_INVALID");
      options.replayGuard.claim(
        "credential-reference",
        parsed.data.requestDigest,
        parsed.data.expiresAt,
        current,
      );
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Local notifications — local-only, redacted, non-actionable                  */
/* -------------------------------------------------------------------------- */

export const localNotificationRequestSchema = z
  .object({
    requestId,
    // The only permitted destination. There is no remote or networked option.
    destination: z.literal("local"),
    title: z.string().min(1).max(120),
    body: z.string().min(1).max(500),
    urgency: z.enum(["low", "normal"]),
    requestedAt: timestampSchema,
    expiresAt: timestampSchema,
  })
  .strict();
export type LocalNotificationRequest = z.infer<typeof localNotificationRequestSchema>;

export const localNotificationReceiptSchema = z
  .object({
    notificationId: z.string().regex(/^notification_[a-f0-9]{16}$/u),
    destination: z.literal("local"),
    shownAt: timestampSchema,
    urgency: z.enum(["low", "normal"]),
    // Structural guarantees.
    persisted: z.literal(false),
    remote: z.literal(false),
    actionable: z.literal(false),
    authority: z.literal("none"),
  })
  .strict();
export type LocalNotificationReceipt = z.infer<typeof localNotificationReceiptSchema>;

export interface LocalNotificationAdapter {
  readonly name: string;
  deliver(request: LocalNotificationRequest, signal: AbortSignal): Promise<{ shownAt: string }>;
}

/**
 * Presents one bounded, redacted, local-only notification through an injected
 * adapter. A request with a link, a remote destination (rejected by strict
 * parsing), a secret-like or authority-laundering payload, or an action field
 * (rejected by strict parsing) is refused before any adapter call. The receipt
 * carries no content and cannot persist.
 */
export async function presentLocalNotification(
  input: unknown,
  adapter: LocalNotificationAdapter,
  options: ProviderOperationOptions,
): Promise<LocalNotificationReceipt> {
  const decisionId = safeDecisionId(input);
  return auditedOperation(
    options.audit,
    "local-notification",
    decisionId,
    "local notification receipt released",
    async () => {
      const request = localNotificationRequestSchema.parse(input);
      const startedAt = operationNow(options);
      assertLive(request, startedAt);
      assertNotAborted(options.signal);
      const text = `${request.title}\n${request.body}`;
      if (scanForUrl(text)) throw new LocalWorkstationDeniedError("NOTIFICATION_LINK_DENIED");
      if (scanForSecret(text)) throw new LocalWorkstationDeniedError("NOTIFICATION_SECRET_DENIED");
      if (scanForAuthorityLaundering(text))
        throw new LocalWorkstationDeniedError("NOTIFICATION_AUTHORITY_LAUNDERING_DENIED");
      options.replayGuard.claim(
        "local-notification",
        request.requestId,
        request.expiresAt,
        startedAt,
      );
      const { shownAt } = await awaitBoundedProvider(
        (signal) => adapter.deliver(request, signal),
        options,
      );
      assertNotAborted(options.signal);
      assertLive(request, operationNow(options));
      return localNotificationReceiptSchema.parse({
        notificationId: `notification_${createHash("sha256")
          .update(`${request.requestId}:${shownAt}`)
          .digest("hex")
          .slice(0, 16)}`,
        destination: "local",
        shownAt,
        urgency: request.urgency,
        persisted: false,
        remote: false,
        actionable: false,
        authority: "none",
      });
    },
  );
}
