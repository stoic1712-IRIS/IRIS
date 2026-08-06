import { execFileSync } from "node:child_process";

import { z } from "zod";

const repositorySchema = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u);
const commitSchema = z.string().regex(/^[a-f0-9]{40}$/u);
const referenceSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u)
  .refine((value) => !value.includes("..") && !value.endsWith("/"));
const approvalDigestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

const repositoryViewSchema = z.object({
  nameWithOwner: repositorySchema,
  visibility: z.enum(["PUBLIC", "PRIVATE", "INTERNAL"]),
  defaultBranchRef: z.object({ name: z.string().min(1) }),
});

const pullRequestViewSchema = z.object({
  number: z.number().int().positive(),
  url: z.url(),
  isDraft: z.boolean(),
  headRefOid: commitSchema,
  state: z.enum(["OPEN", "CLOSED", "MERGED"]),
  mergeStateStatus: z.string(),
});

export interface GithubCliProcessRunner {
  run(executable: string, args: string[], options?: { cwd?: string; input?: string }): string;
}

export interface GithubRepositoryWorkspace {
  path: string;
  remote: string;
}

export interface GithubMutationAuthorization {
  operation: "push-branch" | "create-pull-request" | "merge-pull-request";
  repository: string;
  target: string;
  approvalDigest: string;
}

export interface GithubCliRepositoryProviderOptions {
  owner: string;
  repositories: Record<string, GithubRepositoryWorkspace>;
  ghPath: string;
  gitPath?: string;
  runner?: GithubCliProcessRunner;
}

export interface GithubRepositoryView {
  repository: string;
  visibility: "PUBLIC" | "PRIVATE" | "INTERNAL";
  defaultBranch: string;
}

class DefaultProcessRunner implements GithubCliProcessRunner {
  run(executable: string, args: string[], options: { cwd?: string; input?: string } = {}): string {
    const environment = { ...process.env };
    delete environment.GH_TOKEN;
    delete environment.GITHUB_TOKEN;
    return execFileSync(executable, args, {
      cwd: options.cwd,
      encoding: "utf8",
      env: environment,
      input: options.input,
      maxBuffer: 1024 * 1024,
      shell: false,
      timeout: 30_000,
      windowsHide: true,
    }).trim();
  }
}

export class GithubCliRepositoryProvider {
  readonly #owner: string;
  readonly #repositories: ReadonlyMap<string, GithubRepositoryWorkspace>;
  readonly #ghPath: string;
  readonly #gitPath: string;
  readonly #runner: GithubCliProcessRunner;

  constructor(options: GithubCliRepositoryProviderOptions) {
    if (!/^[A-Za-z0-9_.-]+$/u.test(options.owner)) throw new Error("GITHUB_OWNER_INVALID");
    const entries = Object.entries(options.repositories);
    if (entries.length === 0) throw new Error("GITHUB_REPOSITORY_ALLOWLIST_REQUIRED");
    for (const [repository, workspace] of entries) {
      repositorySchema.parse(repository);
      if (!repository.startsWith(`${options.owner}/`)) throw new Error("GITHUB_OWNER_MISMATCH");
      if (workspace.path.trim() === "" || !/^[A-Za-z0-9_.-]+$/u.test(workspace.remote))
        throw new Error("GITHUB_WORKSPACE_INVALID");
    }
    if (options.ghPath.trim() === "") throw new Error("GITHUB_CLI_PATH_REQUIRED");
    this.#owner = options.owner;
    this.#repositories = new Map(entries);
    this.#ghPath = options.ghPath;
    this.#gitPath = options.gitPath ?? "git";
    this.#runner = options.runner ?? new DefaultProcessRunner();
  }

  verifyAuthentication(): string {
    const login = this.#runner.run(this.#ghPath, ["api", "user", "--jq", ".login"]);
    if (login !== this.#owner) throw new Error("GITHUB_AUTHENTICATED_OWNER_MISMATCH");
    return login;
  }

  inspectRepository(repository: string): GithubRepositoryView {
    this.#workspace(repository);
    this.verifyAuthentication();
    const view = repositoryViewSchema.parse(
      JSON.parse(
        this.#runner.run(this.#ghPath, [
          "repo",
          "view",
          repository,
          "--json",
          "nameWithOwner,visibility,defaultBranchRef",
        ]),
      ),
    );
    if (view.nameWithOwner !== repository || view.defaultBranchRef.name !== "main")
      throw new Error("GITHUB_REPOSITORY_IDENTITY_MISMATCH");
    return {
      repository,
      visibility: view.visibility,
      defaultBranch: view.defaultBranchRef.name,
    };
  }

  push(input: {
    repository: string;
    ref: string;
    commit: string;
    force: false;
    authorization: GithubMutationAuthorization;
  }): Promise<{ remoteCommit: string }> {
    const workspace = this.#workspace(input.repository);
    const reference = referenceSchema.parse(input.ref);
    const commit = commitSchema.parse(input.commit);
    this.#authorize(input.authorization, "push-branch", input.repository, reference);
    this.verifyAuthentication();
    const localCommit = this.#runner.run(
      this.#gitPath,
      ["-C", workspace.path, "rev-parse", "--verify", `${commit}^{commit}`],
      { cwd: workspace.path },
    );
    if (localCommit !== commit) throw new Error("GITHUB_LOCAL_COMMIT_MISMATCH");
    this.#runner.run(
      this.#gitPath,
      [
        "-C",
        workspace.path,
        "push",
        "--porcelain",
        workspace.remote,
        `${commit}:refs/heads/${reference}`,
      ],
      { cwd: workspace.path },
    );
    const remoteLine = this.#runner.run(
      this.#gitPath,
      ["-C", workspace.path, "ls-remote", "--heads", workspace.remote, `refs/heads/${reference}`],
      { cwd: workspace.path },
    );
    const remoteCommit = remoteLine.split(/\s+/u)[0] ?? "";
    if (remoteCommit !== commit) throw new Error("GITHUB_REMOTE_COMMIT_MISMATCH");
    return Promise.resolve({ remoteCommit });
  }

  createPullRequest(input: {
    repository: string;
    base: "main";
    head: string;
    title: string;
    body: string;
    draft: true;
    maintainersCanModify: false;
    headCommit: string;
    authorization: GithubMutationAuthorization;
  }): Promise<{ number: number; url: string; draft: true; headCommit: string }> {
    this.#workspace(input.repository);
    const head = referenceSchema.parse(input.head);
    const headCommit = commitSchema.parse(input.headCommit);
    this.#authorize(input.authorization, "create-pull-request", input.repository, head);
    this.verifyAuthentication();
    this.#runner.run(this.#ghPath, [
      "pr",
      "create",
      "--repo",
      input.repository,
      "--base",
      "main",
      "--head",
      head,
      "--title",
      input.title,
      "--body",
      input.body,
      "--draft",
      "--no-maintainer-edit",
    ]);
    const pullRequest = this.#pullRequest(input.repository, head);
    if (
      !pullRequest.isDraft ||
      pullRequest.headRefOid !== headCommit ||
      pullRequest.state !== "OPEN"
    )
      throw new Error("GITHUB_PULL_REQUEST_MISMATCH");
    return Promise.resolve({
      number: pullRequest.number,
      url: pullRequest.url,
      draft: true,
      headCommit: pullRequest.headRefOid,
    });
  }

  mergePullRequest(input: {
    repository: string;
    number: number;
    expectedHeadCommit: string;
    authorization: GithubMutationAuthorization;
  }): Promise<{ mergeCommit: string }> {
    this.#workspace(input.repository);
    const number = z.number().int().positive().parse(input.number);
    const expectedHeadCommit = commitSchema.parse(input.expectedHeadCommit);
    this.#authorize(input.authorization, "merge-pull-request", input.repository, String(number));
    this.verifyAuthentication();
    const before = this.#pullRequest(input.repository, number);
    if (
      before.state !== "OPEN" ||
      before.headRefOid !== expectedHeadCommit ||
      !["CLEAN", "HAS_HOOKS", "UNSTABLE"].includes(before.mergeStateStatus)
    )
      throw new Error("GITHUB_PULL_REQUEST_NOT_MERGEABLE");
    this.#runner.run(this.#ghPath, [
      "pr",
      "merge",
      String(number),
      "--repo",
      input.repository,
      "--merge",
      "--match-head-commit",
      expectedHeadCommit,
    ]);
    const mergeCommit = this.#runner.run(this.#ghPath, [
      "pr",
      "view",
      String(number),
      "--repo",
      input.repository,
      "--json",
      "mergeCommit",
      "--jq",
      ".mergeCommit.oid",
    ]);
    return Promise.resolve({ mergeCommit: commitSchema.parse(mergeCommit) });
  }

  clearCredential(): void {
    // Credentials remain owned by the operating-system keyring. This provider
    // never reads, stores, returns, or clears their secret value.
  }

  #workspace(repository: string): GithubRepositoryWorkspace {
    repositorySchema.parse(repository);
    const workspace = this.#repositories.get(repository);
    if (workspace === undefined) throw new Error("GITHUB_REPOSITORY_NOT_ALLOWED");
    return workspace;
  }

  #authorize(
    authorization: GithubMutationAuthorization,
    operation: GithubMutationAuthorization["operation"],
    repository: string,
    target: string,
  ): void {
    approvalDigestSchema.parse(authorization.approvalDigest);
    if (
      authorization.operation !== operation ||
      authorization.repository !== repository ||
      authorization.target !== target
    )
      throw new Error("GITHUB_AUTHORIZATION_MISMATCH");
  }

  #pullRequest(
    repository: string,
    selector: number | string,
  ): z.infer<typeof pullRequestViewSchema> {
    return pullRequestViewSchema.parse(
      JSON.parse(
        this.#runner.run(this.#ghPath, [
          "pr",
          "view",
          String(selector),
          "--repo",
          repository,
          "--json",
          "number,url,isDraft,headRefOid,state,mergeStateStatus",
        ]),
      ),
    );
  }
}
