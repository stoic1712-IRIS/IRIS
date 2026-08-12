# Domain docs

How the engineering skills consume this repository's documentation while exploring the codebase.

There is no `CONTEXT.md` and no `docs/adr/`. Canonical documentation is already laid out by exact path, and the layout below is the map — not a scaffold to create.

## Before exploring, read these

Read the smallest relevant set for the area you are about to touch:

- `docs/operations/stoic-iris-project-context.md` — the operator map: mission, sovereignty objective, architecture, current development state, provider boundaries
- `docs/governance/` — canonical law. `constitution.md` is highest; `worker-reasoning-framework-and-cognitive-identity.md` carries the twelve Core Reasoning Principles that every operator applies
- `docs/architecture/decisions/ADR-NNN-*.md` — the decisions that bound the area
- `docs/specifications/` — the contract a change must satisfy
- `docs/registries/technology-and-platform-registry.md` and `docs/registries/dependency-attribution-registry.md` — adoption status for any external technology in scope
- `evidence/` — what was actually proven, and when

Verify the canonical operating contract before reasoning about capability, authority, execution, repair, acquisition, or completion:

```bash
node scripts/dev/iris-dev.mjs contract inspect --json
```

Its digest-bound v1 contract is the single runtime decision source. The documents above supply provenance and detail; do not rebuild a competing policy from summaries or prior conversation.

## Layout

```
/
├── AGENTS.md                          ← shared operator instruction (CLAUDE.md imports it)
├── .iris/coordination/                ← tasks, handoffs, reviews, and their schemas
├── docs/
│   ├── governance/                    ← constitution and canonical policy (protected)
│   ├── architecture/decisions/        ← ADR-NNN-*.md (protected)
│   ├── specifications/                ← contracts
│   ├── registries/                    ← adoption status (protected)
│   ├── operations/                    ← operator context and runbooks
│   └── superpowers/{plans,specs}/     ← dated plans and design specs
├── evidence/                          ← completion and audit proof
├── packages/ and apps/                ← pnpm workspaces
└── generated/                         ← compiled artifacts; never hand-edited
```

`packages/*` and `apps/*` are workspace boundaries, not documentation contexts. Do not scaffold per-package context files.

## Protected paths

`docs/governance/**`, `docs/architecture/**`, `docs/registries/**`, `.github/**`, package manifests and lockfiles, verification and deployment configuration, credential and access configuration, and `evidence/**` each carry a minimum change requirement in `docs/governance/protected-path-and-branch-policy.md`.

Read them freely. Changing one is a proposal with Founder approval and independent review — never a side effect of another objective.

## Use canonical vocabulary

When your output names a project concept — in a task objective, a refactor proposal, a hypothesis, a test name — use the term as canonical governance defines it. `Canonical`, `bounded`, `producer`, `independent reviewer`, `publisher`, `protected action`, `completion mandate`, and `evidence` each carry an exact meaning here; a synonym loses it.

Reserve `canonical` for what is proved: never a draft, worktree, feature branch, local commit, chat, summary, model output, or private memory.

Where the concept you need has no canonical definition, that is a signal — either the language is invented and should be reconsidered, or there is a real gap worth recording.

## Flag conflicts

Where your output contradicts an ADR, a specification, or canonical governance, surface it rather than silently overriding:

> _Contradicts ADR-0007 — worth reopening because…_

Where sources genuinely conflict with each other, stop and report the conflict. Choosing the convenient reading is how authority gets laundered.
