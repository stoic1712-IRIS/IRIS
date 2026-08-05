import { describe, expect, it } from "vitest";

import { GitHubActionsResourceProvider } from "../packages/development/src/index.js";

describe("Wave 10 GitHub Actions resource provider", () => {
  it("dispatches, discovers, cancels, and verifies zero scoped provider resources", async () => {
    const requests: { url: string; init: RequestInit | undefined }[] = [];
    const responses = [
      new Response(JSON.stringify({ workflow_run_id: 8123 }), { status: 200 }),
      new Response(
        JSON.stringify({
          workflow_runs: [
            {
              id: 8123,
              status: "in_progress",
              display_title: "IRIS provider proof proposal-proof-abc123",
            },
          ],
        }),
        { status: 200 },
      ),
      new Response(null, { status: 202 }),
      new Response(JSON.stringify({ workflow_runs: [] }), { status: 200 }),
      new Response(JSON.stringify({ workflow_runs: [] }), { status: 200 }),
    ];
    const fetchMock: typeof fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      requests.push({ url, init });
      const response = responses.shift();
      if (response === undefined) throw new Error("Unexpected GitHub request.");
      return Promise.resolve(response);
    };
    const provider = new GitHubActionsResourceProvider({
      owner: "stoic1712-IRIS",
      repository: "IRIS",
      workflowId: "wave-10-resource-proof.yml",
      ref: "main",
      scope: "proposal-proof-abc123",
      token: "secret-test-token",
      fetch: fetchMock,
      pollIntervalMs: 0,
      maxPollAttempts: 2,
    });

    expect(await provider.provision()).toEqual(["github-actions:8123:dispatched"]);
    expect(await provider.terminate()).toEqual(["github-actions:8123:in_progress"]);
    expect(await provider.list()).toEqual([]);
    expect(requests.map(({ url }) => url)).toEqual([
      "https://api.github.com/repos/stoic1712-IRIS/IRIS/actions/workflows/wave-10-resource-proof.yml/dispatches",
      "https://api.github.com/repos/stoic1712-IRIS/IRIS/actions/runs?event=workflow_dispatch&branch=main&per_page=100",
      "https://api.github.com/repos/stoic1712-IRIS/IRIS/actions/runs/8123/cancel",
      "https://api.github.com/repos/stoic1712-IRIS/IRIS/actions/runs?event=workflow_dispatch&branch=main&per_page=100",
      "https://api.github.com/repos/stoic1712-IRIS/IRIS/actions/runs?event=workflow_dispatch&branch=main&per_page=100",
    ]);
    const headers = new Headers(requests.at(0)?.init?.headers);
    expect(headers.get("authorization")).toBe("Bearer secret-test-token");
    expect(headers.get("x-github-api-version")).toBe("2026-03-10");
  });

  it("fails closed without an authenticated provider token", () => {
    expect(
      () =>
        new GitHubActionsResourceProvider({
          owner: "stoic1712-IRIS",
          repository: "IRIS",
          workflowId: "wave-10-resource-proof.yml",
          ref: "main",
          scope: "proposal-proof-abc123",
          token: "",
        }),
    ).toThrow(/token is required/i);
  });
});
