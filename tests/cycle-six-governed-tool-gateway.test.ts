import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  GovernedToolGateway,
  GithubToolProvider,
  HttpsFetchToolProvider,
  LocalFilesystemToolProvider,
  governedToolRequestDigest,
  type GovernedToolRequest,
  type ToolGrant,
} from "../packages/tool-gateway/src/index.js";

const now = new Date("2026-08-06T12:00:00.000Z");
const requestId = "request_11111111-1111-4111-8111-111111111111";

function grant(overrides: Partial<ToolGrant> = {}): ToolGrant {
  return {
    grantId: "grant_cycle-six",
    subject: "iris-core",
    tools: [
      "filesystem.list",
      "filesystem.read",
      "filesystem.write",
      "network.fetch-https",
      "github.inspect",
      "github.push-branch",
    ],
    targetPrefixes: ["workspace", "command"],
    allowedHosts: ["example.com"],
    allowedRepositories: ["stoic1712-IRIS/IRIS"],
    maximumResponseBytes: 4_096,
    timeoutMs: 5_000,
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

describe("Cycle Six governed tool gateway", () => {
  it("reads only inside an allowed filesystem root and preserves an audit chain", async () => {
    const root = await mkdtemp(join(tmpdir(), "iris-tool-gateway-"));
    await mkdir(join(root, "docs"));
    await writeFile(join(root, "docs", "proof.txt"), "bounded proof", "utf8");
    const gateway = new GovernedToolGateway({
      providers: [new LocalFilesystemToolProvider({ workspace: { path: root, writable: false } })],
      grants: [grant()],
      now: () => now,
    });
    const result = await gateway.execute({
      requestId,
      subject: "iris-core",
      grantId: "grant_cycle-six",
      tool: "filesystem.read",
      target: "workspace/docs/proof.txt",
      arguments: {},
    });
    expect(result.content).toBe("bounded proof");
    expect(result.effect).toBe("read-local");
    expect(gateway.verifyAudit()).toBe(true);
  });

  it("requires digest-bound Founder authority for a disposable write", async () => {
    const root = await mkdtemp(join(tmpdir(), "iris-tool-write-"));
    await mkdir(join(root, "out"));
    const provider = new LocalFilesystemToolProvider({ workspace: { path: root, writable: true } });
    const unsigned = {
      requestId,
      subject: "iris-core" as const,
      grantId: "grant_cycle-six",
      tool: "filesystem.write" as const,
      target: "workspace/out/candidate.txt",
      arguments: { content: "candidate", overwrite: false },
    };
    const denied = new GovernedToolGateway({
      providers: [provider],
      grants: [grant()],
      now: () => now,
    });
    await expect(denied.execute(unsigned)).rejects.toThrow(/AUTHORIZATION_DENIED/u);
    const allowed = new GovernedToolGateway({
      providers: [provider],
      grants: [grant()],
      now: () => now,
    });
    await allowed.execute(authorize(unsigned));
    await expect(readFile(join(root, "out", "candidate.txt"), "utf8")).resolves.toBe("candidate");
  });

  it("performs only bounded HTTPS GETs to granted hosts", async () => {
    const provider = new HttpsFetchToolProvider(() =>
      Promise.resolve(
        new Response("research evidence", { headers: { "content-type": "text/plain" } }),
      ),
    );
    const gateway = new GovernedToolGateway({
      providers: [provider],
      grants: [grant()],
      now: () => now,
    });
    const result = await gateway.execute({
      requestId,
      subject: "iris-core",
      grantId: "grant_cycle-six",
      tool: "network.fetch-https",
      target: "https://example.com/evidence",
      arguments: {},
    });
    expect(result.content).toBe("research evidence");
    await expect(
      gateway.execute({
        requestId: "request_22222222-2222-4222-8222-222222222222",
        subject: "iris-core",
        grantId: "grant_cycle-six",
        tool: "network.fetch-https",
        target: "https://unlisted.example/evidence",
        arguments: {},
      }),
    ).rejects.toThrow(/TARGET_DENIED/u);
    const oversized = new GovernedToolGateway({
      providers: [
        new HttpsFetchToolProvider(() => Promise.resolve(new Response("x".repeat(4_097)))),
      ],
      grants: [grant()],
      now: () => now,
    });
    await expect(
      oversized.execute({
        requestId: "request_77777777-7777-4777-8777-777777777777",
        subject: "iris-core",
        grantId: "grant_cycle-six",
        tool: "network.fetch-https",
        target: "https://example.com/oversized",
        arguments: {},
      }),
    ).rejects.toThrow(/RESPONSE_OVERSIZED/u);
  });

  it("adapts exact GitHub reads and digest-bound pushes without force", async () => {
    const calls: unknown[] = [];
    const provider = new GithubToolProvider({
      inspectRepository: (repository) => ({
        repository,
        visibility: "PRIVATE",
        defaultBranch: "main",
      }),
      push: (input) => {
        calls.push(input);
        return Promise.resolve({ remoteCommit: input.commit });
      },
      createPullRequest: () => Promise.reject(new Error("unused")),
      mergePullRequest: () => Promise.reject(new Error("unused")),
    });
    const gateway = new GovernedToolGateway({
      providers: [provider],
      grants: [grant()],
      now: () => now,
    });
    const inspection = await gateway.execute({
      requestId,
      subject: "iris-core",
      grantId: "grant_cycle-six",
      tool: "github.inspect",
      target: "stoic1712-IRIS/IRIS",
      arguments: {},
    });
    expect(inspection.content).toContain("PRIVATE");
    const commit = "a".repeat(40);
    const push = {
      requestId: "request_33333333-3333-4333-8333-333333333333",
      subject: "iris-core" as const,
      grantId: "grant_cycle-six",
      tool: "github.push-branch" as const,
      target: "stoic1712-IRIS/IRIS/iris/cycle-six-proof",
      arguments: { commit },
    };
    await gateway.execute(authorize(push));
    expect(calls).toMatchObject([{ force: false, ref: "iris/cycle-six-proof", commit }]);
  });

  it("denies secrets, expired grants, and mismatched authorization digests", async () => {
    const provider = new HttpsFetchToolProvider(() =>
      Promise.resolve(new Response("never reached")),
    );
    const expired = new GovernedToolGateway({
      providers: [provider],
      grants: [grant({ expiresAt: "2026-08-05T12:00:00.000Z" })],
      now: () => now,
    });
    await expect(
      expired.execute({
        requestId,
        subject: "iris-core",
        grantId: "grant_cycle-six",
        tool: "network.fetch-https",
        target: "https://example.com",
        arguments: {},
      }),
    ).rejects.toThrow(/GRANT_EXPIRED/u);
    const secret = new GovernedToolGateway({
      providers: [provider],
      grants: [grant()],
      now: () => now,
    });
    await expect(
      secret.execute({
        requestId,
        subject: "iris-core",
        grantId: "grant_cycle-six",
        tool: "network.fetch-https",
        target: "https://example.com",
        arguments: { token: `github_pat_${"a".repeat(30)}` },
      }),
    ).rejects.toThrow(/SECRET_INPUT_DENIED/u);
  });
});
