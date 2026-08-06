import type {
  RepositoryDeliveryAdapter,
  RepositoryDeliveryProposal,
} from "./repository-delivery.js";

export interface DeliveryWorkspaceController {
  preflight(proposal: RepositoryDeliveryProposal): Promise<void>;
  reconstructAndVerify(proposal: RepositoryDeliveryProposal): Promise<string>;
  createCommit(proposal: RepositoryDeliveryProposal): Promise<string>;
  cleanup(): Promise<void>;
}

export interface DeliveryProviderController {
  push(input: {
    repository: string;
    ref: string;
    commit: string;
    force: false;
    authorization: {
      operation: "push-branch";
      repository: string;
      target: string;
      approvalDigest: string;
    };
  }): Promise<{ remoteCommit: string }>;
  createPullRequest(input: {
    repository: string;
    base: "main";
    head: string;
    title: string;
    body: string;
    draft: true;
    maintainersCanModify: false;
    headCommit: string;
    authorization: {
      operation: "create-pull-request";
      repository: string;
      target: string;
      approvalDigest: string;
    };
  }): Promise<{ number: number; url: string; draft: true; headCommit: string }>;
  clearCredential(): void;
}

/**
 * Fixed adapter joining disposable Git work with a narrowly scoped provider.
 * The provider is injected so credentials never enter proposals, model input,
 * browser state, evidence, or this adapter.
 */
export class GovernedRepositoryDeliveryAdapter implements RepositoryDeliveryAdapter {
  readonly #workspace: DeliveryWorkspaceController;
  readonly #provider: DeliveryProviderController;
  #checkpointVerified = false;
  #targetVerified = false;

  constructor(options: {
    workspace: DeliveryWorkspaceController;
    provider: DeliveryProviderController;
  }) {
    this.#workspace = options.workspace;
    this.#provider = options.provider;
  }

  preflight(proposal: RepositoryDeliveryProposal): Promise<void> {
    return this.#workspace.preflight(proposal);
  }

  reconstructAndVerify(proposal: RepositoryDeliveryProposal): Promise<string> {
    return this.#workspace.reconstructAndVerify(proposal);
  }

  createCommit(proposal: RepositoryDeliveryProposal): Promise<string> {
    return this.#workspace.createCommit(proposal);
  }

  async pushCheckpoint(proposal: RepositoryDeliveryProposal, commit: string): Promise<string> {
    const result = await this.#provider.push({
      repository: proposal.checkpointRepository,
      ref: proposal.checkpointRef,
      commit,
      force: false,
      authorization: {
        operation: "push-branch",
        repository: proposal.checkpointRepository,
        target: proposal.checkpointRef,
        approvalDigest: proposal.digest,
      },
    });
    this.#checkpointVerified = result.remoteCommit === commit;
    return result.remoteCommit;
  }

  async pushTarget(proposal: RepositoryDeliveryProposal, commit: string): Promise<string> {
    if (!this.#checkpointVerified) throw new Error("CHECKPOINT_FIRST_REQUIRED");
    const result = await this.#provider.push({
      repository: proposal.repository,
      ref: proposal.targetBranch,
      commit,
      force: false,
      authorization: {
        operation: "push-branch",
        repository: proposal.repository,
        target: proposal.targetBranch,
        approvalDigest: proposal.digest,
      },
    });
    this.#targetVerified = result.remoteCommit === commit;
    return result.remoteCommit;
  }

  async createDraftPullRequest(
    proposal: RepositoryDeliveryProposal,
    commit: string,
  ): Promise<{ number: number; url: string; draft: true }> {
    if (!this.#checkpointVerified || !this.#targetVerified)
      throw new Error("REMOTE_EQUALITY_REQUIRED");
    const result = await this.#provider.createPullRequest({
      repository: proposal.repository,
      base: "main",
      head: proposal.targetBranch,
      title: proposal.pullRequestTitle,
      body: proposal.pullRequestBody,
      draft: true,
      maintainersCanModify: false,
      headCommit: commit,
      authorization: {
        operation: "create-pull-request",
        repository: proposal.repository,
        target: proposal.targetBranch,
        approvalDigest: proposal.digest,
      },
    });
    if (result.headCommit !== commit) throw new Error("PULL_REQUEST_COMMIT_MISMATCH");
    return { number: result.number, url: result.url, draft: true };
  }

  cleanup(): Promise<void> {
    return this.#workspace.cleanup();
  }

  clearCredential(): void {
    this.#provider.clearCredential();
  }
}
