# HTML Report Format

The architectural review is rendered as a single **self-contained** HTML file in the session scratchpad or OS temp directory. STOIC-IRIS is a local-first, provider-independent project: the report loads **nothing from the network** — no CDN scripts, no external stylesheets, no web fonts, no Mermaid. All styling is a hand-written `<style>` block; all diagrams are hand-built divs and inline SVG. This keeps the artifact reviewable offline and free of untrusted remote code.

## Scaffold

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Architecture review — {{repo name}}</title>
    <style>
      :root {
        --accent: #059669;
        --leak: #dc2626;
        --warn: #d97706;
        --ink: #0f172a;
      }
      body {
        font-family: system-ui, sans-serif;
        background: #fafaf9;
        color: var(--ink);
        max-width: 64rem;
        margin: 0 auto;
        padding: 3rem 1.5rem;
        line-height: 1.5;
      }
      article {
        margin-bottom: 2.5rem;
      }
      .badge {
        display: inline-block;
        padding: 0.15rem 0.6rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .badge.strong {
        background: #d1fae5;
        color: #065f46;
      }
      .badge.explore {
        background: #fef3c7;
        color: #92400e;
      }
      .badge.spec {
        background: #e2e8f0;
        color: #334155;
      }
      .files {
        font-family: ui-monospace, monospace;
        font-size: 0.85rem;
      }
      .diagram {
        display: flex;
        gap: 1rem;
      }
      .diagram > div {
        flex: 1;
        border: 1px solid #e2e8f0;
        background: #fff;
        border-radius: 0.5rem;
        padding: 1rem;
      }
      .module {
        border: 2px solid var(--ink);
        border-radius: 0.25rem;
        padding: 0.4rem 0.6rem;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .module.deep {
        background: linear-gradient(135deg, #0f172a, #1e293b);
        color: #f8fafc;
        border-width: 4px;
      }
      .seam {
        stroke-dasharray: 4 4;
      }
      .leak {
        stroke: var(--leak);
      }
      .adr-callout {
        background: #fef3c7;
        border-left: 4px solid var(--warn);
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
      }
    </style>
  </head>
  <body>
    <header>...</header>
    <section id="candidates">...</section>
    <section id="top-recommendation">...</section>
  </body>
</html>
```

Extend the style block as needed — it is yours to author. The only rule is that everything the page needs travels inside the file.

## Header

Repo name, date, and a compact legend: solid box = module, dashed line = seam, red arrow = leakage, thick dark box = deep module. No introduction paragraph — straight into the candidates.

## Candidate card

The diagrams carry the weight. Prose is sparse, plain, and uses the glossary terms (from the `/codebase-design` skill) without ceremony.

Each candidate is one `<article>`:

- **Title** — short, names the deepening (e.g. "Collapse the capability-resolution pipeline").
- **Badge row** — recommendation strength (`Strong` = emerald, `Worth exploring` = amber, `Speculative` = slate), plus a tag for the dependency category (`in-process`, `local-substitutable`, `ports & adapters`, `mock`).
- **Files** — monospaced list.
- **Before / After diagram** — the centrepiece. Two columns, side by side. See patterns below.
- **Problem** — one sentence. What hurts.
- **Solution** — one sentence. What changes.
- **Wins** — bullets, ≤6 words each. e.g. "Tests hit one interface", "Routing logic stops leaking", "Delete 4 shallow wrappers".
- **ADR callout** (if applicable) — one line in an amber-tinted box.

No paragraphs of explanation. If the diagram needs a paragraph to be understood, redraw the diagram.

## Diagram patterns

All patterns are hand-built divs and inline SVG — there is no diagram library. Pick the pattern that fits the candidate. Mix them; variety is part of the point.

### Boxes-and-arrows (the workhorse for dependencies / call flow)

Modules as `<div class="module">`s with borders and labels. Arrows as inline SVG `<line>` or `<path>` elements positioned absolutely over a relative container. Colour leakage edges red (`class="leak"`), draw seams dashed (`class="seam"`), and render the "after" as one thick-bordered deep module with greyed-out internals.

### Cross-section (good for layered shallowness)

Stack horizontal bands to show layers a call passes through. Before: 6 thin layers each doing nothing. After: 1 thick band labelled with the consolidated responsibility.

### Mass diagram (good for "interface as wide as implementation")

Two rectangles per module — one for interface surface area, one for implementation. Before: interface rectangle is nearly as tall as the implementation rectangle (shallow). After: interface rectangle is short, implementation rectangle is tall (deep).

### Call-graph collapse

Before: a tree of function calls rendered as nested boxes. After: the same tree collapsed into one box, with the now-internal calls shown faded inside it.

### Sequence strip (when round-trips are the story)

A simple horizontal strip of numbered hops rendered as small boxes joined by SVG arrows. Before: 6 hops; after: 1. This replaces what a Mermaid sequence diagram would have done.

## Style guidance

- Lean editorial, not corporate-dashboard. Generous whitespace. Serif optional for headings.
- Colour sparingly: one accent (emerald or indigo) plus red for leakage and amber for warnings.
- Keep diagrams ~320px tall so before/after sits comfortably side by side without scrolling.
- Uppercase, letter-spaced, small labels inside diagrams — they should read as schematic, not as UI.
- **No scripts at all.** The report is static HTML and CSS; interactivity is not needed and remote code is not allowed.

## Top recommendation section

One larger card. Candidate name, one sentence on why, anchor link to its card. That's it.

## Tone

Plain English, concise — but the architectural nouns and verbs come straight from the `/codebase-design` skill. Concision is not an excuse to drift.

**Use exactly:** module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality.

**Never substitute:** component, service, unit (for module) · API, signature (for interface) · boundary (for seam) · layer, wrapper (for module, when you mean module).

**Phrasings that fit the style:**

- "Capability resolution module is shallow — interface nearly matches the implementation."
- "Routing leaks across the seam."
- "Deepen: one interface, one place to test."
- "Two adapters justify the seam: provider client in prod, in-memory in tests."

**Wins bullets** name the gain in glossary terms: _"locality: bugs concentrate in one module"_, _"leverage: one interface, N call sites"_, _"interface shrinks; implementation absorbs the wrappers"_. Don't write _"easier to maintain"_ or _"cleaner code"_ — those terms aren't in the glossary and don't earn their place.

No hedging, no throat-clearing, no "it's worth noting that…". If a sentence could be a bullet, make it a bullet. If a bullet could be cut, cut it. If a term isn't in the `/codebase-design` glossary, reach for one that is before inventing a new one.
