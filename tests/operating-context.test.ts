import { describe, expect, it } from "vitest";

import {
  buildLiveCapabilitySnapshot,
  type LiveCapabilityProviderEvidence,
} from "../packages/capabilities/src/live-capability-snapshot.js";
import { loadCompiledOperatingContract } from "../packages/contracts/src/operating-contract.js";
import { assembleOperatingContext } from "../packages/kernel/src/operating-context.js";
import { decideOperatingAction } from "../packages/kernel/src/operating-decision-engine.js";

const contract = loadCompiledOperatingContract("generated/iris-operating-contract.compiled.json");

function provider(capability: string): LiveCapabilityProviderEvidence {
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

describe("operating context", () => {
  it("contains the five outcomes, exact decision, and only applicable capability evidence", () => {
    const requested = [contract.ordinaryCapabilities[0]!, contract.ordinaryCapabilities[3]!];
    const snapshot = buildLiveCapabilitySnapshot({
      contract,
      providers: contract.ordinaryCapabilities.map((capability) => provider(capability)),
      activeGrant: { capabilities: [...contract.ordinaryCapabilities] },
      capturedAt: "2026-08-10T18:00:00.000Z",
    });
    const objective = {
      objectiveId: "objective_context-test",
      requiredCapabilities: requested,
      protectedEffects: [],
    };
    const decision = decideOperatingAction({
      objective,
      snapshot,
      activeGrantId: "access_context-test",
    });
    const context = assembleOperatingContext({
      contract,
      objective,
      decision,
      snapshot,
      exactEvidence: [
        { reference: "evidence:live-capability-snapshot", digest: contract.contractDigest },
      ],
    });

    expect(context.contract.decisionOutcomes).toEqual([
      "execute-now",
      "acquire-capability",
      "request-protected-approval",
      "repair-runtime",
      "report-terminal",
    ]);
    expect(context.decision).toEqual(decision);
    expect(context.applicableCapabilities.map((entry) => entry.capability)).toEqual(requested);
    expect(context.applicableCapabilities).toHaveLength(2);
    expect(context.modelAuthority).toBe("none");
  });

  it("rejects mismatched objective, contract, or missing capability evidence", () => {
    const snapshot = buildLiveCapabilitySnapshot({
      contract,
      providers: contract.ordinaryCapabilities.map((capability) => provider(capability)),
      activeGrant: { capabilities: [...contract.ordinaryCapabilities] },
      capturedAt: "2026-08-10T18:00:00.000Z",
    });
    const objective = {
      objectiveId: "objective_context-test",
      requiredCapabilities: [contract.ordinaryCapabilities[0]!],
      protectedEffects: [],
    };
    const decision = decideOperatingAction({
      objective,
      snapshot,
      activeGrantId: "access_context-test",
    });

    expect(() =>
      assembleOperatingContext({
        contract,
        objective: { ...objective, objectiveId: "objective_changed-test" },
        decision,
        snapshot,
        exactEvidence: [],
      }),
    ).toThrow("OPERATING_CONTEXT_OBJECTIVE_MISMATCH");
    expect(() =>
      assembleOperatingContext({
        contract,
        objective,
        decision,
        snapshot: { ...snapshot, contractDigest: `sha256:${"0".repeat(64)}` },
        exactEvidence: [],
      }),
    ).toThrow("OPERATING_CONTEXT_CONTRACT_MISMATCH");
  });
});
