import { describe, expect, it, vi } from "vitest";

import {
  captureRedactedScreenshot,
  InMemoryLocalWorkstationReplayGuard,
  LocalWorkstationAudit,
  LocalWorkstationDeniedError,
  PlaywrightEphemeralScreenshotAdapter,
  presentLocalNotification,
  WindowsCredentialReferenceRegistry,
  WindowsNativeNotificationAdapter,
  type EphemeralScreenshotPage,
} from "../packages/tool-gateway/src/index.js";

const now = new Date("2026-08-07T12:00:00.000Z");
const expiresAt = "2026-08-07T12:05:00.000Z";

function options() {
  return {
    audit: new LocalWorkstationAudit(),
    replayGuard: new InMemoryLocalWorkstationReplayGuard(),
    now,
  };
}

function screenshotRequest() {
  return {
    requestId: "request_10000000-0000-4000-8000-000000000010",
    target: { kind: "browser-page" as const, descriptor: "founder-command-center" },
    maximumBytes: 100_000,
    maximumWidthPx: 1_920,
    maximumHeightPx: 1_080,
    requestedAt: now.toISOString(),
    expiresAt,
  };
}

function notificationRequest() {
  return {
    requestId: "request_10000000-0000-4000-8000-000000000011",
    destination: "local" as const,
    title: "IRIS",
    body: "A governed task is ready for review.",
    urgency: "normal" as const,
    requestedAt: now.toISOString(),
    expiresAt,
  };
}

describe("Cycle Ten D Playwright screenshot adapter", () => {
  it("keeps bytes inside the adapter and releases only attested metadata", async () => {
    const bytes = Uint8Array.from([1, 2, 3, 4]);
    const screenshot = vi.fn(() => Promise.resolve(bytes));
    const count = vi.fn(() => Promise.resolve(3));
    const page: EphemeralScreenshotPage = {
      viewportSize: () => ({ width: 1_280, height: 720 }),
      locator: () => ({ count }),
      screenshot,
    };
    const adapter = new PlaywrightEphemeralScreenshotAdapter(() => Promise.resolve(page));
    const handle = await captureRedactedScreenshot(screenshotRequest(), adapter, options());
    expect(handle).toMatchObject({
      widthPx: 1_280,
      heightPx: 720,
      byteLength: 4,
      ephemeral: true,
      persisted: false,
      authority: "none",
      redaction: { attested: true, method: "solid-fill", redactedRegionCount: 3 },
    });
    expect(handle).not.toHaveProperty("bytes");
    expect(handle).not.toHaveProperty("path");
    expect(Array.from(bytes)).toEqual([0, 0, 0, 0]);
    expect(screenshot).toHaveBeenCalledWith(
      expect.objectContaining({ maskColor: "#000000", animations: "disabled" }),
    );
  });

  it("refuses non-browser targets and unavailable viewports before release", async () => {
    const page: EphemeralScreenshotPage = {
      viewportSize: () => null,
      locator: () => ({ count: () => Promise.resolve(0) }),
      screenshot: () => Promise.resolve(Uint8Array.from([1])),
    };
    const adapter = new PlaywrightEphemeralScreenshotAdapter(() => Promise.resolve(page));
    await expect(
      adapter.capture(
        { ...screenshotRequest(), target: { kind: "named-window", descriptor: "x" } },
        new AbortController().signal,
      ),
    ).rejects.toThrow("SCREENSHOT_PROVIDER_TARGET_UNSUPPORTED");
    await expect(
      captureRedactedScreenshot(screenshotRequest(), adapter, options()),
    ).rejects.toThrow("SCREENSHOT_VIEWPORT_UNAVAILABLE");
  });

  it("fails closed on cancellation before a provider call", async () => {
    const resolver = vi.fn<() => Promise<EphemeralScreenshotPage>>();
    const adapter = new PlaywrightEphemeralScreenshotAdapter(resolver);
    const controller = new AbortController();
    controller.abort();
    await expect(adapter.capture(screenshotRequest(), controller.signal)).rejects.toBeInstanceOf(
      LocalWorkstationDeniedError,
    );
    expect(resolver).not.toHaveBeenCalled();
  });
});

describe("Cycle Ten D reference-only Windows Credential Manager adapter", () => {
  it("supports exact known references without enumeration or values", () => {
    const registry = new WindowsCredentialReferenceRegistry();
    const reference = registry.register(
      {
        provider: "windows-credential-manager",
        reference: "wcm://iris/github-cli",
        label: "GitHub CLI reference",
      },
      { now },
    );
    expect(registry.size).toBe(1);
    expect(registry.get(reference.referenceId)).toEqual(reference);
    expect(reference).not.toHaveProperty("value");
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(registry))).not.toContain("list");
    expect(registry.remove(reference.referenceId)).toBe(true);
    expect(() => registry.get(reference.referenceId)).toThrow("CREDENTIAL_REFERENCE_NOT_FOUND");
  });
});

describe("Cycle Ten D Windows notification adapter", () => {
  it("uses an injected local runner and returns no payload content", async () => {
    const run = vi.fn(() => Promise.resolve());
    const adapter = new WindowsNativeNotificationAdapter(run, () => now);
    const receipt = await presentLocalNotification(notificationRequest(), adapter, options());
    expect(run).toHaveBeenCalledWith(
      { title: "IRIS", body: "A governed task is ready for review." },
      expect.any(AbortSignal),
    );
    expect(receipt).toMatchObject({
      destination: "local",
      remote: false,
      actionable: false,
      persisted: false,
      authority: "none",
    });
    expect(receipt).not.toHaveProperty("title");
    expect(receipt).not.toHaveProperty("body");
  });

  it("does not invoke the runner after cancellation", async () => {
    const run = vi.fn(() => Promise.resolve());
    const adapter = new WindowsNativeNotificationAdapter(run);
    const controller = new AbortController();
    controller.abort();
    await expect(adapter.deliver(notificationRequest(), controller.signal)).rejects.toThrow(
      "LOCAL_WORKSTATION_CANCELLED",
    );
    expect(run).not.toHaveBeenCalled();
  });
});
