export interface SovereignDevelopmentSelfDescription {
  readonly name: "STOIC-IRIS";
  readonly runtime: "sovereign-development-runtime";
  readonly capabilities: readonly string[];
  readonly graduationEvidenceComplete: false;
}

export function getSovereignDevelopmentSelfDescription(): SovereignDevelopmentSelfDescription {
  const capabilities = Object.freeze([
    "exact-bounded-proposal",
    "typed-founder-approval",
    "disposable-git-workspace",
    "allowed-path-enforcement",
    "governed-command-execution",
    "multi-file-editing",
    "tests-and-builds",
    "independent-verification",
    "repair-and-reapproval",
    "private-checkpoint",
    "remote-equality-verification",
    "history-preserving-rollback",
    "workspace-cleanup",
    "paid-resource-termination",
    "provider-authoritative-zero-verification",
  ]);
  return Object.freeze({
    name: "STOIC-IRIS",
    runtime: "sovereign-development-runtime",
    capabilities,
    graduationEvidenceComplete: false,
  });
}
