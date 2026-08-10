import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  attachControllerProjection,
  ModelGatewayError,
  OllamaAdapter,
  type ModelGatewayRequest,
} from "../packages/model-gateway/src/index.js";

const outputValidator = z
  .object({
    status: z.literal("ready"),
    explanation: z.string().min(1),
  })
  .strict();
const outputSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["ready"] },
    explanation: { type: "string" },
  },
  required: ["status", "explanation"],
  additionalProperties: false,
};
const request: ModelGatewayRequest = {
  requestId: "request_01936f3a-8b5c-7def-8abc-0123456789ab",
  model: "qwen3:8b",
  messages: [{ role: "user", content: "Return a structured readiness result." }],
  outputSchema,
  temperature: 0,
  seed: 0,
  contextTokens: 4096,
  timeoutMs: 5_000,
  keepAlive: 0,
};

function providerResponse(content: string, model = "qwen3:8b"): Response {
  return Response.json({
    model,
    created_at: "2026-08-04T21:30:00-06:00",
    message: { role: "assistant", content },
    done: true,
    done_reason: "stop",
    total_duration: 100,
    load_duration: 10,
    prompt_eval_count: 12,
    eval_count: 8,
  });
}

describe("Ollama model gateway adapter", () => {
  it("sends a deterministic local request and returns validated structured output", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        providerResponse('{"status":"ready","explanation":"Local runtime passed."}'),
      );
    const adapter = new OllamaAdapter({ fetchImplementation });
    const result = await adapter.invoke(request, outputValidator);

    expect(result.output).toEqual({ status: "ready", explanation: "Local runtime passed." });
    expect(result.modelAuthority).toBe("none");
    expect(result.usage).toMatchObject({ inputTokens: 12, outputTokens: 8 });
    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [url, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:11434/api/chat");
    if (typeof init?.body !== "string") throw new Error("Expected a serialized request body.");
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "qwen3:8b",
      stream: false,
      think: false,
      format: outputSchema,
      keep_alive: 0,
      options: { temperature: 0, seed: 0, num_ctx: 4096 },
    });
  });

  it("attaches a controller decision only after provider output is validated", async () => {
    const adapter = new OllamaAdapter({
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          providerResponse('{"status":"ready","explanation":"Local runtime passed."}'),
        ),
    });
    const providerResult = await adapter.invoke(request, outputValidator);
    const controlled = attachControllerProjection(providerResult, {
      decision: "execute-now",
      activeGrantId: "access_contract-test",
    });

    expect(providerResult).not.toHaveProperty("controller");
    expect(controlled.modelAuthority).toBe("none");
    expect(controlled.controller).toEqual({
      decision: "execute-now",
      executable: true,
      activeGrantId: "access_contract-test",
    });
  });

  it("rejects malformed JSON and structured output that fails its schema", async () => {
    const malformed = new OllamaAdapter({
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(providerResponse("not-json")),
    });
    await expect(malformed.invoke(request, outputValidator)).rejects.toMatchObject({
      code: "INVALID_STRUCTURED_OUTPUT",
    });

    const wrongShape = new OllamaAdapter({
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockResolvedValue(providerResponse('{"status":"wrong","explanation":"No."}')),
    });
    await expect(wrongShape.invoke(request, outputValidator)).rejects.toMatchObject({
      code: "INVALID_STRUCTURED_OUTPUT",
    });
  });

  it("rejects model mismatch and provider errors using safe normalized details", async () => {
    const mismatch = new OllamaAdapter({
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          providerResponse('{"status":"ready","explanation":"Wrong model."}', "other:latest"),
        ),
    });
    await expect(mismatch.invoke(request, outputValidator)).rejects.toMatchObject({
      code: "MODEL_MISMATCH",
    });

    const rejected = new OllamaAdapter({
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ error: "private provider detail" }, { status: 500 })),
    });
    await expect(rejected.invoke(request, outputValidator)).rejects.toMatchObject({
      code: "PROVIDER_REJECTED",
      retryable: true,
      safeDetails: { status: 500 },
    });
  });

  it("blocks secret-like content before transport", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const adapter = new OllamaAdapter({ fetchImplementation });
    const secretRequest = {
      ...request,
      messages: [{ role: "user" as const, content: `api_key=${"a".repeat(24)}` }],
    };
    await expect(adapter.invoke(secretRequest, outputValidator)).rejects.toMatchObject({
      code: "SECRET_DETECTED",
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("normalizes timeout and cancellation without leaking the cause", async () => {
    const fetchImplementation = vi.fn<typeof fetch>((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            reject(new Error("aborted"));
          },
          { once: true },
        );
      });
    });
    const adapter = new OllamaAdapter({ fetchImplementation });
    const controller = new AbortController();
    const pending = adapter.invoke(request, outputValidator, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT", retryable: true });
  });

  it("rejects non-local provider endpoints", () => {
    expect(() => new OllamaAdapter({ baseUrl: "https://example.com" })).toThrow();
  });

  it("uses typed errors for gateway failures", () => {
    const error = new ModelGatewayError("PROVIDER_UNAVAILABLE", "Unavailable.", true);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("PROVIDER_UNAVAILABLE");
  });
});
