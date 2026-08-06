import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  GovernedToolGateway,
  McpStdioToolProvider,
  PlaywrightBrowserToolProvider,
  SearxngSearchToolProvider,
  governedToolRequestDigest,
  type GovernedToolRequest,
  type ToolGrant,
} from "../packages/tool-gateway/src/index.js";

const now = new Date("2026-08-06T12:00:00.000Z");

function grant(tools: ToolGrant["tools"], overrides: Partial<ToolGrant> = {}): ToolGrant {
  return {
    grantId: "grant_connected-tools",
    subject: "iris-core",
    tools,
    targetPrefixes: ["research", "mcp"],
    allowedHosts: ["example.com"],
    allowedRepositories: [],
    maximumResponseBytes: 16_384,
    timeoutMs: 15_000,
    expiresAt: "2026-08-07T12:00:00.000Z",
    mayExpand: false,
    ...overrides,
  };
}

function authorize(request: Omit<GovernedToolRequest, "authorization">): GovernedToolRequest {
  return {
    ...request,
    authorization: {
      requestDigest: governedToolRequestDigest(request),
      tool: request.tool,
      target: request.target,
      approvedBy: "Founder",
      expiresAt: "2026-08-06T13:00:00.000Z",
    },
  };
}

describe("Cycle Six connected tool providers", () => {
  it("normalizes bounded results from the loopback search service", async () => {
    const provider = new SearxngSearchToolProvider("http://127.0.0.1:8888/search", () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            results: [
              {
                title: "Primary source",
                url: "https://example.com/source",
                content: "Evidence summary",
                engine: "unit-proof",
              },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const gateway = new GovernedToolGateway({
      providers: [provider],
      grants: [grant(["research.search"])],
      now: () => now,
    });
    const result = await gateway.execute({
      requestId: "request_88888888-8888-4888-8888-888888888888",
      subject: "iris-core",
      grantId: "grant_connected-tools",
      tool: "research.search",
      target: "research/searxng",
      arguments: { query: "governed systems", maximumResults: 3, language: "en" },
    });
    expect(JSON.parse(result.content)).toMatchObject({
      results: [{ title: "Primary source", url: "https://example.com/source" }],
    });
    expect(result.externalMutation).toBe(false);
  });

  it("denies an ungranted browser host before launching Chromium", async () => {
    const gateway = new GovernedToolGateway({
      providers: [new PlaywrightBrowserToolProvider()],
      grants: [grant(["browser.inspect"])],
      now: () => now,
    });
    await expect(
      gateway.execute({
        requestId: "request_99999999-9999-4999-8999-999999999999",
        subject: "iris-core",
        grantId: "grant_connected-tools",
        tool: "browser.inspect",
        target: "https://unlisted.example/",
        arguments: { mode: "text" },
      }),
    ).rejects.toThrow(/TARGET_DENIED/u);
  });

  it("calls one exact tool on an allowlisted local MCP stdio server", async () => {
    const fixture = join(
      process.cwd(),
      "packages",
      "tool-gateway",
      "test-fixtures",
      "mcp-ping-server.mjs",
    );
    const provider = new McpStdioToolProvider({
      proof: {
        command: process.execPath,
        args: [fixture],
        cwd: join(process.cwd(), "packages", "tool-gateway"),
      },
    });
    const gateway = new GovernedToolGateway({
      providers: [provider],
      grants: [grant(["mcp.call-tool"])],
      now: () => now,
    });
    const unsigned = {
      requestId: "request_aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      subject: "iris-core" as const,
      grantId: "grant_connected-tools",
      tool: "mcp.call-tool" as const,
      target: "mcp/proof/ping",
      arguments: { arguments: {} },
    };
    const result = await gateway.execute(authorize(unsigned));
    expect(result.content).toContain("pong");
    expect(result.effect).toBe("external-mutation");
  }, 15_000);
});
