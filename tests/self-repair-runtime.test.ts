import { describe, expect, it } from "vitest";

import {
  MemorySelfRepairStore,
  SelfRepairRuntime,
  type CapabilityAcquisitionProposal,
  type SelfRepairAdapter,
  type SelfRepairObjective,
} from "../packages/development/src/index.js";

const now = new Date("2026-08-08T08:00:00.000Z");
const sha = (character: string) => `sha256:${character.repeat(64)}`;

function objective(overrides: Partial<SelfRepairObjective> = {}): SelfRepairObjective {
  return {
    repairId: "repair_founder-runtime-0001",
    accessRequestId: "access_founder-full-0001",
    objective: "Restore repository inspection and resume the Founder objective.",
    objectiveDigest: sha("a"),
    modelPolicyDigest: sha("b"),
    repository: "stoic1712-IRIS/IRIS",
    baseRevision: "c".repeat(40),
    maximumAttempts: 2,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 3_600_000).toISOString(),
    budgetUsd: 0,
    ...overrides,
  };
}

function acquisition(): CapabilityAcquisitionProposal {
  return {
    proposalId: "acquisition_repository-inspect-0001",
    capability: "repository.inspect",
    gapType: "provider-not-running",
    source: {
      url: "https://example.com/provider/releases/1.2.3/provider.zip",
      version: "1.2.3",
      sha256: sha("d"),
      license: "MIT",
      primary: true,
    },
    cost: { amountUsd: 0, recurrence: "none" },
    permissions: ["Read the exact registered repository"],
    dataExposure: ["Local repository metadata only"],
    installCommands: [["provider", "install", "--version", "1.2.3"]],
    verificationCommands: [["provider", "health", "--json"]],
    rollbackCommands: [["provider", "rollback"]],
    removalCommands: [["provider", "remove"]],
    registryUpdates: ["repository.inspect -> provider@1.2.3"],
    objectiveDigest: sha("a"),
    contractDigest: sha("b"),
    canonicalRevision: "c".repeat(40),
    createdAt: now.toISOString(),
  };
}

class FixtureAdapter implements SelfRepairAdapter {
  readonly calls: string[] = [];
  unsupported = false;
  protectedEffect = false;
  verifyResult = true;

  observe() {
    this.calls.push("observe");
    return Promise.resolve({ evidence: ["repository inspection provider unavailable"] });
  }
  reproduce() {
    this.calls.push("reproduce");
    return Promise.resolve({ reproduced: true, evidence: ["provider health failed"] });
  }
  diagnose() {
    this.calls.push("diagnose");
    return Promise.resolve({
      capability: "repository.inspect",
      registered: true,
      providerInstalled: true,
      providerRunning: false,
      providerCompatible: true,
      authorized: true,
      credentialReferenceAvailable: true,
      sourceReachable: true,
      hardwareSufficient: true,
      supportedAfterResearch: !this.unsupported,
      protectedEffectRequired: this.protectedEffect,
      evidence: ["provider health check returned unavailable"],
    });
  }
  researchAcquisition() {
    this.calls.push("research");
    return Promise.resolve(acquisition());
  }
  createWorkspace() {
    this.calls.push("workspace");
    return Promise.resolve({ workspaceId: "workspace_self-repair-0001" });
  }
  acquire() {
    this.calls.push("acquire");
    return Promise.resolve({ evidenceDigest: sha("e") });
  }
  verifyCapability() {
    this.calls.push("verify");
    return Promise.resolve({ passed: this.verifyResult, evidenceDigest: sha("f") });
  }
  registerCapability() {
    this.calls.push("register");
    return Promise.resolve({ registryRevision: "1".repeat(40) });
  }
  resumeObjective() {
    this.calls.push("resume");
    return Promise.resolve({ outcomeDigest: sha("9") });
  }
  cleanup() {
    this.calls.push("cleanup");
    return Promise.resolve(true);
  }
}

function runtime(adapter = new FixtureAdapter()) {
  return {
    adapter,
    runtime: new SelfRepairRuntime({
      adapter,
      access: { authorize: () => ({}) },
      store: new MemorySelfRepairStore(),
      now: () => now,
    }),
  };
}

describe("governed IRIS self-repair runtime", () => {
  it("diagnoses an exact gap and pauses on a digest-bound acquisition", async () => {
    const { runtime: repair } = runtime();
    const result = await repair.start(objective());
    expect(result.state).toBe("acquisition-awaiting-approval");
    expect(result.gap?.type).toBe("provider-not-running");
    expect(result.acquisition?.requiredApprovalStatement).toMatch(
      /^I approve capability acquisition acquisition_repository-inspect-0001 at sha256:[a-f0-9]{64} exactly as proposed\.$/u,
    );
    expect(result.events.map((event) => event.state)).toContain("capability-required");
  });

  it("acquires, verifies, registers, resumes the original objective, and cleans up", async () => {
    const { runtime: repair, adapter } = runtime();
    const pending = await repair.start(objective());
    const result = await repair.approveAcquisition(
      pending.objective.repairId,
      pending.acquisition?.requiredApprovalStatement ?? "",
    );
    expect(result.state).toBe("completed");
    expect(result.registryRevision).toBe("1".repeat(40));
    expect(result.resumedObjectiveDigest).toBe(sha("a"));
    expect(result.cleanupVerified).toBe(true);
    expect(adapter.calls).toEqual([
      "observe",
      "reproduce",
      "diagnose",
      "research",
      "workspace",
      "acquire",
      "verify",
      "register",
      "resume",
      "cleanup",
    ]);
  });

  it("rejects altered approval and objective widening before acquisition", async () => {
    const { runtime: repair, adapter } = runtime();
    const pending = await repair.start(objective());
    await expect(repair.approveAcquisition(pending.objective.repairId, "approved")).rejects.toThrow(
      "SELF_REPAIR_ACQUISITION_APPROVAL_INVALID",
    );
    expect(adapter.calls).not.toContain("workspace");
  });

  it("stops with exact evidence when research proves the capability unsupported", async () => {
    const fixture = new FixtureAdapter();
    fixture.unsupported = true;
    const result = await runtime(fixture).runtime.start(
      objective({ repairId: "repair_founder-runtime-0002" }),
    );
    expect(result.state).toBe("unsupported");
    expect(result.summary).toContain("repository.inspect");
    expect(result.summary).not.toContain("I cannot");
    expect(fixture.calls).not.toContain("workspace");
  });

  it("stops separately for a protected effect", async () => {
    const fixture = new FixtureAdapter();
    fixture.protectedEffect = true;
    const result = await runtime(fixture).runtime.start(
      objective({ repairId: "repair_founder-runtime-0003" }),
    );
    expect(result.state).toBe("protected-stop");
    expect(fixture.calls).not.toContain("research");
  });

  it("never resumes when verification fails and preserves rollback evidence", async () => {
    const fixture = new FixtureAdapter();
    fixture.verifyResult = false;
    const repair = runtime(fixture).runtime;
    const pending = await repair.start(objective({ repairId: "repair_founder-runtime-0004" }));
    const result = await repair.approveAcquisition(
      pending.objective.repairId,
      pending.acquisition?.requiredApprovalStatement ?? "",
    );
    expect(result.state).toBe("recovery-ready");
    expect(fixture.calls).not.toContain("register");
    expect(fixture.calls).not.toContain("resume");
    expect(result.cleanupVerified).toBe(true);
  });
});
