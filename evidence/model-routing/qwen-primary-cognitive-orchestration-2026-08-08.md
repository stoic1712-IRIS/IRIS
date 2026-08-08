# Qwen Primary Cognitive Orchestration Evidence

**Date:** 2026-08-08
**Repository:** `stoic1712-IRIS/IRIS`
**Branch:** `iris/qwen-primary-cognitive-orchestration`
**Base:** `6367e4547d34092472c672ee93a9e1b2a8e5c80f`
**Locally verified payload revision:** `22f72dedd05824991f31739946af56de60870b26`
**Payload patch digest:** `sha256:b12af2bdcd53f8ee4a598a67ca708839a87dc480e316913003d095ede7b910bb`

## Result

The approved Core-only Qwen cognitive orchestration tranche is locally implemented and verified.
It is ready for independent material review. It is not pushed, merged, deployed, live-provider
accepted, integrated into the Founder Command Center, or evidence of Phase 0 graduation.

## Verified behavior

- Qwen 27B is the normal dialogue, planning, vision, delegation, and final-synthesis owner.
- Existing specialist routing remains additive: Qwen Coder handles coding and GPT-OSS handles
  research/deep reasoning and independently reviews coding.
- Strict provider envelopes bind request, objective digest, exact scope, route, capabilities,
  evidence, review, synthesis, transitions, model leases, and durable state; unknown fields fail.
- Model leases are sequential, abortable, metadata-only, and release in `finally`; overlap and
  provider release failure fail closed.
- Required evidence is attached from the original validated objects, not reconstructed by a model.
- Synthesis receives one repair attempt for invalid structure or missing evidence acknowledgement.
- Pause/cancel is durable before abort; late worker output cannot overwrite cancellation.
- Resume rejects changed request or policy and resumes reviewed work at synthesis without rerunning
  specialist or reviewer calls.
- Qwen 8B is limited to visibly labeled R0 degraded dialogue when Qwen 27B is unavailable.
- Material work stops before execution when Qwen 27B is unavailable; coding stops before review when
  GPT-OSS is unavailable.
- Existing router, Ollama-adapter, Founder-dialogue, goal-orchestration, and software-delivery tests
  remain compatible.
- Failed provider release now poisons the scheduler until provider-confirmed reconciliation; active
  lease events are durably journaled before model execution.
- Snapshot transitions use generation compare-and-set semantics, so cancellation wins even between
  a post-provider generation check and the next save.
- Material purpose is derived independently from explicit model overrides; unsuitable fallback and
  Qwen 8B material execution fail closed.
- Core recomputes exact-value and canonical specialist-artifact digests and checks conflicting
  duplicate identifiers across all evidence.
- The synthesis repair budget persists across restart, and steering redacts bare provider tokens,
  bearer values, credential URLs, and private keys before storage.

## Verification evidence

All source-document SHA-256 values were checked against `SOURCE-MANIFEST.md` before material work;
the external source library remained read-only. The coordination task and changed-path scope checks
returned zero errors and zero violations.

Focused profiles, with package-manager network disabled:

- Contract profile: 1 file, 6 tests passed, exit `0`, output digest
  `sha256:bc13232b8a88b1e1a2f9e68723983963984476c9c7e89af2ad2f14f2fd920b9a`.
- Lease profile: 1 file, 5 tests passed, exit `0`.
- Runtime profile: 1 file, 17 tests passed, exit `0`.

Full `pnpm verify` used Node `v24.19.0` and pnpm `11.20.0` with network disabled. After
history-preservingly synchronizing canonical `main`, formatting, lint, type checking, 59 test files,
476 passed tests, production build, and repository diagnostics
all exited `0`. One pre-existing platform-conditioned test was skipped on Windows: the Unix-only
Founder runtime build-launcher test in `tests/cycle-five-founder-dialogue.test.ts`. Vite emitted its
existing non-failing large-chunk advisory.

The dependency manifests and lockfile are unchanged. No dependency installation, model download,
live Ollama call, GitHub/provider mutation, credential use, deployment, port exposure, spending,
destructive operation, or Command Center mutation occurred.

## Changed paths

- `.iris/coordination/tasks/qwen-primary-cognitive-orchestration-core.json`
- `docs/specifications/qwen-primary-cognitive-orchestration.md`
- `docs/superpowers/plans/2026-08-08-qwen-primary-cognitive-orchestration-core.md`
- `docs/superpowers/specs/2026-08-08-qwen-primary-cognitive-orchestration-design.md`
- `packages/model-gateway/src/cognitive-orchestrator.ts`
- `packages/model-gateway/src/cognitive-turn-contracts.ts`
- `packages/model-gateway/src/cognitive-turn-errors.ts`
- `packages/model-gateway/src/index.ts`
- `packages/model-gateway/src/model-lease-scheduler.ts`
- `tests/fixtures/qwen-primary-cognitive-orchestration-fixture.ts`
- `tests/model-lease-scheduler.test.ts`
- `tests/qwen-primary-cognitive-orchestration-contracts.test.ts`
- `tests/qwen-primary-cognitive-orchestration-runtime.test.ts`
- `evidence/model-routing/qwen-primary-cognitive-orchestration-2026-08-08.md`
- `.iris/coordination/handoffs/qwen-primary-cognitive-orchestration-core.json`

## Limitations and next gates

- In-memory injected adapters prove the Core contract; live Ollama loading/unloading and model
  acceptance are not claimed.
- Command Center integration must be a separate task bound to the exact independently reviewed and
  merged Core revision.
- Independent review, any repair, non-force push, pull request, merge, synchronization, and
  worktree cleanup remain protected actions.
- This does not complete the permanent Phase 0 Development Independence gate.

## Rollback

Before publication, retain the base and feature branches and omit or history-preservingly revert the
local feature commits; do not reset or rewrite history. After a future merge, revert the exact merge
commit through the normal governed pull-request path. The implementation is additive and created no
provider resource, migration, credential, or live state requiring destructive cleanup.
