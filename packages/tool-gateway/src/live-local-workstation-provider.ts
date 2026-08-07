import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

import {
  credentialReferenceSchema,
  LocalWorkstationDeniedError,
  registerCredentialReference,
  screenshotRedactionAttestationDigest,
  type CredentialReference,
  type LocalNotificationAdapter,
  type LocalNotificationRequest,
  type ScreenshotCapture,
  type ScreenshotCaptureAdapter,
  type ScreenshotRequest,
} from "./local-workstation-provider.js";

/**
 * Cycle Ten D live-provider adapters.
 *
 * The adapters are inert until an authorized caller supplies a page resolver
 * or invokes the notification adapter. Tests inject fakes; no live screenshot,
 * credential-store access, or notification effect is required to verify them.
 */

export interface MaskableLocator {
  count(): Promise<number>;
}

export interface EphemeralScreenshotPage {
  viewportSize(): { width: number; height: number } | null;
  locator(selector: string): MaskableLocator;
  screenshot(options: {
    type: "png";
    animations: "disabled";
    caret: "hide";
    mask: MaskableLocator[];
    maskColor: string;
  }): Promise<Uint8Array>;
}

export type ScreenshotPageResolver = (
  descriptor: string,
  signal: AbortSignal,
) => Promise<EphemeralScreenshotPage>;

const sensitivePageSelector = [
  "input[type='password']",
  "input[autocomplete*='password' i]",
  "input[autocomplete*='token' i]",
  "[data-iris-sensitive]",
].join(",");

function assertActive(signal: AbortSignal): void {
  if (signal.aborted) throw new LocalWorkstationDeniedError("LOCAL_WORKSTATION_CANCELLED");
}

function sha256Bytes(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/**
 * Captures only an already-authorized browser page. Image bytes stay inside
 * this method long enough to hash and measure them, then are discarded. The
 * Core contract receives metadata and an exact redaction attestation only.
 */
export class PlaywrightEphemeralScreenshotAdapter implements ScreenshotCaptureAdapter {
  readonly name = "playwright-ephemeral-redacted-screenshot";

  constructor(readonly resolvePage: ScreenshotPageResolver) {}

  async capture(request: ScreenshotRequest, signal: AbortSignal): Promise<ScreenshotCapture> {
    if (request.target.kind !== "browser-page")
      throw new LocalWorkstationDeniedError("SCREENSHOT_PROVIDER_TARGET_UNSUPPORTED");
    assertActive(signal);
    const page = await this.resolvePage(request.target.descriptor, signal);
    assertActive(signal);
    const viewport = page.viewportSize();
    if (viewport === null) throw new LocalWorkstationDeniedError("SCREENSHOT_VIEWPORT_UNAVAILABLE");
    const mask = page.locator(sensitivePageSelector);
    const redactedRegionCount = await mask.count();
    assertActive(signal);
    const bytes = await page.screenshot({
      type: "png",
      animations: "disabled",
      caret: "hide",
      mask: [mask],
      maskColor: "#000000",
    });
    assertActive(signal);
    const byteLength = bytes.byteLength;
    const contentDigest = sha256Bytes(bytes);
    bytes.fill(0);
    const material = {
      widthPx: viewport.width,
      heightPx: viewport.height,
      byteLength,
      contentDigest,
      redaction: {
        attested: true as const,
        method: "solid-fill" as const,
        redactedRegionCount,
        attestationDigest:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000" as const,
      },
    };
    return {
      ...material,
      redaction: {
        ...material.redaction,
        attestationDigest: screenshotRedactionAttestationDigest(request, material),
      },
    };
  }
}

/**
 * Exact-reference registry. This is deliberately not an OS-store enumerator:
 * callers may register and retrieve one known safe reference by its derived
 * identifier, but cannot list or resolve stored credentials.
 */
export class WindowsCredentialReferenceRegistry {
  readonly #references = new Map<string, CredentialReference>();

  register(input: unknown, options: { now?: Date } = {}): CredentialReference {
    const reference = registerCredentialReference(input, options);
    this.#references.set(reference.referenceId, reference);
    return structuredClone(reference);
  }

  get(referenceId: string): CredentialReference {
    const reference = this.#references.get(referenceId);
    if (reference === undefined)
      throw new LocalWorkstationDeniedError("CREDENTIAL_REFERENCE_NOT_FOUND");
    return credentialReferenceSchema.parse(structuredClone(reference));
  }

  remove(referenceId: string): boolean {
    return this.#references.delete(referenceId);
  }

  get size(): number {
    return this.#references.size;
  }
}

export interface WindowsNotificationPayload {
  title: string;
  body: string;
}

export type WindowsNotificationRunner = (
  payload: WindowsNotificationPayload,
  signal: AbortSignal,
) => Promise<void>;

/** A replaceable adapter; construction alone performs no notification effect. */
export class WindowsNativeNotificationAdapter implements LocalNotificationAdapter {
  readonly name = "windows-native-local-notification";

  constructor(
    readonly run: WindowsNotificationRunner,
    readonly clock: () => Date = () => new Date(),
  ) {}

  async deliver(
    request: LocalNotificationRequest,
    signal: AbortSignal,
  ): Promise<{ shownAt: string }> {
    assertActive(signal);
    await this.run({ title: request.title, body: request.body }, signal);
    assertActive(signal);
    return { shownAt: this.clock().toISOString() };
  }
}

const notificationScript = String.raw`
$ErrorActionPreference = 'Stop'
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml('<toast><visual><binding template="ToastGeneric"><text></text><text></text></binding></visual></toast>')
$nodes = $xml.GetElementsByTagName('text')
$nodes.Item(0).AppendChild($xml.CreateTextNode([string]$payload.title)) > $null
$nodes.Item(1).AppendChild($xml.CreateTextNode([string]$payload.body)) > $null
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('STOIC-IRIS').Show($toast)
`;

/**
 * Explicit live runner for Windows. It is not invoked by import or startup.
 * Payload travels over child stdin, never a command-line argument or log.
 */
export function runWindowsNativeNotification(
  payload: WindowsNotificationPayload,
  signal: AbortSignal,
): Promise<void> {
  assertActive(signal);
  const encoded = Buffer.from(notificationScript, "utf16le").toString("base64");
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      { stdio: ["pipe", "ignore", "pipe"], windowsHide: true },
    );
    child.stderr.resume();
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      if (error === undefined) resolve();
      else
        reject(
          error instanceof Error
            ? error
            : new LocalWorkstationDeniedError("LOCAL_NOTIFICATION_PROVIDER_FAILED"),
        );
    };
    const abort = () => {
      child.kill();
      finish(new LocalWorkstationDeniedError("LOCAL_WORKSTATION_CANCELLED"));
    };
    signal.addEventListener("abort", abort, { once: true });
    child.once("error", (error) => {
      finish(error);
    });
    child.stdin.once("error", (error) => {
      finish(error);
    });
    child.once("exit", (code) => {
      if (signal.aborted) return;
      if (code === 0) finish();
      else finish(new LocalWorkstationDeniedError("LOCAL_NOTIFICATION_PROVIDER_FAILED"));
    });
    child.stdin.end(JSON.stringify(payload), "utf8");
  });
}
