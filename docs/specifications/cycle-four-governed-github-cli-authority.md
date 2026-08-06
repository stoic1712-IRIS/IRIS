# Cycle Four: Governed GitHub CLI Authority

## Objective

Give IRIS the same repository-content and pull-request transport available to the Founder-operated Codex session without exposing a token or granting arbitrary GitHub, shell, administration, credential, billing, organization, deployment, workflow, secret, or settings authority.

## Authority boundary

- Authentication is owned by the operating-system keyring and consumed by the installed GitHub CLI or Git Credential Manager.
- IRIS never reads, receives, logs, serializes, persists, returns, or clears the token value.
- Repository access is an explicit constructor allowlist restricted to the configured `stoic1712-IRIS` repositories.
- Every mutation requires an exact operation, repository, target, and SHA-256 approval digest.
- Branch pushes are exact commit-to-ref updates without force and require remote equality afterward.
- Pull-request creation is draft-only, targets `main`, disables maintainer edits, and verifies the head commit.
- Merge requires a separate exact approval, expected head commit, and mergeability proof, then uses GitHub's match-head-commit protection.
- No generic `gh api`, arbitrary subcommand, shell string, repository administration, secrets, Actions, billing, organization management, deployment, or credential operation is exposed.

## Credential posture

The provider deletes `GH_TOKEN` and `GITHUB_TOKEN` from child environments and relies on the operating-system keyring. GitHub CLI output containing credentials is never requested. `clearCredential()` is intentionally a no-op because IRIS never owns credential material; revocation and rotation remain Founder-controlled keyring operations.

## Verification

Cycle Four must prove exact allowlisted argument construction, no force push, draft pull-request enforcement, remote equality, match-head-commit merge protection, repository denial, authorization mismatch denial, formatting, lint, type safety, the full test suite, production build, and repository diagnostics.
