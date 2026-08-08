import { createHash } from "node:crypto";

import {
  executableWorkerApprovalSchema,
  executableWorkerCheckSchema,
  executableWorkerCleanupEvidenceSchema,
  executableWorkerPlanSchema,
  executableWorkerPreflightSchema,
  executableWorkerProposalDigest,
  executableWorkerProposalSchema,
  requiredExecutableWorkerApproval,
  type ExecutableWorkerApproval,
  type ExecutableWorkerCheck,
  type ExecutableWorkerCleanupEvidence,
  type ExecutableWorkerMutation,
  type ExecutableWorkerPlan,
  type ExecutableWorkerPreflight,
  type ExecutableWorkerProposal,
  type ExecutableWorkerState,
} from "./executable-worker-contracts.js";
import type {
  ExecutableWorkerAttemptEvidence,
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
  cleanup(workspace: ExecutableWorkerWorkspace): Promise<ExecutableWorkerCleanupEvidence>;
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
  cleanup?: ExecutableWorkerCleanupEvidence;
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

function digestText(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function within(path: string, roots: readonly string[]): boolean {
  return roots.some((root) => path === root || path.startsWith(`${root.replace(/\/$/u, "")}/`));
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
    if (!this.#approvalMatches(proposal, approval)) {
      await this.#transition(
        journal,
        "denied",
        "Exact Founder approval did not match the executable-worker proposal.",
      );
      return this.#result(journal, "");
    }
    if (Date.parse(proposal.expiresAt) <= this.#now().getTime()) {
      await this.#transition(journal, "denied", "Executable-worker proposal expired.");
      return this.#result(journal, "");
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
        return this.#result(journal, "");
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
          journal.materializationChecks.push(check);
          await this.#save(journal);
          if (check.exitCode !== 0) throw new Error("EXECUTABLE_WORKER_MATERIALIZATION_FAILED");
        }
      }
      const baselineCommands = proposal.baselineCommands ?? [];
      if (baselineCommands.length > 0) {
        await this.#transition(
          journal,
          "verifying",
          `Recording ${String(baselineCommands.length)} exact baseline commands before editing.`,
        );
        for (const command of baselineCommands) {
          const check = executableWorkerCheckSchema.parse(
            await this.#adapter.run(journal.workspace, command, boundedSignal),
          );
          journal.baselineChecks.push(check);
          await this.#save(journal);
        }
      }
      return await this.#run(journal, agent, boundedSignal);
    } catch (error) {
      return await this.#recoverableFailure(journal, error);
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
    if (journal.journalVersion !== 3 || journal.approvalBindingDigest === undefined)
      throw new Error("EXECUTABLE_WORKER_JOURNAL_EVIDENCE_INCOMPLETE");
    if (
      journal.approvalBindingDigest !==
        digest({
          proposal: journal.proposal,
          approval: journal.approval,
        }) ||
      journal.events[0]?.approvalBindingDigest !== journal.approvalBindingDigest ||
      !this.#approvalMatches(journal.proposal, journal.approval)
    )
      throw new Error("EXECUTABLE_WORKER_JOURNAL_APPROVAL_BINDING_INVALID");
    if (journal.state !== "recovery-ready" && journal.state !== "stopped")
      throw new Error("EXECUTABLE_WORKER_NOT_RECOVERABLE");
    if (journal.workspace === undefined)
      throw new Error("EXECUTABLE_WORKER_WORKSPACE_NOT_RECOVERABLE");
    if (Date.parse(journal.proposal.expiresAt) <= this.#now().getTime())
      throw new Error("EXECUTABLE_WORKER_PROPOSAL_EXPIRED");
    if (journal.candidateCommit !== undefined) {
      const cleanup = executableWorkerCleanupEvidenceSchema.parse(
        await this.#adapter.cleanup(journal.workspace),
      );
      journal.cleanup = cleanup;
      await this.#save(journal);
      if (!cleanup.verified)
        return this.#recoverableFailure(journal, new Error("EXECUTABLE_WORKER_CLEANUP_FAILED"));
      await this.#transition(
        journal,
        "completed",
        "Candidate checkpoint remained exact and disposable-workspace cleanup is now verified.",
      );
      return this.#result(journal, "");
    }
    if (!(await this.#adapter.workspaceExists(journal.workspace)))
      throw new Error("EXECUTABLE_WORKER_WORKSPACE_NOT_RECOVERABLE");
    await this.#transition(
      journal,
      "repairing",
      "Resuming the preserved disposable workspace under the unchanged approval.",
    );
    const boundedSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(journal.proposal.timeoutMs),
    ]);
    return this.#run(journal, agent, boundedSignal);
  }

  async discard(executionId: string): Promise<boolean> {
    const journal = await this.#journals.load(executionId);
    if (journal?.workspace === undefined) return true;
    if (!verifyEventChain(journal.events))
      throw new Error("EXECUTABLE_WORKER_JOURNAL_EVENT_CHAIN_INVALID");
    if (journal.state !== "recovery-ready" && journal.state !== "stopped")
      throw new Error("EXECUTABLE_WORKER_NOT_DISCARDABLE");
    const cleanup = executableWorkerCleanupEvidenceSchema.parse(
      await this.#adapter.cleanup(journal.workspace),
    );
    journal.cleanup = cleanup;
    await this.#save(journal);
    await this.#transition(
      journal,
      cleanup.verified ? "stopped" : "recovery-ready",
      cleanup.verified
        ? "Founder discarded the preserved disposable workspace."
        : "Disposable workspace cleanup could not be verified.",
    );
    return cleanup.verified;
  }

  async journal(executionId: string): Promise<ExecutableWorkerJournal | null> {
    return this.#journals.load(executionId);
  }

  async #run(
    journal: ExecutableWorkerJournal,
    agent: ExecutableWorkerAgent,
    signal: AbortSignal,
  ): Promise<ExecutableWorkerResult> {
    const workspace = journal.workspace;
    if (workspace === undefined) throw new Error("EXECUTABLE_WORKER_WORKSPACE_MISSING");
    let checks = this.#latestAttemptChecks(journal);
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
        const attempt: ExecutableWorkerAttemptEvidence = {
          iteration,
          planDigest: digest(plan),
          normalizationChecks: [],
          verificationChecks: [],
          changedPaths: [],
          startedAt: this.#now().toISOString(),
        };
        journal.attempts.push(attempt);
        await this.#save(journal);
        await this.#transition(
          journal,
          "editing",
          `Applying ${String(plan.mutations.length)} bounded disposable mutations.`,
        );
        for (const mutation of plan.mutations) await this.#applyMutation(workspace, mutation);
        if (isAborted(signal)) return await this.#stopped(journal, checks);
        const normalizationCommands = journal.proposal.normalizationCommands ?? [];
        if (normalizationCommands.length > 0) {
          await this.#transition(
            journal,
            "verifying",
            `Running ${String(normalizationCommands.length)} exact normalization commands.`,
          );
          for (const command of normalizationCommands) {
            const check = executableWorkerCheckSchema.parse(
              await this.#adapter.run(workspace, command, signal),
            );
            attempt.normalizationChecks.push(check);
            await this.#save(journal);
            if (isAborted(signal)) return await this.#stopped(journal, [check]);
          }
          checks = [...attempt.normalizationChecks];
          if (attempt.normalizationChecks.some((check) => check.exitCode !== 0)) {
            await this.#completeAttempt(journal, attempt, workspace);
            continue;
          }
        }
        await this.#transition(
          journal,
          "verifying",
          `Running ${String(journal.proposal.commands.length)} exact verification commands.`,
        );
        for (const command of journal.proposal.commands) {
          const check = executableWorkerCheckSchema.parse(
            await this.#adapter.run(workspace, command, signal),
          );
          attempt.verificationChecks.push(check);
          await this.#save(journal);
          if (isAborted(signal)) return await this.#stopped(journal, [check]);
        }
        checks = [...attempt.normalizationChecks, ...attempt.verificationChecks];
        await this.#completeAttempt(journal, attempt, workspace);
        if (attempt.verificationChecks.every((check) => check.exitCode === 0)) {
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
          // Persist the checkpoint identity before cleanup so a process loss in
          // that boundary can resume cleanup without replaying the mutation.
          await this.#save(journal);
          const cleanup = executableWorkerCleanupEvidenceSchema.parse(
            await this.#adapter.cleanup(workspace),
          );
          journal.cleanup = cleanup;
          await this.#save(journal);
          if (!cleanup.verified) throw new Error("EXECUTABLE_WORKER_CLEANUP_FAILED");
          await this.#transition(
            journal,
            "completed",
            "Candidate checkpoint passed every exact check and the workspace was removed.",
          );
          return this.#result(journal, diff);
        }
        journal.summary = `Verification failed during iteration ${String(iteration)}.`;
        await this.#save(journal);
      }
      throw new Error("EXECUTABLE_WORKER_REPAIR_LIMIT_REACHED");
    } catch (error) {
      return this.#recoverableFailure(journal, error);
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
        if (mutation.content.includes("\0"))
          throw new Error(`EXECUTABLE_WORKER_NUL_CONTENT_DENIED:${mutation.path}`);
        if (containsCredentialLikeText(mutation.content))
          throw new Error("EXECUTABLE_WORKER_CREDENTIAL_OUTPUT_DENIED");
      }
      for (const replacement of mutation.replacements ?? []) {
        bytes += Buffer.byteLength(replacement.newText);
        if (replacement.newText.includes("\0"))
          throw new Error(`EXECUTABLE_WORKER_NUL_CONTENT_DENIED:${mutation.path}`);
        if (containsCredentialLikeText(replacement.newText))
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
    if (mutation.operation === "create") {
      await this.#adapter.writeFile(workspace, mutation.path, mutation.content ?? "");
      return;
    }
    const existing = current ?? "";
    if (digestText(existing) !== mutation.expectedContentDigest)
      throw new Error(`EXECUTABLE_WORKER_CONTENT_DIGEST_MISMATCH:${mutation.path}`);
    if (mutation.operation === "delete") {
      await this.#adapter.deleteFile(workspace, mutation.path);
      return;
    }
    const ranges = (mutation.replacements ?? [])
      .map((replacement) => {
        const start = existing.indexOf(replacement.oldText);
        if (start < 0 || start !== existing.lastIndexOf(replacement.oldText))
          throw new Error(`EXECUTABLE_WORKER_REPLACEMENT_NOT_UNIQUE:${mutation.path}`);
        return {
          start,
          end: start + replacement.oldText.length,
          newText: replacement.newText,
        };
      })
      .sort((left, right) => left.start - right.start);
    for (let index = 1; index < ranges.length; index += 1) {
      if ((ranges[index]?.start ?? 0) < (ranges[index - 1]?.end ?? 0))
        throw new Error(`EXECUTABLE_WORKER_REPLACEMENT_OVERLAP:${mutation.path}`);
    }
    let next = existing;
    for (const range of ranges.toReversed())
      next = `${next.slice(0, range.start)}${range.newText}${next.slice(range.end)}`;
    if (next.includes("\0"))
      throw new Error(`EXECUTABLE_WORKER_NUL_CONTENT_DENIED:${mutation.path}`);
    await this.#adapter.writeFile(workspace, mutation.path, next);
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
      if (content.includes("\0")) throw new Error(`EXECUTABLE_WORKER_NUL_CONTENT_DENIED:${path}`);
      if (containsCredentialLikeText(content))
        throw new Error(`EXECUTABLE_WORKER_CREDENTIAL_OUTPUT_DENIED:${path}`);
    }
    if (changedBytes > proposal.maximumChangedBytes)
      throw new Error("EXECUTABLE_WORKER_CHANGED_BYTE_LIMIT");
    return changedPaths;
  }

  async #completeAttempt(
    journal: ExecutableWorkerJournal,
    attempt: ExecutableWorkerAttemptEvidence,
    workspace: ExecutableWorkerWorkspace,
  ): Promise<void> {
    attempt.changedPaths = [...new Set(await this.#adapter.changedPaths(workspace))].sort();
    attempt.diffDigest = digestText(await this.#adapter.diff(workspace));
    attempt.completedAt = this.#now().toISOString();
    await this.#save(journal);
  }

  #latestAttemptChecks(journal: ExecutableWorkerJournal): ExecutableWorkerCheck[] {
    const attempt = journal.attempts.at(-1);
    if (attempt !== undefined) {
      const checks = [...attempt.normalizationChecks, ...attempt.verificationChecks];
      if (checks.length > 0) return structuredClone(checks);
    }
    if (journal.baselineChecks.length > 0) return structuredClone(journal.baselineChecks);
    return structuredClone(journal.materializationChecks);
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
      journalVersion: 3,
      executionId: proposal.executionId,
      proposal,
      approval,
      approvalBindingDigest: digest({ proposal, approval }),
      state: "preflight",
      iteration: 0,
      summary: "Executable-worker request received for capability preflight.",
      changedPaths: [],
      materializationChecks: [],
      baselineChecks: [],
      attempts: [],
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
      ...(previousDigest === undefined && journal.approvalBindingDigest !== undefined
        ? { approvalBindingDigest: journal.approvalBindingDigest }
        : {}),
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
    return this.#result(journal, "", checks);
  }

  async #recoverableFailure(
    journal: ExecutableWorkerJournal,
    error: unknown,
  ): Promise<ExecutableWorkerResult> {
    const summary = error instanceof Error ? error.message : "Executable worker failed safely.";
    const recoverable = journal.workspace !== undefined && journal.cleanup?.verified !== true;
    await this.#transition(journal, recoverable ? "recovery-ready" : "denied", summary);
    return this.#result(journal, "");
  }

  #result(
    journal: ExecutableWorkerJournal,
    diff: string,
    explicitChecks?: ExecutableWorkerCheck[],
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
      checks: structuredClone(explicitChecks ?? this.#latestAttemptChecks(journal)),
      diff,
      ...(journal.candidateCommit === undefined
        ? {}
        : { candidateCommit: journal.candidateCommit }),
      ...(journal.candidateRef === undefined ? {} : { candidateRef: journal.candidateRef }),
      cleanupVerified: journal.cleanup?.verified ?? journal.workspace === undefined,
      ...(journal.cleanup === undefined ? {} : { cleanup: structuredClone(journal.cleanup) }),
      recoveryAvailable: state === "recovery-ready" || state === "stopped",
      eventChainVerified: verifyEventChain(journal.events),
      events: structuredClone(journal.events),
    };
  }
}
