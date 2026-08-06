import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "iris-test-server", version: "0.0.0" });
server.registerTool(
  "ping",
  {
    description: "Returns a bounded local proof.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  () => Promise.resolve({ content: [{ type: "text", text: "pong" }] }),
);

await server.connect(new StdioServerTransport());
