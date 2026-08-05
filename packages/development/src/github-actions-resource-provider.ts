import type { PaidResourceProvider } from "./sovereign-development-runtime.js";

interface WorkflowRun {
  id: number;
  status: string | null;
  display_title: string;
}

interface WorkflowRunsResponse {
  workflow_runs: WorkflowRun[];
}

export interface GitHubActionsResourceProviderOptions {
  owner: string;
  repository: string;
  workflowId: string;
  ref: string;
  scope: string;
  token: string;
  fetch?: typeof fetch;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

const apiVersion = "2026-03-10";
const activeStatuses = new Set(["requested", "waiting", "pending", "queued", "in_progress"]);

export class GitHubActionsResourceProvider implements PaidResourceProvider {
  readonly #baseUrl: string;
  readonly #workflowId: string;
  readonly #ref: string;
  readonly #scope: string;
  readonly #token: string;
  readonly #fetch: typeof fetch;
  readonly #pollIntervalMs: number;
  readonly #maxPollAttempts: number;

  constructor(options: GitHubActionsResourceProviderOptions) {
    if (options.token.trim() === "") throw new Error("GitHub Actions token is required.");
    if (!/^[A-Za-z0-9._-]+$/.test(options.scope))
      throw new Error("GitHub Actions resource scope contains unsupported characters.");
    this.#baseUrl = `https://api.github.com/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repository)}`;
    this.#workflowId = options.workflowId;
    this.#ref = options.ref;
    this.#scope = options.scope;
    this.#token = options.token;
    this.#fetch = options.fetch ?? fetch;
    this.#pollIntervalMs = options.pollIntervalMs ?? 1_000;
    this.#maxPollAttempts = options.maxPollAttempts ?? 60;
  }

  async provision(): Promise<string[]> {
    const response = await this.#request(
      `/actions/workflows/${encodeURIComponent(this.#workflowId)}/dispatches`,
      {
        method: "POST",
        body: JSON.stringify({ ref: this.#ref, inputs: { scope: this.#scope } }),
      },
    );
    if (response.status !== 200 && response.status !== 204)
      throw new Error(`GitHub workflow dispatch failed with status ${String(response.status)}.`);
    if (response.status === 200) {
      const body = (await response.json()) as { workflow_run_id?: number };
      if (body.workflow_run_id !== undefined)
        return [`github-actions:${String(body.workflow_run_id)}:dispatched`];
    }
    return this.#waitForAtLeastOneResource();
  }

  async terminate(): Promise<string[]> {
    const runs = await this.#activeRuns();
    for (const run of runs) {
      const response = await this.#request(`/actions/runs/${String(run.id)}/cancel`, {
        method: "POST",
      });
      if (response.status !== 202 && response.status !== 409)
        throw new Error(
          `GitHub workflow cancellation failed for ${String(run.id)} with status ${String(response.status)}.`,
        );
    }
    await this.#waitForZeroResources();
    return runs.map((run) => this.#resourceId(run));
  }

  async list(): Promise<string[]> {
    return (await this.#activeRuns()).map((run) => this.#resourceId(run));
  }

  async #activeRuns(): Promise<WorkflowRun[]> {
    const response = await this.#request(
      `/actions/runs?event=workflow_dispatch&branch=${encodeURIComponent(this.#ref)}&per_page=100`,
    );
    if (!response.ok)
      throw new Error(`GitHub workflow-run query failed with status ${String(response.status)}.`);
    const body = (await response.json()) as WorkflowRunsResponse;
    const title = `IRIS provider proof ${this.#scope}`;
    return body.workflow_runs.filter(
      (run) => run.display_title === title && run.status !== null && activeStatuses.has(run.status),
    );
  }

  async #waitForAtLeastOneResource(): Promise<string[]> {
    for (let attempt = 0; attempt < this.#maxPollAttempts; attempt += 1) {
      const resources = await this.list();
      if (resources.length > 0) return resources;
      await this.#wait();
    }
    throw new Error(
      "GitHub did not report the dispatched resource within the bounded poll window.",
    );
  }

  async #waitForZeroResources(): Promise<void> {
    for (let attempt = 0; attempt < this.#maxPollAttempts; attempt += 1) {
      if ((await this.list()).length === 0) return;
      await this.#wait();
    }
    throw new Error("GitHub did not report zero scoped resources within the bounded poll window.");
  }

  #wait(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.#pollIntervalMs));
  }

  #resourceId(run: WorkflowRun): string {
    return `github-actions:${String(run.id)}:${run.status ?? "unknown"}`;
  }

  #request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/vnd.github+json");
    headers.set("authorization", `Bearer ${this.#token}`);
    headers.set("content-type", "application/json");
    headers.set("x-github-api-version", apiVersion);
    return this.#fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers,
    });
  }
}
