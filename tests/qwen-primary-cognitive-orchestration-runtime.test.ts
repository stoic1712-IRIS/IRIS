import { describe, expect, it } from "vitest";

import {
  codingEnvelope,
  codingRequest,
  cognitiveHarness,
  conversationRequest,
  directEnvelope,
  passedSpecialistArtifact,
  passingReview,
  policy,
  requiredEvidenceId,
  synthesis,
} from "./fixtures/qwen-primary-cognitive-orchestration-fixture.js";

describe("Qwen primary cognitive orchestration runtime", () => {
  it("uses Qwen 27B directly for ordinary dialogue without a specialist", async () => {
    const harness = cognitiveHarness({ planningEnvelope: directEnvelope("Hello, Founder.") });
    const result = await harness.runtime.start(conversationRequest(), policy(["conversation"]));

    expect(result.phase).toBe("completed");
    expect(result.presentation?.narrative).toBe("Hello, Founder.");
    expect(harness.provider.models).toEqual(["qwen3.6:27b"]);
    expect(harness.worker.calls).toHaveLength(0);
  });

  it("delegates coding, obtains distinct GPT-OSS review, then returns through Qwen", async () => {
    const harness = cognitiveHarness({
      planningEnvelope: codingEnvelope(),
      specialist: passedSpecialistArtifact("qwen3-coder:30b"),
      review: passingReview("gpt-oss:20b"),
      synthesis: synthesis([requiredEvidenceId]),
    });
    const result = await harness.runtime.start(
      codingRequest(),
      policy(["repository.inspect", "repository.edit-bounded"]),
    );

    expect(result.phase).toBe("completed");
    expect(result.presentation?.provenance).toEqual({
      orchestratorModel: "qwen3.6:27b",
      specialistModel: "qwen3-coder:30b",
      reviewerModel: "gpt-oss:20b",
    });
    expect(harness.provider.models).toEqual(["qwen3.6:27b", "qwen3.6:27b"]);
    expect(harness.worker.models).toEqual(["qwen3-coder:30b"]);
    expect(harness.worker.reviewerModels).toEqual(["gpt-oss:20b"]);
    expect(harness.lifecycle.maximumConcurrent).toBe(1);
    expect(harness.transitions.map((event) => event.phase)).toEqual([
      "accepted",
      "orchestrator-planning",
      "delegation-validated",
      "specialist-loading",
      "specialist-working",
      "verification-running",
      "independent-review",
      "orchestrator-synthesizing",
      "completed",
    ]);
  });

  it("rejects duplicate request execution", async () => {
    const harness = cognitiveHarness({ planningEnvelope: directEnvelope("Hello, Founder.") });
    const input = conversationRequest();
    await harness.runtime.start(input, policy(["conversation"]));
    await expect(harness.runtime.start(input, policy(["conversation"]))).rejects.toThrow(
      "COGNITIVE_RESUME_BINDING_MISMATCH",
    );
  });
});
