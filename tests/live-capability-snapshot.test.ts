import { describe, expect, it } from "vitest";

import {
  buildLiveCapabilitySnapshot,
  type LiveCapabilityProviderEvidence,
} from "../packages/capabilities/src/live-capability-snapshot.js";
import { loadCompiledOperatingContract } from "../packages/contracts/src/operating-contract.js";

const contract = loadCompiledOperatingContract("generated/iris-operating-contract.compiled.json");
const capturedAt = "2026-08-10T18:00:00.000Z";

function readyEvidence(capability: string): LiveCapabilityProviderEvidence {
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

describe("live capability snapshot", () => {
  it("represents each contract capability exactly once and never promotes a protected effect", () => {
    const providers = contract.ordinaryCapabilities.map((capability) => readyEvidence(capability));
    const snapshot = buildLiveCapabilitySnapshot({
      contract,
      providers,
      activeGrant: {
        grantId: "access_contract-snapshot",
        authenticated: true,
        active: true,
        capabilities: [...contract.ordinaryCapabilities],
      },
      capturedAt,
    });

    expect(snapshot.capabilities.map((entry) => entry.capability)).toEqual(
      contract.ordinaryCapabilities,
    );
    expect(snapshot.protectedEffects).toEqual(contract.protectedEffects);
    expect(snapshot.activeGrantId).toBe("access_contract-snapshot");
    expect(snapshot.capabilities.map((entry) => entry.protected)).toEqual(
      snapshot.capabilities.map(() => false),
    );
    expect(snapshot.capabilities.every((entry) => entry.status === "ready")).toBe(true);
  });

  it("derives access, repair, acquisition, and unsupported states only from evidence", () => {
    const providers = contract.ordinaryCapabilities.map((capability) => readyEvidence(capability));
    const [first, second, third] = providers;
    if (first === undefined || second === undefined || third === undefined)
      throw new Error("Expected three ordinary capabilities.");
    providers[0] = { ...first, providerInstalled: false };
    providers[1] = { ...second, providerRunning: false };
    providers[2] = {
      ...third,
      supportedAfterResearch: false,
      providerInstalled: false,
    };

    const snapshot = buildLiveCapabilitySnapshot({
      contract,
      providers,
      activeGrant: {
        grantId: "access_contract-snapshot",
        authenticated: true,
        active: true,
        capabilities: contract.ordinaryCapabilities.slice(0, 3),
      },
      capturedAt,
    });

    expect(snapshot.capabilities[0]?.status).toBe("needs-acquisition");
    expect(snapshot.capabilities[1]?.status).toBe("needs-provider-repair");
    expect(snapshot.capabilities[2]?.status).toBe("unsupported");
    expect(snapshot.capabilities[3]?.status).toBe("needs-access");
  });

  it("rejects duplicate, missing, extra, and protected provider evidence", () => {
    const providers = contract.ordinaryCapabilities.map((capability) => readyEvidence(capability));
    const [first] = providers;
    const [protectedEffect] = contract.protectedEffects;
    if (first === undefined || protectedEffect === undefined)
      throw new Error("Expected contract capabilities.");
    const input = {
      contract,
      capturedAt,
    };

    expect(() => buildLiveCapabilitySnapshot({ ...input, providers: providers.slice(1) })).toThrow(
      "LIVE_CAPABILITY_EVIDENCE_MISSING",
    );
    expect(() =>
      buildLiveCapabilitySnapshot({ ...input, providers: [...providers, first] }),
    ).toThrow("LIVE_CAPABILITY_EVIDENCE_DUPLICATE");
    expect(() =>
      buildLiveCapabilitySnapshot({
        ...input,
        providers: [...providers, readyEvidence("unknown.capability")],
      }),
    ).toThrow("LIVE_CAPABILITY_EVIDENCE_UNKNOWN");
    expect(() =>
      buildLiveCapabilitySnapshot({
        ...input,
        providers: [readyEvidence(protectedEffect), ...providers.slice(1)],
      }),
    ).toThrow("LIVE_CAPABILITY_EVIDENCE_PROTECTED");
  });

  it("rejects an unauthenticated or inactive grant before any capability becomes ready", () => {
    const providers = contract.ordinaryCapabilities.map((capability) => readyEvidence(capability));
    const grant = {
      grantId: "access_contract-snapshot",
      capabilities: [...contract.ordinaryCapabilities],
    };

    expect(() =>
      buildLiveCapabilitySnapshot({
        contract,
        providers,
        activeGrant: { ...grant, authenticated: false, active: true },
        capturedAt,
      }),
    ).toThrow();
    expect(() =>
      buildLiveCapabilitySnapshot({
        contract,
        providers,
        activeGrant: { ...grant, authenticated: true, active: false },
        capturedAt,
      }),
    ).toThrow();
  });
});
