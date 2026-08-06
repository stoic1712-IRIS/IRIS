# Cycle Six Governed Tool Gateway

**Status:** Implemented and locally verified

Cycle Six gives IRIS one common, deny-by-default gateway for capabilities that IRIS and future workers may use. A worker does not inherit the Founder's account, shell, filesystem, browser, or network authority. It receives a short-lived grant naming exact tools, targets, hosts, repositories, byte limits, timeouts, and expiry. Grants cannot expand themselves.

## Capability matrix

| Capability | Cycle Six state | Boundary |
| --- | --- | --- |
| Workspace file list/read | Implemented | Named roots, path containment, real-path and symlink checks |
| Disposable file write | Implemented | Named writable roots plus exact digest-bound Founder authorization |
| Terminal execution | Implemented | Predeclared executable, arguments, and working directory; no shell interpolation |
| HTTPS retrieval | Implemented | GET only, HTTPS only, host allowlist, redirects denied, bounded response |
| GitHub inspection and delivery | Implemented adapter | Existing allowlisted GitHub CLI provider; mutations retain exact digest approval and remote verification |
| Search provider | Implemented | Digest-pinned SearXNG container, loopback only, bounded result count and output |
| Browser inspection/interaction | Implemented | Playwright 1.62.0, ephemeral Chromium contexts, exact host routing, downloads denied |
| MCP tools | Implemented | MCP TypeScript SDK 1.30.0, exact local stdio server and tool allowlists |

The shared request contract rejects undeclared fields and credential-like input. Writes, browser interaction, GitHub mutation, and MCP calls require approval bound to the complete request digest. Provider output is byte-capped and scanned for common secret forms before release. Every accepted, denied, or failed request enters a hash-chained audit trail.

## Architecture direction

- Native IRIS providers remain the narrowest route for local filesystem, exact command catalog, bounded HTTPS retrieval, and the existing GitHub CLI repository provider.
- Model Context Protocol is the connector boundary for optional external tools. Cycle Six activates only exact local stdio commands. Remote Streamable HTTP servers remain unavailable until separately granted.
- Playwright runs headless Chromium inside a fresh context for each request. Requests to unlisted hosts and non-HTTPS protocols are blocked; inspect mode also blocks non-read HTTP methods. Downloads, service workers, persisted browser state, and inherited permissions are disabled.
- Search uses the official SearXNG container pinned to `sha256:f4c8e59de166ed71f6380c0847c312ca51f0d41996e31d0559163b6b09ecde52`. It publishes only `127.0.0.1:8888`, uses a fresh runtime secret, has no restart policy, and returns at most ten normalized results per request.

## Live verification

Local verification on 2026-08-06 completed:

- one credential-free SearXNG search returning three bounded results, with the official Model Context Protocol domain ranked first;
- one Playwright page inspection returning the expected title and link inventory;
- one digest-authorized harmless browser key interaction recorded as an external mutation;
- one MCP stdio handshake, tool inventory check, and exact `ping` invocation returning `pong`;
- hash-chain validation after every live gateway request.

No search account, OAuth credential, persistent secret, paid resource, deployment, or public/LAN listener was created.
