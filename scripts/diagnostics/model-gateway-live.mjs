import { z } from "zod";

import { OllamaAdapter } from "../../packages/model-gateway/dist/index.js";

const outputValidator = z
  .object({
    status: z.literal("ready"),
    model: z.literal("qwen3:8b"),
    authority: z.literal("none"),
  })
  .strict();

const outputSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["ready"] },
    model: { type: "string", enum: ["qwen3:8b"] },
    authority: { type: "string", enum: ["none"] },
  },
  required: ["status", "model", "authority"],
  additionalProperties: false,
};

const adapter = new OllamaAdapter();
const response = await adapter.invoke(
  {
    requestId: "request_01936f3a-8b5c-7def-8abc-0123456789ab",
    model: "qwen3:8b",
    messages: [
      {
        role: "system",
        content: "Return only the required structured fields. You possess no standing authority.",
      },
      {
        role: "user",
        content: 'Return status "ready", model "qwen3:8b", and authority "none".',
      },
    ],
    outputSchema,
    temperature: 0,
    seed: 0,
    contextTokens: 4096,
    timeoutMs: 120_000,
    keepAlive: 0,
  },
  outputValidator,
);

console.log(
  JSON.stringify(
    {
      provider: response.provider,
      model: response.model,
      output: response.output,
      authority: response.authority,
      usage: response.usage,
      doneReason: response.doneReason,
    },
    null,
    2,
  ),
);
