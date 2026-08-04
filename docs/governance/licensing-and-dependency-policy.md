# Licensing and Dependency Policy

**Status:** Founder-approved; canonicalization commit pending

**Version:** 1.0.0

## Purpose

This policy governs external code, packages, models, datasets, images, tools, services, documentation, and other dependencies before adoption, modification, distribution, or commercial use.

## Adoption Gate

No material dependency may be adopted until its exact identity, version, source, license, security posture, install behavior, runtime access, portability, and removal path are recorded.

## Required Review

Every dependency review must identify:

- canonical project or vendor identity and source URL;
- exact package, repository, release, commit, model tag, or image digest;
- publisher or maintainer;
- license text and version;
- copyright and notice obligations;
- modification, redistribution, embedding, hosted-use, and commercial-use rights;
- transitive dependencies and additional licenses;
- install and update scripts;
- secrets, filesystem, Docker, GPU, and network access;
- telemetry and external destinations;
- known vulnerabilities and maintenance status;
- resource and cost requirements;
- data export and provider-replacement capability;
- uninstall and cleanup method; and
- recommendation: use, adapt, inspire, evaluate further, or reject.

Unknown or conflicting license terms block adoption. Absence of a license is not permission.

## Source and Version Control

Prefer official registries and repositories. Pin versions used for builds and evidence. Record immutable digests for containers and model artifacts when available. Floating tags may be evaluated but must not define a reproducible canonical baseline.

## Notices and Attribution

Required license, copyright, source-offer, attribution, and third-party notices must be preserved in the correct distribution materials. Rebranding must remain within granted rights. Using a provider through an API does not grant rights to redistribute or rebrand it.

## Dependency Minimization

Adopt the smallest justified dependency set. A convenience package must not replace a simple native implementation without documented value. Every dependency creates maintenance, security, license, and removal obligations.

## Upgrade and Removal

Upgrades require release-note, license, security, compatibility, migration, rollback, and lockfile review proportionate to risk. Removal must verify unused code, configuration, secrets, images, caches, services, notices, and provider resources.

## Registry

The canonical registry is `docs/registries/dependency-attribution-registry.md`. Registry entries are evidence records, not automatic approval to use a dependency in every context.

## Founder Decision

- [x] Approved as canonical policy
- [ ] Approved with amendments
- [ ] Rejected for revision

**Founder:**

**Decision date:**

**Approved version or commit:**

**Notes:**
