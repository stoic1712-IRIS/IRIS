# Cycle Ten Founder Full Access Profile

**Status:** Implemented additive Core contract; final Phase 0 graduation unchanged

## Purpose

Give the authenticated Founder one visible low-friction session profile across implemented ordinary IRIS capabilities without converting convenience into unrestricted autonomy.

`restricted-full-access` is explicit, authenticated, duration-bounded to no more than four hours, revocable, capability-registered, interruptible by the owning runtime, and audit-chained. The grant contains opaque identifiers and metadata only. It never contains a token, password, key, credential value, microphone content, or provider secret.

## Ordinary capability boundary

The schema recognizes the existing ordinary goal, research, browser, connector, repository, verification, pull-request, remote-equality, cleanup, desktop-preview, and local-notification capability names. A registry instance may authorize only the subset it was constructed to provide. Every use rechecks the exact grant, capability, expiry, and revocation state.

The following remain separate protected domains and cannot be encoded in the profile: secret resolution, spending, deployment, public or LAN exposure, repository administration, force-push or history rewrite, destructive data work, and Phase 0 graduation.

## Audit and failure behavior

Issue, authorize, deny, expire, and revoke decisions form a SHA-256-linked event chain. Unknown, unregistered, duplicate, expired, overlong, revoked, or out-of-grant requests fail closed. Revocation is immediate and idempotent.

This contract creates authority metadata only. Provider adapters and higher runtimes still enforce their own narrower safety contracts.
