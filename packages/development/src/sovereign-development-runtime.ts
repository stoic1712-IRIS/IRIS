import {
  developmentApprovalSchema,
  developmentProposalSchema,
  digestText,
  proposalDigest,
  requiredApprovalStatement,
  type DevelopmentApproval,
  type DevelopmentProposal,
} from "./contracts.js";

export interface DevelopmentWorkspace {
  id: string;
  path: string;
  baseRevision: string;
  disposable: true;
}
export interface CommandResult {
  command: string[];
  exitCode: number;
  outputDigest: string;
}
export interface PaidResourceProvider {
  provision(): Promise<string[]>;
  terminate(): Promise<string[]>;
  list(): Promise<string[]>;
}
export interface DevelopmentAdapter {
  createWorkspace(proposal: DevelopmentProposal): Promise<DevelopmentWorkspace>;
  readFile(workspace: DevelopmentWorkspace, path: string): Promise<string | null>;
  writeFile(workspace: DevelopmentWorkspace, path: string, content: string): Promise<void>;
  deleteFile(workspace: DevelopmentWorkspace, path: string): Promise<void>;
  run(workspace: DevelopmentWorkspace, command: string[]): Promise<CommandResult>;
  verify(workspace: DevelopmentWorkspace, proposal: DevelopmentProposal): Promise<string[]>;
  checkpoint(
    workspace: DevelopmentWorkspace,
    proposal: DevelopmentProposal,
  ): Promise<{ commit: string; remoteRevision: string }>;
  rollbackEvidence(
    workspace: DevelopmentWorkspace,
    checkpoint: string,
  ): Promise<{ command: string; preservesHistory: true }>;
  cleanup(workspace: DevelopmentWorkspace): Promise<boolean>;
  provisionPaidResources(): Promise<string[]>;
  terminatePaidResources(): Promise<string[]>;
  providerResources(): Promise<string[]>;
}
export interface DevelopmentEvent {
  type: string;
  summary: string;
}
export interface DevelopmentResult {
  status: "succeeded" | "denied" | "repair-reapproval-required" | "failed";
  checkpoint?: string;
  remoteEquality: boolean;
  rollback?: { command: string; preservesHistory: true };
  cleanupVerified: boolean;
  providerZeroVerified: boolean;
  events: DevelopmentEvent[];
}

export class SovereignDevelopmentRuntime {
  readonly #adapter: DevelopmentAdapter;
  constructor(adapter: DevelopmentAdapter) {
    this.#adapter = adapter;
  }

  async execute(
    proposalInput: DevelopmentProposal,
    approvalInput: DevelopmentApproval,
  ): Promise<DevelopmentResult> {
    const events: DevelopmentEvent[] = [];
    let workspace: DevelopmentWorkspace | undefined;
    let cleanupVerified = false;
    const emit = (type: string, summary: string) => events.push({ type, summary });
    try {
      const proposal = developmentProposalSchema.parse(proposalInput);
      const approval = developmentApprovalSchema.parse(approvalInput);
      if (
        approval.proposalId !== proposal.proposalId ||
        approval.proposalDigest !== proposalDigest(proposal) ||
        approval.typedStatement !== requiredApprovalStatement(proposal)
      ) {
        emit("DevelopmentDenied", "Typed Founder approval did not exactly match the proposal.");
        return {
          status: "denied",
          remoteEquality: false,
          cleanupVerified: true,
          providerZeroVerified: true,
          events,
        };
      }
      emit(
        "DevelopmentApproved",
        `Approval ${approval.approvalId} matched the immutable proposal.`,
      );
      const provisioned = await this.#adapter.provisionPaidResources();
      if (provisioned.length === 0)
        throw new Error("Provider-authoritative resource proof was not provisioned.");
      emit("PaidResourcesProvisioned", `${String(provisioned.length)} resources provisioned.`);
      workspace = await this.#adapter.createWorkspace(proposal);
      if (workspace.baseRevision !== proposal.baseRevision)
        throw new Error("Workspace base is not exact and disposable.");
      emit("WorkspaceCreated", workspace.id);
      for (const change of proposal.changes) {
        const before = await this.#adapter.readFile(workspace, change.path);
        const actualBefore = before === null ? null : digestText(before);
        if (actualBefore !== change.beforeDigest)
          throw new Error(`Before digest mismatch: ${change.path}`);
        if (change.operation === "delete") await this.#adapter.deleteFile(workspace, change.path);
        else await this.#adapter.writeFile(workspace, change.path, change.content ?? "");
        const after = await this.#adapter.readFile(workspace, change.path);
        const actualAfter = after === null ? null : digestText(after);
        if (actualAfter !== change.afterDigest)
          throw new Error(`After digest mismatch: ${change.path}`);
      }
      emit("MultiFileEditApplied", `${String(proposal.changes.length)} exact changes applied.`);
      for (const command of proposal.commands) {
        const result = await this.#adapter.run(workspace, command);
        if (result.exitCode !== 0) throw new Error(`Governed command failed: ${command.join(" ")}`);
      }
      emit("ChecksPassed", `${String(proposal.commands.length)} governed commands passed.`);
      const findings = await this.#adapter.verify(workspace, proposal);
      if (findings.length > 0) {
        emit("RepairProposed", findings.join("; "));
        cleanupVerified = await this.#adapter.cleanup(workspace);
        await this.#adapter.terminatePaidResources();
        const repairProviderZero = (await this.#adapter.providerResources()).length === 0;
        return {
          status: "repair-reapproval-required",
          remoteEquality: false,
          cleanupVerified,
          providerZeroVerified: repairProviderZero,
          events,
        };
      }
      emit("IndependentVerificationPassed", "Independent verification returned no findings.");
      const checkpoint = await this.#adapter.checkpoint(workspace, proposal);
      const remoteEquality = checkpoint.commit === checkpoint.remoteRevision;
      if (!remoteEquality) throw new Error("Private checkpoint and remote revision differ.");
      emit("RemoteEqualityVerified", checkpoint.commit);
      const rollback = await this.#adapter.rollbackEvidence(workspace, checkpoint.commit);
      emit("RollbackEvidencePreserved", rollback.command);
      cleanupVerified = await this.#adapter.cleanup(workspace);
      if (!cleanupVerified) throw new Error("Disposable workspace cleanup was not verified.");
      emit("WorkspaceCleanupVerified", workspace.id);
      const terminated = await this.#adapter.terminatePaidResources();
      emit("PaidResourcesTerminated", `${String(terminated.length)} resources terminated.`);
      const providerZeroVerified = (await this.#adapter.providerResources()).length === 0;
      if (!providerZeroVerified)
        throw new Error("Provider-authoritative zero resources was not verified.");
      emit("ProviderZeroVerified", "Provider reports zero remaining resources.");
      return {
        status: "succeeded",
        checkpoint: checkpoint.commit,
        remoteEquality,
        rollback,
        cleanupVerified,
        providerZeroVerified,
        events,
      };
    } catch (error) {
      emit("DevelopmentFailed", error instanceof Error ? error.message : "Unknown failure.");
      if (workspace !== undefined && !cleanupVerified)
        cleanupVerified = await this.#adapter.cleanup(workspace);
      await this.#adapter.terminatePaidResources();
      const providerZeroVerified = (await this.#adapter.providerResources()).length === 0;
      return {
        status: "failed",
        remoteEquality: false,
        cleanupVerified,
        providerZeroVerified,
        events,
      };
    }
  }
}
