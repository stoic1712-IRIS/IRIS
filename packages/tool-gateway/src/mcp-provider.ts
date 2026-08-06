import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";

import type {
  GovernedToolRequest,
  ToolGrant,
  ToolProvider,
  ToolProviderResult,
} from "./contracts.js";

export interface McpServerCommand {
  command: string;
  args: string[];
  cwd: string;
}

const argumentsSchema = z.object({ arguments: z.record(z.string(), z.unknown()) }).strict();
const segmentSchema = z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/u);

export class McpStdioToolProvider implements ToolProvider {
  readonly name = "iris-mcp-stdio-client";
  readonly tools = ["mcp.call-tool"] as const;
  readonly #servers: ReadonlyMap<string, McpServerCommand>;

  constructor(servers: Record<string, McpServerCommand>) {
    this.#servers = new Map(
      Object.entries(servers).map(([id, command]) => [segmentSchema.parse(id), command]),
    );
  }

  async execute(
    request: GovernedToolRequest,
    grant: ToolGrant,
    signal: AbortSignal,
  ): Promise<ToolProviderResult> {
    const [prefix, serverId, toolName, ...extra] = request.target.split("/");
    if (prefix !== "mcp" || extra.length !== 0) throw new Error("MCP_TARGET_INVALID");
    const server = this.#servers.get(segmentSchema.parse(serverId));
    const tool = segmentSchema.parse(toolName);
    if (server === undefined) throw new Error("MCP_SERVER_DENIED");
    const input = argumentsSchema.parse(request.arguments);
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args,
      cwd: server.cwd,
      env: { PATH: process.env.PATH ?? "" },
      stderr: "pipe",
      maxBufferSize: grant.maximumResponseBytes,
    });
    const client = new Client({ name: "stoic-iris", version: "0.0.0" }, { capabilities: {} });
    const abort = (): void => {
      void transport.close();
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      await client.connect(transport);
      const listed = await client.listTools();
      if (!listed.tools.some((candidate) => candidate.name === tool))
        throw new Error("MCP_TOOL_DENIED");
      const result = await client.callTool({ name: tool, arguments: input.arguments });
      const content = JSON.stringify(result);
      if (Buffer.byteLength(content) > grant.maximumResponseBytes)
        throw new Error("MCP_RESPONSE_OVERSIZED");
      return {
        status: result.isError === true ? "failed" : "succeeded",
        safeSummary: "Called one exact tool on one allowlisted local MCP server.",
        content,
        contentType: "application/json",
        bytes: Buffer.byteLength(content),
        externalMutation: true,
      };
    } finally {
      signal.removeEventListener("abort", abort);
      await client.close();
    }
  }
}
