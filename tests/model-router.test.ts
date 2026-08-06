import { describe, expect, it } from "vitest";

import { routeIrisModel } from "../packages/model-gateway/src/index.js";

const allModels = new Set(["qwen3:8b", "qwen3.6:27b", "gpt-oss:20b", "qwen3-coder:30b"]);

describe("IRIS governed model router", () => {
  it("routes conversation, reasoning, research, coding, vision, and fast responses", () => {
    expect(
      routeIrisModel({ utterance: "How are you today?", availableModels: allModels }),
    ).toMatchObject({
      model: "qwen3.6:27b",
      purpose: "conversation",
      independentReviewModel: null,
    });
    expect(
      routeIrisModel({
        utterance: "Analyze the security trade-offs deeply.",
        availableModels: allModels,
      }),
    ).toMatchObject({
      model: "gpt-oss:20b",
      purpose: "deep-reasoning",
      independentReviewModel: "qwen3.6:27b",
    });
    expect(
      routeIrisModel({
        utterance: "Research and compare the evidence sources.",
        availableModels: allModels,
      }),
    ).toMatchObject({
      model: "gpt-oss:20b",
      purpose: "research-review",
    });
    expect(
      routeIrisModel({
        utterance: "Refactor this TypeScript repository and run the test suite.",
        availableModels: allModels,
      }),
    ).toMatchObject({
      model: "qwen3-coder:30b",
      purpose: "agentic-coding",
      independentReviewModel: "gpt-oss:20b",
    });
    expect(
      routeIrisModel({
        utterance: "What is shown in this image?",
        availableModels: allModels,
        hasImage: true,
      }),
    ).toMatchObject({
      model: "qwen3.6:27b",
      purpose: "vision",
    });
    expect(
      routeIrisModel({ utterance: "Give me a quick short answer.", availableModels: allModels }),
    ).toMatchObject({
      model: "qwen3:8b",
      purpose: "fast-response",
    });
  });

  it("honors an allowlisted Founder model override without changing authority", () => {
    expect(
      routeIrisModel({ utterance: "Use GPT OSS for this decision.", availableModels: allModels }),
    ).toMatchObject({
      model: "gpt-oss:20b",
      explicitOverride: true,
      fallbackUsed: false,
    });
  });

  it("falls back only through approved local models and selects a distinct reviewer", () => {
    const route = routeIrisModel({
      utterance: "Debug this API implementation.",
      availableModels: new Set(["qwen3.6:27b", "qwen3:8b"]),
    });
    expect(route).toMatchObject({
      model: "qwen3.6:27b",
      fallbackUsed: true,
      independentReviewModel: "qwen3:8b",
    });
    expect(route.reason).toMatch(/unavailable/u);
  });

  it("fails closed when no approved local model is available", () => {
    expect(() =>
      routeIrisModel({ utterance: "Hello", availableModels: new Set(["unknown:model"]) }),
    ).toThrow("NO_APPROVED_LOCAL_MODEL_AVAILABLE");
  });
});
