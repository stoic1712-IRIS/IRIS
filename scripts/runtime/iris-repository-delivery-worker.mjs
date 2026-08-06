/* global Buffer, process */
import {
  createRepositoryDeliveryProposal,
  repositoryDeliveryProposalSchema,
  repositoryDeliveryResultSchema,
} from "../../packages/kernel/dist/repository-delivery.js";

let body = "";
for await (const chunk of process.stdin) {
  body += chunk.toString("utf8");
  if (Buffer.byteLength(body) > 768 * 1024) throw new Error("INPUT_OVERSIZED");
}

const input = JSON.parse(body);
if (input?.mode === "propose") {
  process.stdout.write(JSON.stringify(createRepositoryDeliveryProposal(input.input)));
} else if (input?.mode === "validate-result") {
  process.stdout.write(JSON.stringify(repositoryDeliveryResultSchema.parse(input.result)));
} else {
  repositoryDeliveryProposalSchema.parse(input?.proposal);
  throw new Error("PROVIDER_EXECUTION_REQUIRES_EPHEMERAL_CREDENTIAL_BOUNDARY");
}
