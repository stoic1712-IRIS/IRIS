import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import type {
  ModelGatewayRequest,
  ModelGatewayResponse,
  ModelRuntimeAdapter,
  StructuredOutputValidator,
} from "../packages/model-gateway/src/index.js";
import {
  FounderDialogueService,
  type FounderDialogueResponse,
} from "../packages/model-gateway/src/index.js";

const requestId = "request_12345678-1234-4123-8123-123456789abc";

class DialogueRuntime implements ModelRuntimeAdapter {
  readonly provider = "ollama";
  request: ModelGatewayRequest | null = null;
  output: FounderDialogueResponse = {
    reply: "We can continue from the repository review we discussed.",
    intent: "conversation",
    proposedAction: "none",
    requiresApproval: false,
    authority: "none",
  };

  invoke<Output>(
    request: ModelGatewayRequest,
    validator: StructuredOutputValidator<Output>,
  ): Promise<ModelGatewayResponse & { output: Output }> {
    this.request = request;
    const output = validator.parse(this.output);
    return Promise.resolve({
      requestId,
      provider: "ollama",
      model: "qwen3:8b",
      createdAt: "2026-08-06T00:00:00.000Z",
      output,
      usage: {
        inputTokens: 10,
        outputTokens: 10,
        totalDurationNanoseconds: 1,
        loadDurationNanoseconds: 1,
      },
      doneReason: "stop",
      authority: "none",
    });
  }
}

function request() {
  return {
    requestId,
    source: "voice" as const,
    utterance: "What did we decide, and what should we do next?",
    history: [
      { role: "founder" as const, content: "Review the repository." },
      { role: "iris" as const, content: "The review found no blockers." },
    ],
    stateSummary: "Canonical main is synchronized. No workers are active.",
    model: "qwen3:8b",
  };
}

describe("Cycle Five Founder dialogue service", () => {
  it("launches the matching Command Center worktree with an explicit IRIS root", () => {
    const launcher = readFileSync("scripts/runtime/start-founder-command-center.ps1", "utf8");
    const supervisor = readFileSync("scripts/runtime/start-founder-command-center.sh", "utf8");
    expect(launcher).toContain("$worktreeSuffix");
    expect(launcher).toContain("wslpath -a");
    expect(launcher).toContain('$Path.Replace("\\", "/")');
    expect(launcher).toContain("wslpath -a -- $normalizedPath");
    expect(launcher).toContain("start-founder-command-center.sh");
    expect(supervisor).toContain('export IRIS_ROOT="$iris_root"');
    expect(supervisor).toContain("iris-voice-service.py");
    expect(supervisor).toContain("127.0.0.1:8765/health");
    expect(supervisor).toContain("trap cleanup_runtime EXIT INT TERM");
    expect(supervisor).toContain('kill "$gateway_pid"');
    expect(supervisor).toContain("node scripts/local-gateway.mjs &");
  });

  it("preserves bounded multi-turn context without execution authority", async () => {
    const runtime = new DialogueRuntime();
    const result = await new FounderDialogueService(runtime).reply(request());

    expect(result.authority).toBe("none");
    expect(runtime.request?.messages).toEqual(
      expect.arrayContaining([
        { role: "user", content: "Review the repository." },
        { role: "assistant", content: "The review found no blockers." },
      ]),
    );
    expect(runtime.request?.messages.at(-1)?.content).toMatch(/what should we do next/iu);
  });

  it("fails closed if a mission proposal omits approval", async () => {
    const runtime = new DialogueRuntime();
    runtime.output = {
      reply: "I changed it.",
      intent: "propose-mission",
      proposedAction: "mission-proposal",
      requiresApproval: false,
      authority: "none",
    };
    await expect(new FounderDialogueService(runtime).reply(request())).rejects.toThrow(
      /APPROVAL_REQUIRED/u,
    );
  });

  it("rejects oversized or unbounded conversation history", async () => {
    const runtime = new DialogueRuntime();
    await expect(
      new FounderDialogueService(runtime).reply({
        ...request(),
        history: Array.from({ length: 25 }, () => ({
          role: "founder",
          content: "Continue.",
        })),
      }),
    ).rejects.toThrow();
    expect(runtime.request).toBeNull();
  });
});
