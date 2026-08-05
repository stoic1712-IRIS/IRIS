import type { ModelMessage } from "./contracts.js";
import { ModelGatewayError } from "./errors.js";

const secretPatterns: readonly { name: string; pattern: RegExp }[] = [
  { name: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
  { name: "github-token", pattern: /\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}\b/ },
  { name: "openai-key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  {
    name: "credential-assignment",
    pattern:
      /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?[A-Za-z0-9_./+\-=]{12,}/i,
  },
];

export function assertNoDetectedSecrets(messages: ModelMessage[]): void {
  for (const message of messages) {
    for (const secret of secretPatterns) {
      if (secret.pattern.test(message.content)) {
        throw new ModelGatewayError(
          "SECRET_DETECTED",
          "Model request was blocked because it contains secret-like material.",
          false,
          { detector: secret.name },
        );
      }
    }
  }
}
