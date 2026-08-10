import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  CanonicalPhaseZeroGraduationEvidenceProvider,
  FilePhaseZeroGraduationCoordinator,
  LivePhaseZeroGraduationExecutionProvider,
  OllamaPhaseZeroGraduationProposalModel,
  PhaseZeroGraduationReadinessController,
  type PhaseZeroGraduationExecutionProvider,
  phaseZeroGraduationEnvelopeSchema,
  phaseZeroGraduationModelPlanSchema,
  phaseZeroGraduationProposalDigest,
  resolvePhaseZeroProviderExecutable,
} from "../packages/development/src/index.js";

const coreRevision = "1".repeat(40);
const commandCenterRevision = "2".repeat(40);
const inspectedAt = "2026-08-10T00:00:00.000Z";
const now = new Date("2026-08-10T00:01:00.000Z");

function blockedExecution(onPreflight: () => void): PhaseZeroGraduationExecutionProvider {
  return {
    preflight() {
      onPreflight();
      return Promise.reject(new Error("EXPECTED_TEST_PREFLIGHT_STOP"));
    },
    executeCandidate: vi.fn(),
    independentlyReview: vi.fn(),
    deliver: vi.fn(),
    merge: vi.fn(),
    verifyCanonicalEquality: vi.fn(),
    preserveRollbackEvidence: vi.fn(),
    cleanup: vi.fn(),
    terminatePaidResources: vi.fn(),
    providerResources: vi.fn(),
  };
}

function pendingExecution(onPreflight: () => void): PhaseZeroGraduationExecutionProvider {
  return {
    preflight() {
      onPreflight();
      return new Promise<never>(() => undefined);
    },
    executeCandidate: vi.fn(),
    independentlyReview: vi.fn(),
    deliver: vi.fn(),
    merge: vi.fn(),
    verifyCanonicalEquality: vi.fn(),
    preserveRollbackEvidence: vi.fn(),
    cleanup: vi.fn(),
    terminatePaidResources: vi.fn(),
    providerResources: vi.fn(),
  };
}

function coordinator(
  statePath: string,
  onPreflight: () => void,
  onActivationError: (error: unknown) => void = () => undefined,
  execution: PhaseZeroGraduationExecutionProvider = blockedExecution(onPreflight),
  clock: () => Date = () => now,
) {
  return new FilePhaseZeroGraduationCoordinator({
    statePath,
    now: clock,
    evidence: {
      currentCoreRevision: () => Promise.resolve(coreRevision),
      inspect: vi.fn().mockResolvedValue({
        canonicalBaseRevision: coreRevision,
        commandCenterBaseRevision: commandCenterRevision,
        deploymentId: "founder-command-center-local",
        repositoryInspectionDigest: `sha256:${"3".repeat(64)}`,
        inspectedAt,
        evidence: "canonical tracked paths and bounded source excerpts",
      }),
    },
    model: {
      provider: "ollama",
      name: "qwen3-coder:30b",
      plan: vi.fn().mockResolvedValue({
        objective:
          "Improve IRIS self-inspection with a bounded multi-file implementation and regression test.",
        readPaths: [
          "packages/development/src/self-description.ts",
          "tests/wave-10-graduation-self-description.test.ts",
        ],
        writePaths: [
          "packages/development/src/self-description.ts",
          "tests/wave-10-graduation-self-description.test.ts",
        ],
        verificationCommands: [["pnpm", "verify"]],
      }),
    },
    execution,
    onActivationError,
  });
}

describe("IRIS-owned Phase 0 proposal and activation", () => {
  it("rejects protected control paths at every directory depth", () => {
    for (const path of [
      "src/.git/config",
      "packages/worker/.github/workflows/ci.yml",
      "apps/runtime/.iris/state.json",
      "packages/worker/AGENTS.md",
      "packages/worker/CLAUDE.md",
      "packages/worker/pnpm-lock.yaml",
    ])
      expect(
        phaseZeroGraduationModelPlanSchema.safeParse({
          objective: "Attempt a nested protected control-file mutation.",
          readPaths: [path, "README.md"],
          writePaths: [path, "README.md"],
          verificationCommands: [["pnpm", "verify"]],
        }).success,
      ).toBe(false);
  });

  it("resolves provider executable names for the deployed WSL interop boundary", () => {
    expect(resolvePhaseZeroProviderExecutable("git", "linux", "Ubuntu")).toBe("git.exe");
    expect(resolvePhaseZeroProviderExecutable("gh", "linux", "Ubuntu")).toBe("gh.exe");
    expect(resolvePhaseZeroProviderExecutable("ollama", "linux", "Ubuntu")).toBe("ollama.exe");
    expect(resolvePhaseZeroProviderExecutable("gh", "win32", undefined)).toBe("gh");
    expect(resolvePhaseZeroProviderExecutable("/usr/bin/gh", "linux", "Ubuntu")).toBe(
      "/usr/bin/gh",
    );
  });

  it("binds canonical evidence collection to the deployed WSL-aware Git executable", async () => {
    const runtimeSource = await readFile(
      new URL("../scripts/runtime/iris-core-read-service.mjs", import.meta.url),
      "utf8",
    );
    expect(runtimeSource).toContain("gitExecutable:");
    expect(runtimeSource).toContain(
      'process.env.IRIS_GIT_EXECUTABLE ?? resolvePhaseZeroProviderExecutable("git")',
    );
  });

  it("binds bounded tracked Core and Command Center evidence to exact equal main revisions", async () => {
    const calls: string[] = [];
    const executables: string[] = [];
    const runner = {
      run: vi.fn((executable: string, args: string[], options?: { cwd?: string }) => {
        executables.push(executable);
        calls.push(`${options?.cwd ?? ""}|${args.join(" ")}`);
        const joined = args.join(" ");
        if (joined === "status --porcelain=v1 -uall") return Promise.resolve("");
        if (joined === "branch --show-current") return Promise.resolve("main");
        if (joined === "rev-parse HEAD" || joined === "rev-parse origin/main")
          return Promise.resolve(
            options?.cwd?.endsWith("core") ? coreRevision : commandCenterRevision,
          );
        if (joined === "ls-tree -r --name-only HEAD")
          return Promise.resolve("package.json\npackages/development/src/index.ts\nREADME.md");
        if (joined.startsWith("show ")) return Promise.resolve(`bounded:${joined}`);
        return Promise.reject(new Error(`UNEXPECTED:${joined}`));
      }),
    };
    const provider = new CanonicalPhaseZeroGraduationEvidenceProvider({
      corePath: "C:/test/core",
      commandCenterPath: "C:/test/command-center",
      deploymentId: "founder-command-center-local",
      gitExecutable: "git.exe",
      runner,
      now: () => new Date(inspectedAt),
    });
    const evidence = await provider.inspect("Perform a bounded multi-file self-upgrade.");
    expect(evidence.canonicalBaseRevision).toBe(coreRevision);
    expect(evidence.commandCenterBaseRevision).toBe(commandCenterRevision);
    expect(evidence.repositoryInspectionDigest).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(evidence.evidence).toContain("packages/development/src/index.ts");
    expect(evidence.evidence).not.toContain("C:/test");
    expect(calls.some((call) => call.endsWith("core|status --porcelain=v1 -uall"))).toBe(true);
    expect(new Set(executables)).toEqual(new Set(["git.exe"]));
  });

  it("uses the real loopback coding model and rejects output outside the strict plan schema", async () => {
    const fetchImplementation = vi.fn(
      (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        void input;
        void init;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              model: "qwen3-coder:30b",
              message: {
                role: "assistant",
                content: JSON.stringify({
                  objective:
                    "Create a bounded multi-file self-upgrade with exact regression coverage.",
                  readPaths: ["README.md", "tests/readme.test.ts"],
                  writePaths: ["README.md", "tests/readme.test.ts"],
                  verificationCommands: [["pnpm", "verify"]],
                }),
              },
              done: true,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      },
    );
    const model = new OllamaPhaseZeroGraduationProposalModel({ fetchImplementation });
    const plan = await model.plan({
      objective: "Perform a bounded self-upgrade.",
      evidence: "bounded canonical evidence",
      repositoryInspectionDigest: `sha256:${"3".repeat(64)}`,
      canonicalBaseRevision: coreRevision,
    });
    expect(model.name).toBe("qwen3-coder:30b");
    expect(plan).toMatchObject({ writePaths: ["README.md", "tests/readme.test.ts"] });
    const requestBody = fetchImplementation.mock.calls.at(0)?.[1]?.body;
    if (typeof requestBody !== "string") throw new Error("EXPECTED_STRING_REQUEST_BODY");
    const request = z
      .object({
        model: z.string(),
        stream: z.boolean(),
        messages: z.array(z.object({ content: z.string() })),
      })
      .parse(JSON.parse(requestBody) as unknown);
    expect(request.model).toBe("qwen3-coder:30b");
    expect(request.stream).toBe(false);
    expect(request.messages.at(0)?.content).toContain(coreRevision);
  });

  it("reprompts once when the real model omits a write path from the inspected paths", async () => {
    const responses = [
      {
        objective: "Create a bounded multi-file self-upgrade with exact regression coverage.",
        readPaths: ["README.md"],
        writePaths: ["README.md", "tests/readme.test.ts"],
        verificationCommands: [["pnpm", "verify"]],
      },
      {
        objective: "Create a bounded multi-file self-upgrade with exact regression coverage.",
        readPaths: ["README.md", "tests/readme.test.ts"],
        writePaths: ["README.md", "tests/readme.test.ts"],
        verificationCommands: [["pnpm", "verify"]],
      },
    ];
    const fetchImplementation = vi.fn(
      (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        void input;
        void init;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              model: "qwen3-coder:30b",
              message: {
                role: "assistant",
                content: JSON.stringify(responses.shift()),
              },
              done: true,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      },
    );
    const model = new OllamaPhaseZeroGraduationProposalModel({ fetchImplementation });

    await expect(
      model.plan({
        objective: "Perform a bounded self-upgrade.",
        evidence: "bounded canonical evidence",
        repositoryInspectionDigest: `sha256:${"3".repeat(64)}`,
        canonicalBaseRevision: coreRevision,
      }),
    ).resolves.toMatchObject({
      readPaths: ["README.md", "tests/readme.test.ts"],
      writePaths: ["README.md", "tests/readme.test.ts"],
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    const firstBody = fetchImplementation.mock.calls.at(0)?.[1]?.body;
    const secondBody = fetchImplementation.mock.calls.at(1)?.[1]?.body;
    if (typeof firstBody !== "string" || typeof secondBody !== "string")
      throw new Error("EXPECTED_STRING_REQUEST_BODY");
    const promptRequestSchema = z.object({
      messages: z.array(z.object({ content: z.string() })).min(1),
    });
    const firstPrompt = promptRequestSchema.parse(JSON.parse(firstBody) as unknown).messages[0]
      ?.content;
    const secondPrompt = promptRequestSchema.parse(JSON.parse(secondBody) as unknown).messages[0]
      ?.content;
    expect(firstPrompt).toContain("Every write path must also appear in readPaths");
    expect(secondPrompt).toContain("Previous output failed strict validation");
    expect(secondPrompt).toContain("Every write path must also be inspected");
  });

  it("preflights the exact canonical, provider, checkpoint, model, and zero-resource state", async () => {
    const runner = {
      run: vi.fn((_executable: string, args: string[], options?: { cwd?: string }) => {
        const joined = args.join(" ");
        if (joined === "status --porcelain=v1 -uall") return Promise.resolve("");
        if (joined === "branch --show-current") return Promise.resolve("main");
        if (joined === "rev-parse HEAD" || joined === "rev-parse origin/main")
          return Promise.resolve(
            options?.cwd?.endsWith("core") ? coreRevision : commandCenterRevision,
          );
        if (joined === "ls-remote origin refs/heads/main")
          return Promise.resolve(`${coreRevision}\trefs/heads/main`);
        if (joined.includes("run list")) return Promise.resolve("[]");
        if (joined === "list")
          return Promise.resolve("NAME ID SIZE MODIFIED\nqwen3-coder:30b abc 18 GB now");
        return Promise.reject(new Error(`UNEXPECTED:${joined}`));
      }),
    };
    const provider = new LivePhaseZeroGraduationExecutionProvider({
      canonicalPath: "C:/test/core",
      commandCenterPath: "C:/test/command-center",
      deploymentId: "founder-command-center-local",
      runner,
      repositoryProvider: {
        verifyAuthentication: () => "stoic1712-IRIS",
        inspectRepository: () => ({
          repository: "stoic1712-IRIS/IRIS-checkpoints",
          visibility: "PRIVATE" as const,
          defaultBranch: "main",
        }),
      },
    });
    const proposalStore = coordinator(
      join(await mkdtemp(join(tmpdir(), "iris-pf-p-")), "s.json"),
      () => undefined,
    );
    await proposalStore.prepareProposal({
      objective: "Perform a genuine bounded multi-file IRIS self-upgrade.",
    });
    const proposal = proposalStore.activeProposal();
    if (proposal === null) throw new Error("EXPECTED_PROPOSAL");
    const preflight = await provider.preflight(proposal, new AbortController().signal);
    expect(preflight).toMatchObject({
      modelReady: true,
      checkpointRepositoryPrivate: true,
      currentProviderResources: [],
    });
  });

  it("constructs and durably presents a strict Core-owned proposal from canonical evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "iris-phase-zero-coordinator-"));
    const statePath = join(root, "state.json");
    const value = await coordinator(statePath, () => undefined).prepareProposal({
      objective: "Perform a genuine bounded multi-file IRIS self-upgrade.",
    });
    const envelope = phaseZeroGraduationEnvelopeSchema.parse(value);
    expect(envelope.state).toBe("presented");
    if (envelope.state !== "presented") throw new Error("EXPECTED_PRESENTED");
    expect(envelope.proposal.canonicalBaseRevision).toBe(coreRevision);
    expect(envelope.proposal.commandCenterBaseRevision).toBe(commandCenterRevision);
    expect(envelope.proposal.modelName).toBe("qwen3-coder:30b");
    expect(envelope.proposal.writePaths).toHaveLength(2);
    expect(envelope.proposal.codexMutation).toBe(false);
    expect(envelope.proposal.claudeMutation).toBe(false);
    expect(envelope.approvalStatement).toContain(envelope.proposalDigest);
    expect(JSON.parse(await readFile(statePath, "utf8"))).toMatchObject({ version: 1 });
  });

  it("serializes concurrent proposal creation to one durable active proposal", async () => {
    const root = await mkdtemp(join(tmpdir(), "iris-phase-zero-concurrent-proposal-"));
    const store = coordinator(join(root, "state.json"), () => undefined);
    const results = await Promise.allSettled([
      store.prepareProposal({ objective: "Perform the first bounded multi-file upgrade." }),
      store.prepareProposal({ objective: "Perform the second bounded multi-file upgrade." }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("durably consumes one exact authenticated approval and activates the runtime once", async () => {
    const root = await mkdtemp(join(tmpdir(), "iris-phase-zero-activation-"));
    const statePath = join(root, "state.json");
    let preflights = 0;
    let activationError: unknown;
    const store = coordinator(
      statePath,
      () => {
        preflights += 1;
      },
      (error) => {
        activationError = error;
      },
    );
    const controller = new PhaseZeroGraduationReadinessController(store, () => now);
    const prepared = phaseZeroGraduationEnvelopeSchema.parse(
      await controller.prepareProposal({
        objective: "Perform a genuine bounded multi-file IRIS self-upgrade.",
      }),
    );
    if (prepared.state !== "presented") throw new Error("EXPECTED_PRESENTED");
    const approval = {
      approvalId: "approval_phase0-activation-0001",
      graduationId: prepared.proposal.graduationId,
      proposalDigest: prepared.proposalDigest,
      approvedBy: "Founder" as const,
      authentication: {
        actorId: "Founder" as const,
        sessionId: "founder.session",
        assurance: "founder-loopback-session" as const,
        verified: true as const,
        evidenceDigest: `sha256:${"4".repeat(64)}` as const,
        authenticatedAt: now.toISOString(),
      },
      typedStatement: prepared.approvalStatement,
      oneTime: true as const,
      issuedAt: now.toISOString(),
    };
    const receipt = await controller.consumeApproval({
      approvalType: "graduation",
      approval,
    });
    expect(receipt.durableLedger).toBe(true);
    await vi.waitFor(() => {
      expect(preflights).toBe(1);
    });
    await expect(
      controller.consumeApproval({ approvalType: "graduation", approval }),
    ).rejects.toThrow();
    const restarted = coordinator(statePath, () => {
      preflights += 1;
    });
    if (activationError instanceof Error) throw activationError;
    if (activationError !== undefined) throw new Error("NON_ERROR_ACTIVATION_FAILURE");
    const durable = phaseZeroGraduationEnvelopeSchema.parse(await restarted.read());
    expect(durable.state).toBe("concluded");
    expect(preflights).toBe(1);
  });

  it("serializes concurrent approval submissions to one durable receipt", async () => {
    const root = await mkdtemp(join(tmpdir(), "iris-phase-zero-concurrent-approval-"));
    const store = coordinator(
      join(root, "state.json"),
      () => undefined,
      () => undefined,
      pendingExecution(() => undefined),
    );
    const controller = new PhaseZeroGraduationReadinessController(store, () => now);
    const prepared = phaseZeroGraduationEnvelopeSchema.parse(
      await controller.prepareProposal({
        objective: "Perform a concurrency-safe multi-file upgrade.",
      }),
    );
    if (prepared.state !== "presented") throw new Error("EXPECTED_PRESENTED");
    const approval = {
      approvalType: "graduation" as const,
      approval: {
        approvalId: "approval_phase0-concurrent-0001",
        graduationId: prepared.proposal.graduationId,
        proposalDigest: prepared.proposalDigest,
        approvedBy: "Founder" as const,
        authentication: {
          actorId: "Founder" as const,
          sessionId: "founder.session",
          assurance: "founder-loopback-session" as const,
          verified: true as const,
          evidenceDigest: `sha256:${"4".repeat(64)}` as const,
          authenticatedAt: now.toISOString(),
        },
        typedStatement: prepared.approvalStatement,
        oneTime: true as const,
        issuedAt: now.toISOString(),
      },
    };
    const results = await Promise.allSettled([
      controller.consumeApproval(approval),
      controller.consumeApproval(approval),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("resumes an approved non-concluded activation from durable state after restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "iris-phase-zero-resume-"));
    const statePath = join(root, "state.json");
    let preflights = 0;
    const first = coordinator(
      statePath,
      () => {
        preflights += 1;
      },
      () => undefined,
      pendingExecution(() => {
        preflights += 1;
      }),
    );
    const controller = new PhaseZeroGraduationReadinessController(first, () => now);
    const prepared = phaseZeroGraduationEnvelopeSchema.parse(
      await controller.prepareProposal({ objective: "Perform a restart-safe multi-file upgrade." }),
    );
    if (prepared.state !== "presented") throw new Error("EXPECTED_PRESENTED");
    await controller.consumeApproval({
      approvalType: "graduation",
      approval: {
        approvalId: "approval_phase0-resume-0001",
        graduationId: prepared.proposal.graduationId,
        proposalDigest: prepared.proposalDigest,
        approvedBy: "Founder",
        authentication: {
          actorId: "Founder",
          sessionId: "founder.session",
          assurance: "founder-loopback-session",
          verified: true,
          evidenceDigest: `sha256:${"4".repeat(64)}`,
          authenticatedAt: now.toISOString(),
        },
        typedStatement: prepared.approvalStatement,
        oneTime: true,
        issuedAt: now.toISOString(),
      },
    });
    await vi.waitFor(() => {
      expect(preflights).toBe(1);
    });
    const restarted = coordinator(
      statePath,
      () => undefined,
      () => undefined,
      pendingExecution(() => {
        preflights += 1;
      }),
    );
    await restarted.read();
    await vi.waitFor(() => {
      expect(preflights).toBe(2);
    });
  });

  it("rejects delayed approval after proposal expiry and permits a fresh replacement", async () => {
    const root = await mkdtemp(join(tmpdir(), "iris-phase-zero-expiry-"));
    const statePath = join(root, "state.json");
    let current = now;
    const store = coordinator(
      statePath,
      () => undefined,
      () => undefined,
      blockedExecution(() => undefined),
      () => current,
    );
    const controller = new PhaseZeroGraduationReadinessController(store, () => current);
    const prepared = phaseZeroGraduationEnvelopeSchema.parse(
      await controller.prepareProposal({ objective: "Perform an expiring multi-file upgrade." }),
    );
    if (prepared.state !== "presented") throw new Error("EXPECTED_PRESENTED");
    current = new Date(now.getTime() + 61 * 60_000);
    await expect(
      controller.consumeApproval({
        approvalType: "graduation",
        approval: {
          approvalId: "approval_phase0-expired-0001",
          graduationId: prepared.proposal.graduationId,
          proposalDigest: prepared.proposalDigest,
          approvedBy: "Founder",
          authentication: {
            actorId: "Founder",
            sessionId: "founder.session",
            assurance: "founder-loopback-session",
            verified: true,
            evidenceDigest: `sha256:${"4".repeat(64)}`,
            authenticatedAt: now.toISOString(),
          },
          typedStatement: prepared.approvalStatement,
          oneTime: true,
          issuedAt: now.toISOString(),
        },
      }),
    ).rejects.toThrow("PHASE_ZERO_APPROVAL_MISMATCH");
    const replacement = phaseZeroGraduationEnvelopeSchema.parse(
      await controller.prepareProposal({
        objective: "Perform a fresh replacement multi-file upgrade.",
      }),
    );
    expect(replacement.state).toBe("presented");
    if (replacement.state !== "presented") throw new Error("EXPECTED_REPLACEMENT");
    expect(replacement.proposal.graduationId).not.toBe(prepared.proposal.graduationId);
  });

  it("rejects unsafe model-selected paths before any proposal is stored", async () => {
    const root = await mkdtemp(join(tmpdir(), "iris-phase-zero-unsafe-"));
    const statePath = join(root, "state.json");
    const store = new FilePhaseZeroGraduationCoordinator({
      statePath,
      now: () => now,
      evidence: {
        currentCoreRevision: () => Promise.resolve(coreRevision),
        inspect: () =>
          Promise.resolve({
            canonicalBaseRevision: coreRevision,
            commandCenterBaseRevision: commandCenterRevision,
            deploymentId: "founder-command-center-local",
            repositoryInspectionDigest: `sha256:${"3".repeat(64)}`,
            inspectedAt,
            evidence: "canonical evidence",
          }),
      },
      model: {
        provider: "ollama",
        name: "qwen3-coder:30b",
        plan: () =>
          Promise.resolve({
            objective: "Attempt an unsafe protected mutation from model output.",
            readPaths: [".github/workflows/ci.yml", "README.md"],
            writePaths: [".github/workflows/ci.yml", "README.md"],
            verificationCommands: [["pnpm", "verify"]],
          }),
      },
      execution: blockedExecution(() => undefined),
    });
    await expect(
      store.prepareProposal({ objective: "Perform a bounded self-upgrade." }),
    ).rejects.toThrow();
    await expect(readFile(statePath, "utf8")).rejects.toThrow();
  });

  it("binds the stored executable proposal to the outer digest", async () => {
    const root = await mkdtemp(join(tmpdir(), "iris-phase-zero-digest-"));
    const store = coordinator(join(root, "state.json"), () => undefined);
    const envelope = phaseZeroGraduationEnvelopeSchema.parse(
      await store.prepareProposal({ objective: "Perform a bounded multi-file self-upgrade." }),
    );
    if (envelope.state !== "presented") throw new Error("EXPECTED_PRESENTED");
    const proposal = store.activeProposal();
    if (proposal === null) throw new Error("EXPECTED_ACTIVE_PROPOSAL");
    expect(phaseZeroGraduationProposalDigest(proposal)).toBe(envelope.proposalDigest);
    expect(proposal.executableWorkerProposal.writePaths).toEqual(envelope.proposal.writePaths);
  });
});
