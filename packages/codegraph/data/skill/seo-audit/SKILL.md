---
name: seo-audit
description: >
  Full-site SEO audit orchestrator. Crawls the site, detects business type,
  fans out to the seo-* specialist skills, then aggregates an evidence-backed
  0-100 health score and a prioritized action plan (Critical → Low). Use when
  user says "audit", "full SEO check", "analyze my site", "website health
  check", or "SEO report". Triggers on: seo audit, full seo check, site health
  score, action plan, crawl my site, technical+content+schema audit.
version: 1.1.0
---

# Full-Site SEO Audit (Orchestrator)

This is the **umbrella** skill. It does not do the deep work itself — it crawls,
classifies the site, **delegates** to the specialist `seo-*` skills, then merges
their findings into one scored report. Every finding it emits carries **evidence**,
a **falsifiability check**, and a **leading indicator** so the report is verifiable
rather than vibes.

## When to use

- Someone asks for a whole-site audit / health check / SEO report.
- You need a single prioritized backlog across technical, content, schema, perf, etc.
- Before a redesign or migration (capture a baseline), or after launch (verify).

For a single concern, skip this and go straight to the specialist (e.g. just schema →
`seo-schema`). Use this when the ask is "how healthy is the whole site".

## Process

1. **Render the homepage.** Fetch raw + rendered HTML and extracted text (use your
   own crawler/headless tooling). Note SPA vs SSR — for our stack this is Next.js 15
   App Router, so most routes are RSC/SSR; flag any client-only routes that ship
   empty initial HTML.
2. **Detect business type / vertical.** SaaS, local service, e-commerce, publisher,
   marketing site. This decides which conditional specialists fan out and how weights
   shift (see Scoring).
3. **Crawl** internal links (config below), respect `robots.txt`, dedupe by canonical.
4. **Fan out to specialists** (run as parallel subagents if available, else inline
   in priority order). Each returns per-finding evidence + a category sub-score.
5. **Aggregate** into the 0-100 SEO Health Score using the weighted rubric.
6. **Prioritize** every finding into Critical → High → Medium → Low.
7. **Report**: executive summary, per-category sections, action plan grouped by phase.

## Specialist delegation map

Always run the core set. Add conditional specialists based on detected vertical /
available data. Names below are the actual sibling skills in this catalog.

| Specialist skill        | Owns                                                                 | Run when            |
|-------------------------|---------------------------------------------------------------------|---------------------|
| `seo-technical`         | robots.txt, sitemaps, canonicals, indexability, redirects, headers, CWV reality | always |
| `seo-content`           | E-E-A-T, search intent, thin/duplicate content, readability         | always              |
| `seo-page`              | On-page: title, meta description, headings, internal links per page | always              |
| `seo-schema`            | JSON-LD detection, validation, missing-type opportunities           | always              |
| `seo-images`            | alt text, dimensions/CLS, format (AVIF/WebP), `next/image` usage     | always              |
| `seo-geo` / `ai-seo`    | AI-crawler access, llms.txt, citability, answer-engine readiness     | always              |
| `seo-sitemap-advanced`  | sitemap structure, quality gates, index/sub-sitemaps, missing pages | sites > ~50 pages   |
| `seo-hreflang`          | hreflang correctness, x-default, return tags (next-intl locales)    | multi-locale sites  |
| `programmatic-seo` / `seo-programmatic` | template/page-pattern quality, dup risk at scale    | templated/large catalogs |
| `seo-competitor-pages`  | gap vs competitor pages for target queries                          | strategy/ranking goals |
| `seo-for-devs`          | implementation fixes mapped to Next.js/Payload code                 | when handing fixes to devs |

Performance (LCP/INP/CLS) is part of `seo-technical`'s CWV reality check; capture
field data if a CrUX/RUM source exists, otherwise label numbers as lab estimates.

## Crawl configuration

```
Max pages: 500
Respect robots.txt: yes
Follow redirects: yes (max 3 hops)
Timeout per page: 30s
Concurrent requests: 5
Delay between requests: 1s
Canonical dedupe: yes (collapse param/duplicate URLs)
```

On large sites, cap at the page limit, report what was crawled, and estimate total
scope rather than silently truncating.

## Scoring (0-100, weighted)

Each specialist returns a category sub-score (0-100). Combine with these weights.
Shift weights by vertical (e.g. e-commerce → raise Schema; publisher → raise Content;
local → raise the geo/local signal). State the weights you used in the report.

| Category                 | Weight | Default rubric anchor                                  |
|--------------------------|:------:|-------------------------------------------------------|
| Technical SEO            |  22%   | crawlable, indexable, no canonical/redirect chaos     |
| Content Quality          |  23%   | intent match, E-E-A-T signals, no thin/dup pages       |
| On-Page SEO              |  20%   | unique titles/meta, clean heading tree, internal links |
| Schema / Structured Data |  10%   | valid JSON-LD for the page types that warrant it       |
| Performance (CWV)        |  10%   | LCP < 2.5s, INP < 200ms, CLS < 0.1 (p75 field if avail) |
| AI Search Readiness      |  10%   | AI crawlers allowed, citable structure, llms.txt       |
| Images                   |   5%   | alt text present, sized to avoid CLS, modern formats   |

**Sub-score banding:** 90-100 excellent · 70-89 good · 50-69 needs work ·
30-49 poor · 0-29 critical. The overall score is the weighted mean, rounded.

## Evidence + falsifiability per finding (claude-seo's core value)

Do not emit a finding without all four fields. This is what makes the audit honest
and re-checkable instead of generic advice.

- **Claim** — the specific problem, with the exact URL(s)/selector/value.
- **Evidence** — what was observed (the rendered title, the HTTP status, the LCP
  element, the missing JSON-LD field). Quote the real value, not a paraphrase.
- **Falsifiability** — "How would we know this finding is wrong?" State the concrete
  observation that would overturn it (e.g. "wrong if GSC shows these URLs indexed
  within 14 days despite the noindex we flagged").
- **Leading indicator** — the metric that should move first if the fix works, and
  roughly when (e.g. "impressions in GSC for the target query cluster within 2-4
  weeks", "INP p75 in CrUX next 28-day window", "valid items in Rich Results Test").

Per-finding record shape:

```json
{
  "title": "Homepage <title> duplicated across 38 routes",
  "category": "On-Page SEO",
  "severity": "High",
  "evidence": "38 crawled URLs return identical <title>'Acme — Home'; e.g. /pricing, /about, /blog/x",
  "recommendation": "Set route-level generateMetadata() titles; use a title.template in the root layout",
  "falsifiability": "Wrong if these routes already have unique titles in rendered HTML (we only saw the streamed shell)",
  "leading_indicator": "Unique-title coverage in next crawl → CTR lift in GSC for those URLs within 3-4 weeks"
}
```

## Priority definitions

- **Critical** — blocks indexing or triggers penalties (noindex on money pages,
  blocked in robots.txt, broken canonical loops, manual action). Fix immediately.
- **High** — materially suppresses rankings/CTR (duplicate titles at scale, missing
  H1s on key pages, INP failing on primary templates). Fix within ~1 week.
- **Medium** — real optimization upside (thin sections, schema gaps, image weight).
  Fix within ~1 month.
- **Low** — polish / backlog (minor alt-text gaps, nice-to-have schema).

Tie-break by reach (how many pages) × impact (how close to conversion/indexation) ÷
effort. Put the top quick wins (high impact, low effort) up front in the summary.

## Report structure

### Executive summary
- Overall SEO Health Score (0-100) + per-category sub-scores and the weights used.
- Detected business type / vertical and which specialists were run.
- Top 5 critical issues and top 5 quick wins, each with its leading indicator.

### Per-category sections
For each category: sub-score, **what works**, then findings (each with the four
evidence fields above), then the category's recommended fixes.

### Action plan (phased)
- **Phase 1 — Critical (Week 1):** indexability/crawl blockers.
- **Phase 2 — High impact (Weeks 2-3):** on-page + CWV on primary templates.
- **Phase 3 — Content & authority (Month 2):** depth, E-E-A-T, schema, internal links.
- **Phase 4 — Monitoring (ongoing):** track the leading indicators; re-audit cadence.

## Next.js 15 stack notes for the auditor

These are the recurring, stack-specific causes behind common findings. Use them so
recommendations map to real code rather than generic advice.

- **Metadata** lives in `generateMetadata()` / the static `metadata` export per route
  segment. Duplicate or missing titles/descriptions are almost always a missing
  route-level export, not a CMS issue. A `title.template` in the root layout fixes
  "brand suffix everywhere" cheaply.
- **Canonicals & alternates** belong in `metadata.alternates` (`canonical` plus
  `languages` for next-intl locales). Missing hreflang on a multi-locale site is a
  `seo-hreflang` finding but the fix is here.
- **`robots` / indexability** — a stray `metadata.robots = { index: false }` (often
  left from staging) on a production route is a Critical finding. Also check
  `app/robots.ts` and any middleware that sets `X-Robots-Tag`.
- **Sitemaps** — `app/sitemap.ts` (and `generateSitemaps` for large/templated sets).
  A static `public/sitemap.xml` that drifts from real routes is a common defect.
- **Empty initial HTML** — `'use client'` at a route boundary or data fetched only in
  `useEffect` means crawlers see a shell. Move data fetching to the server component;
  this is both an indexation and an LCP problem.
- **CWV** — LCP is usually an unoptimized hero image (use `next/image` with `priority`
  and correct `sizes`); CLS is unsized media or late-injected banners; INP is heavy
  client hydration. Map each to the owning template.
- **Images** — `next/image` enforces dimensions (kills CLS) and serves AVIF/WebP;
  flag raw `<img>` on key pages.
- **Payload CMS** — when titles/descriptions come from CMS fields, a finding may be
  "editors left the field blank" rather than a code bug; recommend required SEO
  fields + sensible fallbacks in `generateMetadata()`.

## Output artifacts

- `FULL-AUDIT-REPORT.md` — comprehensive findings (the structure above).
- `ACTION-PLAN.md` — prioritized backlog (Critical → High → Medium → Low / phased).
- `audit-data.json` — structured envelope (summary + categories[] with the
  four-field findings + phased action_plan) so a report can be regenerated.
- `screenshots/` — desktop + mobile captures, if a headless browser is available.

## Error handling

| Scenario | Action |
|----------|--------|
| URL unreachable (DNS / connection refused) | Report clearly. Do not guess content. Ask the user to verify the URL. |
| robots.txt blocks crawling | Report which paths are blocked; audit only accessible pages and note the limitation. |
| Rate limiting (429) | Back off, reduce concurrency, report partial results with what is missing. |
| Large site (> 500 pages) | Cap at the limit, report crawled pages, estimate total scope. |
| Client-only route (empty shell) | Note rendered HTML was empty; mark related findings with that caveat in falsifiability. |

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
