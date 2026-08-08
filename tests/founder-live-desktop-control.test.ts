import { describe, expect, it } from "vitest";

import {
  createDesktopControlPreview,
  desktopControlApprovalStatement,
  desktopControlPlanDigest,
  DesktopControlAudit,
  FounderLiveDesktopControl,
  InMemoryDesktopControlReplayGuard,
  type DesktopControlAdapter,
  type DesktopControlPlan,
} from "../packages/tool-gateway/src/index.js";

const now = new Date("2026-08-08T10:00:00.000Z");
const plan: DesktopControlPlan = {
  requestId: "request_00000000-0000-4000-8000-000000000091",
  target: {
    applicationId: "notepad",
    windowTitle: "IRIS disposable test window",
    processId: 4242,
  },
  actions: [{ kind: "focus-window" }],
  requestedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + 60_000).toISOString(),
  maximumDurationMs: 5_000,
  recovery: "refocus-target",
};

function bound() {
  const audit = new DesktopControlAudit();
  const preview = createDesktopControlPreview(plan, {
    previewId: "proposal_00000000-0000-4000-8000-000000000091",
    audit,
    now,
  });
  return {
    audit,
    preview,
    approval: {
      approvalId: "approval_00000000-0000-4000-8000-000000000091",
      previewId: preview.previewId,
      planDigest: preview.planDigest,
      statement: desktopControlApprovalStatement(
        preview.previewId,
        desktopControlPlanDigest(plan),
        plan.target,
      ),
      approver: "Founder" as const,
      issuedAt: now.toISOString(),
      expiresAt: plan.expiresAt,
      oneTime: true as const,
    },
  };
}

describe("Founder live desktop control", () => {
  it("requires the active Full-access capability and executes the exact preview", async () => {
    const authorization: string[] = [];
    const adapter: DesktopControlAdapter = {
      name: "fixture",
      perform: () => Promise.resolve({ completedAt: now.toISOString(), result: "completed" }),
      recover: () => Promise.resolve({ recoveredAt: now.toISOString(), result: "recovered" }),
    };
    const live = new FounderLiveDesktopControl({
      access: { authorize: (_requestId, capability) => authorization.push(capability) },
      adapter,
      replayGuard: new InMemoryDesktopControlReplayGuard(),
      now: () => now,
    });
    const value = bound();
    const receipt = await live.start(
      "access_founder-full-0001",
      plan,
      value.preview,
      value.approval,
      value.audit,
    );
    expect(receipt.planDigest).toBe(value.preview.planDigest);
    expect(authorization).toEqual(["desktop.operate-bounded"]);
    expect(live.status()).toEqual({ active: false });
  });

  it("allows only one active execution and emergency stop remains terminal", async () => {
    let finish: (() => void) | undefined;
    const adapter: DesktopControlAdapter = {
      name: "deferred",
      perform: () =>
        new Promise((resolve) => {
          finish = () => {
            resolve({ completedAt: now.toISOString(), result: "completed" });
          };
        }),
      recover: () => Promise.resolve({ recoveredAt: now.toISOString(), result: "recovered" }),
    };
    const live = new FounderLiveDesktopControl({
      access: { authorize: () => ({}) },
      adapter,
      replayGuard: new InMemoryDesktopControlReplayGuard(),
      now: () => now,
    });
    const first = bound();
    const running = live.start(
      "access_founder-full-0001",
      plan,
      first.preview,
      first.approval,
      first.audit,
    );
    await expect(
      live.start("access_founder-full-0001", plan, first.preview, first.approval, first.audit),
    ).rejects.toThrow("DESKTOP_CONTROL_EXECUTION_ALREADY_ACTIVE");
    expect(live.stop()).toBe(true);
    finish?.();
    await expect(running).rejects.toThrow("DESKTOP_CONTROL_CANCELLED");
    expect(live.status()).toEqual({ active: false });
    expect(first.audit.entries().at(-1)?.outcome).toBe("cancelled");
  });

  it("fails before provider invocation when Full access is inactive", async () => {
    let calls = 0;
    const live = new FounderLiveDesktopControl({
      access: {
        authorize: () => {
          throw new Error("FOUNDER_ACCESS_NOT_ACTIVE");
        },
      },
      adapter: {
        name: "fixture",
        perform: () => {
          calls += 1;
          return Promise.resolve({ completedAt: now.toISOString(), result: "completed" });
        },
        recover: () => Promise.resolve({ recoveredAt: now.toISOString(), result: "recovered" }),
      },
      replayGuard: new InMemoryDesktopControlReplayGuard(),
      now: () => now,
    });
    const value = bound();
    await expect(
      live.start("access_founder-full-0001", plan, value.preview, value.approval, value.audit),
    ).rejects.toThrow("FOUNDER_ACCESS_NOT_ACTIVE");
    expect(calls).toBe(0);
  });
});
