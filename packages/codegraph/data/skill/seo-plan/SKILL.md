---
name: seo-plan
description: >
  Audit-driven SEO planning that turns audit findings into a sequenced, owned
  roadmap with effort/impact scoring, leading indicators, and falsifiable
  success criteria. Industry-specific architecture templates, competitive
  analysis, and content strategy for Next.js sites. Use when user says "SEO
  plan", "SEO strategy", "SEO roadmap", "content strategy", "keyword strategy",
  "content calendar", "site architecture", or "turn this audit into a plan".
  Triggers on: SEO plan, SEO roadmap, SEO strategy, audit to roadmap,
  prioritize SEO fixes, content calendar, site architecture, effort impact SEO.
version: 1.1.0
---

# Strategic SEO Planning

Turn a pile of findings (from an audit, a competitor scan, or a greenfield brief)
into a roadmap a team can actually execute: every item has an owner, an
effort/impact score, a leading indicator you can watch this week, and a
falsifiable success criterion so you know whether it worked.

## Core principle: evidence before tactics

A plan is only as good as the evidence under it. Before writing any roadmap item:

1. **Name the search surface** it targets — classic organic, AI answer / AI
   Overview, local pack, business profile, community reference, or a
   sales-assisted/BOFU page. Different surfaces need different evidence and have
   different leading indicators.
2. **Separate observable evidence from assumptions.** Any claim with a number
   (traffic, CR, position, citation share) must trace to a real source — GSC,
   analytics, a crawl, a SERP capture, the CMS — or be downgraded to a hypothesis.
3. **Decide which stage is blocking progress** (Find → Leverage → Optimize → Win,
   below). Fixing the wrong stage burns budget. Most "we have traffic but no
   leads" problems are Win problems, not ranking problems.

## The FLOW loop — which stage is blocking?

An evidence-led loop for the AI-search era. Treat rankings, AI citations, local
visibility, and sales evidence as connected surfaces, not separate channels.

| Stage | The question | Symptoms it's the bottleneck | Typical roadmap items |
|-------|--------------|------------------------------|-----------------------|
| **Find** | Is demand language clear? | Thin keyword map, no intent clustering, guessing topics | Keyword/intent research, content gap vs competitors, SERP intent mapping |
| **Leverage** | Is the brand corroborated off-site? | New domain, no mentions, entity not consistent across the web | Digital PR, citations/listings, entity consistency (NAP, sameAs) |
| **Optimize** | Is the owned asset easy to extract and trust? | Pages rank low, not cited by AI, weak E-E-A-T, crawl issues | On-page rewrites, schema, internal links, technical fixes, freshness |
| **Win** | Does traffic convert to a business outcome? | Traffic flat-to-up but leads/signups flat | BOFU pages, CRO, comparison pages, conversion tracking, ROI proof |

Pick the stage that can change the **next business outcome**, then build evidence
there first. Re-run the loop each quarter.

## Why surfaces matter in 2026

- Position-one CTR is materially lower when an AI Overview is present, so ranking
  #1 no longer guarantees the click — Win and Optimize-for-extraction matter more.
- A meaningful share of top AI-cited URLs have little or no classic organic
  visibility, so AI answers are a distinct surface to plan for, not a by-product
  of rankings.
- Core Web Vitals thresholds to plan against: **LCP < 2.5s, INP < 200ms (INP
  replaced FID), CLS < 0.1** — set these as Phase-1 baselines, not afterthoughts.

## Process

### 1. Discovery
- Business type, target audience, top 5 competitors, business goals.
- Current-site assessment (run an audit first if a URL exists — see Inputs below).
- Budget, timeline, and team constraints (who can actually do the work).
- KPIs and the **one** business outcome that defines success this quarter.

### 2. Competitive analysis
- Top 5 competitors: content strategy, schema usage, technical setup, E-E-A-T.
- Keyword and content gaps; AI-citation gaps (who gets cited for our topics?).
- Estimate authority qualitatively; only cite numbers you can source.

### 3. Architecture design
- Load the matching industry template from `assets/` (see below).
- URL hierarchy, content pillars, internal-linking plan, IA for user journeys.
- For Next.js App Router: map pillars to route segments and decide rendering
  per template (static for evergreen, ISR for catalog/blog, dynamic only where
  required). Plan `sitemap.ts`, `robots.ts`, and canonical strategy up front.

### 4. Content strategy
- Content gaps vs competitors; page types and estimated counts.
- Publishing cadence the team can sustain (be honest about capacity).
- E-E-A-T plan: author bios + credentials, first-hand experience signals, sources.
- Content calendar prioritized by the effort/impact rubric below.

### 5. Technical foundation
- Hosting/performance requirements; CWV baseline targets (LCP/INP/CLS above).
- Schema plan per page type (Organization, Article, Product, FAQ, etc.).
- AI-extraction readiness: clear headings, direct answers, quotable tables.
- Mobile-first, i18n strategy (next-intl): locale routing + `hreflang`/alternates.

## Audit findings → roadmap

This is the heart of the plan. Convert every finding into a row.

### Effort / Impact scoring

Score each candidate item 1-5 on two axes, then sequence by the ratio.

**Impact (1-5)** — expected effect on the target business outcome:
- 5 = unlocks a primary outcome (e.g. enables indexing of a whole revenue section)
- 3 = improves a key page/cluster meaningfully
- 1 = marginal or cosmetic

**Effort (1-5)** — realistic cost to ship, including review and QA:
- 1 = config/copy change, hours
- 3 = a few pages or one template, days
- 5 = new section, migration, or cross-team work, weeks

**Priority = Impact ÷ Effort.** Sequence high-ratio first. Break ties by
*time-to-signal* (how soon a leading indicator can confirm it worked) — a 0.8
item that proves itself in a week beats a 0.8 item that takes a quarter.

### Roadmap item template

Every item gets all seven fields. No field is optional.

| Field | Example |
|-------|---------|
| **Finding** | Product category pages blocked by `robots.txt` |
| **Surface / FLOW stage** | Organic + AI / Optimize (technical) |
| **Owner** | api-developer |
| **Effort / Impact** | E2 / I5 → priority 2.5 |
| **Leading indicator** (watch this week) | GSC "Discovered – currently not indexed" count drops; crawl of section returns 200 |
| **Success criterion** (falsifiable) | ≥ 80% of category URLs indexed within 4 weeks |
| **Falsifiability check** | *How would we know this failed?* Indexed count flat after 4 weeks despite recrawl. *Leading indicator that would warn early:* GSC coverage report still excludes the section after 7 days |

### Falsifiability discipline (claude-seo's key idea)

For every success criterion, write down two things explicitly:

1. **How would we know this failed?** A concrete observation that would prove the
   item did *not* work. If you can't state one, the criterion is marketing, not a
   plan — rewrite it until it's measurable.
2. **What's the earliest leading indicator?** A signal visible in days, not the
   lagging KPI that takes a quarter (rankings, sessions, revenue). Leading
   indicators let you cut a losing bet before it consumes the budget.

Lagging KPIs (sessions, MQLs, revenue) belong in the quarterly scorecard. Roadmap
items are steered by leading indicators.

## Implementation roadmap (4 phases)

Phases are the default container; the effort/impact ranking decides order *within*
each phase. Pull a high-ratio Phase-2 item forward if it's a quick win.

### Phase 1 — Foundation (weeks 1-4)
- Technical setup: rendering strategy, `sitemap.ts`/`robots.ts`, canonicals, CWV baseline.
- Core pages (home, about, contact, main services) + essential schema.
- Analytics, GSC, and **conversion events wired before** content ships — you
  cannot judge Win-stage work without them.

### Phase 2 — Expansion (weeks 5-12)
- Content for primary pages; blog launch with initial posts.
- Internal-linking structure; local SEO setup (if applicable).

### Phase 3 — Scale (weeks 13-24)
- Advanced content; link building / digital PR (Leverage).
- AI-extraction / GEO optimization; performance hardening.

### Phase 4 — Authority (months 7-12)
- Thought leadership; PR and media mentions; advanced schema; continuous iteration.

## Next.js scaffolding the plan should specify

The plan is the spec for the build. Name the concrete artifacts:

```ts
// app/sitemap.ts — one entry per planned route; mirrors the IA from step 3
import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL!
  const pillars = ['product', 'solutions', 'pricing', 'blog'] // from architecture design
  return pillars.map((p) => ({
    url: `${base}/${p}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: p === 'pricing' ? 0.9 : 0.7,
  }))
}
```

```ts
// app/robots.ts — Phase-1 item: never ship a section blocked by accident
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/draft/'] },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  }
}
```

```ts
// app/[locale]/(marketing)/[pillar]/page.tsx — rendering decided in the plan
export const revalidate = 3600 // ISR for catalog/blog; use `force-static` for evergreen
export async function generateStaticParams() {
  // enumerate pillars/clusters from the content calendar so they prerender
}
```

For schema and metadata implementation details, defer to the `seo-technical`
and content skills — the plan only specifies *which* schema per page type.

## Industry templates

Load the matching file from `assets/` (per-business-type architecture, content
priorities, schema map, and metrics):

- `saas.md` — SaaS / software companies
- `local-service.md` — local service businesses
- `ecommerce.md` — e-commerce stores
- `publisher.md` — content publishers / media
- `agency.md` — agencies and consultancies
- `generic.md` — general business template (fallback)

## Output

### Deliverables
- `SEO-STRATEGY.md` — strategy + chosen FLOW stage and rationale
- `COMPETITOR-ANALYSIS.md` — competitive and AI-citation gaps
- `CONTENT-CALENDAR.md` — prioritized content roadmap
- `IMPLEMENTATION-ROADMAP.md` — the seven-field roadmap table, sequenced by priority
- `SITE-STRUCTURE.md` — URL hierarchy and rendering map

### Quarterly scorecard (lagging KPIs)
Balance visibility and business indicators — never report one without the other.

| Metric | Baseline | 3 Month | 6 Month | 12 Month |
|--------|----------|---------|---------|----------|
| Organic sessions | ... | ... | ... | ... |
| Keyword rankings (tracked set) | ... | ... | ... | ... |
| AI citations / mentions | ... | ... | ... | ... |
| Indexed pages | ... | ... | ... | ... |
| Core Web Vitals (LCP/INP/CLS) | ... | ... | ... | ... |
| **Qualified leads / signups** | ... | ... | ... | ... |

If a page or profile cannot be measured, add the measurement event **before**
judging its performance.

### Success criteria for the plan itself
- Every roadmap item has an owner, effort/impact, a leading indicator, and a
  falsifiable success criterion.
- Each phase has measurable goals and named dependencies.
- Risks and their mitigations are listed.

## Optional external tooling

If you have access to a keyword/competitor data provider (e.g. an SEO data MCP or
API), use it for real competitive intelligence, traffic estimates, search volume,
and keyword difficulty. Otherwise proceed qualitatively and label every estimate
as a hypothesis (use your own crawler/tooling). Never invent vendor numbers.

## Error handling

| Scenario | Action |
|----------|--------|
| Unrecognized business type | Fall back to `generic.md`; note that no industry template matched. |
| No website URL provided | New-site planning mode: skip current-site assessment and live-URL gap analysis. |
| Industry template missing | Use `generic.md` and note the missing template in output. |
| Finding has no measurable success criterion | Do not add it to the roadmap until it is made falsifiable. |

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
