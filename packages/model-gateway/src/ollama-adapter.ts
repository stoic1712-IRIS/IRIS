import { z } from "zod";

import {
  modelGatewayRequestSchema,
  modelGatewayResponseSchema,
  type ModelGatewayRequest,
  type ModelRuntimeAdapter,
  type StructuredOutputValidator,
} from "./contracts.js";
import { ModelGatewayError } from "./errors.js";
import { assertNoDetectedSecrets } from "./secret-filter.js";

const ollamaResponseSchema = z.looseObject({
  model: z.string().min(1),
  created_at: z.iso.datetime({ offset: true }),
  message: z.looseObject({
    role: z.literal("assistant"),
    content: z.string(),
  }),
  done: z.literal(true),
  done_reason: z.string().min(1).default("stop"),
  total_duration: z.number().int().nonnegative().default(0),
  load_duration: z.number().int().nonnegative().default(0),
  prompt_eval_count: z.number().int().nonnegative().default(0),
  eval_count: z.number().int().nonnegative().default(0),
});

const localOllamaUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}, "The initial Ollama adapter permits only a local HTTP endpoint.");

export interface OllamaAdapterOptions {
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
}

export class OllamaAdapter implements ModelRuntimeAdapter {
  readonly provider = "ollama";
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: OllamaAdapterOptions = {}) {
    this.#baseUrl = localOllamaUrlSchema.parse(options.baseUrl ?? "http://localhost:11434");
    this.#fetch = options.fetchImplementation ?? globalThis.fetch;
  }

  async invoke<Output>(
    candidate: ModelGatewayRequest,
    outputValidator: StructuredOutputValidator<Output>,
    signal?: AbortSignal,
  ): Promise<ReturnType<typeof modelGatewayResponseSchema.parse> & { output: Output }> {
    const request = modelGatewayRequestSchema.parse(candidate);
    assertNoDetectedSecrets(request.messages);
    const timeoutSignal = AbortSignal.timeout(request.timeoutMs);
    const combinedSignal =
      signal === undefined ? timeoutSignal : AbortSignal.any([signal, timeoutSignal]);

    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: false,
          think: false,
          format: request.outputSchema,
          keep_alive: request.keepAlive,
          options: {
            temperature: request.temperature,
            seed: request.seed,
            num_ctx: request.contextTokens,
          },
        }),
        signal: combinedSignal,
      });
    } catch {
      if (combinedSignal.aborted) {
        throw new ModelGatewayError(
          "PROVIDER_TIMEOUT",
          "The model request was cancelled or timed out.",
          true,
          {
            provider: this.provider,
            model: request.model,
          },
        );
      }
      throw new ModelGatewayError(
        "PROVIDER_UNAVAILABLE",
        "The local model provider is unavailable.",
        true,
        {
          provider: this.provider,
          model: request.model,
        },
      );
    }

    if (!response.ok) {
      throw new ModelGatewayError(
        "PROVIDER_REJECTED",
        "The model provider rejected the request.",
        response.status >= 500,
        {
          provider: this.provider,
          model: request.model,
          status: response.status,
        },
      );
    }

    let providerOutput: z.infer<typeof ollamaResponseSchema>;
    try {
      providerOutput = ollamaResponseSchema.parse(await response.json());
    } catch {
      throw new ModelGatewayError(
        "INVALID_PROVIDER_RESPONSE",
        "The model provider returned an invalid response envelope.",
        false,
        {
          provider: this.provider,
          model: request.model,
        },
      );
    }
    if (providerOutput.model !== request.model) {
      throw new ModelGatewayError(
        "MODEL_MISMATCH",
        "The provider response model does not match the requested model.",
        false,
        {
          requestedModel: request.model,
          responseModel: providerOutput.model,
        },
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(providerOutput.message.content) as unknown;
    } catch {
      throw new ModelGatewayError(
        "INVALID_STRUCTURED_OUTPUT",
        "The model response is not valid JSON.",
        false,
        {
          provider: this.provider,
          model: request.model,
        },
      );
    }

    const validatedOutput = outputValidator.safeParse(parsedJson);
    if (!validatedOutput.success) {
      throw new ModelGatewayError(
        "INVALID_STRUCTURED_OUTPUT",
        "The model response does not satisfy the required schema.",
        false,
        {
          provider: this.provider,
          model: request.model,
        },
      );
    }

    return {
      ...modelGatewayResponseSchema.parse({
        requestId: request.requestId,
        provider: this.provider,
        model: providerOutput.model,
        createdAt: providerOutput.created_at,
        output: validatedOutput.data,
        usage: {
          inputTokens: providerOutput.prompt_eval_count,
          outputTokens: providerOutput.eval_count,
          totalDurationNanoseconds: providerOutput.total_duration,
          loadDurationNanoseconds: providerOutput.load_duration,
        },
        doneReason: providerOutput.done_reason,
        authority: "none",
      }),
      output: validatedOutput.data,
    };
  }
}
