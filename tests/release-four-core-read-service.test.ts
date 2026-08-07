import { describe, expect, it } from "vitest";
import {
  attestCoreResponse,
  createCoreReadEnvelope,
  founderCommandCenterAudience,
  parseCoreReadRequest,
  readModelScope,
  signCoreRequest,
  verifyCoreRequest,
  verifyCoreResponseAttestation,
} from "../packages/kernel/src/index.js";

const key = "a".repeat(64);
const now = new Date("2026-08-05T20:00:00.000Z");
const unsigned = {
  method: "GET" as const,
  path: "/v1/read-model" as const,
  requestId: `request_${"b".repeat(32)}`,
  timestamp: now.toISOString(),
  audience: founderCommandCenterAudience,
  scope: readModelScope,
};

describe("Release Four Core read boundary", () => {
  it("accepts only the exact signed request", () => {
    const request = { ...unsigned, signature: signCoreRequest(key, unsigned) };
    expect(verifyCoreRequest(key, request, now)).toBe(true);
    expect(verifyCoreRequest(key, { ...request, scope: "write" }, now)).toBe(false);
    expect(verifyCoreRequest(key, { ...request, signature: "0".repeat(64) }, now)).toBe(false);
  });

  it("rejects stale requests and unallowlisted routes", () => {
    const request = { ...unsigned, signature: signCoreRequest(key, unsigned) };
    expect(verifyCoreRequest(key, request, new Date(now.getTime() + 30_001))).toBe(false);
    expect(parseCoreReadRequest("POST", "/v1/read-model", {})).toBeNull();
    expect(parseCoreReadRequest("GET", "/other", {})).toBeNull();
  });

  it("binds real repository state into an expiring envelope", () => {
    const envelope = createCoreReadEnvelope(
      {
        canonicalRevision: "7dcd3c24244ffc4ebdc3d56b7aba1ece6915505a",
        branch: "main",
        remoteIdentity: "https://github.com/stoic1712-IRIS/IRIS.git",
        trackedRemoteRevision: "7dcd3c24244ffc4ebdc3d56b7aba1ece6915505a",
        remoteEqual: true,
        observedAt: now.toISOString(),
        phaseZeroGraduated: false,
        graduationCheckpoint: null,
      },
      now,
    );
    expect(envelope.canonicalRevision).toBe(envelope.payload.connectedRevision);
    expect(envelope.repository.remoteEqual).toBe(true);
    expect(envelope.payload.health).toContainEqual(
      expect.objectContaining({
        component: "Phase 0 graduation",
        state: "offline",
      }),
    );
    expect(Date.parse(envelope.expiresAt) - Date.parse(envelope.generatedAt)).toBe(30_000);
  });

  it("attests the exact body and rejects alteration", () => {
    const body = '{"state":"ready"}';
    const attestation = attestCoreResponse(key, body);
    expect(verifyCoreResponseAttestation(key, body, attestation)).toBe(true);
    expect(verifyCoreResponseAttestation(key, `${body} `, attestation)).toBe(false);
  });
});
