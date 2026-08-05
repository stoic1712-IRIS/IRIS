import { readFile } from "node:fs/promises";

import {
  developmentApprovalSchema,
  developmentProposalSchema,
  GitDevelopmentAdapter,
  GitHubActionsResourceProvider,
  proposalDigest,
  SovereignDevelopmentRuntime,
} from "../../packages/development/dist/index.js";

const [proposalPath, approvalPath] = process.argv.slice(2);
if (proposalPath === undefined || approvalPath === undefined)
  throw new Error("Usage: node iris-execute-approved-upgrade.mjs <proposal.json> <approval.json>");
const proposal = developmentProposalSchema.parse(JSON.parse(await readFile(proposalPath, "utf8")));
const approval = developmentApprovalSchema.parse(JSON.parse(await readFile(approvalPath, "utf8")));
const token = process.env.IRIS_GITHUB_TOKEN;
if (token === undefined || token.trim() === "")
  throw new Error("IRIS_GITHUB_TOKEN is required for provider-authoritative graduation.");
const [owner, repository] = proposal.canonicalRepository.split("/");
if (owner === undefined || repository === undefined)
  throw new Error("Canonical GitHub repository must use owner/name form.");
const scope = `${proposal.proposalId}-${proposalDigest(proposal).slice(7, 19)}`;
const paidResourceProvider = new GitHubActionsResourceProvider({
  owner,
  repository,
  workflowId: "wave-10-resource-proof.yml",
  ref: "main",
  scope,
  token,
});
const adapter = new GitDevelopmentAdapter({
  canonicalPath: process.cwd(),
  paidResourceProvider,
});
const result = await new SovereignDevelopmentRuntime(adapter).execute(proposal, approval);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (result.status !== "succeeded") process.exitCode = 1;
