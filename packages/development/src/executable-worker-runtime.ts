import { createHash } from "node:crypto";

import {
  executableWorkerApprovalSchema,
  executableWorkerCheckSchema,
  executableWorkerPlanSchema,
  executableWorkerPreflightSchema,
  executableWorkerProposalDigest,
  executableWorkerProposalSchema,
  requiredExecutableWorkerApproval,
  type ExecutableWorkerApproval,
  type ExecutableWorkerCheck,
  type ExecutableWorkerMutation,
  type ExecutableWorkerPlan,
  type ExecutableWorkerPreflight,
  type ExecutableWorkerProposal,
  type ExecutableWorkerState,
} from "./executable-worker-contracts.js";
import type {
  ExecutableWorkerJournal,
  ExecutableWorkerJournalEvent,
  ExecutableWorkerWorkspace,
  ExecutionJournalStore,
} from "./execution-journal.js";

export interface ExecutableWorkerAgentInput {
  proposal: ExecutableWorkerProposal;
  iteration: number;
  repositoryContext: string;
  currentDiff: string;
  previousChecks: ExecutableWorkerCheck[];
}

export interface ExecutableWorkerAgent {
  plan(input: ExecutableWorkerAgentInput, signal: AbortSignal): Promise<ExecutableWorkerPlan>;
}

export interface ExecutableWorkerAdapter {
  preflight(proposal: ExecutableWorkerProposal): Promise<ExecutableWorkerPreflight>;
  createWorkspace(proposal: ExecutableWorkerProposal): Promise<ExecutableWorkerWorkspace>;
  workspaceExists(workspace: ExecutableWorkerWorkspace): Promise<boolean>;
  context(
    workspace: ExecutableWorkerWorkspace,
    proposal: ExecutableWorkerProposal,
  ): Promise<string>;
  diff(workspace: ExecutableWorkerWorkspace): Promise<string>;
  readFile(workspace: ExecutableWorkerWorkspace, path: string): Promise<string | null>;
  writeFile(workspace: ExecutableWorkerWorkspace, path: string, content: string): Promise<void>;
  deleteFile(workspace: ExecutableWorkerWorkspace, path: string): Promise<void>;
  run(
    workspace: ExecutableWorkerWorkspace,
    command: string[],
    signal: AbortSignal,
  ): Promise<ExecutableWorkerCheck>;
  changedPaths(workspace: ExecutableWorkerWorkspace): Promise<string[]>;
  checkpoint(
    workspace: ExecutableWorkerWorkspace,
    proposal: ExecutableWorkerProposal,
    changedPaths: string[],
  ): Promise<{ commit: string; ref: string; diff: string }>;
  cleanup(workspace: ExecutableWorkerWorkspace): Promise<boolean>;
}

export interface ExecutableWorkerResult {
  executionId: string;
  status: "succeeded" | "denied" | "recovery-ready" | "stopped";
  state: ExecutableWorkerState;
  summary: string;
  iteration: number;
  changedPaths: string[];
  checks: ExecutableWorkerCheck[];
  diff: string;
  candidateCommit?: string;
  candidateRef?: string;
  cleanupVerified: boolean;
  recoveryAvailable: boolean;
  eventChainVerified: boolean;
  events: ExecutableWorkerJournalEvent[];
}

const credentialPatterns = [
  /github_pat_[a-z0-9_]{20,}/iu,
  /gh[pousr]_[a-z0-9]{20,}/iu,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bxox[baprs]-[a-z0-9-]+/iu,
];

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function within(path: string, roots: readonly string[]): boolean {
  return roots.some(
    (root) => root === "." || path === root || path.startsWith(`${root.replace(/\/$/u, "")}/`),
  );
}

function containsCredentialLikeText(value: string): boolean {
  return credentialPatterns.some((pattern) => pattern.test(value));
}

function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

function verifyEventChain(events: readonly ExecutableWorkerJournalEvent[]): boolean {
  return events.every((event, index) => {
    const { digest: actual, ...unsigned } = event;
    return unsigned.previousDigest === events[index - 1]?.digest && digest(unsigned) === actual;
  });
}

export class ExecutableWorkerRuntime {
  readonly #adapter: ExecutableWorkerAdapter;
  readonly #journals: ExecutionJournalStore;
  readonly #now: () => Date;

  constructor(options: {
    adapter: ExecutableWorkerAdapter;
    journals: ExecutionJournalStore;
    now?: () => Date;
  }) {
    this.#adapter = options.adapter;
    this.#journals = options.journals;
    this.#now = options.now ?? (() => new Date());
  }

  async execute(
    proposalInput: ExecutableWorkerProposal,
    approvalInput: ExecutableWorkerApproval,
    agent: ExecutableWorkerAgent,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<ExecutableWorkerResult> {
    const proposal = executableWorkerProposalSchema.parse(proposalInput);
    const approval = executableWorkerApprovalSchema.parse(approvalInput);
    const journal = this.#newJournal(proposal, approval);
    const materializationChecks: ExecutableWorkerCheck[] = [];
    if (!this.#approvalMatches(proposal, approval)) {
      await this.#transition(
        journal,
        "denied",
        "Exact Founder approval did not match the executable-worker proposal.",
      );
      return this.#result(journal, [], "", true);
    }
    if (Date.parse(proposal.expiresAt) <= this.#now().getTime()) {
      await this.#transition(journal, "denied", "Executable-worker proposal expired.");
      return this.#result(journal, [], "", true);
    }

    try {
      const preflight = executableWorkerPreflightSchema.parse(
        await this.#adapter.preflight(proposal),
      );
      if (!preflight.ready) {
        await this.#transition(
          journal,
          "denied",
          `Capability preflight blocked execution: ${preflight.checks
            .filter((check) => check.status === "blocked")
            .map((check) => check.capability)
            .join(", ")}`,
        );
        return this.#result(journal, [], "", true);
      }
      await this.#transition(
        journal,
        "preparing-workspace",
        "All capabilities passed preflight; creating an exact disposable workspace.",
      );
      journal.workspace = await this.#adapter.createWorkspace(proposal);
      if (journal.workspace.baseRevision !== proposal.baseRevision)
        throw new Error("EXECUTABLE_WORKER_BASE_REVISION_MISMATCH");
      await this.#save(journal);
      const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(proposal.timeoutMs)]);
      if (proposal.materializationCommands.length > 0) {
        await this.#transition(
          journal,
          "materializing",
          `Materializing pinned dependencies with ${String(proposal.materializationCommands.length)} exact offline commands.`,
        );
        for (const command of proposal.materializationCommands) {
          const check = executableWorkerCheckSchema.parse(
            await this.#adapter.run(journal.workspace, command, boundedSignal),
          );
          materializationChecks.push(check);
          if (check.exitCode !== 0) throw new Error("EXECUTABLE_WORKER_MATERIALIZATION_FAILED");
        }
      }
      return await this.#run(journal, agent, boundedSignal, materializationChecks);
    } catch (error) {
      return await this.#recoverableFailure(journal, error, materializationChecks);
    }
  }

  async resume(
    executionId: string,
    agent: ExecutableWorkerAgent,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<ExecutableWorkerResult> {
    const journal = await this.#journals.load(executionId);
    if (journal === null) throw new Error("EXECUTABLE_WORKER_JOURNAL_NOT_FOUND");
    if (!verifyEventChain(journal.events))
      throw new Error("EXECUTABLE_WORKER_JOURNAL_EVENT_CHAIN_INVALID");
    if (journal.state !== "recovery-ready" && journal.state !== "stopped")
      throw new Error("EXECUTABLE_WORKER_NOT_RECOVERABLE");
    if (
      journal.workspace === undefined ||
      !(await this.#adapter.workspaceExists(journal.workspace))
    )
      throw new Error("EXECUTABLE_WORKER_WORKSPACE_NOT_RECOVERABLE");
    if (Date.parse(journal.proposal.expiresAt) <= this.#now().getTime())
      throw new Error("EXECUTABLE_WORKER_PROPOSAL_EXPIRED");
    await this.#transition(
      journal,
      "repairing",
      "Resuming the preserved disposable workspace under the unchanged approval.",
    );
    const boundedSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(journal.proposal.timeoutMs),
    ]);
    return this.#run(journal, agent, boundedSignal, []);
  }

  async discard(executionId: string): Promise<boolean> {
    const journal = await this.#journals.load(executionId);
    if (journal?.workspace === undefined) return true;
    if (!verifyEventChain(journal.events))
      throw new Error("EXECUTABLE_WORKER_JOURNAL_EVENT_CHAIN_INVALID");
    if (journal.state !== "recovery-ready" && journal.state !== "stopped")
      throw new Error("EXECUTABLE_WORKER_NOT_DISCARDABLE");
    if (!(await this.#adapter.workspaceExists(journal.workspace))) {
      await this.#transition(
        journal,
        "stopped",
        "Disposable workspace was already absent; cleanup is verified.",
      );
      return true;
    }
    const cleaned = await this.#adapter.cleanup(journal.workspace);
    await this.#transition(
      journal,
      "stopped",
      cleaned
        ? "Founder discarded the preserved disposable workspace."
        : "Disposable workspace cleanup could not be verified.",
    );
    return cleaned;
  }

  async journal(executionId: string): Promise<ExecutableWorkerJournal | null> {
    return this.#journals.load(executionId);
  }

  async #run(
    journal: ExecutableWorkerJournal,
    agent: ExecutableWorkerAgent,
    signal: AbortSignal,
    priorChecks: ExecutableWorkerCheck[],
  ): Promise<ExecutableWorkerResult> {
    const workspace = journal.workspace;
    if (workspace === undefined) throw new Error("EXECUTABLE_WORKER_WORKSPACE_MISSING");
    let checks = priorChecks;
    try {
      for (
        let iteration = journal.iteration + 1;
        iteration <= journal.proposal.maximumIterations;
        iteration += 1
      ) {
        if (isAborted(signal)) return await this.#stopped(journal, checks);
        journal.iteration = iteration;
        await this.#transition(
          journal,
          iteration === 1 ? "planning" : "repairing",
          iteration === 1
            ? "The coding model is planning the first bounded candidate edit."
            : `The coding model is repairing failed verification at iteration ${String(iteration)}.`,
        );
        const plan = executableWorkerPlanSchema.parse(
          await agent.plan(
            {
              proposal: journal.proposal,
              iteration,
              repositoryContext: await this.#adapter.context(workspace, journal.proposal),
              currentDiff: await this.#adapter.diff(workspace),
              previousChecks: checks,
            },
            signal,
          ),
        );
        this.#validatePlan(journal.proposal, plan);
        await this.#transition(
          journal,
          "editing",
          `Applying ${String(plan.mutations.length)} bounded disposable mutations.`,
        );
        for (const mutation of plan.mutations) await this.#applyMutation(workspace, mutation);
        if (isAborted(signal)) return await this.#stopped(journal, checks);
        await this.#transition(
          journal,
          "verifying",
          `Running ${String(journal.proposal.commands.length)} exact verification commands.`,
        );
        checks = [];
        for (const command of journal.proposal.commands) {
          const check = executableWorkerCheckSchema.parse(
            await this.#adapter.run(workspace, command, signal),
          );
          checks.push(check);
          if (isAborted(signal)) return await this.#stopped(journal, checks);
        }
        if (checks.every((check) => check.exitCode === 0)) {
          const changedPaths = await this.#validateChangedPaths(workspace, journal.proposal);
          journal.changedPaths = changedPaths;
          await this.#transition(
            journal,
            "checkpointing",
            "Verification passed; preserving a local candidate checkpoint.",
          );
          const checkpoint = await this.#adapter.checkpoint(
            workspace,
            journal.proposal,
            changedPaths,
          );
          journal.candidateCommit = checkpoint.commit;
          journal.candidateRef = checkpoint.ref;
          const diff = checkpoint.diff;
          const cleanupVerified = await this.#adapter.cleanup(workspace);
          if (!cleanupVerified) throw new Error("EXECUTABLE_WORKER_CLEANUP_FAILED");
          await this.#transition(
            journal,
            "completed",
            "Candidate checkpoint passed every exact check and the workspace was removed.",
          );
          return this.#result(journal, checks, diff, cleanupVerified);
        }
        journal.summary = `Verification failed during iteration ${String(iteration)}.`;
        await this.#save(journal);
      }
      throw new Error("EXECUTABLE_WORKER_REPAIR_LIMIT_REACHED");
    } catch (error) {
      return this.#recoverableFailure(journal, error, checks);
    }
  }

  #validatePlan(proposal: ExecutableWorkerProposal, plan: ExecutableWorkerPlan): void {
    const uniquePaths = new Set(plan.mutations.map((mutation) => mutation.path));
    if (uniquePaths.size !== plan.mutations.length)
      throw new Error("EXECUTABLE_WORKER_DUPLICATE_MUTATION");
    if (plan.mutations.length > proposal.maximumChangedFiles)
      throw new Error("EXECUTABLE_WORKER_CHANGED_FILE_LIMIT");
    let bytes = 0;
    for (const mutation of plan.mutations) {
      if (!within(mutation.path, proposal.writePaths))
        throw new Error(`EXECUTABLE_WORKER_PATH_NOT_WRITABLE:${mutation.path}`);
      if (within(mutation.path, proposal.forbiddenPaths))
        throw new Error(`EXECUTABLE_WORKER_PATH_FORBIDDEN:${mutation.path}`);
      if (mutation.content !== undefined) {
        bytes += Buffer.byteLength(mutation.content);
        if (containsCredentialLikeText(mutation.content))
          throw new Error("EXECUTABLE_WORKER_CREDENTIAL_OUTPUT_DENIED");
      }
    }
    if (bytes > proposal.maximumChangedBytes)
      throw new Error("EXECUTABLE_WORKER_CHANGED_BYTE_LIMIT");
  }

  async #applyMutation(
    workspace: ExecutableWorkerWorkspace,
    mutation: ExecutableWorkerMutation,
  ): Promise<void> {
    const current = await this.#adapter.readFile(workspace, mutation.path);
    if (mutation.operation === "create" && current !== null)
      throw new Error(`EXECUTABLE_WORKER_CREATE_EXISTS:${mutation.path}`);
    if (mutation.operation !== "create" && current === null)
      throw new Error(`EXECUTABLE_WORKER_MUTATION_MISSING:${mutation.path}`);
    if (mutation.operation === "delete") await this.#adapter.deleteFile(workspace, mutation.path);
    else await this.#adapter.writeFile(workspace, mutation.path, mutation.content ?? "");
  }

  async #validateChangedPaths(
    workspace: ExecutableWorkerWorkspace,
    proposal: ExecutableWorkerProposal,
  ): Promise<string[]> {
    const changedPaths = [...new Set(await this.#adapter.changedPaths(workspace))].sort();
    if (changedPaths.length === 0) throw new Error("EXECUTABLE_WORKER_NO_CHANGES");
    if (changedPaths.length > proposal.maximumChangedFiles)
      throw new Error("EXECUTABLE_WORKER_CHANGED_FILE_LIMIT");
    for (const path of changedPaths) {
      if (!within(path, proposal.writePaths))
        throw new Error(`EXECUTABLE_WORKER_CHANGED_PATH_NOT_WRITABLE:${path}`);
      if (within(path, proposal.forbiddenPaths))
        throw new Error(`EXECUTABLE_WORKER_CHANGED_PATH_FORBIDDEN:${path}`);
    }
    let changedBytes = 0;
    for (const path of changedPaths) {
      const content = await this.#adapter.readFile(workspace, path);
      if (content === null) continue;
      changedBytes += Buffer.byteLength(content);
      if (containsCredentialLikeText(content))
        throw new Error(`EXECUTABLE_WORKER_CREDENTIAL_OUTPUT_DENIED:${path}`);
    }
    if (changedBytes > proposal.maximumChangedBytes)
      throw new Error("EXECUTABLE_WORKER_CHANGED_BYTE_LIMIT");
    return changedPaths;
  }

  #approvalMatches(
    proposal: ExecutableWorkerProposal,
    approval: ExecutableWorkerApproval,
  ): boolean {
    return (
      approval.executionId === proposal.executionId &&
      approval.proposalDigest === executableWorkerProposalDigest(proposal) &&
      approval.typedStatement === requiredExecutableWorkerApproval(proposal)
    );
  }

  #newJournal(
    proposal: ExecutableWorkerProposal,
    approval: ExecutableWorkerApproval,
  ): ExecutableWorkerJournal {
    return {
      executionId: proposal.executionId,
      proposal,
      approval,
      state: "preflight",
      iteration: 0,
      summary: "Executable-worker request received for capability preflight.",
      changedPaths: [],
      events: [],
      updatedAt: this.#now().toISOString(),
    };
  }

  async #transition(
    journal: ExecutableWorkerJournal,
    state: ExecutableWorkerState,
    summary: string,
  ): Promise<void> {
    journal.state = state;
    journal.summary = summary;
    journal.updatedAt = this.#now().toISOString();
    const previousDigest = journal.events.at(-1)?.digest;
    const unsigned = {
      sequence: journal.events.length + 1,
      type: `ExecutableWorker${state
        .split("-")
        .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join("")}`,
      state,
      summary,
      occurredAt: journal.updatedAt,
      ...(previousDigest === undefined ? {} : { previousDigest }),
    };
    journal.events.push({ ...unsigned, digest: digest(unsigned) });
    await this.#save(journal);
  }

  #save(journal: ExecutableWorkerJournal): Promise<void> {
    return this.#journals.save(journal);
  }

  async #stopped(
    journal: ExecutableWorkerJournal,
    checks: ExecutableWorkerCheck[],
  ): Promise<ExecutableWorkerResult> {
    await this.#transition(
      journal,
      "stopped",
      "Execution stopped; the disposable workspace was preserved for bounded recovery.",
    );
    return this.#result(journal, checks, "", false);
  }

  async #recoverableFailure(
    journal: ExecutableWorkerJournal,
    error: unknown,
    checks: ExecutableWorkerCheck[],
  ): Promise<ExecutableWorkerResult> {
    const summary = error instanceof Error ? error.message : "Executable worker failed safely.";
    const hasWorkspace =
      journal.workspace !== undefined && (await this.#adapter.workspaceExists(journal.workspace));
    await this.#transition(journal, hasWorkspace ? "recovery-ready" : "denied", summary);
    return this.#result(journal, checks, "", !hasWorkspace);
  }

  #result(
    journal: ExecutableWorkerJournal,
    checks: ExecutableWorkerCheck[],
    diff: string,
    cleanupVerified: boolean,
  ): ExecutableWorkerResult {
    const state = journal.state;
    const status =
      state === "completed"
        ? "succeeded"
        : state === "stopped"
          ? "stopped"
          : state === "recovery-ready"
            ? "recovery-ready"
            : "denied";
    return {
      executionId: journal.executionId,
      status,
      state,
      summary: journal.summary,
      iteration: journal.iteration,
      changedPaths: [...journal.changedPaths],
      checks: structuredClone(checks),
      diff,
      ...(journal.candidateCommit === undefined
        ? {}
        : { candidateCommit: journal.candidateCommit }),
      ...(journal.candidateRef === undefined ? {} : { candidateRef: journal.candidateRef }),
      cleanupVerified,
      recoveryAvailable: state === "recovery-ready" || state === "stopped",
      eventChainVerified: verifyEventChain(journal.events),
      events: structuredClone(journal.events),
    };
  }
}
