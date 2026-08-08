import { describe, expect, it } from "vitest";

import {
  DesktopControlDeniedError,
  WindowsDesktopRunner,
  windowsDesktopRunnerRequestSchema,
  type WindowsDesktopRunnerInvoker,
} from "../packages/tool-gateway/src/index.js";

const target = {
  applicationId: "notepad",
  windowTitle: "IRIS disposable test window",
  automationRootId: "RootPanel",
  processId: 4242,
};

function invoker(output: unknown) {
  const requests: unknown[] = [];
  const invoke: WindowsDesktopRunnerInvoker = async (request, _signal) => {
    requests.push(request);
    return JSON.stringify(output);
  };
  return { invoke, requests };
}

describe("bounded Windows desktop runner", () => {
  it("sends one strict JSON request and validates one strict response", async () => {
    const fixture = invoker({
      completedAt: "2026-08-08T10:00:00.000Z",
      result: "completed",
    });
    const runner = new WindowsDesktopRunner({
      scriptPath: "C:\\Projects\\STOIC-IRIS\\scripts\\desktop\\iris-desktop-runner.ps1",
      invoke: fixture.invoke,
    });
    const response = await runner.perform(
      target,
      { kind: "invoke", automationId: "SaveButton" },
      new AbortController().signal,
    );
    expect(response.result).toBe("completed");
    expect(windowsDesktopRunnerRequestSchema.parse(fixture.requests[0])).toEqual({
      operation: "perform",
      target,
      action: { kind: "invoke", automationId: "SaveButton" },
    });
  });

  it("requires an exact process binding and rejects sensitive windows before invocation", async () => {
    const fixture = invoker({ completedAt: "2026-08-08T10:00:00.000Z", result: "completed" });
    const runner = new WindowsDesktopRunner({
      scriptPath: "C:\\runner.ps1",
      invoke: fixture.invoke,
    });
    await expect(
      runner.perform(
        { applicationId: "notepad", windowTitle: "IRIS disposable test window" },
        { kind: "focus-window" },
        new AbortController().signal,
      ),
    ).rejects.toThrow("DESKTOP_CONTROL_PROCESS_BINDING_REQUIRED");
    await expect(
      runner.perform(
        { ...target, windowTitle: "Windows Credential Manager" },
        { kind: "focus-window" },
        new AbortController().signal,
      ),
    ).rejects.toThrow("DESKTOP_CONTROL_SENSITIVE_WINDOW_DENIED");
    expect(fixture.requests).toHaveLength(0);
  });

  it("fails closed for malformed or widened provider output", async () => {
    for (const output of ["not json", { result: "completed", completedAt: "bad" }, {
      result: "completed",
      completedAt: "2026-08-08T10:00:00.000Z",
      secret: "leak",
    }]) {
      const fixture: WindowsDesktopRunnerInvoker = () => Promise.resolve(
        typeof output === "string" ? output : JSON.stringify(output),
      );
      const runner = new WindowsDesktopRunner({ scriptPath: "C:\\runner.ps1", invoke: fixture });
      await expect(
        runner.perform(target, { kind: "focus-window" }, new AbortController().signal),
      ).rejects.toBeInstanceOf(DesktopControlDeniedError);
    }
  });

  it("propagates immediate Founder interruption and supports bounded recovery", async () => {
    const controller = new AbortController();
    controller.abort();
    const runner = new WindowsDesktopRunner({
      scriptPath: "C:\\runner.ps1",
      invoke: () => Promise.resolve("{}"),
    });
    await expect(runner.perform(target, { kind: "focus-window" }, controller.signal))
      .rejects.toThrow("DESKTOP_CONTROL_CANCELLED");

    const recovery = invoker({ recoveredAt: "2026-08-08T10:00:00.000Z", result: "recovered" });
    const recovering = new WindowsDesktopRunner({
      scriptPath: "C:\\runner.ps1",
      invoke: recovery.invoke,
    });
    expect(
      await recovering.recover(target, "action-failed", new AbortController().signal),
    ).toEqual({ recoveredAt: "2026-08-08T10:00:00.000Z", result: "recovered" });
    expect(recovery.requests[0]).toMatchObject({ operation: "recover", reason: "action-failed" });
  });
});
