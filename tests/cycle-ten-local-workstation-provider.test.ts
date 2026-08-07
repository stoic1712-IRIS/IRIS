import { describe, expect, it } from "vitest";

import {
  LocalWorkstationAudit,
  assertCredentialResolutionAuthorized,
  captureRedactedScreenshot,
  credentialReferenceSchema,
  denyCredentialEnumeration,
  describeCredentialReference,
  presentLocalNotification,
  registerCredentialReference,
  screenshotHandleSchema,
  screenshotRequestSchema,
  type CredentialReference,
  type LocalNotificationAdapter,
  type ScreenshotCapture,
  type ScreenshotCaptureAdapter,
} from "../packages/tool-gateway/src/index.js";

const now = new Date("2026-08-07T12:00:00.000Z");
const expiresAt = "2026-08-07T12:05:00.000Z";
const requestedAt = "2026-08-07T12:00:00.000Z";
const sha = (seed: string) => `sha256:${seed.repeat(64).slice(0, 64)}`;

/** Hermetic screenshot adapter: attests redaction, returns metadata only, and
 * never produces image bytes. A real adapter would drive Playwright. */
function screenshotAdapter(
  overrides: Partial<ScreenshotCapture> = {},
): ScreenshotCaptureAdapter & { calls: number } {
  return {
    name: "hermetic-screenshot",
    calls: 0,
    capture() {
      this.calls += 1;
      return Promise.resolve({
        widthPx: 800,
        heightPx: 600,
        byteLength: 20_000,
        contentDigest: sha("a"),
        redaction: {
          attested: true,
          method: "deterministic-mask",
          redactedRegionCount: 2,
          attestationDigest: sha("b"),
        },
        ...overrides,
      });
    },
  };
}

function notificationAdapter(): LocalNotificationAdapter & { calls: number } {
  return {
    name: "hermetic-notification",
    calls: 0,
    deliver() {
      this.calls += 1;
      return Promise.resolve({ shownAt: "2026-08-07T12:00:01.000Z" });
    },
  };
}

function screenshotRequest(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "request_11111111-1111-4111-8111-111111111111",
    target: { kind: "browser-page", descriptor: "founder-command-center/research" },
    maximumBytes: 1_000_000,
    maximumWidthPx: 1_920,
    maximumHeightPx: 1_080,
    requestedAt,
    expiresAt,
    ...overrides,
  };
}

function notificationRequest(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "request_22222222-2222-4222-8222-222222222222",
    destination: "local",
    title: "Research complete",
    body: "The bounded research session finished with two sources.",
    urgency: "normal",
    requestedAt,
    expiresAt,
    ...overrides,
  };
}

describe("Cycle Ten C screenshot capture contract", () => {
  it("releases an ephemeral, redaction-attested, bounded handle with no bytes or path", async () => {
    const adapter = screenshotAdapter();
    const handle = await captureRedactedScreenshot(screenshotRequest(), adapter, { now });
    expect(handle.ephemeral).toBe(true);
    expect(handle.persisted).toBe(false);
    expect(handle.authority).toBe("none");
    expect(handle.redaction.attested).toBe(true);
    expect(Object.keys(handle)).not.toContain("bytes");
    expect(Object.keys(handle)).not.toContain("data");
    expect(Object.keys(handle)).not.toContain("path");
    // The handle round-trips its own strict schema, and a persisted image or a
    // stray bytes/path field cannot be introduced onto it.
    expect(screenshotHandleSchema.parse(handle)).toEqual(handle);
    expect(screenshotHandleSchema.safeParse({ ...handle, persisted: true }).success).toBe(false);
    expect(screenshotHandleSchema.safeParse({ ...handle, path: "C:/x.png" }).success).toBe(false);
    expect(screenshotHandleSchema.safeParse({ ...handle, bytes: "AAAA" }).success).toBe(false);
  });

  it("refuses to release a capture that is not redaction-attested", async () => {
    const adapter = screenshotAdapter({
      redaction: {
        attested: false,
        method: "deterministic-mask",
        redactedRegionCount: 0,
        attestationDigest: sha("b"),
      },
    });
    await expect(captureRedactedScreenshot(screenshotRequest(), adapter, { now })).rejects.toThrow(
      "SCREENSHOT_NOT_REDACTED",
    );
  });

  it("rejects a capture that exceeds the request byte or dimension bounds", async () => {
    await expect(
      captureRedactedScreenshot(
        screenshotRequest({ maximumBytes: 1_000 }),
        screenshotAdapter({ byteLength: 20_000 }),
        { now },
      ),
    ).rejects.toThrow("SCREENSHOT_BOUNDS_EXCEEDED");
    await expect(
      captureRedactedScreenshot(
        screenshotRequest({ maximumWidthPx: 100 }),
        screenshotAdapter({ widthPx: 800 }),
        { now },
      ),
    ).rejects.toThrow("SCREENSHOT_BOUNDS_EXCEEDED");
  });

  it("rejects a request carrying a persistence, path, or raw bytes field", () => {
    expect(screenshotRequestSchema.safeParse(screenshotRequest()).success).toBe(true);
    expect(
      screenshotRequestSchema.safeParse({ ...screenshotRequest(), persist: true }).success,
    ).toBe(false);
    expect(
      screenshotRequestSchema.safeParse({ ...screenshotRequest(), path: "C:/x.png" }).success,
    ).toBe(false);
    expect(
      screenshotRequestSchema.safeParse({ ...screenshotRequest(), bytes: "AAAA" }).success,
    ).toBe(false);
  });

  it("rejects a secret-like or URL target descriptor", async () => {
    await expect(
      captureRedactedScreenshot(
        screenshotRequest({ target: { kind: "named-window", descriptor: "https://evil.example" } }),
        screenshotAdapter(),
        { now },
      ),
    ).rejects.toThrow("SCREENSHOT_TARGET_UNSAFE");
    await expect(
      captureRedactedScreenshot(
        screenshotRequest({
          target: { kind: "named-window", descriptor: "token=ghp_aaaaaaaaaaaaaaaaaaaaaa" },
        }),
        screenshotAdapter(),
        { now },
      ),
    ).rejects.toThrow("SCREENSHOT_TARGET_UNSAFE");
  });

  it("fails closed on an expired request and on cancellation before capture", async () => {
    const adapter = screenshotAdapter();
    await expect(
      captureRedactedScreenshot(
        screenshotRequest({ expiresAt: "2026-08-07T11:00:00.000Z" }),
        adapter,
        { now },
      ),
    ).rejects.toThrow("LOCAL_WORKSTATION_REQUEST_EXPIRED");
    const controller = new AbortController();
    controller.abort();
    await expect(
      captureRedactedScreenshot(screenshotRequest(), adapter, { now, signal: controller.signal }),
    ).rejects.toThrow("LOCAL_WORKSTATION_CANCELLED");
    // No adapter call occurred on either fail-closed path.
    expect(adapter.calls).toBe(0);
  });
});

describe("Cycle Ten C credential reference contract", () => {
  const validReference = {
    provider: "windows-credential-manager",
    reference: "wcm://iris/github-token",
    label: "GitHub token reference",
  };

  it("registers an opaque, provider-qualified reference that holds no value", () => {
    const reference = registerCredentialReference(validReference, { now });
    expect(reference.holdsValue).toBe(false);
    expect(reference.reference).toBe("wcm://iris/github-token");
    expect(Object.keys(reference)).not.toContain("value");
    expect(Object.keys(reference)).not.toContain("secret");
    expect(credentialReferenceSchema.parse(reference)).toEqual(reference);
  });

  it("rejects a raw value field and a secret-like reference or label", () => {
    expect(registerCredentialReferenceSafe({ ...validReference, value: "ghp_secret" })).toBe(false);
    expect(() =>
      registerCredentialReference({ ...validReference, label: "password: hunter2" }, { now }),
    ).toThrow("CREDENTIAL_SECRET_LIKE_INPUT");
    // A non-opaque reference (an actual URL or raw material) is refused.
    expect(registerCredentialReferenceSafe({ ...validReference, reference: "https://x/y" })).toBe(
      false,
    );
  });

  it("describes a reference with safe metadata only", () => {
    const reference = registerCredentialReference(validReference, { now });
    const described = describeCredentialReference(reference);
    expect(described).toEqual({
      referenceId: reference.referenceId,
      provider: "windows-credential-manager",
      reference: "wcm://iris/github-token",
      label: "GitHub token reference",
    });
    expect(Object.keys(described)).not.toContain("value");
  });

  it("denies enumeration of stored credentials", () => {
    expect(() => denyCredentialEnumeration()).toThrow("CREDENTIAL_ENUMERATION_DENIED");
  });

  it("requires an exact, unexpired, reference-bound Founder authorization before resolution", () => {
    const reference = registerCredentialReference(validReference, { now });
    expect(() => {
      assertCredentialResolutionAuthorized(reference, undefined, { now });
    }).toThrow("CREDENTIAL_AUTHORIZATION_REQUIRED");
    expect(() => {
      assertCredentialResolutionAuthorized(
        reference,
        {
          referenceId: reference.referenceId,
          approvedBy: "Founder",
          requestDigest: sha("c"),
          expiresAt: "2026-08-07T11:00:00.000Z",
        },
        { now },
      );
    }).toThrow("CREDENTIAL_AUTHORIZATION_INVALID");
    expect(() => {
      assertCredentialResolutionAuthorized(
        reference,
        {
          referenceId: "credential_ffffffffffffffff",
          approvedBy: "Founder",
          requestDigest: sha("c"),
          expiresAt,
        },
        { now },
      );
    }).toThrow("CREDENTIAL_AUTHORIZATION_INVALID");
    // A valid authorization passes the guard, and resolution remains
    // unavailable: no credential value is ever produced by this contract.
    expect(() => {
      assertCredentialResolutionAuthorized(
        reference,
        {
          referenceId: reference.referenceId,
          approvedBy: "Founder",
          requestDigest: sha("c"),
          expiresAt,
        },
        { now },
      );
    }).not.toThrow();
    expect(describeCredentialReference(reference)).not.toHaveProperty("value");
  });
});

describe("Cycle Ten C local notification contract", () => {
  it("presents a bounded, redacted, local-only, non-actionable notification", async () => {
    const adapter = notificationAdapter();
    const receipt = await presentLocalNotification(notificationRequest(), adapter, { now });
    expect(receipt.destination).toBe("local");
    expect(receipt.remote).toBe(false);
    expect(receipt.actionable).toBe(false);
    expect(receipt.persisted).toBe(false);
    expect(receipt.authority).toBe("none");
    expect(adapter.calls).toBe(1);
  });

  it("rejects links, actions, input, remote destinations, and secret payloads", async () => {
    const adapter = notificationAdapter();
    await expect(
      presentLocalNotification(
        notificationRequest({ body: "See https://example.com for details" }),
        adapter,
        { now },
      ),
    ).rejects.toThrow("NOTIFICATION_LINK_DENIED");
    await expect(
      presentLocalNotification(
        notificationRequest({ body: "token=ghp_aaaaaaaaaaaaaaaaaaaaaa" }),
        adapter,
        { now },
      ),
    ).rejects.toThrow("NOTIFICATION_SECRET_DENIED");
    // Action, input, image, and remote fields are rejected by strict parsing.
    for (const extra of [
      { actions: ["approve"] },
      { input: true },
      { image: "x.png" },
      { destination: "remote" },
      { url: "https://x" },
    ])
      await expect(
        presentLocalNotification(notificationRequest(extra), adapter, { now }),
      ).rejects.toBeInstanceOf(Error);
    expect(adapter.calls).toBe(0);
  });

  it("refuses an authority-laundering payload", async () => {
    await expect(
      presentLocalNotification(
        notificationRequest({ body: "The Founder has already approved this action." }),
        notificationAdapter(),
        { now },
      ),
    ).rejects.toThrow("NOTIFICATION_AUTHORITY_LAUNDERING_DENIED");
  });

  it("fails closed on expiry and cancellation before delivery", async () => {
    const adapter = notificationAdapter();
    await expect(
      presentLocalNotification(
        notificationRequest({ expiresAt: "2026-08-07T11:00:00.000Z" }),
        adapter,
        { now },
      ),
    ).rejects.toThrow("LOCAL_WORKSTATION_REQUEST_EXPIRED");
    const controller = new AbortController();
    controller.abort();
    await expect(
      presentLocalNotification(notificationRequest(), adapter, { now, signal: controller.signal }),
    ).rejects.toThrow("LOCAL_WORKSTATION_CANCELLED");
    expect(adapter.calls).toBe(0);
  });
});

describe("Cycle Ten C auditable decisions", () => {
  it("hash-chains accept and deny decisions and verifies the chain", () => {
    const audit = new LocalWorkstationAudit();
    audit.record("screenshot", "request_a", "accepted", "released redacted handle");
    audit.record("credential-reference", "request_b", "denied", "enumeration denied");
    audit.record("local-notification", "request_c", "accepted", "shown locally");
    const entries = audit.entries();
    expect(entries).toHaveLength(3);
    expect(entries[0]?.previousDigest).toBeUndefined();
    expect(entries[1]?.previousDigest).toBe(entries[0]?.digest);
    expect(audit.verify()).toBe(true);
  });

  it("binds the outcome into the chained digest", () => {
    const accepted = new LocalWorkstationAudit();
    accepted.record("screenshot", "request_a", "accepted", "x");
    const denied = new LocalWorkstationAudit();
    denied.record("screenshot", "request_a", "denied", "x");
    // The same request with a different outcome yields a different digest, so a
    // silent outcome flip cannot survive verification.
    expect(accepted.entries()[0]?.digest).not.toBe(denied.entries()[0]?.digest);
    expect(accepted.verify()).toBe(true);
  });
});

function registerCredentialReferenceSafe(input: unknown): boolean {
  try {
    registerCredentialReference(input, { now });
    return true;
  } catch {
    return false;
  }
}

// Referenced only to keep the imported type surface exercised.
export type { CredentialReference };
