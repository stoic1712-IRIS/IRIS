import { describe, expect, it } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

import type {
  ModelGatewayRequest,
  ModelGatewayResponse,
  ModelRuntimeAdapter,
  StructuredOutputValidator,
} from "../packages/model-gateway/src/index.js";
import {
  createControllerDisposition,
  FounderDialogueService,
  type FounderDialogueController,
  type FounderDialogueResponse,
} from "../packages/model-gateway/src/index.js";

const requestId = "request_12345678-1234-4123-8123-123456789abc";
const dispositionId = "disposition_founder-dialogue-0001";
const sha = (character: string) => `sha256:${character.repeat(64)}`;

class DialogueController implements FounderDialogueController {
  disposition = createControllerDisposition({
    dispositionId,
    contractDigest: sha("a"),
    decision: {
      kind: "execute-now",
      objectiveId: "objective_founder-dialogue-0001",
      capabilities: ["repository.inspect"],
      grantId: "access_contract-dialogue",
      nextAction: "dispatch-governed-controller",
    },
    exactEvidence: [{ reference: "evidence/live-capability-snapshot", digest: sha("b") }],
    protectedApproval: null,
  });

  resolve(candidateId: string) {
    return candidateId === dispositionId ? this.disposition : undefined;
  }
}

class DialogueRuntime implements ModelRuntimeAdapter {
  readonly provider = "ollama";
  request: ModelGatewayRequest | null = null;
  output: FounderDialogueResponse = {
    reply: "We can continue from the repository review we discussed.",
    intent: "conversation",
    proposedAction: "none",
    requiresApproval: false,
    modelAuthority: "none",
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
      modelAuthority: "none",
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
    controllerDispositionId: dispositionId,
    model: "qwen3:8b",
  };
}

describe("Cycle Five Founder dialogue service", () => {
  it.runIf(process.platform === "win32" || process.env.WSL_DISTRO_NAME !== undefined)(
    "selects the canonical main Command Center when a stale legacy checkout also exists",
    () => {
      const fixtureRoot = mkdtempSync(resolve(".launcher-selection-"));
      const irisRoot = join(fixtureRoot, "STOIC-IRIS");
      const canonical = join(fixtureRoot, "iris-founder-command-center-main");
      const legacy = join(fixtureRoot, "iris-founder-command-center");
      const toWindowsPath = (path: string) =>
        process.platform === "win32"
          ? path
          : spawnSync("wslpath", ["-w", path], { encoding: "utf8" }).stdout.trim();

      try {
        mkdirSync(irisRoot);
        for (const candidate of [canonical, legacy]) {
          mkdirSync(join(candidate, "scripts"), { recursive: true });
          writeFileSync(join(candidate, "scripts", "local-gateway.mjs"), "");
        }
        const result = spawnSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            toWindowsPath(resolve("scripts/runtime/resolve-founder-command-center.ps1")),
            "-IrisRepository",
            toWindowsPath(irisRoot),
          ],
          { encoding: "utf8" },
        );

        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout.trim()).toBe(toWindowsPath(canonical));
      } finally {
        rmSync(fixtureRoot, { force: true, recursive: true });
      }
    },
  );

  it("launches the matching Command Center worktree with an explicit IRIS root", () => {
    const launcher = readFileSync("scripts/runtime/start-founder-command-center.ps1", "utf8");
    const resolver = readFileSync("scripts/runtime/resolve-founder-command-center.ps1", "utf8");
    const supervisor = readFileSync("scripts/runtime/start-founder-command-center.sh", "utf8");
    const preparer = readFileSync("scripts/runtime/prepare-founder-runtime.sh", "utf8");
    expect(launcher).toContain("resolve-founder-command-center.ps1");
    expect(resolver).toContain("$worktreeSuffix");
    expect(launcher).toContain("wslpath -a");
    expect(launcher).toContain('$Path.Replace("\\", "/")');
    expect(launcher).toContain("wslpath -a -- $normalizedPath");
    expect(launcher).toContain("start-founder-command-center.sh");
    expect(launcher).toContain("Invoke-HostRuntimeBuild");
    expect(launcher).toContain('"IRIS_RUNTIME_PREBUILT=1"');
    expect(launcher).toContain('$env:Path = "$nodeDirectory;$originalPath"');
    expect(launcher).toContain("pinned-node-bin");
    expect(launcher).toContain('"@call `"$corepack`" pnpm %*`r`n"');
    expect(preparer).toContain('[[ "${IRIS_RUNTIME_PREBUILT:-0}" == "1" ]]');
    expect(supervisor).toContain('export IRIS_ROOT="$iris_root"');
    expect(supervisor).toContain("iris-voice-service.py");
    expect(supervisor).toContain("127.0.0.1:8765/health");
    expect(supervisor).toContain("trap cleanup_runtime EXIT INT TERM");
    expect(supervisor).toContain('kill "$gateway_pid"');
    expect(supervisor).toContain("node scripts/local-gateway.mjs &");
  });

  it.runIf(process.platform !== "win32")(
    "builds Core and the Command Center from their current sources before launch",
    () => {
      const fixtureRoot = mkdtempSync(join(process.cwd(), ".tmp-runtime-build-"));
      const core = join(fixtureRoot, "core");
      const commandCenter = join(fixtureRoot, "command-center");
      const bin = join(fixtureRoot, "bin");
      const buildLog = join(fixtureRoot, "build.log");
      const fakePnpm = join(bin, "pnpm");
      try {
        for (const directory of [core, commandCenter, bin])
          mkdirSync(directory, { recursive: true });
        for (const directory of [core, commandCenter])
          writeFileSync(join(directory, "package.json"), "{}\n", "utf8");
        writeFileSync(
          fakePnpm,
          '#!/usr/bin/env bash\nprintf "%s|%s\\n" "$PWD" "$*" >> "$IRIS_BUILD_LOG"\n',
          "utf8",
        );
        chmodSync(fakePnpm, 0o755);

        const result = spawnSync(
          "bash",
          [resolve("scripts/runtime/prepare-founder-runtime.sh"), core, commandCenter],
          {
            encoding: "utf8",
            env: {
              ...process.env,
              IRIS_BUILD_LOG: buildLog,
              PATH: `${bin}:${process.env.PATH ?? ""}`,
            },
          },
        );

        expect(result.status, result.stderr).toBe(0);
        expect(readFileSync(buildLog, "utf8").trim().split("\n")).toEqual([
          `${core}|build`,
          `${commandCenter}|build`,
        ]);
      } finally {
        rmSync(fixtureRoot, { force: true, recursive: true });
      }
    },
  );

  it("preserves bounded multi-turn context with explicit model and controller separation", async () => {
    const runtime = new DialogueRuntime();
    const result = await new FounderDialogueService(runtime, new DialogueController()).reply(
      request(),
    );

    expect(result.modelAuthority).toBe("none");
    expect(result.controller).toEqual({
      decision: "execute-now",
      executable: true,
      activeGrantId: "access_contract-dialogue",
    });
    expect(result.controllerDispositionId).toBe(dispositionId);
    expect(runtime.request?.messages).toEqual(
      expect.arrayContaining([
        { role: "user", content: "Review the repository." },
        { role: "assistant", content: "The review found no blockers." },
      ]),
    );
    expect(runtime.request?.messages.at(-1)?.content).toMatch(/what should we do next/iu);
    expect(runtime.request?.messages[0]?.content).toMatch(
      /You do not own authority\. Follow the\s+supplied validated IRIS controller disposition exactly/iu,
    );
    expect(runtime.request?.messages[0]?.content).not.toContain("You have no execution authority");
    expect(
      runtime.request?.messages.some(
        (message) => message.role === "system" && message.content.includes('"kind":"execute-now"'),
      ),
    ).toBe(true);
    expect(runtime.request?.messages[0]?.content).not.toContain(
      "Repository mutation, worker activation, publication, deployment, credentials, spending, or provider changes must remain a proposal",
    );
  });

  it("fails closed if a mission proposal omits approval", async () => {
    const runtime = new DialogueRuntime();
    runtime.output = {
      reply: "I changed it.",
      intent: "propose-mission",
      proposedAction: "mission-proposal",
      requiresApproval: false,
      modelAuthority: "none",
    };
    await expect(
      new FounderDialogueService(runtime, new DialogueController()).reply(request()),
    ).rejects.toThrow(/APPROVAL_REQUIRED/u);
  });

  it("cannot turn an execute-now disposition into a generic refusal", async () => {
    const runtime = new DialogueRuntime();
    runtime.output = {
      reply: "I cannot do that. Run these commands yourself.",
      intent: "conversation",
      proposedAction: "none",
      requiresApproval: false,
      modelAuthority: "none",
    };
    const result = await new FounderDialogueService(runtime, new DialogueController()).reply(
      request(),
    );
    expect(result.reply).toContain("dispatching the governed controller");
    expect(result.reply).not.toMatch(/cannot|yourself/iu);
  });

  it("rejects a controller disposition whose digest no longer binds its decision", async () => {
    const runtime = new DialogueRuntime();
    const controller = new DialogueController();
    controller.disposition = {
      ...controller.disposition,
      decisionDigest: sha("f"),
    };
    await expect(new FounderDialogueService(runtime, controller).reply(request())).rejects.toThrow(
      "CONTROLLER_DISPOSITION_DIGEST_MISMATCH",
    );
    expect(runtime.request).toBeNull();
  });

  it("rejects oversized or unbounded conversation history", async () => {
    const runtime = new DialogueRuntime();
    await expect(
      new FounderDialogueService(runtime, new DialogueController()).reply({
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
