import { describe, expect, it, vi } from "vitest";

import {
  createDesktopControlPreview,
  desktopControlApprovalStatement,
  desktopControlPlanDigest,
  desktopControlPlanSchema,
  desktopControlPreviewSchema,
  desktopControlReceiptSchema,
  DesktopControlAudit,
  executeDesktopControl,
  InMemoryDesktopControlReplayGuard,
  WindowsUiAutomationAdapter,
  type DesktopControlAction,
  type DesktopControlAdapter,
  type DesktopControlPlan,
  type DesktopControlTarget,
} from "../packages/tool-gateway/src/index.js";

const now = new Date("2026-08-07T12:00:00.000Z");
const expiresAt = "2026-08-07T12:05:00.000Z";
const requestId = "request_00000000-0000-4000-8000-000000000011";
const previewId = "proposal_00000000-0000-4000-8000-000000000011";
const approvalId = "approval_00000000-0000-4000-8000-000000000011";

function plan(overrides: Partial<DesktopControlPlan> = {}): DesktopControlPlan {
  return {
    requestId,
    target: {
      applicationId: "com.microsoft.Notepad",
      windowTitle: "IRIS disposable test window",
      automationRootId: "RootPanel",
    },
    actions: [
      { kind: "focus-window" },
      { kind: "set-text", automationId: "DraftText", text: "Bounded fictional input" },
      { kind: "invoke", automationId: "SaveButton" },
    ],
    requestedAt: now.toISOString(),
    expiresAt,
    maximumDurationMs: 5_000,
    recovery: "refocus-target",
    ...overrides,
  };
}

function preview(value = plan(), audit = new DesktopControlAudit()) {
  return createDesktopControlPreview(value, { previewId, audit, now });
}

function approval(value = plan(), prepared = preview(value)) {
  return {
    approvalId,
    previewId: prepared.previewId,
    planDigest: desktopControlPlanDigest(value),
    statement: desktopControlApprovalStatement(
      prepared.previewId,
      desktopControlPlanDigest(value),
      value.target,
    ),
    approver: "Founder" as const,
    issuedAt: now.toISOString(),
    expiresAt,
    oneTime: true as const,
  };
}

function adapter(overrides: Partial<DesktopControlAdapter> = {}) {
  const calls: { target: DesktopControlTarget; action: DesktopControlAction }[] = [];
  let recoveries = 0;
  const value: DesktopControlAdapter & {
    calls: typeof calls;
    readonly recoveries: number;
  } = {
    name: "hermetic-windows-ui-automation",
    calls,
    get recoveries() {
      return recoveries;
    },
    perform(target, action) {
      calls.push({ target, action });
      return Promise.resolve({ completedAt: now.toISOString(), result: "completed" });
    },
    recover() {
      recoveries += 1;
      return Promise.resolve({ recoveredAt: now.toISOString(), result: "recovered" });
    },
    ...overrides,
  };
  return value;
}

function executionOptions(overrides = {}) {
  return {
    enabled: true,
    audit: new DesktopControlAudit(),
    replayGuard: new InMemoryDesktopControlReplayGuard(),
    now,
    ...overrides,
  };
}

describe("Cycle Eleven desktop-control preview", () => {
  it("seals an exact metadata-only preview with disabled authority", () => {
    const prepared = preview();
    expect(prepared.planDigest).toBe(desktopControlPlanDigest(plan()));
    expect(prepared.actionCount).toBe(3);
    expect(prepared.enabled).toBe(false);
    expect(prepared.authority).toBe("none");
    expect(JSON.stringify(prepared)).not.toContain("Bounded fictional input");
    expect(desktopControlPreviewSchema.parse(prepared)).toEqual(prepared);
  });

  it("rejects coordinates, wildcard targets, unbounded actions, and secret input", () => {
    expect(
      desktopControlPlanSchema.safeParse({
        ...plan(),
        actions: [{ kind: "invoke", automationId: "SaveButton", x: 10, y: 20 }],
      }).success,
    ).toBe(false);
    expect(
      desktopControlPlanSchema.safeParse({
        ...plan(),
        target: { applicationId: "com.microsoft.*", windowTitle: "*" },
      }).success,
    ).toBe(false);
    expect(
      desktopControlPlanSchema.safeParse({
        ...plan(),
        actions: Array.from({ length: 21 }, () => ({ kind: "focus-window" })),
      }).success,
    ).toBe(false);
    expect(
      desktopControlPlanSchema.safeParse({
        ...plan(),
        actions: [
          { kind: "set-text", automationId: "DraftText", text: "token=ghp_aaaaaaaaaaaaaaaaaaaaaa" },
        ],
      }).success,
    ).toBe(false);
  });

  it("fails closed for future, expired, and overlong request windows", () => {
    expect(() => preview(plan({ requestedAt: "2026-08-07T12:00:01.000Z" }))).toThrow(
      "DESKTOP_CONTROL_WINDOW_INVALID",
    );
    expect(() =>
      preview(
        plan({
          requestedAt: "2026-08-07T11:54:59.000Z",
          expiresAt: "2026-08-07T11:59:59.000Z",
        }),
      ),
    ).toThrow("DESKTOP_CONTROL_EXPIRED");
    expect(
      desktopControlPlanSchema.safeParse(plan({ expiresAt: "2026-08-07T12:05:00.001Z" })).success,
    ).toBe(false);
  });

  it("requires audit sealing before releasing a preview", () => {
    expect(() =>
      createDesktopControlPreview(plan(), {
        previewId,
        now,
        audit: {
          record() {
            throw new Error("audit unavailable");
          },
        },
      }),
    ).toThrow("DESKTOP_CONTROL_AUDIT_FAILED");
  });
});

describe("Cycle Eleven bounded execution", () => {
  it("is disabled by default and performs no adapter call", async () => {
    const value = plan();
    const prepared = preview(value);
    const provider = adapter();
    await expect(
      executeDesktopControl(value, prepared, approval(value, prepared), provider, {
        audit: new DesktopControlAudit(),
        replayGuard: new InMemoryDesktopControlReplayGuard(),
        now,
      }),
    ).rejects.toThrow("DESKTOP_CONTROL_DISABLED");
    expect(provider.calls).toHaveLength(0);
  });

  it("executes exactly approved actions and returns metadata only", async () => {
    const value = plan();
    const prepared = preview(value);
    const provider = adapter();
    const receipt = await executeDesktopControl(
      value,
      prepared,
      approval(value, prepared),
      provider,
      executionOptions(),
    );
    expect(provider.calls.map(({ action }) => action.kind)).toEqual([
      "focus-window",
      "set-text",
      "invoke",
    ]);
    expect(receipt.actionCount).toBe(3);
    expect(receipt.authority).toBe("none");
    expect(JSON.stringify(receipt)).not.toContain("Bounded fictional input");
    expect(desktopControlReceiptSchema.parse(receipt)).toEqual(receipt);
  });

  it("rejects altered plan, preview, statement, or target before a provider call", async () => {
    const value = plan();
    const prepared = preview(value);
    const provider = adapter();
    for (const [candidatePlan, candidatePreview, candidateApproval] of [
      [plan({ actions: [{ kind: "focus-window" }] }), prepared, approval(value, prepared)],
      [value, { ...prepared, actionCount: 2 }, approval(value, prepared)],
      [value, { ...prepared, expiresAt: "2026-08-07T12:04:59.000Z" }, approval(value, prepared)],
      [value, prepared, { ...approval(value, prepared), statement: "I approve something else." }],
      [
        value,
        {
          ...prepared,
          target: { ...prepared.target, windowTitle: "Another exact window" },
        },
        approval(value, prepared),
      ],
    ] as const)
      await expect(
        executeDesktopControl(
          candidatePlan,
          candidatePreview,
          candidateApproval,
          provider,
          executionOptions(),
        ),
      ).rejects.toThrow();
    expect(provider.calls).toHaveLength(0);
  });

  it("consumes approval once and rejects replay", async () => {
    const value = plan();
    const prepared = preview(value);
    const provider = adapter();
    const options = executionOptions();
    const approved = approval(value, prepared);
    await executeDesktopControl(value, prepared, approved, provider, options);
    await expect(
      executeDesktopControl(value, prepared, approved, provider, options),
    ).rejects.toThrow("DESKTOP_CONTROL_APPROVAL_REPLAYED");
    expect(provider.calls).toHaveLength(3);
  });

  it("stops immediately when the Founder interrupts a non-cooperative adapter", async () => {
    const value = plan({ actions: [{ kind: "focus-window" }] });
    const prepared = preview(value);
    const controller = new AbortController();
    const provider = adapter({
      perform: () => new Promise(() => undefined),
    });
    const running = executeDesktopControl(value, prepared, approval(value, prepared), provider, {
      ...executionOptions(),
      signal: controller.signal,
      timeoutMs: 5_000,
    });
    controller.abort();
    await expect(running).rejects.toThrow("DESKTOP_CONTROL_CANCELLED");
  });

  it("times out a non-cooperative adapter without waiting for it", async () => {
    vi.useFakeTimers();
    try {
      const value = plan({ actions: [{ kind: "focus-window" }], maximumDurationMs: 5 });
      const prepared = preview(value);
      const provider = adapter({ perform: () => new Promise(() => undefined) });
      const running = executeDesktopControl(
        value,
        prepared,
        approval(value, prepared),
        provider,
        executionOptions({ timeoutMs: 5 }),
      );
      const expected = expect(running).rejects.toThrow("DESKTOP_CONTROL_TIMEOUT");
      await vi.advanceTimersByTimeAsync(5);
      await expected;
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs bounded recovery after an ordinary action failure", async () => {
    const value = plan({ actions: [{ kind: "invoke", automationId: "FailButton" }] });
    const prepared = preview(value);
    const provider = adapter({
      perform() {
        return Promise.reject(new Error("provider details must not escape"));
      },
    });
    const options = executionOptions();
    await expect(
      executeDesktopControl(value, prepared, approval(value, prepared), provider, options),
    ).rejects.toThrow("DESKTOP_CONTROL_ACTION_FAILED");
    expect(provider.recoveries).toBe(1);
    expect(options.audit.entries().map((entry) => entry.outcome)).toEqual(["recovered", "denied"]);
  });

  it("fails closed when recovery or final audit cannot be sealed", async () => {
    const value = plan({ actions: [{ kind: "invoke", automationId: "FailButton" }] });
    const prepared = preview(value);
    await expect(
      executeDesktopControl(
        value,
        prepared,
        approval(value, prepared),
        adapter({
          perform() {
            return Promise.reject(new Error("failed"));
          },
          recover() {
            return Promise.reject(new Error("recovery failed"));
          },
        }),
        executionOptions(),
      ),
    ).rejects.toThrow("DESKTOP_CONTROL_RECOVERY_FAILED");

    await expect(
      executeDesktopControl(value, prepared, approval(value, prepared), adapter(), {
        enabled: true,
        replayGuard: new InMemoryDesktopControlReplayGuard(),
        now,
        audit: {
          record() {
            throw new Error("audit unavailable");
          },
        },
      }),
    ).rejects.toThrow("DESKTOP_CONTROL_AUDIT_FAILED");
  });

  it("keeps the Windows adapter inert until an explicit method call", () => {
    let effects = 0;
    const provider = new WindowsUiAutomationAdapter({
      perform() {
        effects += 1;
        return Promise.resolve({ completedAt: now.toISOString(), result: "completed" });
      },
      recover() {
        effects += 1;
        return Promise.resolve({ recoveredAt: now.toISOString(), result: "recovered" });
      },
    });
    expect(effects).toBe(0);
    expect(provider.name).toBe("windows-ui-automation");
  });
});

describe("Cycle Eleven mandatory audit", () => {
  it("hash-chains preview, recovery, acceptance, and denial decisions", () => {
    const audit = new DesktopControlAudit();
    audit.record(requestId, previewId, "previewed", "preview sealed");
    audit.record(requestId, previewId, "recovered", "target recovered");
    audit.record(requestId, previewId, "accepted", "completed");
    audit.record(requestId, previewId, "denied", "replay denied");
    expect(audit.entries()[1]?.previousDigest).toBe(audit.entries()[0]?.digest);
    expect(audit.verify()).toBe(true);
  });

  it("bounds the one-shot replay ledger", () => {
    const guard = new InMemoryDesktopControlReplayGuard(1);
    guard.claim(previewId, `sha256:${"a".repeat(64)}`, expiresAt, now);
    expect(() => {
      guard.claim(
        "proposal_00000000-0000-4000-8000-000000000012",
        `sha256:${"b".repeat(64)}`,
        expiresAt,
        now,
      );
    }).toThrow("DESKTOP_CONTROL_REPLAY_GUARD_CAPACITY");
  });
});
