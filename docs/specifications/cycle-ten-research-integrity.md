# Cycle Ten A Research Integrity

**Status:** Implemented and locally verified

Cycle Ten A is the first bounded tranche of Cycle Ten. It gives IRIS source-efficient research
planning, claim-to-source citation verification with source-quality scoring, and fail-closed
prompt-injection isolation for untrusted search, browser, and MCP content.

It adds no provider, starts no service, controls no desktop, reads no credential store, and makes no
claim of complete Cycle Ten parity. It composes entirely with the already pinned Cycle Six provider
boundaries.

## Position in the architecture

`packages/tool-gateway/src/research-integrity.ts` sits **above** the Cycle Six governed tool gateway.
The gateway remains the only path to a provider and keeps its deny-by-default grants, digest-bound
approvals for mutating effects, byte caps, secret scanning, and hash-chained audit trail. Cycle Ten A
adds no tool name, no provider, and no authority. Cycle Six provider internals are unchanged.

## Source-efficient research

A `ResearchSession` binds one `ResearchPlan`: objective, `maximumQueries`, `maximumSources`, and
`minimumSourceScore`.

- Queries are normalized (case, punctuation, stopwords, token order) so equivalent phrasings consume
  one budget unit. A repeated query returns no new sources and consumes no budget.
- Exceeding the query budget raises `RESEARCH_QUERY_BUDGET_EXCEEDED` rather than degrading silently.
- Results are deduplicated on a canonical URL: lowercased host, default port removed, fragment removed,
  common tracking parameters removed, query parameters sorted, trailing slash removed.
- Accepting sources stops exactly at `maximumSources`.
- Sources scoring below `minimumSourceScore` are not retained.

### Source schemes

Only `https:` and `http:` may enter a session. HTTPS is the normal path; plain HTTP is retained for
loopback and legacy documentation sources but is penalized by `scoreSource`. Every other scheme —
`file:`, `javascript:`, `data:`, `ftp:`, and anything else — is a non-network or code-execution source
and is refused fail-closed with `RESEARCH_SOURCE_SCHEME_DENIED`. `scoreSource` independently returns
`score: 0`, tier `rejected` for such a URL, and `recordSearch` refuses the whole batch rather than
quietly dropping the entry, because a non-network scheme is an attack surface, not a low-quality result.

### Resumption binding

A resumed session binds to its **own serialized plan**. Supplying a different plan alongside a resume
state raises `RESEARCH_RESUME_PLAN_MISMATCH`; accepting the supplied plan would let an exhausted state
be reopened under a wider budget, silently granting queries the Founder never approved. Resume state is
additionally validated against its plan — executed queries within budget, sources within the ceiling, no
duplicate queries or canonical URLs, and a quarantine count that cannot exceed observed items — raising
`RESEARCH_RESUME_STATE_INVALID` otherwise.

## Untrusted content isolation

Every retrieved item from `search`, `browser`, or `mcp` is wrapped as `IsolatedContent` with
`trusted: false`, its origin, source URL, retrieval time, and a SHA-256 digest of the exact original
text. Isolation is pattern-based and never depends on a model reading the content.

**Normalization precedes high-severity detection.** Zero-width and bidirectional controls are stripped
first, and the high-severity patterns run against the normalized text. Detecting on the raw text first
would let a single zero-width character split a payload — `prev<ZWSP>ious` — past every pattern, after
which the stripped text would be retained as a clean instruction. The `hidden-content` finding is still
raised from the original text, and `contentDigest` still binds the exact original bytes, so tampering
evidence survives normalization.

Six detection categories: `instruction-override`, `authority-laundering`, `credential-exfiltration`,
`tool-invocation`, `exfiltration-channel`, and `hidden-content`.

Content carrying an instruction-override, authority-laundering, credential-exfiltration, or
tool-invocation attempt is **quarantined**: its text is withheld entirely, so it cannot reach an
execution or approval context. Lower-severity findings keep the text readable as data but reduce the
source score. Zero-width and bidirectional control characters are stripped from retained text.

Authority laundering is treated as high severity deliberately. A page claiming the Founder already
approved something, that approval is not required, or that it overrides governance is exactly the
attack that a permissive research path would launder into an approval context.

## Source quality

`scoreSource` is deterministic and uses only observable provenance: transport, host class, path shape,
discovery route, and isolation findings. Registered standards and advisory hosts score highest;
government, academic, and intergovernmental domains score next; plaintext transport is penalized;
search-index discovery is penalized slightly against direct retrieval. A quarantined source scores `0`
and is tiered `rejected`. Tiers are `primary`, `reputable`, `secondary`, `unverified`, and `rejected`.

Scoring never consults page-claimed authority, which would itself be untrusted input.

## Claim-to-source verification

`verifyClaim` accepts a claim and its required evidence spans and returns `supported`, `unsupported`, or
`conflicted` with citations and conflicts.

- A claim is `supported` only when a **non-quarantined** source's isolated text actually contains a
  required span. Quarantined sources are never cited even when their text would match.
- Absent supporting evidence the verdict is `unsupported` and the rationale says so. Unsupported claims
  are refused, never softened.
- A source that contradicts the cited evidence produces a `conflicted` verdict with both sides recorded
  rather than silently choosing a winner.

Every citation carries the source identifier, canonical URL, the exact quoted span, and the source's
quality record.

## Cancellation, bounds, and resumability

- An aborted `AbortSignal` or an explicit `cancel()` fails closed with `RESEARCH_SESSION_CANCELLED`
  before any budget is consumed.
- Retained isolated text is capped at 20,000 characters; the gateway's own response byte caps and
  timeouts continue to apply to provider calls.
- `state()` returns a serializable `ResearchSessionState` and `ResearchSession.resume()` restores it
  exactly, preserving spent budget, executed queries, retained sources, and quarantine count. A resumed
  session neither re-spends budget nor duplicates sources.

## Verification

`tests/cycle-ten-research-integrity.test.ts` covers query normalization and budgeting, budget-exceeded
failure, canonical deduplication, the source ceiling, all six injection categories including
authority-laundering and credential-exfiltration attempts, quarantine withholding text, per-origin
isolation for search/browser/MCP, hidden-character stripping, source scoring and rejection, supported,
unsupported, quarantined-not-cited, and conflicted claim verdicts, abort and explicit cancellation,
exact resumption, gateway audit-chain integrity across a bounded research call, and the retained-text
bound.

The Cycle Six governed-tool-gateway and connected-provider suites remain unchanged and passing.

## Boundary

Cycle Ten A does not deliver Founder Command Center integration, browser screenshots, desktop control,
a credential store, or notifications. Those remain later Cycle Ten tranches, and the ones requiring a
provider decision remain blocked on an ADR and registry entry. No live SearXNG, browser, or MCP process
was started for this cycle; all verification uses deterministic hermetic fixtures.
