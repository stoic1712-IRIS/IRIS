import { readFile } from "node:fs/promises";

import {
  developmentApprovalSchema,
  developmentProposalSchema,
  GitDevelopmentAdapter,
  SovereignDevelopmentRuntime,
} from "../../packages/development/dist/index.js";

const [proposalPath, approvalPath] = process.argv.slice(2);
if (proposalPath === undefined || approvalPath === undefined)
  throw new Error("Usage: node iris-execute-approved-upgrade.mjs <proposal.json> <approval.json>");
const proposal = developmentProposalSchema.parse(JSON.parse(await readFile(proposalPath, "utf8")));
const approval = developmentApprovalSchema.parse(JSON.parse(await readFile(approvalPath, "utf8")));
const adapter = new GitDevelopmentAdapter({ canonicalPath: process.cwd() });
const result = await new SovereignDevelopmentRuntime(adapter).execute(proposal, approval);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (result.status !== "succeeded") process.exitCode = 1;
