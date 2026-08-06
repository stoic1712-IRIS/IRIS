import { z } from "zod";

import { canonicalIdSchema, sha256DigestSchema, timestampSchema } from "@stoic-iris/contracts";

export const governedToolNameSchema = z.enum([
  "filesystem.list",
  "filesystem.read",
  "filesystem.write",
  "process.run-exact",
  "network.fetch-https",
  "research.search",
  "browser.inspect",
  "browser.interact",
  "github.inspect",
  "github.push-branch",
  "github.create-pull-request",
  "github.merge-pull-request",
  "mcp.call-tool",
]);
export type GovernedToolName = z.infer<typeof governedToolNameSchema>;

export const toolEffectSchema = z.enum([
  "read-local",
  "read-network",
  "write-disposable",
  "external-mutation",
]);
export type ToolEffect = z.infer<typeof toolEffectSchema>;

export const toolAuthorizationSchema = z
  .object({
    requestDigest: sha256DigestSchema,
    tool: governedToolNameSchema,
    target: z.string().min(1).max(2_000),
    approvedBy: z.literal("Founder"),
    expiresAt: timestampSchema,
  })
  .strict();
export type ToolAuthorization = z.infer<typeof toolAuthorizationSchema>;

export const toolGrantSchema = z
  .object({
    grantId: z.string().regex(/^grant_[a-z0-9-]{8,100}$/u),
    subject: z.string().regex(/^(?:iris-core|worker_[a-z0-9-]{3,100})$/u),
    tools: z.array(governedToolNameSchema).min(1).max(30),
    targetPrefixes: z.array(z.string().min(1).max(2_000)).max(100),
    allowedHosts: z
      .array(
        z
          .string()
          .min(1)
          .max(253)
          .regex(
            /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/u,
          ),
      )
      .max(100),
    allowedRepositories: z.array(z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u)).max(50),
    maximumResponseBytes: z.number().int().min(1).max(1_048_576),
    timeoutMs: z.number().int().min(10).max(300_000),
    expiresAt: timestampSchema,
    mayExpand: z.literal(false),
  })
  .strict();
export type ToolGrant = z.infer<typeof toolGrantSchema>;

export const governedToolRequestSchema = z
  .object({
    requestId: canonicalIdSchema.refine((value) => value.startsWith("request_")),
    subject: z.string().regex(/^(?:iris-core|worker_[a-z0-9-]{3,100})$/u),
    grantId: z.string().regex(/^grant_[a-z0-9-]{8,100}$/u),
    tool: governedToolNameSchema,
    target: z.string().min(1).max(2_000),
    arguments: z.record(z.string(), z.unknown()),
    authorization: toolAuthorizationSchema.optional(),
  })
  .strict();
export type GovernedToolRequest = z.infer<typeof governedToolRequestSchema>;

export const toolProviderResultSchema = z
  .object({
    status: z.enum(["succeeded", "failed"]),
    safeSummary: z.string().min(1).max(1_000),
    content: z.string().max(1_048_576),
    contentType: z.string().min(1).max(200),
    bytes: z.number().int().nonnegative().max(1_048_576),
    externalMutation: z.boolean(),
  })
  .strict();
export type ToolProviderResult = z.infer<typeof toolProviderResultSchema>;

export const governedToolResultSchema = toolProviderResultSchema.extend({
  requestId: canonicalIdSchema,
  tool: governedToolNameSchema,
  provider: z.string().min(1).max(200),
  effect: toolEffectSchema,
  auditDigest: sha256DigestSchema,
});
export type GovernedToolResult = z.infer<typeof governedToolResultSchema>;

export interface ToolProvider {
  readonly name: string;
  readonly tools: readonly GovernedToolName[];
  execute(
    request: GovernedToolRequest,
    grant: ToolGrant,
    signal: AbortSignal,
  ): Promise<ToolProviderResult>;
}

export const toolEffects: Readonly<Record<GovernedToolName, ToolEffect>> = {
  "filesystem.list": "read-local",
  "filesystem.read": "read-local",
  "filesystem.write": "write-disposable",
  "process.run-exact": "write-disposable",
  "network.fetch-https": "read-network",
  "research.search": "read-network",
  "browser.inspect": "read-network",
  "browser.interact": "external-mutation",
  "github.inspect": "read-network",
  "github.push-branch": "external-mutation",
  "github.create-pull-request": "external-mutation",
  "github.merge-pull-request": "external-mutation",
  "mcp.call-tool": "external-mutation",
};
