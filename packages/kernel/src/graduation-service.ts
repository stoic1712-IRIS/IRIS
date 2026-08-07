import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

export const graduationTransportAudience = "iris-founder-command-center" as const;
export const graduationReadScope = "phase-zero-graduation:read:v1" as const;
export const graduationApprovalScope = "phase-zero-graduation:approve:v1" as const;
export const graduationReadinessPath = "/v1/graduation-readiness" as const;
export const graduationApprovalsPath = "/v1/graduation-approvals" as const;

export interface CoreGraduationRequest {
  method: "GET" | "POST";
  path: typeof graduationReadinessPath | typeof graduationApprovalsPath;
  requestId: string;
  timestamp: string;
  audience: string;
  scope: string;
  bodyDigest: string;
  signature: string;
}

function one(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name];
  return typeof value === "string" ? value : "";
}

export function graduationBodyDigest(body: string): string {
  return `sha256:${createHash("sha256").update(body).digest("hex")}`;
}

export function graduationRequestSigningText(
  input: Omit<CoreGraduationRequest, "signature">,
): string {
  return [
    input.method,
    input.path,
    input.requestId,
    input.timestamp,
    input.audience,
    input.scope,
    input.bodyDigest,
  ].join("\n");
}

export function signCoreGraduationRequest(
  key: string,
  input: Omit<CoreGraduationRequest, "signature">,
): string {
  return createHmac("sha256", key).update(graduationRequestSigningText(input)).digest("hex");
}

function equalHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/u.test(left) || !/^[a-f0-9]{64}$/u.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function parseCoreGraduationRequest(
  method: string | undefined,
  path: string | undefined,
  headers: IncomingHttpHeaders,
): CoreGraduationRequest | null {
  const isRead = method === "GET" && path === graduationReadinessPath;
  const isApproval = method === "POST" && path === graduationApprovalsPath;
  if (!isRead && !isApproval) return null;
  const scope = one(headers, "x-iris-scope");
  if (scope !== (isRead ? graduationReadScope : graduationApprovalScope)) return null;
  const audience = one(headers, "x-iris-audience");
  if (audience !== graduationTransportAudience) return null;
  return {
    method: isRead ? "GET" : "POST",
    path: isRead ? graduationReadinessPath : graduationApprovalsPath,
    requestId: one(headers, "x-iris-request-id"),
    timestamp: one(headers, "x-iris-timestamp"),
    audience,
    scope,
    bodyDigest: one(headers, "x-iris-content-sha256"),
    signature: one(headers, "x-iris-signature"),
  };
}

export function verifyCoreGraduationRequest(
  key: string,
  input: CoreGraduationRequest,
  now: Date,
): boolean {
  const expectedScope =
    input.method === "GET" && input.path === graduationReadinessPath
      ? graduationReadScope
      : input.method === "POST" && input.path === graduationApprovalsPath
        ? graduationApprovalScope
        : null;
  if (expectedScope === null || input.scope !== expectedScope) return false;
  if (input.audience !== graduationTransportAudience) return false;
  if (!/^request_[a-f0-9]{32}$/u.test(input.requestId)) return false;
  if (!/^sha256:[a-f0-9]{64}$/u.test(input.bodyDigest)) return false;
  const timestamp = Date.parse(input.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(now.getTime() - timestamp) > 30_000) return false;
  const { signature, ...unsigned } = input;
  return equalHex(signature, signCoreGraduationRequest(key, unsigned));
}

export function verifyCoreGraduationBody(input: CoreGraduationRequest, body: string): boolean {
  return input.bodyDigest === graduationBodyDigest(body);
}
