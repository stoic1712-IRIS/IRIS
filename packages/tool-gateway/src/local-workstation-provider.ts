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

function assertLive(request: { expiresAt: string }, now: Date): void {
  const expires = Date.parse(request.expiresAt);
  if (!Number.isFinite(expires) || expires <= now.getTime())
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
  options: { signal?: AbortSignal; now?: Date } = {},
): Promise<ScreenshotHandle> {
  const now = options.now ?? new Date();
  const request = screenshotRequestSchema.parse(input);
  assertLive(request, now);
  assertNotAborted(options.signal);
  if (scanForSecret(request.target.descriptor) || scanForUrl(request.target.descriptor))
    throw new LocalWorkstationDeniedError("SCREENSHOT_TARGET_UNSAFE");
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 30_000);
  const signal =
    options.signal === undefined
      ? controller.signal
      : AbortSignal.any([options.signal, controller.signal]);
  let capture: ScreenshotCapture;
  try {
    capture = screenshotCaptureSchema.parse(await adapter.capture(request, signal));
  } finally {
    clearTimeout(timeout);
  }
  if (!capture.redaction.attested) throw new LocalWorkstationDeniedError("SCREENSHOT_NOT_REDACTED");
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
    capturedAt: now.toISOString(),
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
export function denyCredentialEnumeration(): never {
  throw new LocalWorkstationDeniedError("CREDENTIAL_ENUMERATION_DENIED");
}

export const credentialResolutionAuthorizationSchema = z
  .object({
    referenceId: z.string().regex(/^credential_[a-f0-9]{16}$/u),
    approvedBy: z.literal("Founder"),
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
  options: { now?: Date } = {},
): void {
  const now = options.now ?? new Date();
  const parsed = credentialResolutionAuthorizationSchema.safeParse(authorization);
  if (!parsed.success) throw new LocalWorkstationDeniedError("CREDENTIAL_AUTHORIZATION_REQUIRED");
  if (
    parsed.data.referenceId !== reference.referenceId ||
    Date.parse(parsed.data.expiresAt) <= now.getTime()
  )
    throw new LocalWorkstationDeniedError("CREDENTIAL_AUTHORIZATION_INVALID");
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
  options: { signal?: AbortSignal; now?: Date } = {},
): Promise<LocalNotificationReceipt> {
  const now = options.now ?? new Date();
  const request = localNotificationRequestSchema.parse(input);
  assertLive(request, now);
  assertNotAborted(options.signal);
  const text = `${request.title}\n${request.body}`;
  if (scanForUrl(text)) throw new LocalWorkstationDeniedError("NOTIFICATION_LINK_DENIED");
  if (scanForSecret(text)) throw new LocalWorkstationDeniedError("NOTIFICATION_SECRET_DENIED");
  if (scanForAuthorityLaundering(text))
    throw new LocalWorkstationDeniedError("NOTIFICATION_AUTHORITY_LAUNDERING_DENIED");
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 30_000);
  const signal =
    options.signal === undefined
      ? controller.signal
      : AbortSignal.any([options.signal, controller.signal]);
  let shownAt: string;
  try {
    ({ shownAt } = await adapter.deliver(request, signal));
  } finally {
    clearTimeout(timeout);
  }
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
}
