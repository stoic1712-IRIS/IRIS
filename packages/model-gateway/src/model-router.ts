import { z } from "zod";

export const irisModelNameSchema = z.enum([
  "qwen3:8b",
  "qwen3.6:27b",
  "gpt-oss:20b",
  "qwen3-coder:30b",
]);
export type IrisModelName = z.infer<typeof irisModelNameSchema>;

export const modelRoutePurposeSchema = z.enum([
  "fast-response",
  "conversation",
  "deep-reasoning",
  "research-review",
  "vision",
  "agentic-coding",
]);
export type ModelRoutePurpose = z.infer<typeof modelRoutePurposeSchema>;

export const modelRouteSchema = z
  .object({
    model: irisModelNameSchema,
    purpose: modelRoutePurposeSchema,
    reason: z.string().min(1).max(300),
    explicitOverride: z.boolean(),
    fallbackUsed: z.boolean(),
    independentReviewModel: irisModelNameSchema.nullable(),
  })
  .strict();
export type ModelRoute = z.infer<typeof modelRouteSchema>;

export interface ModelRoutingRequest {
  utterance: string;
  availableModels: ReadonlySet<string>;
  hasImage?: boolean;
}

const overridePatterns: readonly (readonly [RegExp, IrisModelName])[] = [
  [/\b(?:use|with|ask)\s+(?:the\s+)?(?:model\s+)?gpt[- ]?oss(?:[: ]20b)?\b/iu, "gpt-oss:20b"],
  [
    /\b(?:use|with|ask)\s+(?:the\s+)?(?:model\s+)?qwen\s*3(?:\.|\s*)6(?:[: ]27b)?\b/iu,
    "qwen3.6:27b",
  ],
  [
    /\b(?:use|with|ask)\s+(?:the\s+)?(?:model\s+)?qwen\s*3[- ]?coder(?:[: ]30b)?\b/iu,
    "qwen3-coder:30b",
  ],
  [/\b(?:use|with|ask)\s+(?:the\s+)?(?:fast\s+model|qwen\s*3(?:[: ]8b))\b/iu, "qwen3:8b"],
];

const codingPattern =
  /\b(code|coding|program|repository|repo|refactor|debug|bug|typescript|javascript|python|rust|function|class|api|database|sql|test suite|pull request|implementation|website|frontend|backend|compile|build error|git|worktree|working tree|branch|commit|revision|head sha|checkout|rebase|merge conflict|untracked|staged)\b/iu;
const researchPattern =
  /\b(research|sources?|citations?|evidence|fact[- ]?check|verify|audit|review|compare|comparison|investigate)\b/iu;
const reasoningPattern =
  /\b(reason|reasoning|analy[sz]e|strategy|plan|architecture|trade[- ]?offs?|diagnose|root cause|security|risk|decide|decision|best approach|step by step|think deeply|complex)\b/iu;
const fastPattern = /\b(quick|quickly|brief|briefly|short answer|simple answer|fast)\b/iu;

function requestedOverride(utterance: string): IrisModelName | null {
  for (const [pattern, model] of overridePatterns) if (pattern.test(utterance)) return model;
  return null;
}

function intendedRoute(request: ModelRoutingRequest): {
  model: IrisModelName;
  purpose: ModelRoutePurpose;
  reason: string;
  explicitOverride: boolean;
} {
  const override = requestedOverride(request.utterance);
  if (override)
    return {
      model: override,
      purpose:
        override === "qwen3-coder:30b"
          ? "agentic-coding"
          : override === "gpt-oss:20b"
            ? "deep-reasoning"
            : override === "qwen3:8b"
              ? "fast-response"
              : "conversation",
      reason: `Founder explicitly requested ${override}.`,
      explicitOverride: true,
    };
  if (request.hasImage)
    return {
      model: "qwen3.6:27b",
      purpose: "vision",
      reason: "The request includes visual input and requires the multimodal model.",
      explicitOverride: false,
    };
  if (codingPattern.test(request.utterance))
    return {
      model: "qwen3-coder:30b",
      purpose: "agentic-coding",
      reason: "The request is a software-engineering or repository task.",
      explicitOverride: false,
    };
  if (researchPattern.test(request.utterance))
    return {
      model: "gpt-oss:20b",
      purpose: "research-review",
      reason: "The request needs evidence comparison or independent review.",
      explicitOverride: false,
    };
  if (reasoningPattern.test(request.utterance))
    return {
      model: "gpt-oss:20b",
      purpose: "deep-reasoning",
      reason: "The request calls for deliberate planning, diagnosis, or risk analysis.",
      explicitOverride: false,
    };
  if (fastPattern.test(request.utterance))
    return {
      model: "qwen3:8b",
      purpose: "fast-response",
      reason: "The Founder requested a fast or brief response.",
      explicitOverride: false,
    };
  return {
    model: "qwen3.6:27b",
    purpose: "conversation",
    reason: "The request is ordinary Founder dialogue.",
    explicitOverride: false,
  };
}

function fallbackOrder(purpose: ModelRoutePurpose): readonly IrisModelName[] {
  if (purpose === "agentic-coding")
    return ["qwen3-coder:30b", "qwen3.6:27b", "gpt-oss:20b", "qwen3:8b"];
  if (purpose === "deep-reasoning" || purpose === "research-review")
    return ["gpt-oss:20b", "qwen3.6:27b", "qwen3-coder:30b", "qwen3:8b"];
  if (purpose === "vision") return ["qwen3.6:27b"];
  if (purpose === "fast-response")
    return ["qwen3:8b", "gpt-oss:20b", "qwen3.6:27b", "qwen3-coder:30b"];
  return ["qwen3.6:27b", "gpt-oss:20b", "qwen3:8b", "qwen3-coder:30b"];
}

function reviewModel(primary: IrisModelName, available: ReadonlySet<string>): IrisModelName | null {
  const order: readonly IrisModelName[] =
    primary === "gpt-oss:20b"
      ? ["qwen3.6:27b", "qwen3-coder:30b", "qwen3:8b"]
      : ["gpt-oss:20b", "qwen3.6:27b", "qwen3:8b"];
  return order.find((model) => model !== primary && available.has(model)) ?? null;
}

export function routeIrisModel(request: ModelRoutingRequest): ModelRoute {
  const intended = intendedRoute(request);
  const selected = fallbackOrder(intended.purpose).find((model) =>
    request.availableModels.has(model),
  );
  if (!selected) throw new Error("NO_APPROVED_LOCAL_MODEL_AVAILABLE");
  const needsReview =
    intended.purpose === "agentic-coding" ||
    intended.purpose === "deep-reasoning" ||
    intended.purpose === "research-review";
  return modelRouteSchema.parse({
    model: selected,
    purpose: intended.purpose,
    reason:
      selected === intended.model
        ? intended.reason
        : `${intended.reason} ${intended.model} is unavailable, so IRIS selected ${selected}.`,
    explicitOverride: intended.explicitOverride,
    fallbackUsed: selected !== intended.model,
    independentReviewModel: needsReview ? reviewModel(selected, request.availableModels) : null,
  });
}
