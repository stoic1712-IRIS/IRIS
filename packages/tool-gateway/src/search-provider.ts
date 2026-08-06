import { z } from "zod";

import type {
  GovernedToolRequest,
  ToolGrant,
  ToolProvider,
  ToolProviderResult,
} from "./contracts.js";

const searchArgumentsSchema = z
  .object({
    query: z.string().min(1).max(500),
    maximumResults: z.number().int().min(1).max(10).default(5),
    language: z
      .string()
      .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/u)
      .default("en"),
    timeRange: z.enum(["day", "month", "year"]).optional(),
  })
  .strict();

const searchResponseSchema = z.looseObject({
  results: z.array(
    z.looseObject({
      title: z.string().default(""),
      url: z.url(),
      content: z.string().default(""),
      engine: z.string().optional(),
      publishedDate: z.string().nullable().optional(),
    }),
  ),
});

async function boundedJson(response: Response, maximumBytes: number): Promise<unknown> {
  if (response.body === null) throw new Error("SEARCH_RESPONSE_EMPTY");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel();
      throw new Error("SEARCH_RESPONSE_OVERSIZED");
    }
    chunks.push(next.value);
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown;
}

export class SearxngSearchToolProvider implements ToolProvider {
  readonly name = "iris-loopback-searxng";
  readonly tools = ["research.search"] as const;
  readonly #endpoint: URL;
  readonly #fetch: typeof fetch;

  constructor(
    endpoint = "http://127.0.0.1:8888/search",
    fetchImplementation: typeof fetch = fetch,
  ) {
    this.#endpoint = new URL(endpoint);
    if (this.#endpoint.protocol !== "http:" || this.#endpoint.hostname !== "127.0.0.1")
      throw new Error("SEARCH_ENDPOINT_MUST_BE_LOOPBACK");
    this.#fetch = fetchImplementation;
  }

  async execute(
    request: GovernedToolRequest,
    grant: ToolGrant,
    signal: AbortSignal,
  ): Promise<ToolProviderResult> {
    const input = searchArgumentsSchema.parse(request.arguments);
    const url = new URL(this.#endpoint);
    url.searchParams.set("q", input.query);
    url.searchParams.set("format", "json");
    url.searchParams.set("language", input.language);
    if (input.timeRange !== undefined) url.searchParams.set("time_range", input.timeRange);
    const response = await this.#fetch(url, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal,
    });
    if (!response.ok) throw new Error(`SEARCH_RESPONSE_DENIED_${String(response.status)}`);
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > grant.maximumResponseBytes * 8) throw new Error("SEARCH_RESPONSE_OVERSIZED");
    const parsed = searchResponseSchema.parse(
      await boundedJson(response, Math.min(1_048_576, grant.maximumResponseBytes * 8)),
    );
    const results = parsed.results.slice(0, input.maximumResults).map((result) => {
      const resultUrl = new URL(result.url);
      if (!["http:", "https:"].includes(resultUrl.protocol))
        throw new Error("SEARCH_RESULT_DENIED");
      return {
        title: result.title.slice(0, 500),
        url: resultUrl.href,
        snippet: result.content.slice(0, 2_000),
        ...(result.engine === undefined ? {} : { engine: result.engine.slice(0, 100) }),
        ...(result.publishedDate == null ? {} : { publishedDate: result.publishedDate }),
      };
    });
    const content = JSON.stringify({ query: input.query, results });
    if (Buffer.byteLength(content) > grant.maximumResponseBytes)
      throw new Error("SEARCH_RESULT_OVERSIZED");
    return {
      status: "succeeded",
      safeSummary: `Returned ${String(results.length)} bounded search results from loopback SearXNG.`,
      content,
      contentType: "application/json",
      bytes: Buffer.byteLength(content),
      externalMutation: false,
    };
  }
}
