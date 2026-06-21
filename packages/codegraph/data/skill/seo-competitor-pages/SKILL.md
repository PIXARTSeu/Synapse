---
name: seo-competitor-pages
description: >
  Build and audit competitor comparison, "alternatives to X", and category roundup
  pages — competitive content gap analysis, SERP-feature targeting, page-level
  teardown, feature matrices, JSON-LD, and a 0-100 prioritization rubric. Use when
  user says "comparison page", "vs page", "alternatives page", "competitor comparison",
  "content gap", "SERP analysis", "X vs Y". Triggers on: versus, compare competitors,
  alternative to, comparison table, gap analysis, SERP features, competitive teardown.
version: 1.1.0
---

# Competitor Comparison & Alternatives Pages

Two jobs in one skill:
1. **Analyze** — find the competitive content gap, decide what to build, and prioritize it.
2. **Build** — ship high-converting comparison/alternatives pages on our stack (Next.js 15 App Router + RSC, TypeScript, Tailwind, Payload CMS, next-intl) that win competitive-intent queries with accurate, structured content.

Start with analysis. Building a page nobody can rank for or that nobody clicks is wasted effort.

---

## Part 1 — Competitive Content Gap Analysis

### Method (per target query)
1. **Pull the live SERP** for the target query (use your own crawler/SERP tooling). Record the top 10 organic results and every SERP feature present (see SERP table below).
2. **Classify dominant intent** — is the SERP serving comparison pages, listicles, vendor pages, or forum/UGC? If the SERP is all vendor homepages, a comparison page may be the wrong format.
3. **Teardown the top 3 pages** (see Part 2). Capture word count, sub-topics covered, entities mentioned, table presence, schema present, freshness signal.
4. **Build the gap matrix** — sub-topics × competitors. Cells = covered / partial / missing. Your opportunity is the union of (high-value sub-topics) ∩ (thin or missing across the SERP).
5. **Score and prioritize** each opportunity (rubric below) before committing build effort.

### Gap matrix (the core artifact)
```
| Sub-topic / question        | Comp A | Comp B | Comp C | Demand | Our angle      |
|-----------------------------|:------:|:------:|:------:|:------:|----------------|
| Pricing breakdown w/ totals |  part  |  full  | miss   |  high  | total-cost calc|
| Migration steps from X      |  miss  |  miss  | miss   |  med   | step-by-step   |
| API / integrations depth    |  full  |  part  | full   |  low   | skip / brief   |
| Real limits & gotchas       |  miss  |  part  | miss   |  high  | honest section |
```
Rule of thumb: prioritize cells that are **high demand + missing/partial across all competitors**. Those are rankable wedges. A sub-topic everyone covers fully ("table stakes") must be present but is not a differentiator.

### Entity & topic coverage check
- Extract the entities (features, integrations, use cases, named competitors) that top pages co-mention. Missing entities = thin coverage Google can detect.
- Don't keyword-stuff. Cover the entity *because the topic genuinely needs it*, then move on.

---

## Part 2 — Page-Level Competitive Teardown

For each top-3 result, capture a structured snapshot (use your own crawler/tooling; do not assume any specific script exists):

| Dimension | What to record | Why it matters |
|-----------|----------------|----------------|
| Format | vs / alternatives / roundup / vendor | Tells you the SERP-expected format |
| Word count & depth | total words, # of H2s | Calibrate your minimum, don't pad |
| Table presence | feature matrix? sortable? | Tables win featured snippets for comparison intent |
| Schema | Product, SoftwareApplication, ItemList, FAQPage | Eligibility for rich results |
| Freshness | "updated" date, year in title | Comparison intent is recency-sensitive |
| Bias signal | balanced vs. hit-piece | Over-biased pages lose trust + links |
| Internal links | hub/cluster wiring | Reveals their topical authority play |
| CTA pattern | placement, aggressiveness | Conversion benchmark |

Output: a one-row-per-competitor teardown table feeding the gap matrix. The goal is "be the most complete, most honest, most current page for this query" — derived from evidence, not vibes.

---

## Part 3 — SERP Feature Targeting

Decide which SERP feature you are trying to capture; it changes how you structure the page.

| SERP feature | How to target | Structural requirement |
|--------------|---------------|------------------------|
| Featured snippet (table) | Lead with a clean comparison table near the top | Real `<table>`, ≤ ~8 rows, first column = labels |
| Featured snippet (paragraph) | Answer "is A better than B?" in 40-55 words right after H1 | Direct, self-contained sentence |
| Featured snippet (list) | "Best X alternatives" as an ordered/unordered list | `<ol>`/`<ul>` with concise item leads |
| People Also Ask | Add an FAQ section answering the literal PAA questions | `FAQPage` JSON-LD + visible Q/A |
| Product/Review rich result | Mark up products with ratings you actually have | `Product` + `AggregateRating` (real data only) |
| AI Overview / generative | Clear entity definitions, comparison facts, cited claims | Scannable facts, source links |

Never fabricate ratings, review counts, or prices to win a rich result — it's a manual-action and trust risk. Mark up only data you genuinely have.

---

## Part 4 — Prioritization Rubric (0-100)

Score each candidate page before building. Sum the weighted dimensions:

| Dimension | Weight | 0 | 50 | 100 |
|-----------|:------:|---|----|-----|
| Demand (search volume / trend) | 25 | negligible | steady mid | high & growing |
| Win probability (gap size vs. our authority) | 25 | SERP fully saturated | beatable on depth | clear wedge, weak incumbents |
| Commercial intent (proximity to revenue) | 25 | informational only | mid-funnel | high buyer intent (vs/pricing) |
| Effort inverse (lower effort = higher score) | 15 | needs deep original research | moderate | data we already have |
| Strategic fit (cluster/hub support) | 10 | orphan | adjacent | reinforces a money cluster |

**Decision bands:** ≥ 70 build now · 50-69 backlog with a date · < 50 skip or revisit when authority grows.

### Falsifiability — how would we know this failed?
Define the failure condition *before* publishing, so the page is accountable:
- **Hypothesis:** "This vs page will rank top-5 for `[A vs B]` and convert at ≥ X%."
- **Leading indicator (2-4 weeks):** impressions in Search Console for the target query rising; average position breaking into top 20. If impressions are flat after 4 weeks of being indexed, the page is mis-targeted (wrong intent/format) — diagnose before adding more pages like it.
- **Lagging indicator (8-12 weeks):** top-5 position + assisted conversions. No movement here despite healthy leading indicators ⇒ on-page relevance/depth gap or CTR problem (fix title/snippet), not a "wait longer" problem.
- **Kill criterion:** no top-20 position and < N impressions after 12 weeks ⇒ consolidate into a stronger page or unpublish; don't let thin comparison pages dilute the cluster.

---

## Page Types

### 1. "X vs Y" Comparison
Direct head-to-head, balanced feature-by-feature analysis, clear justified verdict. Target: `[A] vs [B]`.

### 2. "Alternatives to X"
List of alternatives, each with summary, pros/cons, best-for use case. Target: `[Product] alternatives`, `best alternatives to [Product]`.

### 3. "Best [Category] Tools" Roundup
Curated ranking with stated criteria. Target: `best [category] tools [year]`, `top [category] software`.

### 4. Comparison Table / Matrix
Multiple products in columns, sortable/filterable if interactive. Target: `[category] comparison`, `[category] comparison chart`.

---

## Keyword Targeting

| Pattern | Example | Intent strength |
|---------|---------|-----------------|
| `[A] vs [B]` | "Slack vs Teams" | high, mid-funnel |
| `[A] alternatives` | "Figma alternatives" | high, commercial |
| `[A] alternatives [year]` | "Notion alternatives 2026" | high, recency |
| `best [category] tools` | "best project management tools" | high, top-funnel |
| `[A] vs [B] for [use case]` | "AWS vs Azure for startups" | medium, qualified |
| `[A] vs [B] pricing` | "HubSpot vs Salesforce pricing" | medium, high buyer intent |
| `is [A] better than [B]` | "is Notion better than Confluence" | medium, snippet-prone |

### Title / H1 formulas
- vs: `[A] vs [B]: [Key Differentiator] ([Year])`
- alternatives: `[N] Best [A] Alternatives in [Year] (Free & Paid)`
- roundup: `[N] Best [Category] Tools in [Year], Compared & Ranked`
- H1: match title intent, primary keyword natural, < 70 chars.

---

## Build — Next.js 15 (App Router + RSC)

### Comparison page route + metadata
```tsx
// app/[locale]/compare/[slug]/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getComparison } from "@/lib/payload/comparisons"; // your Payload fetch
import { ComparisonTable } from "@/components/comparison-table";
import { JsonLd } from "@/components/json-ld";

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string; slug: string }> },
): Promise<Metadata> {
  const { slug, locale } = await params;
  const c = await getComparison(slug, locale);
  if (!c) return {};
  const title = `${c.productA} vs ${c.productB}: ${c.differentiator} (${new Date().getFullYear()})`;
  return {
    title,
    description: c.metaDescription,
    alternates: { canonical: `/compare/${slug}` },
    openGraph: { title, description: c.metaDescription, type: "article" },
  };
}

export default async function ComparePage(
  { params }: { params: Promise<{ locale: string; slug: string }> },
) {
  const { slug, locale } = await params;
  const c = await getComparison(slug, locale);          // RSC: fetched on the server
  if (!c) return null;
  const t = await getTranslations("compare");

  return (
    <article className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">
        {c.productA} vs {c.productB}
      </h1>
      {/* 40-55 word self-contained verdict → targets paragraph featured snippet */}
      <p className="mt-4 text-lg text-muted-foreground">{c.verdict}</p>

      <ComparisonTable rows={c.rows} columns={[c.productA, c.productB]} />

      <JsonLd data={buildComparisonSchema(c)} />
      <time className="mt-8 block text-sm text-muted-foreground" dateTime={c.updatedAt}>
        {t("updated", { date: new Date(c.updatedAt).toLocaleDateString(locale) })}
      </time>
    </article>
  );
}
```

### Accessible, snippet-friendly table component
```tsx
// components/comparison-table.tsx
type Cell = "yes" | "no" | "partial" | string;
export function ComparisonTable(
  { rows, columns }: { rows: { feature: string; values: Cell[] }[]; columns: string[] },
) {
  const mark = (v: Cell) =>
    v === "yes" ? <span aria-label="Yes">✓</span>
    : v === "no" ? <span aria-label="No">—</span>
    : v === "partial" ? <span aria-label="Partial">◐</span>
    : v;
  return (
    <table className="mt-8 w-full border-collapse text-sm">
      <caption className="sr-only">Feature comparison</caption>
      <thead>
        <tr>
          <th scope="col" className="text-left p-3">Feature</th>
          {columns.map((c) => (
            <th key={c} scope="col" className="p-3 text-center">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.feature} className="border-t">
            <th scope="row" className="p-3 text-left font-medium">{r.feature}</th>
            {r.values.map((v, i) => <td key={i} className="p-3 text-center">{mark(v)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Data accuracy (enforce in content, not just markup)
- Every feature/pricing claim verifiable from a public source; store the source URL alongside the value in Payload.
- Pricing carries an "as of [date]" note; review quarterly or when a competitor ships a major change.
- Prefer Payload-managed comparison data over hardcoded JSX so non-devs can keep it current and `revalidateTag` refreshes the page.

---

## Schema Markup (JSON-LD)

Render via a small `<JsonLd>` server component (`<script type="application/ld+json">`). Use only the type(s) the page genuinely supports.

```json
// SoftwareApplication (software comparisons)
{ "@context": "https://schema.org", "@type": "SoftwareApplication",
  "name": "[Software]", "applicationCategory": "[Category]", "operatingSystem": "[OS]",
  "offers": { "@type": "Offer", "price": "[Price]", "priceCurrency": "EUR" } }
```
```json
// ItemList (roundup pages)
{ "@context": "https://schema.org", "@type": "ItemList",
  "itemListOrder": "https://schema.org/ItemListOrderDescending",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "[Product]", "url": "[URL]" }
  ] }
```
```json
// FAQPage (target People Also Ask) — mirror visible Q/A on the page
{ "@context": "https://schema.org", "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "Is [A] better than [B]?",
      "acceptedAnswer": { "@type": "Answer", "text": "..." } }
  ] }
```
- `Product` + `AggregateRating` only when you hold real ratings (don't invent `reviewCount`/`ratingValue`).
- Keep JSON-LD in sync with visible content — mismatches risk a structured-data penalty.

---

## Conversion & Trust

- **CTA placement:** brief summary + CTA above fold; secondary CTA after the table; final recommendation + CTA at the bottom. Avoid aggressive CTAs inside competitor-description sections — it reads as biased and kills trust.
- **Social proof:** testimonials tied to the comparison criteria, third-party ratings *with source links*, "switched from [Competitor]" stories.
- **Pricing:** highlight value (not just lowest price), surface hidden costs (setup, per-seat, overage), link to the full pricing page.
- **Trust signals:** visible "last updated" date, author with relevant expertise, methodology disclosure, explicit disclosure of which product is ours.

### Fairness (non-negotiable)
- Accuracy: all competitor info verifiable from public sources.
- No defamation / no false or misleading claims.
- Cite sources; acknowledge competitor strengths honestly.
- Balanced presentation beats a hit-piece — it earns links and survives competitor scrutiny.

---

## Internal Linking
- Link from comparison sections to your own product/feature pages.
- Cross-link related comparisons ("A vs B" ↔ "A vs C") and wire them into the category hub.
- Breadcrumb: Home > Comparisons > [This Page].
- "Related comparisons" block at the bottom; link to any cited case studies/testimonials.

---

## Deliverables
- **Gap matrix** (sub-topic × competitor) + chosen wedges.
- **Teardown table** of top-3 SERP pages.
- **Prioritization scores** (0-100) with build/backlog/skip decision and the falsifiability hypothesis per page.
- **Page implementation** — RSC route + metadata + accessible table (≥ 1,500 words only if depth genuinely warrants it; depth over padding).
- **JSON-LD** matching visible content.
- **Recommendations** — improvements to existing comparison pages, new opportunities, schema/CTA fixes.

## Error Handling
| Scenario | Action |
|----------|--------|
| Competitor URL unreachable | Report which URLs failed; proceed with available data and note the gap. |
| Insufficient competitor data | Use "Not publicly available" in tables rather than guessing; flag the missing cells. |
| No product overlap | Report different markets; suggest overlapping competitors or pivot to a category roundup. |
| SERP dominated by non-comparison formats | Don't force a vs page — match the format the SERP rewards (listicle/vendor/forum). |

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
