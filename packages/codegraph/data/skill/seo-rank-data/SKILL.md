---
name: seo-rank-data
description: "OPTIONAL reference for wiring third-party rank-tracking, keyword, backlink, SERP, and AI-visibility DATA APIs into an SEO workflow via an MCP server. Vendor-agnostic: explains what each data class provides, when to reach for live data vs. first-party signals, how to wire an MCP server, and how to keep API spend under control. Not required by any other seo-* skill. Use when user says they have (or want) a rank-tracking / keyword / backlink data API, or asks how to get live SERP positions, search volume, keyword difficulty, referring-domain counts, or AI share-of-voice. Triggers on: rank tracking, keyword data API, search volume, keyword difficulty, backlink API, referring domains, live SERP, SERP API, AI visibility, share of voice, LLM mentions, rank data MCP, DataForSEO, Ahrefs, SE Ranking, Semrush, Moz."
version: 1.0.0
---

# SEO Rank & Link Data APIs (Optional Integration Reference)

> **This is an OPTIONAL reference.** None of the other `seo-*` skills require it.
> They are designed to work from first-party signals you already control — your
> own crawl, Search Console exports, server logs, and the rendered HTML/RSC
> output of your Next.js app. A paid data API only *adds* the part of SEO you
> cannot observe directly: what the rest of the web and the SERPs are doing.
> Reach for it when a decision genuinely turns on competitive/external data,
> not as a default.

## What only an external API can tell you

Most SEO work is observable from your own stack. A data API exists to fill the
gaps you physically cannot crawl:

| Data class | What it gives you | Why you can't self-serve it |
|------------|-------------------|-----------------------------|
| **Live SERP positions** | Your (and competitors') rank for a keyword, plus SERP features (snippets, PAA, AI Overview citations, image/video packs) | Requires geo-distributed, captcha-solving scraping at scale |
| **Keyword metrics** | Monthly search volume, CPC, competition, difficulty (0-100), search intent | Derived from clickstream + ad-auction data you don't have |
| **Backlink graph** | Referring domains, anchor-text distribution, follow/nofollow ratio, new/lost links, spam/toxicity score | Needs a continuous crawl of the whole web's link graph |
| **Competitor intelligence** | Estimated traffic, ranked-keyword sets, keyword/backlink overlap, domain rating | Aggregates the above across domains you don't own |
| **AI visibility / share-of-voice** | How often a brand is cited by ChatGPT, Gemini, Perplexity, Google AI Overviews / AI Mode | Requires sampling LLM responses across a prompt set |

If the question is "is my page indexable / fast / well-structured / correctly
marked up?", you do **not** need this — use `seo-technical`, `seo-page`,
`seo-schema`, `seo-content`. If the question is "where do I rank, who beats me,
who links to them, and am I cited by AI assistants?", an API is the only
reliable source.

## First-party data you should exhaust first (free)

Before paying for an API, confirm you've used what's already free and often more
trustworthy because it's *your* data:

- **Google Search Console** — real impressions, clicks, average position, and the
  exact queries Google attributes to your pages. This is ground truth for your
  own rankings; no third-party estimate beats it. Export via the Search Console
  API or bulk export to BigQuery.
- **Bing Webmaster Tools** — same idea for Bing/Copilot surfaces.
- **Your own crawl** — render each route (RSC/SSR output, not just the shell) and
  parse titles, metadata, canonicals, internal links, status codes. Use your own
  crawler/tooling (a headless browser or a Node crawler over your sitemap).
- **Server / edge logs** — which bots (Googlebot, GPTBot, PerplexityBot,
  ClaudeBot) actually fetch which routes, and how often.

An external API is for the **external** half of those questions only.

## Choosing a vendor (treat them as interchangeable backends)

Vendors differ in coverage, freshness, and pricing model, but the *data classes*
are the same. Pick based on what you actually need:

- **Broad, pay-per-call platforms** (e.g. DataForSEO) — widest module coverage
  (SERP across Google/Bing/Yahoo/YouTube/Images, keywords, backlinks, on-page
  Lighthouse, business listings, AI-scraping). Billed per request; cheapest if
  usage is bursty.
- **Established subscription suites** (e.g. Ahrefs, Semrush, Moz) — strong
  backlink graphs and ranked-keyword data; metered API units on top of a seat.
  Good when you already pay for the seat.
- **AI-visibility-first** (e.g. SE Ranking, or dedicated GEO trackers) — one call
  returns share-of-voice across ChatGPT, Gemini, Perplexity, AI Overviews and AI
  Mode. Worth it when the brief is GEO, not classic SERP.

**Multi-source confidence weighting:** when two vendors disagree on the same
metric (e.g. referring-domain count), don't average blindly. Report both, note
the discrepancy, and weight by the vendor with the larger/fresher crawl for that
metric. Always cite the source and freshness on every figure, e.g.
`DR 62 (Ahrefs, live)` or `volume 1.9k/mo (DataForSEO, est.)`. A number without a
source is not actionable.

## Wiring it in via an MCP server (recommended)

Expose the API to the agent as an **MCP server** rather than hand-rolling fetch
calls. The agent then calls typed tools (`serp_organic`, `keyword_volume`,
`backlinks_summary`, …) and the credential never enters the conversation or the
repo. Two common patterns:

1. **Vendor-published MCP server** — some vendors ship one (e.g. an official
   `@vendor/mcp` package run over stdio). Configure it in your MCP client with
   the API token supplied via environment, not inline.
2. **Thin wrapper MCP server** — if the vendor only offers REST, write a small
   MCP server (TypeScript SDK) that maps a handful of tools to their endpoints.
   Keep it minimal: one tool per data class you actually use.

Example MCP client config (token comes from the environment, never committed):

```jsonc
// mcp config — token injected from env, not hardcoded
{
  "mcpServers": {
    "rank-data": {
      "command": "npx",
      "args": ["-y", "@vendor/mcp"],
      "env": { "RANK_DATA_API_TOKEN": "${RANK_DATA_API_TOKEN}" }
    }
  }
}
```

In our stack the token lives in the personal master.env (fetched at runtime via
`user_env_get`), never in `.env.local` committed to the repo, and never read
from disk by the agent.

**Availability check (do this before any call):** verify the MCP tool is actually
connected in the session. If it isn't, tell the user the integration isn't set
up and fall back to first-party data — do **not** fabricate numbers. A missing
data API degrades the audit's confidence; it does not block it.

## Cost awareness (these APIs cost money per call)

Every call is billed (per-request or per-unit). Build the habit of estimating
before spending and logging after:

- **Estimate before bulk runs.** Before a large keyword list, full backlink
  crawl, or a SERP pull with `site:` / `filetype:` operators (often billed at a
  multiple of a plain query), surface the expected cost and get explicit
  approval.
- **Set a daily budget.** Track spend per endpoint against a cap. Below a small
  threshold, auto-approve; above it, ask; above the daily cap, refuse and
  explain.
- **Prefer bulk endpoints** over N single calls — bulk volume/difficulty/traffic
  endpoints are dramatically cheaper per keyword.
- **Use sane defaults** (one locale/language, depth 100) unless the user asks
  for more; don't pull 700-deep SERPs or all locales by reflex.
- **Don't re-fetch within a session.** Cache results in working memory; the same
  keyword's volume doesn't change between two questions five minutes apart.
- **Pull, then reason offline.** Fetch the dataset once and do the analysis on it
  locally rather than making the API do iterative work.

A simple budget gate (illustrative — wire your own tracker/ledger):

```ts
// Rough cost guard before an external rank-data call.
type Decision = "approved" | "needs_approval" | "blocked";

function checkSpend(estCost: number, spentToday: number, opts = {
  autoApproveUnder: 0.5, // currency units
  dailyCap: 20,
}): Decision {
  if (spentToday + estCost > opts.dailyCap) return "blocked";
  if (estCost > opts.autoApproveUnder) return "needs_approval";
  return "approved";
}
```

## How the other skills *optionally* benefit

When (and only when) a rank-data MCP is connected, the existing skills can
upgrade an estimate to a measured fact. They never depend on it:

- `seo-audit` — annotate findings with live SERP positions and real backlink
  counts instead of "likely ranks for".
- `seo-technical` / `seo-page` — cross-check your crawl with the vendor's on-page
  / Lighthouse pull and live SERP position for target queries.
- `seo-content` — replace guessed search volume / difficulty / intent with real
  numbers when prioritizing topics.
- `seo-backlinks` — add a vendor's referring-domain and toxicity signal to the
  multi-source confidence model.
- `seo-competitor-pages` / `seo-plan` — use keyword/backlink intersection and
  traffic estimates for genuine competitive gap analysis.
- `seo-geo` — add measured AI share-of-voice / LLM-citation data on top of the
  qualitative citability audit.

In each case the rule is the same: **prefer first-party truth (Search Console)
where it exists, use the API for what only it can see, and label the source.**

## Falsifiability check

How would we know this integration is *not* helping?

- **Failure signal:** decisions (which keywords to target, which links to chase)
  come out the same whether or not the API data is present — i.e. you're paying
  for numbers that don't change the plan. Or: reported figures contradict Search
  Console for queries you own (the API is wrong about *your* site, so trust it
  less for everyone else's).
- **Leading indicator:** track API spend against decisions-changed. If a month of
  spend produced zero plan changes attributable to external data, the
  integration is overhead — narrow it to the few queries that actually need
  competitive context, or drop it.
- **Confidence, not gating:** an audit run *without* this API should still
  produce a valid, lower-confidence report. If removing the API makes a skill
  unusable, the dependency was wired wrong.

---

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
