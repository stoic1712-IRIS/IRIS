import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";
import { z } from "zod";

import type {
  GovernedToolRequest,
  ToolGrant,
  ToolProvider,
  ToolProviderResult,
} from "./contracts.js";
import { assertPublicHttpsTarget } from "./network-policy.js";

const inspectArgumentsSchema = z
  .object({ mode: z.enum(["text", "links"]).default("text") })
  .strict();

const interactionArgumentsSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("click"), selector: z.string().min(1).max(500) }).strict(),
  z
    .object({
      action: z.literal("fill"),
      selector: z.string().min(1).max(500),
      value: z.string().max(10_000),
    })
    .strict(),
  z
    .object({
      action: z.literal("press"),
      selector: z.string().min(1).max(500),
      key: z.enum(["Enter", "Escape", "Tab", "ArrowDown", "ArrowUp", "Space"]),
    })
    .strict(),
]);

export class PlaywrightBrowserToolProvider implements ToolProvider {
  readonly name = "iris-playwright-browser";
  readonly tools = ["browser.inspect", "browser.interact"] as const;

  async execute(
    request: GovernedToolRequest,
    grant: ToolGrant,
    signal: AbortSignal,
  ): Promise<ToolProviderResult> {
    const target = new URL(request.target);
    assertPublicHttpsTarget(target, grant.allowedHosts);
    let browser: Browser | undefined;
    let context: BrowserContext | undefined;
    const close = (): void => {
      void context?.close();
      void browser?.close();
    };
    signal.addEventListener("abort", close, { once: true });
    try {
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext({
        acceptDownloads: false,
        serviceWorkers: "block",
        permissions: [],
        javaScriptEnabled: true,
      });
      await context.route("**/*", async (route: Route) => {
        const outgoing = new URL(route.request().url());
        const methodAllowed =
          request.tool === "browser.interact" || ["GET", "HEAD"].includes(route.request().method());
        try {
          assertPublicHttpsTarget(outgoing, grant.allowedHosts);
        } catch {
          await route.abort("blockedbyclient");
          return;
        }
        if (!methodAllowed) {
          await route.abort("blockedbyclient");
          return;
        }
        await route.continue();
      });
      context.on("page", (opened) => {
        if (opened !== context?.pages()[0]) void opened.close();
      });
      const page = await context.newPage();
      page.on("dialog", (dialog) => void dialog.dismiss());
      await page.goto(target.href, {
        waitUntil: "domcontentloaded",
        timeout: grant.timeoutMs,
      });
      if (request.tool === "browser.inspect") {
        const input = inspectArgumentsSchema.parse(request.arguments);
        return this.#result(
          input.mode === "links" ? await this.#links(page) : await this.#snapshot(page),
          false,
          grant.maximumResponseBytes,
        );
      }
      const input = interactionArgumentsSchema.parse(request.arguments);
      const locator = page.locator(input.selector).first();
      if (input.action === "click") await locator.click({ timeout: grant.timeoutMs });
      if (input.action === "fill") await locator.fill(input.value, { timeout: grant.timeoutMs });
      if (input.action === "press") await locator.press(input.key, { timeout: grant.timeoutMs });
      return this.#result(await this.#snapshot(page), true, grant.maximumResponseBytes);
    } finally {
      signal.removeEventListener("abort", close);
      await context?.close();
      await browser?.close();
    }
  }

  async #snapshot(page: Page): Promise<Record<string, unknown>> {
    return {
      url: page.url(),
      title: await page.title(),
      text: await page.locator("body").innerText(),
    };
  }

  async #links(page: Page): Promise<Record<string, unknown>> {
    return {
      url: page.url(),
      title: await page.title(),
      links: await page.locator("a[href]").evaluateAll((links) =>
        links.slice(0, 200).map((link) => ({
          text: link.textContent.trim().slice(0, 300),
          href: (link as HTMLAnchorElement).href,
        })),
      ),
    };
  }

  #result(
    payload: Record<string, unknown>,
    externalMutation: boolean,
    maximumBytes: number,
  ): ToolProviderResult {
    let content = JSON.stringify(payload);
    if (Buffer.byteLength(content) > maximumBytes) {
      content = JSON.stringify({
        url: payload.url,
        title: payload.title,
        truncated: true,
      });
    }
    if (Buffer.byteLength(content) > maximumBytes) throw new Error("BROWSER_RESPONSE_OVERSIZED");
    return {
      status: "succeeded",
      safeSummary: externalMutation
        ? "Completed one exact authorized ephemeral browser interaction."
        : "Inspected one allowlisted page in an ephemeral browser context.",
      content,
      contentType: "application/json",
      bytes: Buffer.byteLength(content),
      externalMutation,
    };
  }
}
