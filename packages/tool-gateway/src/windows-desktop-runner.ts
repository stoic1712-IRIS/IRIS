import { execFile } from "node:child_process";

import { z } from "zod";

import {
  DesktopControlDeniedError,
  desktopControlActionSchema,
  desktopControlAdapterResultSchema,
  desktopControlRecoveryResultSchema,
  desktopControlTargetSchema,
  type DesktopControlAction,
  type DesktopControlAdapterResult,
  type DesktopControlRecoveryResult,
  type DesktopControlTarget,
  type WindowsUiAutomationRunner,
} from "./desktop-control-provider.js";

const liveTargetSchema = desktopControlTargetSchema.safeExtend({
  processId: z.number().int().positive().max(4_294_967_295),
});

export const windowsDesktopRunnerRequestSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("perform"),
      target: liveTargetSchema,
      action: desktopControlActionSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("recover"),
      target: liveTargetSchema,
      reason: z.literal("action-failed"),
    })
    .strict(),
]);
export type WindowsDesktopRunnerRequest = z.infer<typeof windowsDesktopRunnerRequestSchema>;

const sensitiveWindowPattern =
  /(?:credential|password|passkey|secret|token|wallet|payment|billing|checkout|account\s+admin|administrator|user\s+account\s+control|windows\s+security|certificate|private\s+key)/iu;

export type WindowsDesktopRunnerInvoker = (
  request: WindowsDesktopRunnerRequest,
  signal: AbortSignal,
) => Promise<string>;

function defaultPowerShellPath(): string {
  return process.platform === "win32"
    ? "powershell.exe"
    : "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
}

function createInvoker(scriptPath: string, powershellPath: string): WindowsDesktopRunnerInvoker {
  return (request, signal) =>
    new Promise<string>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DesktopControlDeniedError("DESKTOP_CONTROL_CANCELLED"));
        return;
      }
      const child = execFile(
        powershellPath,
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          scriptPath,
        ],
        {
          encoding: "utf8",
          windowsHide: true,
          maxBuffer: 64 * 1024,
          signal,
        },
        (error, stdout) => {
          if (error !== null) {
            reject(
              new DesktopControlDeniedError(
                signal.aborted ? "DESKTOP_CONTROL_CANCELLED" : "DESKTOP_CONTROL_RUNNER_FAILED",
                { cause: error },
              ),
            );
            return;
          }
          resolve(stdout);
        },
      );
      child.stdin?.end(JSON.stringify(request));
    });
}

function exactLiveTarget(target: DesktopControlTarget): z.infer<typeof liveTargetSchema> {
  if (target.processId === undefined)
    throw new DesktopControlDeniedError("DESKTOP_CONTROL_PROCESS_BINDING_REQUIRED");
  const parsed = liveTargetSchema.parse(target);
  if (
    sensitiveWindowPattern.test(parsed.windowTitle) ||
    sensitiveWindowPattern.test(parsed.applicationId)
  )
    throw new DesktopControlDeniedError("DESKTOP_CONTROL_SENSITIVE_WINDOW_DENIED");
  return parsed;
}

function parseJson(stdout: string): unknown {
  if (Buffer.byteLength(stdout, "utf8") > 64 * 1024)
    throw new DesktopControlDeniedError("DESKTOP_CONTROL_RUNNER_OUTPUT_TOO_LARGE");
  try {
    return JSON.parse(stdout.trim());
  } catch (error) {
    throw new DesktopControlDeniedError("DESKTOP_CONTROL_RUNNER_OUTPUT_INVALID", { cause: error });
  }
}

export class WindowsDesktopRunner implements WindowsUiAutomationRunner {
  readonly #invoke: WindowsDesktopRunnerInvoker;

  constructor(options: {
    scriptPath: string;
    powershellPath?: string;
    invoke?: WindowsDesktopRunnerInvoker;
  }) {
    const scriptPath = z.string().min(1).max(1_000).parse(options.scriptPath);
    this.#invoke =
      options.invoke ??
      createInvoker(scriptPath, options.powershellPath ?? defaultPowerShellPath());
  }

  async perform(
    target: DesktopControlTarget,
    action: DesktopControlAction,
    signal: AbortSignal,
  ): Promise<DesktopControlAdapterResult> {
    if (signal.aborted) throw new DesktopControlDeniedError("DESKTOP_CONTROL_CANCELLED");
    const request = windowsDesktopRunnerRequestSchema.parse({
      operation: "perform",
      target: exactLiveTarget(target),
      action: desktopControlActionSchema.parse(action),
    });
    try {
      return desktopControlAdapterResultSchema.parse(
        parseJson(await this.#invoke(request, signal)),
      );
    } catch (error) {
      if (error instanceof DesktopControlDeniedError) throw error;
      throw new DesktopControlDeniedError("DESKTOP_CONTROL_RUNNER_OUTPUT_INVALID", {
        cause: error,
      });
    }
  }

  async recover(
    target: DesktopControlTarget,
    reason: "action-failed",
    signal: AbortSignal,
  ): Promise<DesktopControlRecoveryResult> {
    if (signal.aborted) throw new DesktopControlDeniedError("DESKTOP_CONTROL_CANCELLED");
    const request = windowsDesktopRunnerRequestSchema.parse({
      operation: "recover",
      target: exactLiveTarget(target),
      reason,
    });
    try {
      return desktopControlRecoveryResultSchema.parse(
        parseJson(await this.#invoke(request, signal)),
      );
    } catch (error) {
      if (error instanceof DesktopControlDeniedError) throw error;
      throw new DesktopControlDeniedError("DESKTOP_CONTROL_RUNNER_OUTPUT_INVALID", {
        cause: error,
      });
    }
  }
}
