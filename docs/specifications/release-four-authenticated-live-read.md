# Release Four Authenticated Live Read

**Status:** Locally implemented under a digest-bound proposal; canonicalization requires separate approval

Release Four introduces the first real, local-only, authenticated read boundary between IRIS Core and the private Founder Command Center. The Core service reads exact allowlisted repository and graduation state, binds it to the existing read-model contract, and authenticates every request and response with per-launch memory-only HMAC keys.

The Core listener binds only to `127.0.0.1:4181`, accepts only authenticated `GET /v1/read-model` and `GET /v1/health`, rejects replay, and exposes no mutation route. Credentials arrive once through inherited standard input rather than source, arguments, environment variables, disk, browser state, logs, or evidence.

The paired application gateway owns the local Founder session and remains non-authoritative. Release Four cannot activate workers, mutate missions or memory, submit or consume approvals, write repositories, call providers, deploy, register startup, expose a LAN or public service, or spend.

Verification covers exact transport and identity binding, request signatures, response attestations, real revision evidence, expiry, replay rejection, fail-closed behavior, browser credential isolation, complete repository verification, graceful shutdown, closed ports, absent processes, removed temporary state, and zero scoped provider resources.
