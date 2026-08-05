import { spawn } from "node:child_process";

import { z } from "zod";

import { IntegratedDecisionGate } from "../../packages/kernel/dist/index.js";
import { OllamaAdapter } from "../../packages/model-gateway/dist/index.js";

async function windowsLoopbackFetch(url, init = {}) {
  if (url !== "http://localhost:11434/api/chat" || init.method !== "POST") {
    return Response.json({ error: "Diagnostic transport rejected the endpoint." }, { status: 400 });
  }
  if (typeof init.body !== "string") {
    return Response.json(
      { error: "Diagnostic transport requires a serialized body." },
      { status: 400 },
    );
  }

  const command = [
    "$body = [Console]::In.ReadToEnd()",
    "$response = Invoke-RestMethod -Uri 'http://localhost:11434/api/chat' -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 120",
    "$response | ConvertTo-Json -Depth 20 -Compress",
  ].join("; ");
  const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  const abort = () => child.kill();
  init.signal?.addEventListener("abort", abort, { once: true });
  child.stdin.end(init.body);
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  init.signal?.removeEventListener("abort", abort);
  if (exitCode !== 0) {
    return Response.json(
      {
        error: "Windows loopback diagnostic transport failed.",
        diagnostic: Buffer.concat(stderr).toString("utf8").slice(0, 200),
      },
      { status: 502 },
    );
  }
  return Response.json(JSON.parse(Buffer.concat(stdout).toString("utf8")));
}

const outputValidator = z
  .object({
    status: z.literal("ready"),
    model: z.literal("qwen3:8b"),
    authority: z.literal("none"),
  })
  .strict();
const outputSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["ready"] },
    model: { type: "string", enum: ["qwen3:8b"] },
    authority: { type: "string", enum: ["none"] },
  },
  required: ["status", "model", "authority"],
  additionalProperties: false,
};
const requestId = "request_02936f3a-8b5c-7def-8abc-0123456789ab";
const adapter = new OllamaAdapter({ fetchImplementation: windowsLoopbackFetch });
const result = await new IntegratedDecisionGate(adapter).execute(
  {
    objective: {
      objectiveId: "objective_02936f3a-8b5c-7def-8abc-0123456789ab",
      submittedAt: "2026-08-04T22:30:00-06:00",
      summary: "Verify the Wave 3 read-only integrated decision gate",
      requestedOutcome: "Return a structured readiness result without changing state.",
      mode: "read",
      externalEffects: false,
      destructive: false,
      usesSecrets: false,
      createsCost: false,
    },
    actor: {
      identityId: "identity_02936f3a-8b5c-7def-8abc-0123456789ab",
      identityType: "founder",
      displayName: "Founder",
      authenticated: true,
      authorityScopes: ["read"],
    },
    audit: {
      correlationId: requestId,
      eventIds: [
        "audit_02936f3a-8b5c-7def-8abc-000000000001",
        "audit_02936f3a-8b5c-7def-8abc-000000000002",
        "audit_02936f3a-8b5c-7def-8abc-000000000003",
        "audit_02936f3a-8b5c-7def-8abc-000000000004",
      ],
      occurredAt: "2026-08-04T22:30:00-06:00",
      recordedAt: "2026-08-04T22:30:00-06:00",
      actor: {
        actorId: "worker_02936f3a-8b5c-7def-8abc-0123456789ab",
        actorType: "iris-core",
        displayName: "IRIS Kernel",
      },
    },
    modelRequest: {
      requestId,
      model: "qwen3:8b",
      messages: [
        {
          role: "system",
          content: "Return only the required structured fields. You possess no standing authority.",
        },
        {
          role: "user",
          content: 'Return status "ready", model "qwen3:8b", and authority "none".',
        },
      ],
      outputSchema,
      temperature: 0,
      seed: 0,
      contextTokens: 4096,
      timeoutMs: 120_000,
      keepAlive: 0,
    },
  },
  outputValidator,
);

console.log(
  JSON.stringify(
    {
      status: result.status,
      riskClass: result.classification.riskClass,
      authorization: result.authorization.decision,
      provider: result.modelResponse?.provider,
      model: result.modelResponse?.model,
      output: result.modelResponse?.output,
      modelAuthority: result.modelResponse?.authority,
      auditEventTypes: result.auditEvents.map((event) => event.eventType),
      auditCorrelationIds: [
        ...new Set(result.auditEvents.map((event) => event.correlation.correlationId)),
      ],
      auditChainComplete: result.auditEvents
        .slice(1)
        .every((event) => event.previousEventDigest !== undefined),
      usage: result.modelResponse?.usage,
    },
    null,
    2,
  ),
);
