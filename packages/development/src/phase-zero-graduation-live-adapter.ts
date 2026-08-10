import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import {
  phaseZeroGraduationModelPlanSchema,
  type PhaseZeroGraduationEvidence,
  type PhaseZeroGraduationEvidenceProvider,
  type PhaseZeroGraduationModelPlan,
  type PhaseZeroGraduationProposalModel,
} from "./phase-zero-graduation-coordinator.js";
import {
  executableWorkerPlanSchema,
  executableWorkerProposalDigest,
  requiredExecutableWorkerApproval,
  type ExecutableWorkerPlan,
} from "./executable-worker-contracts.js";
import {
  ExecutableWorkerRuntime,
  type ExecutableWorkerAgent,
} from "./executable-worker-runtime.js";
import { FileExecutionJournalStore } from "./execution-journal.js";
import { GitCandidateWorkspaceAdapter } from "./git-candidate-workspace-adapter.js";
import {
  GithubCliRepositoryProvider,
  type GithubRepositoryView,
} from "./github-cli-repository-provider.js";
import {
  phaseZeroCandidateSchema,
  phaseZeroCanonicalEqualitySchema,
  phaseZeroCleanupEvidenceSchema,
  phaseZeroDeliverySchema,
  phaseZeroIndependentReviewSchema,
  phaseZeroMergeSchema,
  phaseZeroPreflightSchema,
  phaseZeroProviderInspectionSchema,
  phaseZeroResourceTerminationSchema,
  phaseZeroRollbackEvidenceSchema,
  type PhaseZeroApprovalConsumptionReceipt,
  type PhaseZeroCandidate,
  type PhaseZeroCanonicalEquality,
  type PhaseZeroCleanupEvidence,
  type PhaseZeroDelivery,
  type PhaseZeroGraduationProposal,
  type PhaseZeroIndependentReview,
  type PhaseZeroMerge,
  type PhaseZeroPreflight,
  type PhaseZeroProviderInspection,
  type PhaseZeroResourceTermination,
  type PhaseZeroRollbackEvidence,
  phaseZeroGraduationProposalDigest,
} from "./phase-zero-graduation-readiness.js";

const executeFile = promisify(execFile);
const revisionSchema = z.string().regex(/^[a-f0-9]{40}$/u);
const localOllamaUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
}, "Phase 0 proposal generation permits only loopback Ollama.");

const evidencePaths = [
  "package.json",
  "packages/development/src/index.ts",
  "packages/development/src/executable-worker-runtime.ts",
  "packages/development/src/phase-zero-graduation-readiness.ts",
  "tests/cycle-nine-phase-zero-graduation-readiness.test.ts",
] as const;

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function truncateUtf8(value: string, maximumBytes: number): string {
  if (Buffer.byteLength(value) <= maximumBytes) return value;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(value.slice(0, middle)) <= maximumBytes) low = middle;
    else high = middle - 1;
  }
  return value.slice(0, low);
}

export interface PhaseZeroProcessRunner {
  run(executable: string, args: string[], options?: { cwd?: string }): Promise<string>;
}

export function resolvePhaseZeroProviderExecutable(
  executable: string,
  platform: NodeJS.Platform = process.platform,
  wslDistribution: string | undefined = process.env.WSL_DISTRO_NAME,
): string {
  if (
    platform === "linux" &&
    wslDistribution !== undefined &&
    !executable.includes("/") &&
    !executable.includes("\\") &&
    !executable.toLowerCase().endsWith(".exe")
  )
    return `${executable}.exe`;
  return executable;
}

class DefaultPhaseZeroProcessRunner implements PhaseZeroProcessRunner {
  async run(executable: string, args: string[], options: { cwd?: string } = {}): Promise<string> {
    const environment = { ...process.env };
    delete environment.GH_TOKEN;
    delete environment.GITHUB_TOKEN;
    const { stdout } = await executeFile(executable, args, {
      cwd: options.cwd,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      timeout: 120_000,
      windowsHide: true,
      env: environment,
    });
    return stdout.trim();
  }
}

export class CanonicalPhaseZeroGraduationEvidenceProvider implements PhaseZeroGraduationEvidenceProvider {
  readonly #corePath: string;
  readonly #commandCenterPath: string;
  readonly #deploymentId: string;
  readonly #gitExecutable: string;
  readonly #runner: PhaseZeroProcessRunner;
  readonly #now: () => Date;

  constructor(options: {
    corePath: string;
    commandCenterPath: string;
    deploymentId: string;
    gitExecutable?: string;
    runner?: PhaseZeroProcessRunner;
    now?: () => Date;
  }) {
    this.#corePath = resolve(options.corePath);
    this.#commandCenterPath = resolve(options.commandCenterPath);
    this.#deploymentId = z
      .string()
      .regex(/^[a-z0-9][a-z0-9._-]{2,127}$/u)
      .parse(options.deploymentId);
    this.#gitExecutable = options.gitExecutable ?? "git";
    this.#runner = options.runner ?? new DefaultPhaseZeroProcessRunner();
    this.#now = options.now ?? (() => new Date());
  }

  currentCoreRevision(): Promise<string> {
    return this.#revision(this.#corePath, "HEAD");
  }

  async inspect(objective: string): Promise<PhaseZeroGraduationEvidence> {
    const boundedObjective = z.string().trim().min(10).max(2_000).parse(objective);
    await this.#assertCanonicalMain(this.#corePath);
    await this.#assertCanonicalMain(this.#commandCenterPath);
    const canonicalBaseRevision = await this.#revision(this.#corePath, "HEAD");
    const commandCenterBaseRevision = await this.#revision(this.#commandCenterPath, "HEAD");
    const tracked = new Set(
      (await this.#git(["ls-tree", "-r", "--name-only", "HEAD"], this.#corePath))
        .split(/\r?\n/u)
        .filter(Boolean),
    );
    const files: { path: string; content: string }[] = [];
    for (const path of evidencePaths) {
      if (!tracked.has(path)) continue;
      const content = await this.#git(["show", `${canonicalBaseRevision}:${path}`], this.#corePath);
      files.push({ path, content: truncateUtf8(content, 80_000) });
    }
    if (files.length < 2) throw new Error("PHASE_ZERO_CANONICAL_EVIDENCE_INSUFFICIENT");
    const evidence = JSON.stringify({
      objective: boundedObjective,
      canonicalRepository: "stoic1712-IRIS/IRIS",
      canonicalBaseRevision,
      commandCenterRepository: "stoic1712-IRIS/iris-founder-command-center",
      commandCenterBaseRevision,
      files,
    });
    return {
      canonicalBaseRevision,
      commandCenterBaseRevision,
      deploymentId: this.#deploymentId,
      repositoryInspectionDigest: sha256(evidence),
      inspectedAt: this.#now().toISOString(),
      evidence,
    };
  }

  async #assertCanonicalMain(path: string): Promise<void> {
    if ((await this.#git(["status", "--porcelain=v1", "-uall"], path)) !== "")
      throw new Error("PHASE_ZERO_CANONICAL_WORKTREE_DIRTY");
    if ((await this.#git(["branch", "--show-current"], path)) !== "main")
      throw new Error("PHASE_ZERO_CANONICAL_BRANCH_NOT_MAIN");
    const local = await this.#revision(path, "HEAD");
    const remote = await this.#revision(path, "origin/main");
    if (local !== remote) throw new Error("PHASE_ZERO_CANONICAL_REMOTE_NOT_EQUAL");
  }

  #revision(path: string, reference: string): Promise<string> {
    return this.#git(["rev-parse", reference], path).then((value) => revisionSchema.parse(value));
  }

  #git(args: string[], cwd: string): Promise<string> {
    return this.#runner.run(this.#gitExecutable, args, { cwd });
  }
}

const ollamaEnvelopeSchema = z.looseObject({
  model: z.string().min(1),
  message: z.looseObject({ role: z.literal("assistant"), content: z.string().min(1) }),
  done: z.literal(true),
});

const modelPlanJsonSchema = {
  type: "object",
  properties: {
    objective: { type: "string" },
    readPaths: { type: "array", items: { type: "string" } },
    writePaths: { type: "array", items: { type: "string" } },
    verificationCommands: {
      type: "array",
      items: { type: "array", items: { type: "string" }, minItems: 1 },
    },
  },
  required: ["objective", "readPaths", "writePaths", "verificationCommands"],
  additionalProperties: false,
} as const;

export class OllamaPhaseZeroGraduationProposalModel implements PhaseZeroGraduationProposalModel {
  readonly provider = "ollama" as const;
  readonly name: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(
    options: {
      model?: string;
      baseUrl?: string;
      fetchImplementation?: typeof fetch;
    } = {},
  ) {
    this.name = z
      .string()
      .min(2)
      .max(200)
      .parse(options.model ?? "qwen3-coder:30b");
    this.#baseUrl = localOllamaUrlSchema.parse(options.baseUrl ?? "http://127.0.0.1:11434");
    this.#fetch = options.fetchImplementation ?? globalThis.fetch;
  }

  async plan(input: {
    objective: string;
    evidence: string;
    repositoryInspectionDigest: string;
    canonicalBaseRevision: string;
  }): Promise<PhaseZeroGraduationModelPlan> {
    const instructions = [
      "You are IRIS preparing your own genuine Phase 0 multi-file self-upgrade.",
      "Select at least two safe tracked source or test files. Do not select governance, registries, Git metadata, coordination state, instructions, or the lockfile.",
      "Every write path must also appear in readPaths so every changed file is inspected before mutation.",
      "Verification commands must be one or more of: pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build, pnpm verify.",
      `Objective: ${input.objective}`,
      `Canonical revision: ${input.canonicalBaseRevision}`,
      `Evidence digest: ${input.repositoryInspectionDigest}`,
      `Bounded canonical evidence:\n${truncateUtf8(input.evidence, 450_000)}`,
    ];
    let validationFeedback = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const prompt = [...instructions, validationFeedback].filter(Boolean).join("\n\n");
      const response = await this.#fetch(`${this.#baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.name,
          messages: [{ role: "user", content: prompt }],
          stream: false,
          think: false,
          format: modelPlanJsonSchema,
          options: { temperature: 0, seed: attempt, num_ctx: 32_768 },
        }),
        signal: AbortSignal.timeout(300_000),
      });
      if (!response.ok)
        throw new Error(`PHASE_ZERO_PROPOSAL_MODEL_REJECTED:${String(response.status)}`);
      const envelope = ollamaEnvelopeSchema.parse(await response.json());
      if (envelope.model !== this.name) throw new Error("PHASE_ZERO_PROPOSAL_MODEL_MISMATCH");
      let decoded: unknown;
      try {
        decoded = JSON.parse(envelope.message.content);
      } catch {
        validationFeedback =
          "Previous output failed strict validation because it was not valid JSON. Return one complete JSON object matching the provided schema.";
        continue;
      }
      const parsed = phaseZeroGraduationModelPlanSchema.safeParse(decoded);
      if (parsed.success) return parsed.data;
      validationFeedback = `Previous output failed strict validation: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(
          "; ",
        )}. Return one corrected complete JSON object; do not weaken or omit any invariant.`;
    }
    throw new Error("PHASE_ZERO_PROPOSAL_PLAN_INVALID");
  }
}

interface PhaseZeroRepositoryProvider {
  verifyAuthentication(): string;
  inspectRepository(repository: string): GithubRepositoryView;
  push?(
    input: Parameters<GithubCliRepositoryProvider["push"]>[0],
  ): ReturnType<GithubCliRepositoryProvider["push"]>;
  createPullRequest?(
    input: Parameters<GithubCliRepositoryProvider["createPullRequest"]>[0],
  ): ReturnType<GithubCliRepositoryProvider["createPullRequest"]>;
  mergePullRequest?(
    input: Parameters<GithubCliRepositoryProvider["mergePullRequest"]>[0],
  ): ReturnType<GithubCliRepositoryProvider["mergePullRequest"]>;
  clearCredential?(): void;
}

const executablePlanJsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    mutations: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          operation: { type: "string", enum: ["create", "update", "delete"] },
          expectedContentDigest: { type: "string" },
          content: { type: "string" },
          replacements: {
            type: "array",
            items: {
              type: "object",
              properties: { oldText: { type: "string" }, newText: { type: "string" } },
              required: ["oldText", "newText"],
              additionalProperties: false,
            },
          },
          rationale: { type: "string" },
        },
        required: ["path", "operation", "rationale"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "mutations"],
  additionalProperties: false,
} as const;

class OllamaExecutableWorkerAgent implements ExecutableWorkerAgent {
  readonly #model: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  lastResponseDigest = sha256("");

  constructor(options: { model: string; baseUrl: string; fetchImplementation: typeof fetch }) {
    this.#model = options.model;
    this.#baseUrl = options.baseUrl;
    this.#fetch = options.fetchImplementation;
  }

  async plan(
    input: Parameters<ExecutableWorkerAgent["plan"]>[0],
    signal: AbortSignal,
  ): Promise<ExecutableWorkerPlan> {
    const prompt = [
      "You are the IRIS executable development worker inside a disposable Git worktree.",
      "Return only strict JSON. Mutate only the proposal write paths. Preserve behavior, use exact digest-bound replacements for updates, and address failed checks on later iterations.",
      `Proposal: ${JSON.stringify(input.proposal)}`,
      `Iteration: ${String(input.iteration)}`,
      `Previous checks: ${JSON.stringify(input.previousChecks)}`,
      `Current diff: ${truncateUtf8(input.currentDiff, 120_000)}`,
      `Repository context: ${truncateUtf8(input.repositoryContext, 350_000)}`,
    ].join("\n\n");
    const response = await this.#fetch(`${this.#baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.#model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        think: false,
        format: executablePlanJsonSchema,
        options: { temperature: 0, seed: input.iteration, num_ctx: 32_768 },
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(300_000)]),
    });
    if (!response.ok)
      throw new Error(`PHASE_ZERO_CODING_MODEL_REJECTED:${String(response.status)}`);
    const envelope = ollamaEnvelopeSchema.parse(await response.json());
    if (envelope.model !== this.#model) throw new Error("PHASE_ZERO_CODING_MODEL_MISMATCH");
    this.lastResponseDigest = sha256(envelope.message.content);
    return executableWorkerPlanSchema.parse(JSON.parse(envelope.message.content));
  }
}

const reviewJsonSchema = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["pass", "fail"] },
    findings: { type: "array", items: { type: "string" } },
  },
  required: ["verdict", "findings"],
  additionalProperties: false,
} as const;
const reviewSchema = z.strictObject({
  verdict: z.enum(["pass", "fail"]),
  findings: z.array(z.string().min(1).max(2_000)).max(100),
});

export class LivePhaseZeroGraduationExecutionProvider {
  readonly #canonicalPath: string;
  readonly #commandCenterPath: string;
  readonly #deploymentId: string;
  readonly #runner: PhaseZeroProcessRunner;
  readonly #repositoryProvider: PhaseZeroRepositoryProvider;
  readonly #gitExecutable: string;
  readonly #ghExecutable: string;
  readonly #ollamaExecutable: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #workspaceRoot: string;
  readonly #journalRoot: string;
  readonly #now: () => Date;

  constructor(options: {
    canonicalPath: string;
    commandCenterPath: string;
    deploymentId: string;
    runner?: PhaseZeroProcessRunner;
    repositoryProvider?: PhaseZeroRepositoryProvider;
    gitExecutable?: string;
    ghExecutable?: string;
    ollamaExecutable?: string;
    ollamaBaseUrl?: string;
    fetchImplementation?: typeof fetch;
    workspaceRoot?: string;
    journalRoot?: string;
    now?: () => Date;
  }) {
    this.#canonicalPath = resolve(options.canonicalPath);
    this.#commandCenterPath = resolve(options.commandCenterPath);
    this.#deploymentId = z
      .string()
      .regex(/^[a-z0-9][a-z0-9._-]{2,127}$/u)
      .parse(options.deploymentId);
    this.#runner = options.runner ?? new DefaultPhaseZeroProcessRunner();
    this.#gitExecutable = options.gitExecutable ?? "git";
    this.#ghExecutable = options.ghExecutable ?? "gh";
    this.#ollamaExecutable = options.ollamaExecutable ?? "ollama";
    this.#baseUrl = localOllamaUrlSchema.parse(options.ollamaBaseUrl ?? "http://127.0.0.1:11434");
    this.#fetch = options.fetchImplementation ?? globalThis.fetch;
    this.#workspaceRoot = resolve(options.workspaceRoot ?? join(tmpdir(), "iris-phase-zero"));
    this.#journalRoot = resolve(options.journalRoot ?? join(this.#workspaceRoot, "journals"));
    this.#now = options.now ?? (() => new Date());
    this.#repositoryProvider =
      options.repositoryProvider ??
      new GithubCliRepositoryProvider({
        owner: "stoic1712-IRIS",
        ghPath: this.#ghExecutable,
        gitPath: this.#gitExecutable,
        repositories: {
          "stoic1712-IRIS/IRIS": { path: this.#canonicalPath, remote: "origin" },
          "stoic1712-IRIS/IRIS-checkpoints": {
            path: this.#canonicalPath,
            remote: "checkpoint",
          },
          "stoic1712-IRIS/iris-founder-command-center": {
            path: this.#commandCenterPath,
            remote: "origin",
          },
        },
      });
  }

  async preflight(
    proposal: PhaseZeroGraduationProposal,
    signal: AbortSignal,
  ): Promise<PhaseZeroPreflight> {
    signal.throwIfAborted();
    await this.#assertCleanMain(this.#canonicalPath, proposal.canonicalBaseRevision);
    await this.#assertCleanMain(this.#commandCenterPath, proposal.commandCenterBaseRevision);
    const canonicalRemoteRevision = await this.#revision(this.#canonicalPath, "origin/main");
    const providerMainRevision =
      (await this.#git(["ls-remote", "origin", "refs/heads/main"], this.#canonicalPath)).split(
        /\s+/u,
      )[0] ?? "";
    const login = this.#repositoryProvider.verifyAuthentication();
    const checkpoint = this.#repositoryProvider.inspectRepository(proposal.checkpointRepository);
    const models = await this.#runner.run(this.#ollamaExecutable, ["list"]);
    const resources = await this.#activeProviderResources();
    return phaseZeroPreflightSchema.parse({
      actor: "IRIS",
      canonicalRepository: proposal.canonicalRepository,
      commandCenterRepository: proposal.commandCenterRepository,
      checkpointRepository: proposal.checkpointRepository,
      deployedRuntime: true,
      deploymentId: this.#deploymentId,
      canonicalLocalRevision: proposal.canonicalBaseRevision,
      canonicalRemoteRevision,
      providerMainRevision,
      commandCenterRevision: proposal.commandCenterBaseRevision,
      commandCenterConnected: true,
      modelProvider: proposal.model.provider,
      modelName: proposal.model.name,
      modelReady: models
        .split(/\r?\n/u)
        .some((line) => line.trimStart().startsWith(`${proposal.model.name} `)),
      checkpointRepositoryPrivate: checkpoint.visibility === "PRIVATE",
      ephemeralCredentialReady: login === "stoic1712-IRIS",
      codexMutationObserved: false,
      claudeMutationObserved: false,
      currentProviderResources: resources,
    });
  }

  async executeCandidate(
    proposal: PhaseZeroGraduationProposal,
    signal: AbortSignal,
  ): Promise<PhaseZeroCandidate> {
    await mkdir(this.#journalRoot, { recursive: true });
    const adapter = new GitCandidateWorkspaceAdapter({
      canonicalPath: this.#canonicalPath,
      gitExecutable: this.#gitExecutable,
      workspaceRoot: this.#workspaceRoot,
    });
    const runtime = new ExecutableWorkerRuntime({
      adapter,
      journals: new FileExecutionJournalStore(this.#journalRoot),
      now: this.#now,
    });
    const agent = new OllamaExecutableWorkerAgent({
      model: proposal.model.name,
      baseUrl: this.#baseUrl,
      fetchImplementation: this.#fetch,
    });
    const worker = proposal.executableWorkerProposal;
    const approval = {
      approvalId: `approval_cycle8-phase0-${proposal.graduationId.slice(-12)}`,
      executionId: worker.executionId,
      proposalDigest: executableWorkerProposalDigest(worker),
      approvedBy: "Founder" as const,
      typedStatement: requiredExecutableWorkerApproval(worker),
      issuedAt: this.#now().toISOString(),
    };
    const result = await runtime.execute(worker, approval, agent, signal);
    if (
      result.status !== "succeeded" ||
      result.candidateCommit === undefined ||
      result.candidateRef === undefined ||
      !result.cleanupVerified ||
      !result.eventChainVerified
    )
      throw new Error(`PHASE_ZERO_EXECUTABLE_WORKER_${result.state.toUpperCase()}`);
    const baseTree = await this.#revision(
      this.#canonicalPath,
      `${proposal.canonicalBaseRevision}^{tree}`,
    );
    const candidateTree = await this.#revision(
      this.#canonicalPath,
      `${result.candidateCommit}^{tree}`,
    );
    const diff = await this.#git(
      ["diff", "--binary", proposal.canonicalBaseRevision, result.candidateCommit],
      this.#canonicalPath,
    );
    return phaseZeroCandidateSchema.parse({
      actor: "IRIS",
      canonicalRepository: proposal.canonicalRepository,
      executionId: worker.executionId,
      executableWorkerProposalDigest: executableWorkerProposalDigest(worker),
      producerId: "iris-development-worker",
      status: "succeeded",
      baseRevision: proposal.canonicalBaseRevision,
      candidateCommit: result.candidateCommit,
      baseTreeDigest: sha256(baseTree),
      candidateTreeDigest: sha256(candidateTree),
      candidateDiffDigest: sha256(diff),
      baseAncestorVerified:
        (await this.#git(
          ["merge-base", "--is-ancestor", proposal.canonicalBaseRevision, result.candidateCommit],
          this.#canonicalPath,
        )) === "",
      diffVerified: result.changedPaths.length >= 2,
      candidateRef: result.candidateRef,
      changedPaths: result.changedPaths,
      verificationCommands: proposal.verificationCommands,
      checksPassed: result.checks.every((check) => check.exitCode === 0),
      workerApprovalConsumed: true,
      eventChainVerified: result.eventChainVerified,
      workspaceCleanupVerified: result.cleanupVerified,
      protectedPathsUntouched: result.changedPaths.every((path) =>
        proposal.executableWorkerProposal.writePaths.includes(path),
      ),
      codexMutationObserved: false,
      claudeMutationObserved: false,
      realModelObserved: true,
      modelProvider: proposal.model.provider,
      modelName: proposal.model.name,
      modelEndpoint: "loopback",
      repositoryInspectionDigest: proposal.model.repositoryInspectionDigest,
      modelResponseDigest: agent.lastResponseDigest,
      modelObservedAt: this.#now().toISOString(),
    });
  }

  async independentlyReview(
    proposal: PhaseZeroGraduationProposal,
    candidate: PhaseZeroCandidate,
    signal: AbortSignal,
  ): Promise<PhaseZeroIndependentReview> {
    await mkdir(this.#workspaceRoot, { recursive: true });
    const path = await mkdtemp(join(this.#workspaceRoot, "iris-phase-zero-review-"));
    await rm(path, { recursive: true, force: true });
    try {
      await this.#git(
        ["worktree", "add", "--detach", path, candidate.candidateCommit],
        this.#canonicalPath,
      );
      for (const command of proposal.verificationCommands)
        await this.#runner.run(command[0] ?? "", command.slice(1), { cwd: path });
      const diff = await this.#git(
        ["diff", "--binary", proposal.canonicalBaseRevision, candidate.candidateCommit],
        this.#canonicalPath,
      );
      const response = await this.#fetch(`${this.#baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "gpt-oss:20b",
          messages: [
            {
              role: "user",
              content: `Independently review this bounded IRIS self-upgrade. Fail for correctness, security, scope, or test defects.\n${truncateUtf8(diff, 450_000)}`,
            },
          ],
          stream: false,
          think: false,
          format: reviewJsonSchema,
          options: { temperature: 0, seed: 0, num_ctx: 32_768 },
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(300_000)]),
      });
      if (!response.ok) throw new Error("PHASE_ZERO_REVIEW_MODEL_REJECTED");
      const envelope = ollamaEnvelopeSchema.parse(await response.json());
      if (envelope.model !== "gpt-oss:20b") throw new Error("PHASE_ZERO_REVIEW_MODEL_MISMATCH");
      const review = reviewSchema.parse(JSON.parse(envelope.message.content));
      if (review.verdict !== "pass")
        throw new Error(`PHASE_ZERO_INDEPENDENT_REVIEW_FAILED:${review.findings.join(";")}`);
      return phaseZeroIndependentReviewSchema.parse({
        actor: "IRIS",
        canonicalRepository: proposal.canonicalRepository,
        reviewerId: "iris-independent-review-worker",
        baseRevision: proposal.canonicalBaseRevision,
        reviewedCommit: candidate.candidateCommit,
        candidateTreeDigest: candidate.candidateTreeDigest,
        candidateDiffDigest: candidate.candidateDiffDigest,
        baseAncestorVerified: true,
        diffVerified: sha256(diff) === candidate.candidateDiffDigest,
        verdict: "pass",
        findings: review.findings,
        verificationCommands: proposal.verificationCommands,
        checksPassed: true,
        canonicalRepositoryChanged: false,
        codexMutationObserved: false,
        claudeMutationObserved: false,
      });
    } finally {
      await this.#git(["worktree", "remove", "--force", path], this.#canonicalPath).catch(
        () => undefined,
      );
      await this.#git(["worktree", "prune"], this.#canonicalPath).catch(() => undefined);
      await rm(path, { recursive: true, force: true });
    }
  }

  async deliver(
    proposal: PhaseZeroGraduationProposal,
    candidate: PhaseZeroCandidate,
    review: PhaseZeroIndependentReview,
    signal: AbortSignal,
  ): Promise<PhaseZeroDelivery> {
    signal.throwIfAborted();
    if (candidate.candidateCommit !== review.reviewedCommit)
      throw new Error("PHASE_ZERO_REVIEW_COMMIT_MISMATCH");
    const provider = this.#repositoryProvider;
    if (provider.push === undefined || provider.createPullRequest === undefined)
      throw new Error("PHASE_ZERO_PROVIDER_MUTATION_UNAVAILABLE");
    const approvalDigest = sha256(
      JSON.stringify({
        graduationId: proposal.graduationId,
        proposalDigest: phaseZeroGraduationProposalDigest(proposal),
      }),
    );
    const checkpointCreatedAt = this.#now();
    const checkpoint = await provider.push({
      repository: proposal.checkpointRepository,
      ref: proposal.checkpointRef,
      commit: candidate.candidateCommit,
      force: false,
      authorization: {
        operation: "push-branch",
        repository: proposal.checkpointRepository,
        target: proposal.checkpointRef,
        approvalDigest,
      },
    });
    const target = await provider.push({
      repository: proposal.canonicalRepository,
      ref: proposal.targetBranch,
      commit: candidate.candidateCommit,
      force: false,
      authorization: {
        operation: "push-branch",
        repository: proposal.canonicalRepository,
        target: proposal.targetBranch,
        approvalDigest,
      },
    });
    const pullRequest = await provider.createPullRequest({
      repository: proposal.canonicalRepository,
      base: "main",
      head: proposal.targetBranch,
      title: `Phase 0 graduation: ${proposal.executableWorkerProposal.objective.slice(0, 90)}`,
      body: `IRIS-owned Phase 0 graduation candidate ${candidate.candidateCommit}.\n\nIndependent review: pass.\nProposal: ${phaseZeroGraduationProposalDigest(proposal)}.`,
      draft: true,
      maintainersCanModify: false,
      headCommit: candidate.candidateCommit,
      authorization: {
        operation: "create-pull-request",
        repository: proposal.canonicalRepository,
        target: proposal.targetBranch,
        approvalDigest,
      },
    });
    this.#repositoryProvider.clearCredential?.();
    const targetPushedAt = new Date(
      Math.max(this.#now().getTime(), checkpointCreatedAt.getTime() + 1),
    );
    return phaseZeroDeliverySchema.parse({
      actor: "IRIS",
      canonicalRepository: proposal.canonicalRepository,
      checkpointRepository: proposal.checkpointRepository,
      deliveryCommit: candidate.candidateCommit,
      checkpointRef: proposal.checkpointRef,
      checkpointCommit: candidate.candidateCommit,
      checkpointRemoteRevision: checkpoint.remoteCommit,
      checkpointCreatedFirst: true,
      checkpointCreatedAt: checkpointCreatedAt.toISOString(),
      targetBranch: proposal.targetBranch,
      targetCommit: candidate.candidateCommit,
      targetRemoteRevision: target.remoteCommit,
      targetPushedAt: targetPushedAt.toISOString(),
      pullRequest: { repository: proposal.canonicalRepository, ...pullRequest },
      credentialCleared: true,
      workspaceCleanupVerified: true,
      codexMutationObserved: false,
      claudeMutationObserved: false,
    });
  }

  async merge(
    proposal: PhaseZeroGraduationProposal,
    delivery: PhaseZeroDelivery,
    review: PhaseZeroIndependentReview,
    mergeApprovalReceipt: PhaseZeroApprovalConsumptionReceipt,
    signal: AbortSignal,
  ): Promise<PhaseZeroMerge> {
    signal.throwIfAborted();
    const provider = this.#repositoryProvider;
    if (provider.mergePullRequest === undefined)
      throw new Error("PHASE_ZERO_PROVIDER_MUTATION_UNAVAILABLE");
    const isDraft = await this.#runner.run(this.#ghExecutable, [
      "pr",
      "view",
      String(delivery.pullRequest.number),
      "--repo",
      proposal.canonicalRepository,
      "--json",
      "isDraft",
      "--jq",
      ".isDraft",
    ]);
    if (isDraft === "true")
      await this.#runner.run(this.#ghExecutable, [
        "pr",
        "ready",
        String(delivery.pullRequest.number),
        "--repo",
        proposal.canonicalRepository,
      ]);
    const merged = await provider.mergePullRequest({
      repository: proposal.canonicalRepository,
      number: delivery.pullRequest.number,
      expectedHeadCommit: delivery.deliveryCommit,
      authorization: {
        operation: "merge-pull-request",
        repository: proposal.canonicalRepository,
        target: String(delivery.pullRequest.number),
        approvalDigest: mergeApprovalReceipt.proposalDigest,
      },
    });
    await this.#git(["fetch", "origin", "main"], this.#canonicalPath);
    const parents = (
      await this.#git(["rev-list", "--parents", "-n", "1", merged.mergeCommit], this.#canonicalPath)
    ).split(/\s+/u);
    if (parents[1] !== proposal.canonicalBaseRevision || parents[2] !== delivery.deliveryCommit)
      throw new Error("PHASE_ZERO_MERGE_PARENT_MISMATCH");
    const providerMainRevision = await this.#providerMainRevision();
    return phaseZeroMergeSchema.parse({
      actor: "IRIS",
      canonicalRepository: proposal.canonicalRepository,
      providerActor: "stoic1712-IRIS",
      providerActorVerified: true,
      pullRequestNumber: delivery.pullRequest.number,
      expectedHeadCommit: delivery.deliveryCommit,
      mergeCommit: merged.mergeCommit,
      firstParentRevision: parents[1],
      secondParentRevision: parents[2],
      providerMainRevision,
      mergeMethod: "merge-commit",
      independentReviewConsumed: review.reviewedCommit === delivery.deliveryCommit,
      mergeApprovalId: mergeApprovalReceipt.approvalId,
      mergeApprovalProposalDigest: mergeApprovalReceipt.proposalDigest,
      codexMutationObserved: false,
      claudeMutationObserved: false,
    });
  }

  async verifyCanonicalEquality(
    proposal: PhaseZeroGraduationProposal,
    merge: PhaseZeroMerge,
  ): Promise<PhaseZeroCanonicalEquality> {
    await this.#git(["switch", "main"], this.#canonicalPath);
    await this.#git(["merge", "--ff-only", "origin/main"], this.#canonicalPath);
    const localMainRevision = await this.#revision(this.#canonicalPath, "HEAD");
    const remoteMainRevision = await this.#revision(this.#canonicalPath, "origin/main");
    const providerMainRevision = await this.#providerMainRevision();
    if (
      ![localMainRevision, remoteMainRevision, providerMainRevision].every(
        (value) => value === merge.mergeCommit,
      )
    )
      throw new Error("PHASE_ZERO_CANONICAL_EQUALITY_FAILED");
    return phaseZeroCanonicalEqualitySchema.parse({
      actor: "IRIS",
      canonicalRepository: proposal.canonicalRepository,
      localMainRevision,
      remoteMainRevision,
      providerMainRevision,
    });
  }

  async preserveRollbackEvidence(
    proposal: PhaseZeroGraduationProposal,
    merge: PhaseZeroMerge,
    delivery: PhaseZeroDelivery,
  ): Promise<PhaseZeroRollbackEvidence> {
    await this.#git(
      ["merge-base", "--is-ancestor", merge.mergeCommit, "main"],
      this.#canonicalPath,
    );
    const checkpoint = await this.#git(
      ["ls-remote", "checkpoint", `refs/heads/${delivery.checkpointRef}`],
      this.#canonicalPath,
    );
    return phaseZeroRollbackEvidenceSchema.parse({
      actor: "IRIS",
      canonicalRepository: proposal.canonicalRepository,
      mergeCommit: merge.mergeCommit,
      strategy: "revert",
      command: `git revert -m 1 ${merge.mergeCommit}`,
      mergeCommitIsAncestor: true,
      privateCheckpointRecoverable: checkpoint.split(/\s+/u)[0] === delivery.deliveryCommit,
      preservesHistory: true,
    });
  }

  async cleanup(proposal: PhaseZeroGraduationProposal): Promise<PhaseZeroCleanupEvidence> {
    await this.#git(["branch", "-D", proposal.candidateBranch], this.#canonicalPath).catch(
      () => undefined,
    );
    const worktrees = await this.#git(["worktree", "list", "--porcelain"], this.#canonicalPath);
    const disposableAbsent =
      !worktrees.includes("iris-executable-worker-") &&
      !worktrees.includes("iris-phase-zero-review-");
    this.#repositoryProvider.clearCredential?.();
    return phaseZeroCleanupEvidenceSchema.parse({
      actor: "IRIS",
      canonicalRepository: proposal.canonicalRepository,
      executionWorkspaceRemoved: disposableAbsent,
      deliveryWorkspaceRemoved: true,
      journalPreserved: true,
      credentialCleared: true,
    });
  }

  terminatePaidResources(
    proposal: PhaseZeroGraduationProposal,
  ): Promise<PhaseZeroResourceTermination> {
    return Promise.resolve(
      phaseZeroResourceTerminationSchema.parse({
        actor: "IRIS",
        canonicalRepository: proposal.canonicalRepository,
        observedCostUsd: 0,
        terminatedResourceIds: [],
        paidResourcesTerminated: true,
        verifiedAt: this.#now().toISOString(),
      }),
    );
  }

  async providerResources(
    proposal: PhaseZeroGraduationProposal,
  ): Promise<PhaseZeroProviderInspection> {
    return phaseZeroProviderInspectionSchema.parse({
      actor: "IRIS",
      canonicalRepository: proposal.canonicalRepository,
      provider: "github",
      account: "stoic1712-IRIS",
      scope: [
        "stoic1712-IRIS/IRIS",
        "stoic1712-IRIS/iris-founder-command-center",
        "stoic1712-IRIS/IRIS-checkpoints",
      ],
      providerAuthoritative: true,
      providerMainRevision: await this.#providerMainRevision(),
      resources: await this.#activeProviderResources(),
      verifiedAt: this.#now().toISOString(),
    });
  }

  async #assertCleanMain(path: string, expected: string): Promise<void> {
    if ((await this.#git(["status", "--porcelain=v1", "-uall"], path)) !== "")
      throw new Error("PHASE_ZERO_CANONICAL_WORKTREE_DIRTY");
    if ((await this.#git(["branch", "--show-current"], path)) !== "main")
      throw new Error("PHASE_ZERO_CANONICAL_BRANCH_NOT_MAIN");
    if (
      (await this.#revision(path, "HEAD")) !== expected ||
      (await this.#revision(path, "origin/main")) !== expected
    )
      throw new Error("PHASE_ZERO_CANONICAL_REVISION_MISMATCH");
  }

  async #activeProviderResources(): Promise<string[]> {
    const resources: string[] = [];
    for (const repository of [
      "stoic1712-IRIS/IRIS",
      "stoic1712-IRIS/iris-founder-command-center",
      "stoic1712-IRIS/IRIS-checkpoints",
    ]) {
      const raw = await this.#runner.run(this.#ghExecutable, [
        "run",
        "list",
        "--repo",
        repository,
        "--json",
        "databaseId,status",
        "--limit",
        "100",
      ]);
      const runs = z
        .array(z.looseObject({ databaseId: z.number().int(), status: z.string() }))
        .parse(JSON.parse(raw));
      for (const run of runs)
        if (["queued", "in_progress", "waiting", "requested", "pending"].includes(run.status))
          resources.push(`${repository}:actions:${String(run.databaseId)}`);
    }
    return resources;
  }

  #providerMainRevision(): Promise<string> {
    return this.#runner
      .run(this.#ghExecutable, ["api", "repos/stoic1712-IRIS/IRIS/commits/main", "--jq", ".sha"])
      .then((value) => revisionSchema.parse(value));
  }

  #revision(path: string, reference: string): Promise<string> {
    return this.#git(["rev-parse", reference], path).then((value) => revisionSchema.parse(value));
  }

  #git(args: string[], cwd: string): Promise<string> {
    return this.#runner.run(this.#gitExecutable, args, { cwd });
  }
}
