import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const founderCommandCenterAudience = "iris-founder-command-center" as const;
export const readModelScope = "read-model:v1" as const;
export const readModelVersion = "iris.stoic/read-model/v1" as const;

interface CoreReadStateBase {
  canonicalRevision: string;
  branch: string;
  remoteIdentity: string;
  trackedRemoteRevision: string;
  remoteEqual: boolean;
  observedAt: string;
}

export type CoreReadState = CoreReadStateBase &
  (
    | { phaseZeroGraduated: false; graduationCheckpoint: null }
    | { phaseZeroGraduated: true; graduationCheckpoint: string }
  );

export interface CoreReadRequest {
  method: "GET";
  path: "/v1/read-model" | "/v1/health";
  requestId: string;
  timestamp: string;
  audience: string;
  scope: string;
  signature: string;
}

export function requestSigningText(input: Omit<CoreReadRequest, "signature">): string {
  return [
    input.method,
    input.path,
    input.requestId,
    input.timestamp,
    input.audience,
    input.scope,
  ].join("\n");
}

export function signCoreRequest(key: string, input: Omit<CoreReadRequest, "signature">): string {
  return createHmac("sha256", key).update(requestSigningText(input)).digest("hex");
}

function equalHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function verifyCoreRequest(key: string, input: CoreReadRequest, now: Date): boolean {
  if (input.audience !== founderCommandCenterAudience || input.scope !== readModelScope)
    return false;
  if (!/^request_[a-f0-9]{32}$/.test(input.requestId)) return false;
  const timestamp = Date.parse(input.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(now.getTime() - timestamp) > 30_000) return false;
  const { signature, ...unsigned } = input;
  return equalHex(signature, signCoreRequest(key, unsigned));
}

export function createCoreReadEnvelope(state: CoreReadState, generatedAt: Date) {
  const revision = state.canonicalRevision;
  const source = (evidence: string) => ({
    revision,
    evidence,
    integrity: "verified" as const,
  });
  const payload = {
    connectedRevision: revision,
    actor: "Synthetic Founder" as const,
    mode: "READ ONLY · SYNTHETIC DATA" as const,
    decisions: [],
    missions: [
      {
        id: "mission_operational-integration",
        objective: "Launch the Founder-operated local IRIS experience",
        status: "active" as const,
        progress: 25,
        blocker: "Worker activation requires a later exact approval",
        source: source("docs/specifications/release-four-authenticated-live-read.md"),
      },
    ],
    workers: [],
    evidence: [
      {
        id: "evidence_phase-zero-graduation",
        title: state.phaseZeroGraduated
          ? "Phase 0 Development Independence"
          : "Phase 0 graduation readiness",
        citation: state.phaseZeroGraduated
          ? "evidence/wave-10/sovereign-development-graduation-2026-08-05.md"
          : "docs/specifications/cycle-nine-phase-zero-graduation-readiness.md",
        redacted: true as const,
        source: source(
          state.phaseZeroGraduated
            ? "evidence/wave-10/sovereign-development-graduation-2026-08-05.md"
            : "docs/specifications/cycle-nine-phase-zero-graduation-readiness.md",
        ),
      },
    ],
    blueprints: [
      {
        id: "iris-founder-command-center",
        profile: "development" as const,
        publicExposure: false as const,
        hourlyCostUsd: 0 as const,
        findings: 0 as const,
        source: source("proposals/applications/iris-founder-command-center/README.md"),
      },
    ],
    health: [
      {
        component: "Canonical repository",
        state: state.remoteEqual ? ("healthy" as const) : ("degraded" as const),
        latencyMs: 0,
        detail: state.remoteEqual
          ? `Local and tracked remote revisions match on ${state.branch}.`
          : "Local and tracked remote revisions differ.",
        source: source(".git/refs/remotes/origin/main"),
      },
      {
        component: "Phase 0 graduation",
        state: state.phaseZeroGraduated ? ("healthy" as const) : ("offline" as const),
        latencyMs: 0,
        detail: state.phaseZeroGraduated
          ? `Completed at checkpoint ${state.graduationCheckpoint}.`
          : "Readiness machinery is being completed; the deployed Founder-operated graduation has not run.",
        source: source(
          state.phaseZeroGraduated
            ? "evidence/wave-10/sovereign-development-graduation-2026-08-05.md"
            : "docs/specifications/cycle-nine-phase-zero-graduation-readiness.md",
        ),
      },
      {
        component: "Provider resources",
        state: "offline" as const,
        latencyMs: 0,
        detail: "Not queried by Release Four; provider state is unverified.",
        source: source("docs/specifications/release-four-authenticated-live-read.md"),
      },
    ],
  };
  const payloadDigest = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return {
    apiVersion: readModelVersion,
    generatedAt: generatedAt.toISOString(),
    expiresAt: new Date(generatedAt.getTime() + 30_000).toISOString(),
    actor: {
      id: "Founder",
      authentication: "local-console-session",
      audience: founderCommandCenterAudience,
      scope: readModelScope,
    },
    canonicalRevision: revision,
    repository: {
      branch: state.branch,
      remoteIdentity: state.remoteIdentity,
      trackedRemoteRevision: state.trackedRemoteRevision,
      remoteEqual: state.remoteEqual,
      observedAt: state.observedAt,
    },
    integrity: {
      algorithm: "sha256",
      payloadDigest: `sha256:${payloadDigest}`,
      attestation: "gateway-verifiable",
    },
    payload,
  };
}

export function attestCoreResponse(key: string, body: string): string {
  return createHmac("sha256", key).update(body).digest("hex");
}

export function verifyCoreResponseAttestation(
  key: string,
  body: string,
  attestation: string,
): boolean {
  return equalHex(attestation, attestCoreResponse(key, body));
}
