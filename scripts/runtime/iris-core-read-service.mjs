import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import {
  attestCoreResponse,
  createCoreReadEnvelope,
  parseCoreReadRequest,
  verifyCoreRequest,
} from "../../packages/kernel/dist/index.js";

const host = "127.0.0.1";
const port = 4181;
const checkpoint = "468f81e4c2f91afe101796157d867926123c853d";
const maximumBytes = 256 * 1024;

function git(...args) {
  const options = {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"],
  };
  try {
    return execFileSync("git", args, options).trim();
  } catch (error) {
    if (process.platform !== "linux") throw error;
    return execFileSync("git.exe", args, options).trim();
  }
}

function realState(now) {
  const canonicalRevision = git("rev-parse", "HEAD");
  const trackedRemoteRevision = git("rev-parse", "origin/main");
  return {
    canonicalRevision,
    branch: git("branch", "--show-current"),
    remoteIdentity: git("remote", "get-url", "origin").replace(/https:\/\/[^@/]+@/u, "https://"),
    trackedRemoteRevision,
    remoteEqual: canonicalRevision === trackedRemoteRevision,
    observedAt: now.toISOString(),
    phaseZeroGraduated: true,
    graduationCheckpoint: checkpoint,
  };
}

async function readBootstrap() {
  let value = "";
  for await (const chunk of process.stdin) {
    value += chunk.toString("utf8");
    if (value.includes("\n")) break;
    if (Buffer.byteLength(value) > 4096) throw new Error("BOOTSTRAP_OVERSIZED");
  }
  const parsed = JSON.parse(value.trim());
  if (!/^[a-f0-9]{64}$/u.test(parsed.requestKey) || !/^[a-f0-9]{64}$/u.test(parsed.responseKey))
    throw new Error("BOOTSTRAP_INVALID");
  return parsed;
}

const { requestKey, responseKey } = await readBootstrap();
const seen = new Map();
const server = createServer((request, response) => {
  const parsed = parseCoreReadRequest(request.method, request.url, request.headers);
  const now = new Date();
  if (!parsed || !verifyCoreRequest(requestKey, parsed, now) || seen.has(parsed.requestId)) {
    response.writeHead(404, { "content-type": "application/json", "cache-control": "no-store" });
    response.end('{"error":"unavailable"}');
    return;
  }
  seen.set(parsed.requestId, now.getTime());
  for (const [id, observed] of seen) if (now.getTime() - observed > 60_000) seen.delete(id);
  const result =
    parsed.path === "/v1/health" ? { state: "ready" } : createCoreReadEnvelope(realState(now), now);
  const body = JSON.stringify(result);
  if (Buffer.byteLength(body) > maximumBytes) {
    response.writeHead(500, { "content-type": "application/json", "cache-control": "no-store" });
    response.end('{"error":"unavailable"}');
    return;
  }
  response.writeHead(200, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-iris-request-id": parsed.requestId,
    "x-iris-attestation": attestCoreResponse(responseKey, body),
  });
  response.end(body);
});

server.listen(port, host, () => console.log("IRIS_CORE_READ_READY"));
const stop = () => server.close(() => process.exit(0));
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
