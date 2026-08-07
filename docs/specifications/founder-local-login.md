# Founder Local Login

**Status:** Canonical version 1.0.0

This specification supersedes the active pairing-bootstrap rule in Release Four. It does not rewrite historical proposals or evidence.

The Founder Command Center may authenticate one local Founder identity through first-run setup and later email/password verification. Raw credentials remain outside Git, browser storage, logs, models, IRIS Core, and evidence. The gateway stores only a normalized-email digest, random salt, scrypt parameters, and derived password hash in an owner-only WSL-local file.

All HTTP listeners remain on `127.0.0.1`. Exact same-origin validation, HttpOnly SameSite Strict session cookies, CSRF protection, bounded expiry, rate limiting, logout cleanup, and fail-closed behavior remain mandatory.

IRIS Core remains the sole authority for identity policy, governance, approvals, canonical state, worker authorization, and execution semantics. Local login creates a browser session only and grants no additional IRIS capability.
