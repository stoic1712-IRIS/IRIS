import { createHash } from "node:crypto";

import { z } from "zod";

import { sha256DigestSchema, timestampSchema } from "@stoic-iris/contracts";

/**
 * Cycle Ten A research integrity.
 *
 * This module sits above the Cycle Six governed tool gateway. It plans
 * source-efficient research inside an exact query budget, deduplicates queries
 * and results, scores source quality from observable provenance, verifies each
 * claim against its cited sources, and isolates every piece of untrusted
 * retrieved content so it can never become an instruction.
 *
 * It adds no provider, starts no service, and holds no credential. Retrieved
 * content, search results, browser text, and MCP output are always data.
 */

export const untrustedOriginSchema = z.enum(["search", "browser", "mcp"]);
export type UntrustedOrigin = z.infer<typeof untrustedOriginSchema>;

export const injectionCategorySchema = z.enum([
  "instruction-override",
  "authority-laundering",
  "credential-exfiltration",
  "tool-invocation",
  "exfiltration-channel",
  "hidden-content",
]);
export type InjectionCategory = z.infer<typeof injectionCategorySchema>;

export const injectionFindingSchema = z
  .object({
    category: injectionCategorySchema,
    evidence: z.string().min(1).max(300),
  })
  .strict();
export type InjectionFinding = z.infer<typeof injectionFindingSchema>;

export const isolatedContentSchema = z
  .object({
    origin: untrustedOriginSchema,
    sourceUrl: z.string().min(1).max(2_000),
    retrievedAt: timestampSchema,
    /** Always true. Isolated content is data and is never an instruction. */
    trusted: z.literal(false),
    quarantined: z.boolean(),
    findings: z.array(injectionFindingSchema).max(50),
    contentDigest: sha256DigestSchema,
    /** Neutralized text. Absent when the content is quarantined. */
    text: z.string().max(20_000).optional(),
  })
  .strict();
export type IsolatedContent = z.infer<typeof isolatedContentSchema>;

export const sourceQualitySchema = z
  .object({
    score: z.number().min(0).max(100),
    tier: z.enum(["primary", "reputable", "secondary", "unverified", "rejected"]),
    signals: z.array(z.string().min(1).max(200)).max(20),
  })
  .strict();
export type SourceQuality = z.infer<typeof sourceQualitySchema>;

export const researchSourceSchema = z
  .object({
    sourceId: z.string().regex(/^source_[a-f0-9]{16}$/u),
    url: z.string().min(1).max(2_000),
    canonicalUrl: z.string().min(1).max(2_000),
    title: z.string().max(500),
    origin: untrustedOriginSchema,
    retrievedAt: timestampSchema,
    quality: sourceQualitySchema,
    isolated: isolatedContentSchema,
  })
  .strict();
export type ResearchSource = z.infer<typeof researchSourceSchema>;

export const citationSchema = z
  .object({
    sourceId: z.string().regex(/^source_[a-f0-9]{16}$/u),
    canonicalUrl: z.string().min(1).max(2_000),
    quotedSpan: z.string().min(1).max(1_000),
    quality: sourceQualitySchema,
  })
  .strict();
export type Citation = z.infer<typeof citationSchema>;

export const claimVerdictSchema = z.enum(["supported", "unsupported", "conflicted"]);
export type ClaimVerdict = z.infer<typeof claimVerdictSchema>;

export const verifiedClaimSchema = z
  .object({
    claim: z.string().min(1).max(2_000),
    verdict: claimVerdictSchema,
    citations: z.array(citationSchema).max(20),
    conflicts: z.array(citationSchema).max(20),
    rationale: z.string().min(1).max(500),
  })
  .strict();
export type VerifiedClaim = z.infer<typeof verifiedClaimSchema>;

export const researchPlanSchema = z
  .object({
    objective: z.string().min(1).max(2_000),
    maximumQueries: z.number().int().min(1).max(25),
    maximumSources: z.number().int().min(1).max(100),
    minimumSourceScore: z.number().min(0).max(100),
  })
  .strict();
export type ResearchPlan = z.infer<typeof researchPlanSchema>;

/** Serializable session state, so a bounded session can be resumed exactly. */
export const researchSessionStateSchema = z
  .object({
    plan: researchPlanSchema,
    executedQueries: z.array(z.string().min(1).max(500)).max(25),
    sources: z.array(researchSourceSchema).max(100),
    /**
     * Results examined during isolation, including those later dropped for
     * quarantine or a below-threshold score. Serialized because quarantined
     * results are not retained as sources, so without it no sound bound on
     * `quarantined` can be checked on resume.
     */
    observedResults: z.number().int().nonnegative(),
    quarantined: z.number().int().nonnegative(),
    cancelled: z.boolean(),
  })
  .strict();
export type ResearchSessionState = z.infer<typeof researchSessionStateSchema>;

const searchResultSchema = z
  .object({
    title: z.string().max(500).default(""),
    url: z.string().min(1).max(2_000),
    snippet: z.string().max(20_000).default(""),
  })
  .loose();

/**
 * Patterns that indicate retrieved content is trying to act as an instruction,
 * borrow authority it does not have, or move secrets off the workstation.
 * Detection never depends on the model reading the content.
 */
const injectionPatterns: readonly { category: InjectionCategory; pattern: RegExp }[] = [
  {
    category: "instruction-override",
    pattern: /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/iu,
  },
  {
    category: "instruction-override",
    pattern: /disregard\s+(?:your|the)\s+(?:rules|policy|guidelines|system prompt)/iu,
  },
  { category: "instruction-override", pattern: /^\s*(?:system|assistant|developer)\s*:/imu },
  { category: "instruction-override", pattern: /<\/?(?:system|instructions?)>/iu },
  { category: "instruction-override", pattern: /new\s+instructions?\s*[:-]/iu },
  {
    category: "authority-laundering",
    pattern:
      /the\s+(?:founder|owner|user|administrator)\s+(?:has\s+)?(?:already\s+)?(?:approved|authorized|permitted)/iu,
  },
  {
    category: "authority-laundering",
    pattern:
      /you\s+(?:are\s+)?(?:now\s+)?(?:have|granted)\s+(?:full|admin|root|elevated)\s+(?:access|permission|authority)/iu,
  },
  {
    category: "authority-laundering",
    pattern: /this\s+message\s+overrides\s+(?:your|the)\s+(?:governance|policy|instructions)/iu,
  },
  {
    category: "authority-laundering",
    pattern: /(?:approval|authorization)\s+is\s+not\s+required/iu,
  },
  {
    category: "credential-exfiltration",
    pattern:
      /(?:reveal|print|show|output|share|send)\s+(?:your|the)\s+(?:token|password|secret|api[_\s-]?key|credential)/iu,
  },
  {
    category: "credential-exfiltration",
    pattern: /\b(?:GITHUB_TOKEN|IRIS_GITHUB_TOKEN|AWS_SECRET_ACCESS_KEY)\b/u,
  },
  { category: "credential-exfiltration", pattern: /contents\s+of\s+(?:\.env|~\/\.ssh|id_rsa)/iu },
  {
    category: "tool-invocation",
    pattern: /\b(?:call|invoke|run|execute)\s+the\s+\w+[\s.]*tool\b/iu,
  },
  { category: "tool-invocation", pattern: /```(?:tool_call|function_call|mcp)/iu },
  {
    category: "exfiltration-channel",
    pattern: /(?:post|send|upload|exfiltrate)\s+(?:it|this|them|the\s+\w+)\s+to\s+https?:\/\//iu,
  },
  { category: "hidden-content", pattern: /[\u200B-\u200F\u202A-\u202E\u2060-\u2064]/u },
  {
    category: "hidden-content",
    pattern: /<!--[\s\S]{0,200}?(?:ignore|instruction|system)[\s\S]{0,200}?-->/iu,
  },
];

/**
 * Categories severe enough to withhold the content entirely rather than retain
 * it as readable data.
 */
const highSeverityCategories = new Set<InjectionCategory>([
  "instruction-override",
  "authority-laundering",
  "credential-exfiltration",
  "tool-invocation",
]);

const hiddenCharacterPattern = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064]/gu;

/** Removes zero-width and bidirectional controls used to split payloads. */
export function normalizeHiddenCharacters(text: string): string {
  return text.replace(hiddenCharacterPattern, "");
}

/**
 * Schemes a research source may use. HTTPS is the normal path. Plain HTTP is
 * retained for loopback and legacy documentation sources but is penalized by
 * `scoreSource`. Every other scheme — `file:`, `javascript:`, `data:`, `ftp:`,
 * and anything else — is a non-network or code-execution source and is refused.
 */
const allowedSourceProtocols = new Set(["https:", "http:"]);

export class UnsupportedSourceSchemeError extends Error {
  constructor(readonly scheme: string) {
    super("RESEARCH_SOURCE_SCHEME_DENIED");
  }
}

const highTrustHosts = new Set([
  "www.rfc-editor.org",
  "datatracker.ietf.org",
  "www.w3.org",
  "nvd.nist.gov",
  "cve.mitre.org",
  "spdx.org",
]);
const reputableSuffixes = [".gov", ".edu", ".int"];

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sourceId(canonicalUrl: string): string {
  return `source_${createHash("sha256").update(canonicalUrl).digest("hex").slice(0, 16)}`;
}

/**
 * Canonical form used for deduplication: lowercase host, no default port, no
 * fragment, no common tracking parameters, no trailing slash.
 */
export function canonicalizeUrl(value: string): string {
  const url = new URL(value);
  // Fail closed on non-network schemes. file:, javascript:, data:, and the
  // rest are either local-filesystem reads or code execution, never research
  // sources, and must not enter a session at any score.
  if (!allowedSourceProtocols.has(url.protocol))
    throw new UnsupportedSourceSchemeError(url.protocol);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  )
    url.port = "";
  for (const key of [...url.searchParams.keys()])
    if (/^(?:utm_[a-z]+|gclid|fbclid|ref|ref_src|mc_[a-z]+)$/iu.test(key))
      url.searchParams.delete(key);
  url.searchParams.sort();
  if (url.pathname.length > 1 && url.pathname.endsWith("/"))
    url.pathname = url.pathname.slice(0, -1);
  return url.href;
}

/** Normalizes a query so equivalent phrasings consume one budget unit. */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .normalize("NFKC")
    .replace(/["'`]/gu, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/u)
    .filter((token) => token.length > 0 && !["the", "a", "an", "of", "for", "to"].includes(token))
    .sort()
    .join(" ");
}

export function detectInjection(text: string): InjectionFinding[] {
  const findings: InjectionFinding[] = [];
  for (const { category, pattern } of injectionPatterns) {
    const match = pattern.exec(text);
    if (match !== null && !findings.some((finding) => finding.category === category))
      findings.push({ category, evidence: match[0].slice(0, 300) });
  }
  return findings;
}

/**
 * Wraps untrusted retrieved content as data. Content carrying an
 * instruction-override, authority-laundering, credential-exfiltration, or
 * tool-invocation attempt is quarantined: its text is withheld entirely so it
 * cannot reach an execution or approval context.
 */
export function isolateContent(input: {
  origin: UntrustedOrigin;
  sourceUrl: string;
  retrievedAt: string;
  text: string;
}): IsolatedContent {
  // Hidden and bidirectional controls are stripped BEFORE high-severity
  // detection. Detecting on the raw text first would let a single zero-width
  // character split a payload ("prev<ZWSP>ious") past every pattern, after
  // which the stripped text would be retained as a clean instruction. The
  // hidden-content finding is still raised from the original text, and the
  // digest still binds the exact original bytes.
  const neutralized = normalizeHiddenCharacters(input.text);
  const findings = [
    ...detectInjection(input.text).filter((finding) => finding.category === "hidden-content"),
    ...detectInjection(neutralized).filter((finding) => finding.category !== "hidden-content"),
  ];
  const quarantined = findings.some((finding) => highSeverityCategories.has(finding.category));
  return isolatedContentSchema.parse({
    origin: input.origin,
    sourceUrl: input.sourceUrl,
    retrievedAt: input.retrievedAt,
    trusted: false,
    quarantined,
    findings,
    contentDigest: sha256(input.text),
    ...(quarantined ? {} : { text: neutralized.slice(0, 20_000) }),
  });
}

/** Deterministic source-quality score from observable provenance only. */
export function scoreSource(input: {
  url: string;
  origin: UntrustedOrigin;
  isolated: IsolatedContent;
}): SourceQuality {
  const signals: string[] = [];
  let score = 40;
  let url: URL;
  try {
    url = new URL(input.url);
    if (!allowedSourceProtocols.has(url.protocol))
      return {
        score: 0,
        tier: "rejected",
        signals: [`Unsupported non-network source scheme ${url.protocol}`],
      };
  } catch {
    return { score: 0, tier: "rejected", signals: ["Unparseable source URL."] };
  }
  if (url.protocol === "https:") {
    score += 10;
    signals.push("Transport is HTTPS.");
  } else {
    score -= 20;
    signals.push("Transport is not HTTPS.");
  }
  const host = url.hostname.toLowerCase();
  if (highTrustHosts.has(host)) {
    score += 35;
    signals.push("Host is a registered standards or advisory primary source.");
  } else if (reputableSuffixes.some((suffix) => host.endsWith(suffix))) {
    score += 20;
    signals.push("Host is a government, academic, or intergovernmental domain.");
  }
  if (/\/(?:docs?|documentation|specification|reference|rfc)\//iu.test(url.pathname)) {
    score += 10;
    signals.push("Path indicates primary documentation.");
  }
  if (input.origin === "search") {
    score -= 5;
    signals.push("Discovered through a search index rather than direct retrieval.");
  }
  if (input.isolated.quarantined) {
    score = 0;
    signals.push("Content was quarantined for a prompt-injection attempt.");
  } else if (input.isolated.findings.length > 0) {
    score -= 15;
    signals.push("Content carried lower-severity untrusted-content findings.");
  }
  const bounded = Math.max(0, Math.min(100, score));
  const tier =
    bounded === 0
      ? "rejected"
      : bounded >= 80
        ? "primary"
        : bounded >= 60
          ? "reputable"
          : bounded >= 40
            ? "secondary"
            : "unverified";
  return sourceQualitySchema.parse({ score: bounded, tier, signals });
}

export class ResearchBudgetExceededError extends Error {
  constructor() {
    super("RESEARCH_QUERY_BUDGET_EXCEEDED");
  }
}
export class ResearchCancelledError extends Error {
  constructor() {
    super("RESEARCH_SESSION_CANCELLED");
  }
}
export class ResearchResumePlanMismatchError extends Error {
  constructor() {
    super("RESEARCH_RESUME_PLAN_MISMATCH");
  }
}
export class ResearchResumeStateInvalidError extends Error {
  constructor() {
    super("RESEARCH_RESUME_STATE_INVALID");
  }
}

/** Order-independent structural comparison for exact plan binding. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

/**
 * A bounded, resumable research session. Every query consumes budget exactly
 * once, duplicate queries and duplicate canonical URLs are refused rather than
 * re-fetched, and cancellation is checked before any provider call.
 */
export class ResearchSession {
  readonly #plan: ResearchPlan;
  readonly #executedQueries: string[];
  readonly #sources: ResearchSource[];
  #observedResults: number;
  #quarantined: number;
  #cancelled: boolean;

  constructor(plan: ResearchPlan, resumeFrom?: ResearchSessionState) {
    const declared = researchPlanSchema.parse(plan);
    if (resumeFrom === undefined) {
      this.#plan = declared;
      this.#executedQueries = [];
      this.#sources = [];
      this.#observedResults = 0;
      this.#quarantined = 0;
      this.#cancelled = false;
      return;
    }
    const state = researchSessionStateSchema.parse(resumeFrom);
    // A resumed session binds to its own serialized plan. Accepting a
    // separately supplied plan would let an exhausted state be reopened under a
    // wider budget, silently granting queries the Founder never approved.
    if (stableJson(state.plan) !== stableJson(declared))
      throw new ResearchResumePlanMismatchError();
    // Malformed state must not widen bounds either. Every check below is a
    // property that `state()` guarantees by construction, so any state this
    // class emits resumes exactly. Quarantined results are dropped rather than
    // retained as sources, so `observedResults` — not the source count — is the
    // only sound bound on `quarantined`.
    if (
      state.executedQueries.length > state.plan.maximumQueries ||
      state.sources.length > state.plan.maximumSources ||
      new Set(state.executedQueries).size !== state.executedQueries.length ||
      new Set(state.sources.map((source) => source.canonicalUrl)).size !== state.sources.length ||
      state.quarantined > state.observedResults ||
      state.sources.length > state.observedResults
    )
      throw new ResearchResumeStateInvalidError();
    this.#plan = state.plan;
    this.#executedQueries = [...state.executedQueries];
    this.#sources = [...state.sources];
    this.#observedResults = state.observedResults;
    this.#quarantined = state.quarantined;
    this.#cancelled = state.cancelled;
  }

  static resume(state: ResearchSessionState): ResearchSession {
    const parsed = researchSessionStateSchema.parse(state);
    return new ResearchSession(parsed.plan, parsed);
  }

  get remainingQueries(): number {
    return this.#plan.maximumQueries - this.#executedQueries.length;
  }

  get quarantinedCount(): number {
    return this.#quarantined;
  }

  sources(): ResearchSource[] {
    return structuredClone(this.#sources);
  }

  state(): ResearchSessionState {
    return researchSessionStateSchema.parse({
      plan: this.#plan,
      executedQueries: [...this.#executedQueries],
      sources: structuredClone(this.#sources),
      observedResults: this.#observedResults,
      quarantined: this.#quarantined,
      cancelled: this.#cancelled,
    });
  }

  cancel(): void {
    this.#cancelled = true;
  }

  /** True when the query is new and budget remains. Never mutates state. */
  shouldQuery(query: string): boolean {
    return this.remainingQueries > 0 && !this.#executedQueries.includes(normalizeQuery(query));
  }

  /**
   * Records one bounded search. Duplicate queries return no new sources and
   * consume no budget. Exceeding the budget fails closed.
   */
  recordSearch(input: {
    query: string;
    retrievedAt: string;
    results: readonly unknown[];
    signal?: AbortSignal;
  }): ResearchSource[] {
    if (this.#cancelled || input.signal?.aborted === true) throw new ResearchCancelledError();
    const normalized = normalizeQuery(input.query);
    if (this.#executedQueries.includes(normalized)) return [];
    if (this.remainingQueries <= 0) throw new ResearchBudgetExceededError();

    // The complete bounded batch is resolved into locals first. Nothing on the
    // session is mutated until the whole batch succeeds, so a refused result —
    // a non-network scheme, or malformed input — leaves sources, quarantine
    // count, executed queries, and remaining budget exactly as they were.
    const accepted: ResearchSource[] = [];
    const seen = new Set(this.#sources.map((source) => source.canonicalUrl));
    let quarantinedDelta = 0;
    let observedDelta = 0;
    for (const candidate of input.results) {
      if (this.#sources.length + accepted.length >= this.#plan.maximumSources) break;
      const result = searchResultSchema.parse(candidate);
      let canonicalUrl: string;
      try {
        canonicalUrl = canonicalizeUrl(result.url);
      } catch (error) {
        // A non-network scheme is an attack surface, not a low-quality result.
        // Refuse the whole batch rather than quietly dropping one entry.
        if (error instanceof UnsupportedSourceSchemeError) throw error;
        continue;
      }
      if (seen.has(canonicalUrl)) continue;
      observedDelta += 1;
      const isolated = isolateContent({
        origin: "search",
        sourceUrl: canonicalUrl,
        retrievedAt: input.retrievedAt,
        text: `${result.title}\n${result.snippet}`,
      });
      if (isolated.quarantined) quarantinedDelta += 1;
      const quality = scoreSource({ url: canonicalUrl, origin: "search", isolated });
      if (quality.score < this.#plan.minimumSourceScore) continue;
      const source = researchSourceSchema.parse({
        sourceId: sourceId(canonicalUrl),
        url: result.url,
        canonicalUrl,
        title: result.title.slice(0, 500),
        origin: "search",
        retrievedAt: input.retrievedAt,
        quality,
        isolated,
      });
      seen.add(canonicalUrl);
      accepted.push(source);
    }

    // Commit point. Every mutation below is total.
    this.#executedQueries.push(normalized);
    this.#sources.push(...accepted);
    this.#quarantined += quarantinedDelta;
    this.#observedResults += observedDelta;
    return structuredClone(accepted);
  }

  /**
   * Verifies one claim against the session's sources. A claim is supported only
   * when a non-quarantined source's isolated text actually contains the
   * required evidence span. Unsupported claims are refused, never softened.
   */
  verifyClaim(input: { claim: string; requiredSpans: readonly string[] }): VerifiedClaim {
    const citations: Citation[] = [];
    const conflicts: Citation[] = [];
    for (const source of this.#sources) {
      const text = source.isolated.text;
      if (source.isolated.quarantined || text === undefined) continue;
      const haystack = text.toLowerCase();
      const matched = input.requiredSpans.find((span) => haystack.includes(span.toLowerCase()));
      if (matched !== undefined) {
        citations.push({
          sourceId: source.sourceId,
          canonicalUrl: source.canonicalUrl,
          quotedSpan: matched.slice(0, 1_000),
          quality: source.quality,
        });
        continue;
      }
      const contradiction = /\bnot\b|\bno longer\b|\bdeprecated\b|\bincorrect\b|\bfalse\b/iu.exec(
        text,
      );
      if (contradiction !== null && input.requiredSpans.length > 0) {
        const near = input.requiredSpans.some((span) =>
          haystack.includes(span.toLowerCase().split(/\s+/u)[0] ?? ""),
        );
        if (near)
          conflicts.push({
            sourceId: source.sourceId,
            canonicalUrl: source.canonicalUrl,
            quotedSpan: contradiction[0].slice(0, 1_000),
            quality: source.quality,
          });
      }
    }
    const verdict: ClaimVerdict =
      citations.length === 0 ? "unsupported" : conflicts.length > 0 ? "conflicted" : "supported";
    return verifiedClaimSchema.parse({
      claim: input.claim,
      verdict,
      citations,
      conflicts,
      rationale:
        verdict === "supported"
          ? `Supported by ${String(citations.length)} non-quarantined cited source(s).`
          : verdict === "conflicted"
            ? `Cited by ${String(citations.length)} source(s) but contradicted by ${String(conflicts.length)}.`
            : "No non-quarantined source contains the required evidence span.",
    });
  }
}
