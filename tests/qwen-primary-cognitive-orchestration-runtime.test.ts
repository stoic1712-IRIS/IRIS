import { describe, expect, it } from "vitest";

import {
  cognitiveTurnSnapshotSchema,
  type CognitiveTurnSnapshot,
} from "../packages/model-gateway/src/cognitive-turn-contracts.js";
import type { CognitiveTurnStore } from "../packages/model-gateway/src/cognitive-orchestrator.js";

import {
  codingEnvelope,
  codingPolicy,
  codingRequest,
  cognitiveHarness,
  conversationRequest,
  directEnvelope,
  delayedSpecialistHarness,
  exactEvidence,
  fastResponseEnvelope,
  fastResponseRequest,
  MemoryStore,
  passedSpecialistArtifact,
  passingReview,
  policy,
  researchEnvelope,
  researchRequest,
  restartHarnessThatFailsBeforeSynthesis,
  restartedHarness,
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

  it("attaches exact evidence unchanged instead of asking Qwen to reproduce it", async () => {
    const exact = exactEvidence({
      kind: "citation",
      exactValue: "https://nodejs.org/en/about/previous-releases",
      requiredInPresentation: true,
    });
    const harness = cognitiveHarness({
      planningEnvelope: researchEnvelope(),
      specialist: passedSpecialistArtifact("gpt-oss:20b", [exact]),
      review: passingReview("qwen3.6:27b", [exact]),
      synthesis: {
        narrative: "The official release table supports the finding.",
        acknowledgedEvidenceIds: [exact.evidenceId],
        authority: "none",
      },
    });

    const result = await harness.runtime.start(
      researchRequest(),
      policy(["research.search", "research.verify-source"]),
    );
    expect(result.presentation?.exactEvidence).toEqual([exact]);
  });

  it("allows one synthesis repair and then preserves evidence in synthesis-failed state", async () => {
    const harness = cognitiveHarness({ synthesisSequence: [synthesis([]), synthesis([])] });
    const result = await harness.runtime.start(
      codingRequest(),
      policy(["repository.inspect", "repository.edit-bounded"]),
    );

    expect(result.phase).toBe("synthesis-failed");
    expect(result.synthesisAttempts).toBe(2);
    expect(result.specialistArtifact?.evidence).not.toHaveLength(0);
    expect(result.presentation).toBeNull();
    expect(harness.provider.synthesisCalls).toBe(2);
  });

  it("keeps cancellation terminal when a non-cooperative specialist returns late", async () => {
    const harness = delayedSpecialistHarness();
    const running = harness.runtime.start(
      codingRequest(),
      policy(["repository.inspect", "repository.edit-bounded"]),
    );
    await harness.worker.started;
    const cancelled = await harness.runtime.cancel(codingRequest().requestId);
    harness.worker.resolve(passedSpecialistArtifact("qwen3-coder:30b"));
    await running;

    expect(cancelled.phase).toBe("cancelled");
    expect((await harness.runtime.state(codingRequest().requestId))?.phase).toBe("cancelled");
    expect(harness.provider.synthesisCalls).toBe(0);
  });

  it("uses compare-and-set so cancellation wins a post-check transition race", async () => {
    const base = new MemoryStore();
    let injected = false;
    const racingStore: CognitiveTurnStore = {
      load: (id) => base.load(id),
      async compareAndSet(snapshot, expectedGeneration) {
        if (!injected && snapshot.phase === "verification-running") {
          const current = await base.load(snapshot.request.requestId);
          if (current === null) throw new Error("missing current snapshot");
          const cancelled: CognitiveTurnSnapshot = cognitiveTurnSnapshotSchema.parse({
            ...current,
            phase: "cancelled",
            generation: current.generation + 1,
            updatedAt: "2026-08-08T21:39:25.124Z",
          });
          injected = true;
          await base.compareAndSet(cancelled, current.generation);
          return false;
        }
        return base.compareAndSet(snapshot, expectedGeneration);
      },
    };
    const harness = cognitiveHarness({}, racingStore);
    const result = await harness.runtime.start(codingRequest(), codingPolicy());
    expect(result.phase).toBe("cancelled");
    expect((await harness.runtime.state(codingRequest().requestId))?.phase).toBe("cancelled");
    expect(harness.provider.synthesisCalls).toBe(0);
  });

  it("resumes from the last durable artifact without repeating completed model calls", async () => {
    const first = restartHarnessThatFailsBeforeSynthesis();
    const stopped = await first.runtime.start(
      codingRequest(),
      policy(["repository.inspect", "repository.edit-bounded"]),
    );
    expect(stopped.phase).toBe("recovery-required");

    const second = restartedHarness(first.store);
    const completed = await second.runtime.resume(
      codingRequest().requestId,
      codingRequest(),
      policy(["repository.inspect", "repository.edit-bounded"]),
    );
    expect(completed.phase).toBe("completed");
    expect(second.worker.specialistCalls).toBe(0);
    expect(second.worker.reviewCalls).toBe(0);
    expect(second.provider.synthesisCalls).toBe(1);
  });

  it("persists pause and bounded steering without widening resume bindings", async () => {
    const harness = cognitiveHarness({ planningEnvelope: directEnvelope("Hello, Founder.") });
    const input = conversationRequest();
    await harness.runtime.start(input, policy(["conversation"]));
    const completed = await harness.runtime.pause(input.requestId);
    expect(completed.phase).toBe("completed");

    const delayed = delayedSpecialistHarness();
    const running = delayed.runtime.start(codingRequest(), codingPolicy());
    await delayed.worker.started;
    const steered = await delayed.runtime.steer(
      codingRequest().requestId,
      "Focus on the exact test failure.",
    );
    expect(steered.steeringNotes).toEqual(["Focus on the exact test failure."]);
    const paused = await delayed.runtime.pause(codingRequest().requestId);
    expect(paused.phase).toBe("paused");
    delayed.worker.resolve(passedSpecialistArtifact("qwen3-coder:30b"));
    await running;
    await expect(
      delayed.runtime.resume(
        codingRequest().requestId,
        codingRequest({ pathScope: ["**"] }),
        codingPolicy(),
      ),
    ).rejects.toThrow("COGNITIVE_RESUME_BINDING_MISMATCH");
  });

  it("uses a clearly labeled Qwen 8B degraded interface only for direct R0 dialogue", async () => {
    const harness = cognitiveHarness({ planningEnvelope: directEnvelope("Hello, Founder.") });
    const result = await harness.runtime.start(
      conversationRequest({ riskClass: "R0", availableModels: ["qwen3:8b"] }),
      policy(["conversation"]),
    );

    expect(result.phase).toBe("degraded-interface");
    expect(result.presentation?.provenance.orchestratorModel).toBe("qwen3:8b");
    expect(result.presentation?.degraded).toBe(true);
    expect(result.presentation?.narrative).toContain("Degraded local interface");
    expect(harness.worker.calls).toHaveLength(0);
  });

  it("stops delegated work when the primary orchestrator or required reviewer is unavailable", async () => {
    const noPrimary = cognitiveHarness();
    expect(
      (
        await noPrimary.runtime.start(
          codingRequest({ availableModels: ["qwen3-coder:30b", "gpt-oss:20b"] }),
          codingPolicy(),
        )
      ).phase,
    ).toBe("recovery-required");
    expect(noPrimary.worker.calls).toHaveLength(0);

    const noReviewer = cognitiveHarness();
    expect(
      (
        await noReviewer.runtime.start(
          codingRequest({ availableModels: ["qwen3.6:27b", "qwen3-coder:30b"] }),
          codingPolicy(),
        )
      ).phase,
    ).toBe("reviewer-model-unavailable");
    expect(noReviewer.worker.reviewerModels).toHaveLength(0);
  });

  it("keeps material purpose and review obligations when a model override is requested", async () => {
    const direct = cognitiveHarness({ planningEnvelope: directEnvelope("Unsafe direct answer.") });
    const request = codingRequest({
      utterance: "Use qwen3.6:27b to refactor this TypeScript repository.",
    });
    const rejected = await direct.runtime.start(request, codingPolicy());
    expect(rejected.phase).toBe("recovery-required");
    expect(direct.worker.calls).toHaveLength(0);

    const delegated = cognitiveHarness({ planningEnvelope: codingEnvelope() });
    const completed = await delegated.runtime.start(request, codingPolicy());
    expect(completed.phase).toBe("completed");
    expect(delegated.worker.models).toEqual(["qwen3.6:27b"]);
    expect(delegated.worker.reviewerModels).toEqual(["gpt-oss:20b"]);
  });

  it("fails closed instead of using unsuitable fallbacks for material work", async () => {
    const missingCoder = cognitiveHarness();
    const fallback = await missingCoder.runtime.start(
      codingRequest({ availableModels: ["qwen3.6:27b", "gpt-oss:20b"] }),
      codingPolicy(),
    );
    expect(fallback.phase).toBe("recovery-required");
    expect(fallback.safeFailureCode).toBe("COGNITIVE_SPECIALIST_UNAVAILABLE");
    expect(missingCoder.worker.calls).toHaveLength(0);

    const qwenEight = cognitiveHarness();
    const override = await qwenEight.runtime.start(
      codingRequest({
        utterance: "Use qwen3:8b to refactor this repository.",
        availableModels: ["qwen3:8b", "qwen3.6:27b", "gpt-oss:20b"],
      }),
      codingPolicy(),
    );
    expect(override.phase).toBe("recovery-required");
    expect(qwenEight.worker.calls).toHaveLength(0);
  });

  it("uses Qwen 8B only for delegated R0 fast response without invented independent review", async () => {
    const harness = cognitiveHarness({ planningEnvelope: fastResponseEnvelope() });
    const result = await harness.runtime.start(
      fastResponseRequest(),
      policy(["conversation.fast"]),
    );
    expect(result.phase).toBe("completed");
    expect(result.presentation?.provenance).toEqual({
      orchestratorModel: "qwen3.6:27b",
      specialistModel: "qwen3:8b",
      reviewerModel: null,
    });
    expect(harness.worker.reviewCalls).toBe(0);
  });

  it("refuses tampered evidence and specialist artifact digests", async () => {
    const tamperedEvidence = exactEvidence({ contentDigest: `sha256:${"f".repeat(64)}` });
    const evidenceHarness = cognitiveHarness({
      specialist: passedSpecialistArtifact("qwen3-coder:30b", [tamperedEvidence]),
    });
    const evidenceResult = await evidenceHarness.runtime.start(codingRequest(), codingPolicy());
    expect(evidenceResult.phase).toBe("recovery-required");
    expect(evidenceResult.safeFailureCode).toBe("COGNITIVE_EVIDENCE_MISMATCH");

    const valid = passedSpecialistArtifact("qwen3-coder:30b");
    const artifactHarness = cognitiveHarness({
      specialist: { ...valid, artifactDigest: `sha256:${"e".repeat(64)}` },
    });
    const artifactResult = await artifactHarness.runtime.start(codingRequest(), codingPolicy());
    expect(artifactResult.phase).toBe("recovery-required");
    expect(artifactResult.safeFailureCode).toBe("COGNITIVE_EVIDENCE_MISMATCH");

    const duplicateHarness = cognitiveHarness({
      specialist: passedSpecialistArtifact("qwen3-coder:30b", [
        exactEvidence({ requiredInPresentation: false }),
        exactEvidence({ exactValue: "artifact://different", requiredInPresentation: false }),
      ]),
    });
    const duplicateResult = await duplicateHarness.runtime.start(codingRequest(), codingPolicy());
    expect(duplicateResult.phase).toBe("recovery-required");
    expect(duplicateResult.safeFailureCode).toBe("COGNITIVE_EVIDENCE_MISMATCH");
  });

  it("does not reset the synthesis repair budget on resume", async () => {
    const first = cognitiveHarness({ synthesisSequence: [synthesis([]), synthesis([])] });
    const failed = await first.runtime.start(codingRequest(), codingPolicy());
    expect(failed.synthesisAttempts).toBe(2);
    const restarted = restartedHarness(first.store);
    const resumed = await restarted.runtime.resume(
      codingRequest().requestId,
      codingRequest(),
      codingPolicy(),
    );
    expect(resumed.phase).toBe("synthesis-failed");
    expect(restarted.provider.synthesisCalls).toBe(0);
  });

  it("redacts bare tokens and private keys before durable steering", async () => {
    const delayed = delayedSpecialistHarness();
    const running = delayed.runtime.start(codingRequest(), codingPolicy());
    await delayed.worker.started;
    const steered = await delayed.runtime.steer(
      codingRequest().requestId,
      `Use github_pat_${"a".repeat(40)} and -----BEGIN PRIVATE KEY----- secret -----END PRIVATE KEY-----`,
    );
    expect(steered.steeringNotes[0]).not.toContain("github_pat_");
    expect(steered.steeringNotes[0]).not.toContain("secret");
    delayed.worker.resolve(passedSpecialistArtifact("qwen3-coder:30b"));
    await running;
  });
});
