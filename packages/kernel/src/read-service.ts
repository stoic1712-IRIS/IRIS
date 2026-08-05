import type { IncomingHttpHeaders } from "node:http";
import {
  founderCommandCenterAudience,
  readModelScope,
  type CoreReadRequest,
} from "./read-model.js";

function one(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name];
  return typeof value === "string" ? value : "";
}

export function parseCoreReadRequest(
  method: string | undefined,
  path: string | undefined,
  headers: IncomingHttpHeaders,
): CoreReadRequest | null {
  if (method !== "GET" || (path !== "/v1/read-model" && path !== "/v1/health")) return null;
  const requestId = one(headers, "x-iris-request-id");
  const timestamp = one(headers, "x-iris-timestamp");
  const audience = one(headers, "x-iris-audience");
  const scope = one(headers, "x-iris-scope");
  const signature = one(headers, "x-iris-signature");
  if (audience !== founderCommandCenterAudience || scope !== readModelScope) return null;
  return {
    method,
    path,
    requestId,
    timestamp,
    audience,
    scope,
    signature,
  };
}
