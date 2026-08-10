import { describe, expect, it } from "vitest";

import {
  buildLiveCapabilitySnapshot,
  type LiveCapabilityProviderEvidence,
} from "../packages/capabilities/src/live-capability-snapshot.js";
import { loadCompiledOperatingContract } from "../packages/contracts/src/operating-contract.js";
import { decideOperatingAction } from "../packages/kernel/src/operating-decision-engine.js";

const contract = loadCompiledOperatingContract("generated/iris-operating-contract.compiled.json");

function evidence(capability: string): LiveCapabilityProviderEvidence {
  return {
    capability,
    registered: true,
    providerInstalled: true,
    providerRunning: true,
    providerCompatible: true,
    credentialReferenceAvailable: true,
    sourceReachable: true,
    hardwareSufficient: true,
    supportedAfterResearch: true,
    evidence: [`verified:${capability}`],
  };
}

function snapshot(
  change?: (providers: LiveCapabilityProviderEvidence[]) => void,
  granted = contract.ordinaryCapabilities,
) {
  const providers = contract.ordinaryCapabilities.map((capability) => evidence(capability));
  change?.(providers);
  return buildLiveCapabilitySnapshot({
    contract,
    providers,
    activeGrant: { capabilities: [...granted] },
    capturedAt: "2026-08-10T18:00:00.000Z",
  });
}

const objectiveId = "objective_contract-test";
const capability = contract.ordinaryCapabilities[0]!;

describe("operating decision engine", () => {
  it("executes immediately when required ordinary capabilities are ready and granted", () => {
    expect(
      decideOperatingAction({
        objective: { objectiveId, requiredCapabilities: [capability], protectedEffects: [] },
        snapshot: snapshot(),
        activeGrantId: "access_contract-test",
      }),
    ).toEqual({
      kind: "execute-now",
      objectiveId,
      capabilities: [capability],
      grantId: "access_contract-test",
      nextAction: "dispatch-governed-controller",
    });
  });

  it("acquires an absent provider or ordinary access instead of refusing", () => {
    const absent = decideOperatingAction({
      objective: { objectiveId, requiredCapabilities: [capability], protectedEffects: [] },
      snapshot: snapshot((providers) => {
        providers[0] = { ...providers[0]!, providerInstalled: false };
      }),
      activeGrantId: "access_contract-test",
    });
    const needsAccess = decideOperatingAction({
      objective: { objectiveId, requiredCapabilities: [capability], protectedEffects: [] },
      snapshot: snapshot(undefined, []),
    });

    expect(absent.kind).toBe("acquire-capability");
    expect(needsAccess.kind).toBe("acquire-capability");
  });

  it("repairs a stopped provider", () => {
    const decision = decideOperatingAction({
      objective: { objectiveId, requiredCapabilities: [capability], protectedEffects: [] },
      snapshot: snapshot((providers) => {
        providers[0] = { ...providers[0]!, providerRunning: false };
      }),
      activeGrantId: "access_contract-test",
    });
    expect(decision.kind).toBe("repair-runtime");
  });

  it("returns the first unsatisfied capability in canonical contract order", () => {
    const second = contract.ordinaryCapabilities[1]!;
    const decision = decideOperatingAction({
      objective: {
        objectiveId,
        requiredCapabilities: [second, capability],
        protectedEffects: [],
      },
      snapshot: snapshot((providers) => {
        providers[0] = { ...providers[0]!, providerInstalled: false };
        providers[1] = { ...providers[1]!, providerRunning: false };
      }),
      activeGrantId: "access_contract-test",
    });

    expect(decision.kind).toBe("acquire-capability");
    if (decision.kind === "acquire-capability") expect(decision.gap.capability).toBe(capability);
  });

  it("requests exact Founder approval for a protected effect", () => {
    expect(
      decideOperatingAction({
        objective: {
          objectiveId,
          requiredCapabilities: [],
          protectedEffects: [contract.protectedEffects[0]!],
        },
        snapshot: snapshot(),
      }),
    ).toEqual({
      kind: "request-protected-approval",
      objectiveId,
      effect: contract.protectedEffects[0],
      proposalRequired: true,
    });
  });

  it("reports a terminal objective before considering any requested effect", () => {
    expect(
      decideOperatingAction({
        objective: {
          objectiveId,
          requiredCapabilities: [capability],
          protectedEffects: [contract.protectedEffects[0]!],
          terminal: { state: "completed", evidence: ["evidence:verified"] },
        },
        snapshot: snapshot(),
      }),
    ).toEqual({
      kind: "report-terminal",
      objectiveId,
      terminalState: "completed",
      evidence: ["evidence:verified"],
    });
  });

  it("never produces a generic refusal for an actionable evidence state", () => {
    const decisions = [
      decideOperatingAction({
        objective: { objectiveId, requiredCapabilities: [capability], protectedEffects: [] },
        snapshot: snapshot(),
        activeGrantId: "access_contract-test",
      }),
      decideOperatingAction({
        objective: { objectiveId, requiredCapabilities: [capability], protectedEffects: [] },
        snapshot: snapshot((providers) => {
          providers[0] = { ...providers[0]!, providerInstalled: false };
        }),
      }),
      decideOperatingAction({
        objective: { objectiveId, requiredCapabilities: [capability], protectedEffects: [] },
        snapshot: snapshot((providers) => {
          providers[0] = { ...providers[0]!, providerRunning: false };
        }),
      }),
    ];

    for (const decision of decisions)
      expect(JSON.stringify(decision)).not.toMatch(
        /cannot|not connected|no authority|run these commands yourself/iu,
      );
  });
});
