# Development, Coding, and Documentation Standards

**Status:** Canonical

**Version:** 1.0.0

## Development Standards

- Work from a verified branch and clean or understood worktree.
- Define objective, scope, prerequisites, risks, approvals, tests, rollback, cleanup, and evidence before material implementation.
- Inspect existing architecture and conventions before adding structure.
- Make the smallest coherent change that satisfies the approved objective.
- Preserve unrelated work and avoid broad staging or destructive history operations.
- Pin and review dependencies before project adoption.
- Do not implement later-wave capability before its governing gate.

## Coding Standards

- Use TypeScript strict mode for the planned monorepo unless an approved ADR states otherwise.
- Validate data at trust boundaries and use explicit schemas for shared contracts.
- Keep provider-specific behavior behind adapters.
- Separate pure domain logic from I/O, process, network, filesystem, and provider effects.
- Make permissions, timeouts, retries, idempotency, redaction, and failure states explicit.
- Avoid hidden global state, ambient authority, silent fallback, and unbounded recursion or concurrency.
- Return structured errors without secrets and preserve correlation identifiers.
- Prefer readable names and small cohesive modules over premature abstraction.
- Comments explain governing intent, non-obvious constraints, and safety rationale rather than restating code.

## Documentation Standards

- Document purpose, authority, version, scope, requirements, exclusions, dependencies, evidence, limitations, rollback, and completion gate.
- Mark drafts and canonical documents accurately.
- Link decisions to ADRs, approvals, and commits.
- Record exact external identities, versions, official sources, and license/security findings.
- Keep examples fictional and free of usable secrets.
- Update repository maps and registries in the same bounded change when architecture or dependencies change.

## Change Review

Every material change must pass scope review, protected-path review, formatting and static checks, relevant tests, secret inspection, evidence review, and independent verification proportionate to risk.

## Founder Decision

- [x] Approved as canonical standards
- [ ] Approved with amendments
- [ ] Rejected for revision
