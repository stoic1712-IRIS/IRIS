import { describe, expect, it } from "vitest";

import {
  InMemoryLocalWorkstationReplayGuard,
  LocalWorkstationAudit,
  assertCredentialResolutionAuthorized,
  captureRedactedScreenshot,
  credentialResolutionRequestDigest,
  credentialReferenceSchema,
  denyCredentialEnumeration,
  describeCredentialReference,
  presentLocalNotification,
  registerCredentialReference,
  screenshotHandleSchema,
  screenshotRedactionAttestationDigest,
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
    capture(request) {
      this.calls += 1;
      const base: ScreenshotCapture = {
        widthPx: 800,
        heightPx: 600,
        byteLength: 20_000,
        contentDigest: sha("a"),
        redaction: {
          attested: true,
          method: "deterministic-mask",
          redactedRegionCount: 2,
          attestationDigest: sha("0"),
        },
      };
      const capture: ScreenshotCapture = {
        ...base,
        ...overrides,
        redaction: { ...base.redaction, ...overrides.redaction },
      };
      if (overrides.redaction?.attestationDigest === undefined)
        capture.redaction.attestationDigest = screenshotRedactionAttestationDigest(
          request,
          capture,
        );
      return Promise.resolve(capture);
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

function operationOptions(
  overrides: Partial<{
    signal: AbortSignal;
    now: Date;
    clock: () => Date;
    timeoutMs: number;
  }> = {},
) {
  return {
    audit: new LocalWorkstationAudit(),
    replayGuard: new InMemoryLocalWorkstationReplayGuard(),
    now,
    ...overrides,
  };
}

function credentialAuthorization(reference: CredentialReference) {
  const binding = {
    operation: "resolve-credential-reference" as const,
    approvedBy: "Founder" as const,
    approvedAt: requestedAt,
    expiresAt,
  };
  return {
    referenceId: reference.referenceId,
    ...binding,
    requestDigest: credentialResolutionRequestDigest(reference, binding),
  };
}

describe("Cycle Ten C screenshot capture contract", () => {
  it("releases an ephemeral, redaction-attested, bounded handle with no bytes or path", async () => {
    const adapter = screenshotAdapter();
    const handle = await captureRedactedScreenshot(
      screenshotRequest(),
      adapter,
      operationOptions(),
    );
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
    await expect(
      captureRedactedScreenshot(screenshotRequest(), adapter, operationOptions()),
    ).rejects.toThrow("SCREENSHOT_NOT_REDACTED");
  });

  it("rejects a capture that exceeds the request byte or dimension bounds", async () => {
    await expect(
      captureRedactedScreenshot(
        screenshotRequest({ maximumBytes: 1_000 }),
        screenshotAdapter({ byteLength: 20_000 }),
        operationOptions(),
      ),
    ).rejects.toThrow("SCREENSHOT_BOUNDS_EXCEEDED");
    await expect(
      captureRedactedScreenshot(
        screenshotRequest({ maximumWidthPx: 100 }),
        screenshotAdapter({ widthPx: 800 }),
        operationOptions(),
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
        operationOptions(),
      ),
    ).rejects.toThrow("SCREENSHOT_TARGET_UNSAFE");
    await expect(
      captureRedactedScreenshot(
        screenshotRequest({
          target: { kind: "named-window", descriptor: "token=ghp_aaaaaaaaaaaaaaaaaaaaaa" },
        }),
        screenshotAdapter(),
        operationOptions(),
      ),
    ).rejects.toThrow("SCREENSHOT_TARGET_UNSAFE");
  });

  it("fails closed on an expired request and on cancellation before capture", async () => {
    const adapter = screenshotAdapter();
    await expect(
      captureRedactedScreenshot(
        screenshotRequest({
          requestedAt: "2026-08-07T10:55:00.000Z",
          expiresAt: "2026-08-07T11:00:00.000Z",
        }),
        adapter,
        operationOptions(),
      ),
    ).rejects.toThrow("LOCAL_WORKSTATION_REQUEST_EXPIRED");
    const controller = new AbortController();
    controller.abort();
    await expect(
      captureRedactedScreenshot(
        screenshotRequest(),
        adapter,
        operationOptions({ signal: controller.signal }),
      ),
    ).rejects.toThrow("LOCAL_WORKSTATION_CANCELLED");
    // No adapter call occurred on either fail-closed path.
    expect(adapter.calls).toBe(0);
  });

  it("binds redaction attestation to the exact target and content digest", async () => {
    const request = screenshotRequestSchema.parse(screenshotRequest());
    const material = {
      widthPx: 800,
      heightPx: 600,
      byteLength: 20_000,
      contentDigest: sha("a"),
      redaction: {
        attested: true as const,
        method: "deterministic-mask" as const,
        redactedRegionCount: 2,
        attestationDigest: sha("0"),
      },
    };
    const wrongTarget = {
      ...request,
      target: { kind: "named-window" as const, descriptor: "another-window" },
    };
    const targetAdapter = screenshotAdapter({
      redaction: {
        ...material.redaction,
        attestationDigest: screenshotRedactionAttestationDigest(wrongTarget, material),
      },
    });
    await expect(
      captureRedactedScreenshot(request, targetAdapter, operationOptions()),
    ).rejects.toThrow("SCREENSHOT_ATTESTATION_INVALID");

    const contentAdapter = screenshotAdapter({
      redaction: {
        ...material.redaction,
        attestationDigest: screenshotRedactionAttestationDigest(request, {
          ...material,
          contentDigest: sha("d"),
        }),
      },
    });
    await expect(
      captureRedactedScreenshot(request, contentAdapter, operationOptions()),
    ).rejects.toThrow("SCREENSHOT_ATTESTATION_INVALID");
  });

  it("rejects replayed, future-dated, and overlong screenshot requests", async () => {
    const adapter = screenshotAdapter();
    const options = operationOptions();
    await captureRedactedScreenshot(screenshotRequest(), adapter, options);
    await expect(captureRedactedScreenshot(screenshotRequest(), adapter, options)).rejects.toThrow(
      "LOCAL_WORKSTATION_REQUEST_REPLAYED",
    );
    expect(adapter.calls).toBe(1);
    await expect(
      captureRedactedScreenshot(
        screenshotRequest({ requestedAt: "2026-08-07T12:00:01.000Z" }),
        screenshotAdapter(),
        operationOptions(),
      ),
    ).rejects.toThrow("LOCAL_WORKSTATION_REQUEST_WINDOW_INVALID");
    await expect(
      captureRedactedScreenshot(
        screenshotRequest({ expiresAt: "2026-08-07T12:05:00.001Z" }),
        screenshotAdapter(),
        operationOptions(),
      ),
    ).rejects.toThrow("LOCAL_WORKSTATION_REQUEST_WINDOW_INVALID");
  });

  it("enforces cancellation and timeout even when the screenshot adapter ignores its signal", async () => {
    const neverAdapter: ScreenshotCaptureAdapter = {
      name: "non-cooperative-screenshot",
      capture: () => new Promise<ScreenshotCapture>(() => undefined),
    };
    const controller = new AbortController();
    const cancelled = captureRedactedScreenshot(
      screenshotRequest(),
      neverAdapter,
      operationOptions({ signal: controller.signal, timeoutMs: 100 }),
    );
    controller.abort();
    await expect(cancelled).rejects.toThrow("LOCAL_WORKSTATION_CANCELLED");
    await expect(
      captureRedactedScreenshot(
        screenshotRequest(),
        neverAdapter,
        operationOptions({ timeoutMs: 1 }),
      ),
    ).rejects.toThrow("LOCAL_WORKSTATION_TIMEOUT");
  });

  it("re-checks expiry after capture and records accepted and denied decisions", async () => {
    let current = now;
    const expiredOptions = operationOptions({ clock: () => current });
    const adapter: ScreenshotCaptureAdapter = {
      name: "expiry-transition-screenshot",
      capture(request) {
        current = new Date(expiresAt);
        return screenshotAdapter().capture(request, new AbortController().signal);
      },
    };
    await expect(
      captureRedactedScreenshot(screenshotRequest(), adapter, expiredOptions),
    ).rejects.toThrow("LOCAL_WORKSTATION_REQUEST_EXPIRED");
    expect(expiredOptions.audit.entries().at(-1)?.outcome).toBe("denied");

    const acceptedOptions = operationOptions();
    await captureRedactedScreenshot(screenshotRequest(), screenshotAdapter(), acceptedOptions);
    expect(acceptedOptions.audit.entries().at(-1)?.outcome).toBe("accepted");
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
    const audit = new LocalWorkstationAudit();
    expect(() => denyCredentialEnumeration({ audit })).toThrow("CREDENTIAL_ENUMERATION_DENIED");
    expect(audit.entries().at(-1)?.outcome).toBe("denied");
  });

  it("requires an exact, unexpired, reference-bound Founder authorization before resolution", () => {
    const reference = registerCredentialReference(validReference, { now });
    const authorization = credentialAuthorization(reference);
    expect(() => {
      assertCredentialResolutionAuthorized(reference, undefined, operationOptions());
    }).toThrow("CREDENTIAL_AUTHORIZATION_REQUIRED");
    expect(() => {
      assertCredentialResolutionAuthorized(
        reference,
        { ...authorization, requestDigest: sha("c") },
        operationOptions(),
      );
    }).toThrow("CREDENTIAL_AUTHORIZATION_INVALID");
    expect(() => {
      assertCredentialResolutionAuthorized(
        reference,
        { ...authorization, referenceId: "credential_ffffffffffffffff" },
        operationOptions(),
      );
    }).toThrow("CREDENTIAL_AUTHORIZATION_INVALID");
    expect(() => {
      assertCredentialResolutionAuthorized(
        reference,
        { ...authorization, operation: "read-secret" },
        operationOptions(),
      );
    }).toThrow("CREDENTIAL_AUTHORIZATION_REQUIRED");
    expect(() => {
      assertCredentialResolutionAuthorized(
        reference,
        { ...authorization, expiresAt: "2026-08-07T12:04:00.000Z" },
        operationOptions(),
      );
    }).toThrow("CREDENTIAL_AUTHORIZATION_INVALID");
    // A valid authorization passes the guard, and resolution remains
    // unavailable: no credential value is ever produced by this contract.
    expect(() => {
      assertCredentialResolutionAuthorized(reference, authorization, operationOptions());
    }).not.toThrow();
    expect(describeCredentialReference(reference)).not.toHaveProperty("value");
  });

  it("consumes an exact credential authorization once and audits both outcomes", () => {
    const reference = registerCredentialReference(validReference, { now });
    const authorization = credentialAuthorization(reference);
    const options = operationOptions();
    assertCredentialResolutionAuthorized(reference, authorization, options);
    expect(() => {
      assertCredentialResolutionAuthorized(reference, authorization, options);
    }).toThrow("LOCAL_WORKSTATION_REQUEST_REPLAYED");
    expect(options.audit.entries().map((entry) => entry.outcome)).toEqual(["accepted", "denied"]);
  });
});

describe("Cycle Ten C local notification contract", () => {
  it("presents a bounded, redacted, local-only, non-actionable notification", async () => {
    const adapter = notificationAdapter();
    const receipt = await presentLocalNotification(
      notificationRequest(),
      adapter,
      operationOptions(),
    );
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
        operationOptions(),
      ),
    ).rejects.toThrow("NOTIFICATION_LINK_DENIED");
    await expect(
      presentLocalNotification(
        notificationRequest({ body: "token=ghp_aaaaaaaaaaaaaaaaaaaaaa" }),
        adapter,
        operationOptions(),
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
        presentLocalNotification(notificationRequest(extra), adapter, operationOptions()),
      ).rejects.toBeInstanceOf(Error);
    expect(adapter.calls).toBe(0);
  });

  it("refuses an authority-laundering payload", async () => {
    await expect(
      presentLocalNotification(
        notificationRequest({ body: "The Founder has already approved this action." }),
        notificationAdapter(),
        operationOptions(),
      ),
    ).rejects.toThrow("NOTIFICATION_AUTHORITY_LAUNDERING_DENIED");
  });

  it("fails closed on expiry and cancellation before delivery", async () => {
    const adapter = notificationAdapter();
    await expect(
      presentLocalNotification(
        notificationRequest({
          requestedAt: "2026-08-07T10:55:00.000Z",
          expiresAt: "2026-08-07T11:00:00.000Z",
        }),
        adapter,
        operationOptions(),
      ),
    ).rejects.toThrow("LOCAL_WORKSTATION_REQUEST_EXPIRED");
    const controller = new AbortController();
    controller.abort();
    await expect(
      presentLocalNotification(
        notificationRequest(),
        adapter,
        operationOptions({ signal: controller.signal }),
      ),
    ).rejects.toThrow("LOCAL_WORKSTATION_CANCELLED");
    expect(adapter.calls).toBe(0);
  });

  it("rejects replayed, future-dated, and overlong notification requests", async () => {
    const adapter = notificationAdapter();
    const options = operationOptions();
    await presentLocalNotification(notificationRequest(), adapter, options);
    await expect(presentLocalNotification(notificationRequest(), adapter, options)).rejects.toThrow(
      "LOCAL_WORKSTATION_REQUEST_REPLAYED",
    );
    expect(adapter.calls).toBe(1);
    await expect(
      presentLocalNotification(
        notificationRequest({ requestedAt: "2026-08-07T12:00:01.000Z" }),
        notificationAdapter(),
        operationOptions(),
      ),
    ).rejects.toThrow("LOCAL_WORKSTATION_REQUEST_WINDOW_INVALID");
    await expect(
      presentLocalNotification(
        notificationRequest({ expiresAt: "2026-08-07T12:05:00.001Z" }),
        notificationAdapter(),
        operationOptions(),
      ),
    ).rejects.toThrow("LOCAL_WORKSTATION_REQUEST_WINDOW_INVALID");
  });

  it("enforces cancellation and timeout even when the notification adapter ignores its signal", async () => {
    const adapter: LocalNotificationAdapter = {
      name: "non-cooperative-notification",
      deliver: () => new Promise<{ shownAt: string }>(() => undefined),
    };
    const controller = new AbortController();
    const cancelled = presentLocalNotification(
      notificationRequest(),
      adapter,
      operationOptions({ signal: controller.signal, timeoutMs: 100 }),
    );
    controller.abort();
    await expect(cancelled).rejects.toThrow("LOCAL_WORKSTATION_CANCELLED");
    await expect(
      presentLocalNotification(notificationRequest(), adapter, operationOptions({ timeoutMs: 1 })),
    ).rejects.toThrow("LOCAL_WORKSTATION_TIMEOUT");
  });

  it("re-checks expiry after delivery and audits accepted and denied outcomes", async () => {
    let current = now;
    const expiredOptions = operationOptions({ clock: () => current });
    const adapter: LocalNotificationAdapter = {
      name: "expiry-transition-notification",
      deliver() {
        current = new Date(expiresAt);
        return Promise.resolve({ shownAt: "2026-08-07T12:00:01.000Z" });
      },
    };
    await expect(
      presentLocalNotification(notificationRequest(), adapter, expiredOptions),
    ).rejects.toThrow("LOCAL_WORKSTATION_REQUEST_EXPIRED");
    expect(expiredOptions.audit.entries().at(-1)?.outcome).toBe("denied");

    const acceptedOptions = operationOptions();
    await presentLocalNotification(notificationRequest(), notificationAdapter(), acceptedOptions);
    expect(acceptedOptions.audit.entries().at(-1)?.outcome).toBe("accepted");
  });
});

describe("Cycle Ten C auditable decisions", () => {
  it("bounds the one-shot replay ledger and fails closed at capacity", () => {
    const guard = new InMemoryLocalWorkstationReplayGuard(1);
    guard.claim("screenshot", "request_one", expiresAt, now);
    expect(() => {
      guard.claim("local-notification", "request_two", expiresAt, now);
    }).toThrow("LOCAL_WORKSTATION_REPLAY_GUARD_CAPACITY");
  });

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

  it("fails closed when the required decision recorder cannot seal an outcome", async () => {
    await expect(
      captureRedactedScreenshot(screenshotRequest(), screenshotAdapter(), {
        audit: {
          record() {
            throw new Error("audit unavailable");
          },
        },
        replayGuard: new InMemoryLocalWorkstationReplayGuard(),
        now,
      }),
    ).rejects.toThrow("LOCAL_WORKSTATION_AUDIT_FAILED");
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
