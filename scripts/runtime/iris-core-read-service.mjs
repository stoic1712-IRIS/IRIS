import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  attestCoreResponse,
  createCoreReadEnvelope,
  verifyCoreRequest,
} from "../../packages/kernel/dist/read-model.js";
import {
  parseCoreGraduationRequest,
  verifyCoreGraduationBody,
  verifyCoreGraduationRequest,
} from "../../packages/kernel/dist/graduation-service.js";
import { parseCoreReadRequest } from "../../packages/kernel/dist/read-service.js";
import {
  CanonicalPhaseZeroGraduationEvidenceProvider,
  FilePhaseZeroGraduationCoordinator,
  LivePhaseZeroGraduationExecutionProvider,
  OllamaPhaseZeroGraduationProposalModel,
  PhaseZeroGraduationReadinessController,
  phaseZeroGraduationApprovalEnvelopeSchema,
  phaseZeroGraduationProposalRequestSchema,
  resolvePhaseZeroProviderExecutable,
} from "../../packages/development/dist/index.js";

const host = "127.0.0.1";
const port = readLoopbackPort("IRIS_CORE_READ_PORT", 4181);
const maximumBytes = 256 * 1024;
const irisRoot = process.cwd();
const commandCenterRoot = resolve(
  process.env.IRIS_COMMAND_CENTER_ROOT ?? join(irisRoot, "..", "iris-founder-command-center-main"),
);

function readLoopbackPort(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (!/^[0-9]{1,5}$/u.test(value)) throw new Error(`${name}_INVALID`);
  const candidate = Number(value);
  if (!Number.isInteger(candidate) || candidate < 1024 || candidate > 65_535) {
    throw new Error(`${name}_INVALID`);
  }
  return candidate;
}

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
  const canonicalRevision = git("rev-parse", "main");
  const trackedRemoteRevision = git("rev-parse", "origin/main");
  return {
    canonicalRevision,
    branch: "main",
    remoteIdentity: git("remote", "get-url", "origin").replace(/https:\/\/[^@/]+@/u, "https://"),
    trackedRemoteRevision,
    remoteEqual: canonicalRevision === trackedRemoteRevision,
    observedAt: now.toISOString(),
    phaseZeroGraduated: false,
    graduationCheckpoint: null,
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
const phaseZeroStateRoot = resolve(
  process.env.IRIS_PHASE_ZERO_STATE_ROOT ??
    join(homedir(), ".local", "state", "stoic-iris", "phase-zero"),
);
const graduationStore = new FilePhaseZeroGraduationCoordinator({
  statePath: join(phaseZeroStateRoot, "graduation.json"),
  evidence: new CanonicalPhaseZeroGraduationEvidenceProvider({
    corePath: irisRoot,
    commandCenterPath: commandCenterRoot,
    deploymentId: "founder-command-center-local",
  }),
  model: new OllamaPhaseZeroGraduationProposalModel({
    model: "qwen3-coder:30b",
    baseUrl: "http://127.0.0.1:11434",
  }),
  execution: new LivePhaseZeroGraduationExecutionProvider({
    canonicalPath: irisRoot,
    commandCenterPath: commandCenterRoot,
    deploymentId: "founder-command-center-local",
    ghExecutable: process.env.IRIS_GH_EXECUTABLE ?? resolvePhaseZeroProviderExecutable("gh"),
    ollamaExecutable:
      process.env.IRIS_OLLAMA_EXECUTABLE ?? resolvePhaseZeroProviderExecutable("ollama"),
    workspaceRoot: join(phaseZeroStateRoot, "workspaces"),
    journalRoot: join(phaseZeroStateRoot, "journals"),
  }),
  onActivationError(error) {
    console.error(
      "PHASE_ZERO_ACTIVATION_FAILED",
      error instanceof Error ? error.message : "UNKNOWN_ERROR",
    );
  },
});
const graduationController = new PhaseZeroGraduationReadinessController(graduationStore);
const seen = new Map();
const unavailable = (response) => {
  response.writeHead(404, { "content-type": "application/json", "cache-control": "no-store" });
  response.end('{"error":"unavailable"}');
};
const fresh = (requestId, now) => {
  if (seen.has(requestId)) return false;
  seen.set(requestId, now.getTime());
  for (const [id, observed] of seen) if (now.getTime() - observed > 60_000) seen.delete(id);
  return true;
};
const writeResult = (response, requestId, result) => {
  const body = JSON.stringify(result);
  if (Buffer.byteLength(body) > maximumBytes) return unavailable(response);
  response.writeHead(200, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-iris-request-id": requestId,
    "x-iris-attestation": attestCoreResponse(responseKey, body),
  });
  response.end(body);
};
const readBody = async (request) => {
  let body = "";
  for await (const chunk of request) {
    body += chunk.toString("utf8");
    if (Buffer.byteLength(body) > maximumBytes) throw new Error("BODY_OVERSIZED");
  }
  return body;
};

const server = createServer(async (request, response) => {
  const now = new Date();
  const readRequest = parseCoreReadRequest(request.method, request.url, request.headers);
  if (readRequest !== null) {
    if (!verifyCoreRequest(requestKey, readRequest, now) || !fresh(readRequest.requestId, now))
      return unavailable(response);
    const result =
      readRequest.path === "/v1/health"
        ? { state: "ready" }
        : createCoreReadEnvelope(realState(now), now);
    return writeResult(response, readRequest.requestId, result);
  }

  const graduationRequest = parseCoreGraduationRequest(
    request.method,
    request.url,
    request.headers,
  );
  if (
    graduationRequest === null ||
    !verifyCoreGraduationRequest(requestKey, graduationRequest, now) ||
    !fresh(graduationRequest.requestId, now)
  )
    return unavailable(response);

  if (graduationRequest.method === "GET") {
    if (!verifyCoreGraduationBody(graduationRequest, "")) return unavailable(response);
    try {
      return writeResult(response, graduationRequest.requestId, await graduationController.read());
    } catch {
      return unavailable(response);
    }
  }

  try {
    const body = await readBody(request);
    if (!verifyCoreGraduationBody(graduationRequest, body)) return unavailable(response);
    const parsed = JSON.parse(body);
    const result =
      graduationRequest.path === "/v1/graduation-proposals"
        ? await graduationController.prepareProposal(
            phaseZeroGraduationProposalRequestSchema.parse(parsed),
          )
        : await graduationController.consumeApproval(
            phaseZeroGraduationApprovalEnvelopeSchema.parse(parsed),
          );
    return writeResult(response, graduationRequest.requestId, result);
  } catch {
    return unavailable(response);
  }
});

server.listen(port, host, () => console.log("IRIS_CORE_READ_READY"));
const stop = () => server.close(() => process.exit(0));
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
