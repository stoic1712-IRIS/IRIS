# IRIS Founder Command Center Interface Design

**State:** Pending Founder approval; design only

## Application Shell

The desktop shell uses a compact left navigation rail and one primary workspace. Navigation contains Overview, Missions, Approvals, Workers, Evidence, Blueprints, and Health. The global header shows the connected IRIS revision, local-only state, authenticated actor state supplied by Core, and a clear read-only or action-capable mode label.

## Default Overview

The overview answers four questions without becoming a decorative dashboard:

1. What needs the Founder's decision?
2. What mission is active or blocked?
3. Are temporary workers running, terminated, or awaiting cleanup?
4. Is IRIS healthy enough to accept a new objective?

It shows a decision queue, current mission sequence, worker lifecycle summary, and component health. Every value links to its evidence or source revision.

## Approval Review

The approval view is the highest-risk screen. It presents:

- exact proposal identifier and SHA-256 digest;
- risk class and protected action;
- requested paths, commands, providers, resources, cost ceiling, and time boundary;
- verification, rollback, cleanup, and provider-zero requirements;
- changed files or blueprint diff;
- approval expiry and one-time-use state; and
- an exact typed statement generated from the bound proposal.

The interface never replaces the existing approval evaluator. The primary button submits the typed statement for Core validation; it does not say or imply that the UI itself approved the proposal.

## Mission, Worker, and Evidence Views

- Missions show objective, tasks, prerequisites, blockers, required evidence, approval checkpoints, progress, and recommended next work.
- Workers show identity, mission, model, permissions, tools, network, resources, timeout, status, output evidence, termination, and cleanup verification.
- Evidence shows source, revision, citations, correlation identifiers, integrity state, freshness, and redaction status.
- Blueprints reuse the canonical visual composer in read-only mode first. Editing and export authority require separate bounded approvals.
- Health shows allowlisted availability, latency, error, resource, model-runtime, repository, and provider-zero summaries. It never exposes raw secrets or unrestricted logs.

## Interaction Rules

- One primary action per screen.
- Protected actions always show consequence, scope, rollback, and evidence before submission.
- Destructive or provider-affecting controls are visually distinct and never preselected.
- Empty, loading, stale, disconnected, denied, and contradictory states are designed explicitly and fail closed.
- Keyboard navigation, visible focus, semantic landmarks, accessible names, reduced motion, sufficient contrast, and non-color status labels are required.
- Dense operational details use progressive disclosure; critical authority information remains visible.

## Initial Visual Direction

The product should feel like a calm local operations console: dark neutral surfaces, high-contrast text, restrained cyan for selection, amber for pending decisions, red only for blocked or destructive conditions, compact typography, and evidence-first density. It should not resemble a consumer chatbot or an animated science-fiction cockpit.
