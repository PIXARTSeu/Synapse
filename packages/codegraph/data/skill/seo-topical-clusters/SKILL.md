---
name: seo-topical-clusters
description: >
  Build topical authority with pillar/cluster (hub-and-spoke) content architecture,
  internal-linking strategy, content-gap analysis, and cannibalization avoidance —
  with Next.js App Router internal-linking patterns and a coverage-scoring rubric.
  Use when planning content architecture, building topical authority, designing a
  pillar page with supporting cluster pages, fixing keyword cannibalization, or
  auditing internal links. Triggers on: topic cluster, content cluster, topical
  authority, pillar page, hub and spoke, internal linking, content gap, keyword
  cannibalization, semantic clustering, content architecture, orphan pages.
version: 1.0.0
---

# SEO Topical Clusters

Build **topical authority** — search engines reward sites that cover a topic
comprehensively and interlink it coherently, not sites with scattered one-off posts.
The unit of authority is the **cluster**: one broad **pillar page** plus several
focused **spoke pages**, all interlinked, each owning a distinct query.

This skill covers: how to scope a cluster, group keywords by *real SERP behaviour*
(not text similarity), avoid cannibalization, wire internal links in Next.js, find
content gaps, and score topical coverage with a falsifiable rubric.

---

## When to use

- Planning a new content section and you want it to rank as a topic, not isolated pages.
- Two pages compete for the same query (cannibalization) and rankings flip-flop.
- A page ranks but has no supporting context, or is an orphan (no internal links in).
- Auditing whether a topic is "fully covered" or has gaps competitors fill.

If the task is single-page on-page optimization, schema, or Core Web Vitals, use the
respective dedicated skill instead.

---

## Core model: hub and spoke

```
                    ┌──────────────────┐
                    │   PILLAR PAGE     │   broad head term, 2500-4000 words
                    │  /guide/topic     │   links OUT to every spoke
                    └───────┬──────────┘   receives a link FROM every spoke
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
      ┌──────────┐    ┌──────────┐    ┌──────────┐
      │ spoke A1 │◄──►│ spoke A2 │    │ spoke B1 │   focused intent, 1200-1800 words
      └──────────┘    └──────────┘    └──────────┘   spoke↔spoke within a cluster
        cluster A (subtopic)            cluster B
```

- **Pillar**: targets the broad, high-volume head term. Comprehensive but not
  exhaustive — it summarizes each subtopic and links to the spoke that goes deep.
- **Spoke**: targets one specific intent/long-tail query. Goes deep on one thing,
  links back up to the pillar and sideways to sibling spokes.
- **Cluster**: a subtopic group of 2-4 spokes. A pillar has 2-5 clusters.

Rule of thumb sizes (adjust to competition, don't pad to hit a number):

| Page type | Word count | Internal links out (in-body) |
|-----------|------------|------------------------------|
| Pillar | 2500-4000 | one to each spoke |
| Spoke | 1200-1800 | 1 to pillar + 2-3 siblings |

---

## Step 1 — Scope the topic and expand keywords

Start from one seed (a head term or a URL you want to rank). Expand to 30-50 candidate
queries using whatever research tooling you have (use your own crawler/keyword tool,
or manual SERP inspection):

1. **Related / "people also search for"** from the seed's SERP.
2. **People Also Ask (PAA)** questions — each is a potential spoke.
3. **Long-tail modifiers**: `best`, `how to`, `vs`, `for beginners`, `tools`,
   `examples`, `template`, `mistakes`, `checklist`.
4. **Question variants**: who / what / when / where / why / how.
5. **Intent modifiers**: `pricing`, `review`, `alternative`, `comparison`, `free`, `top`.

Deduplicate (lowercase, strip articles, remove near-identical). Target 30-50 unique
candidates. If under ~30, run a second pass seeding from the top PAA questions.

---

## Step 2 — Cluster by SERP overlap, not text similarity

The key idea (and the most defensible one): **group keywords by how Google actually
ranks them**. Two queries belong on the same page only if Google already serves the
same pages for both. Text similarity lies; SERP overlap does not.

**Method** — for each candidate pair, fetch the top-10 *organic* results for both
queries (ignore ads, the featured snippet, PAA, map packs) and count shared URLs:

| Shared top-10 URLs | Relationship | Action |
|--------------------|--------------|--------|
| 7-10 | **Same page** | Merge — one page targets both (prevents cannibalization) |
| 4-6 | **Same cluster** | Distinct spokes under one subtopic, interlinked |
| 2-3 | **Interlink** | Adjacent clusters; add 1 cross-link |
| 0-1 | **Separate** | Different cluster, or drop from this topic |

**Keep it cheap.** Full pairwise on 40 keywords = 780 comparisons. Don't. Instead:
- Pre-group by intent (Step 3) first → ~4 groups of ~10 → 4 × 45 = 180 comparisons.
- Only cross-check keywords at group boundaries.
- Assume long-tail variants of the same head term share a cluster (skip the compare).

If you have no SERP-data access, fall back to intent + manual judgment, and flag the
plan as "intent-only clustered" so it's revisited when SERP data is available.

---

## Step 3 — Classify intent (and drop what doesn't belong)

| Intent | Signals | In cluster? |
|--------|---------|-------------|
| Informational | how, what, why, guide, tutorial, learn | Yes |
| Commercial | best, top, review, comparison, vs, alternative | Yes |
| Transactional | buy, price, pricing, demo, sign up, get started | Yes (usually a landing page, not a blog spoke) |
| Navigational | brand/product names, login | No — exclude |

Classify by *dominant* intent for mixed queries ("best CRM software" → commercial).
Intent also drives the page template:

| Intent pattern | Page template |
|----------------|---------------|
| Informational, broad | ultimate guide (often the pillar) |
| Informational, "how" | how-to |
| Informational, list | listicle |
| Commercial, compare | comparison / "X vs Y" |
| Commercial, rank | best-of |
| Transactional | landing page (Server Component, CTA-led) |

---

## Step 4 — Cannibalization avoidance

Cannibalization = two of *your own* pages competing for one query. Google picks one
(often the weaker), splits link equity, and rankings oscillate.

Prevention rules:
- **No two pages share the same primary keyword.** One query → one canonical page.
- If SERP overlap between two candidates is **7+**, they are the same page — merge them.
- Pillar targets the head term; spokes target long-tails. The pillar must *not* try to
  rank for a spoke's exact long-tail (it links to the spoke instead).

How to detect existing cannibalization on a live site:
1. For the suspect query, `site:yourdomain.com "query"` and see how many pages match.
2. In Search Console, check if multiple URLs get impressions for the *same* query with
   none holding a stable position — that flip-flop is the tell.
3. Fix by: merge + 301 the loser → winner, or differentiate intent and re-point
   internal links/anchors to the page you want to win.

---

## Step 5 — Internal-link matrix

Links are how authority flows and how Google understands the cluster. Design them
explicitly; don't leave it to chance.

| Link | Direction | Requirement |
|------|-----------|-------------|
| Spoke → pillar | spoke → pillar | Mandatory, every spoke |
| Pillar → spoke | pillar → spoke | Mandatory, every spoke |
| Spoke ↔ spoke (same cluster) | bidirectional | 2-3 per spoke |
| Cross-cluster | spoke → spoke (other cluster) | 0-1, only if SERP overlap 2-3 |

Rules:
- Every page has **≥ 3 incoming** internal links. Zero orphans.
- Every spoke is **reachable from the pillar in ≤ 2 clicks**.
- Anchor text = target keyword or a close variant. Never "click here" / "read more".
- Links live **in body content**, not only in nav/sidebar/footer (footer links carry
  little topical signal).

Represent the plan as an adjacency list so it's checkable and renderable:

```json
{
  "pillar": { "slug": "topic", "keyword": "topic" },
  "clusters": [
    { "name": "Subtopic A", "spokes": [
      { "slug": "topic-how-to", "keyword": "how to topic", "template": "how-to" },
      { "slug": "topic-examples", "keyword": "topic examples", "template": "listicle" }
    ]}
  ],
  "links": [
    { "from": "topic", "to": "topic-how-to", "type": "mandatory", "anchor": "how to topic" },
    { "from": "topic-how-to", "to": "topic", "type": "mandatory", "anchor": "topic" },
    { "from": "topic-how-to", "to": "topic-examples", "type": "sibling", "anchor": "topic examples" }
  ]
}
```

---

## Step 6 — Implement in Next.js (App Router + RSC)

Internal linking in a content cluster should be **data-driven**, not hand-typed in
every MDX/post — that's how you avoid orphans and broken anchors as the cluster grows.

**Model the cluster as data** (Payload CMS collection, MDX frontmatter, or a typed
config) so links are derived, not duplicated:

```ts
// content/clusters/topic.ts
export type Spoke = {
  slug: string;
  title: string;
  keyword: string;          // primary keyword — must be unique across the cluster
  cluster: string;          // subtopic name
  template: 'how-to' | 'listicle' | 'comparison' | 'best-of' | 'landing-page';
  siblings?: string[];      // slugs of related spokes (2-3)
};

export const pillar = { slug: 'topic', title: 'The Complete Guide to Topic' };

export const spokes: Spoke[] = [
  { slug: 'topic-how-to', title: 'How to Topic', keyword: 'how to topic',
    cluster: 'Basics', template: 'how-to', siblings: ['topic-examples'] },
  { slug: 'topic-examples', title: 'Topic Examples', keyword: 'topic examples',
    cluster: 'Basics', template: 'listicle', siblings: ['topic-how-to'] },
];
```

**Pillar links out to every spoke** (RSC, no client JS, fully crawlable `<a>`):

```tsx
// app/[locale]/guide/[topic]/page.tsx
import Link from 'next/link';
import { spokes } from '@/content/clusters/topic';

export default function PillarPage() {
  return (
    <article>
      {/* ...pillar body... */}
      <nav aria-label="In this guide">
        <ul>
          {spokes.map((s) => (
            <li key={s.slug}>
              <Link href={`/guide/${s.slug}`}>{s.keyword}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
```

**Every spoke links back to the pillar + its siblings** via a shared component:

```tsx
// components/cluster-links.tsx (Server Component)
import Link from 'next/link';
import { pillar, spokes } from '@/content/clusters/topic';

export function ClusterLinks({ current }: { current: string }) {
  const me = spokes.find((s) => s.slug === current);
  const siblings = spokes.filter((s) => me?.siblings?.includes(s.slug));
  return (
    <aside aria-label="Related">
      <Link href={`/guide/${pillar.slug}`} rel="up">{pillar.title}</Link>
      {siblings.map((s) => (
        <Link key={s.slug} href={`/guide/${s.slug}`}>{s.keyword}</Link>
      ))}
    </aside>
  );
}
```

Next.js / crawlability notes:
- Use `next/link` with real `href`s — emit `<a href>` so the link graph is crawlable.
- Do **not** gate cluster links behind `onClick`, JS-only routers, or hover menus; those
  don't pass topical signal reliably.
- Reflect hierarchy in URLs (`/guide/topic`, `/guide/topic-how-to`) and add
  `BreadcrumbList` JSON-LD (see the schema skill) so Google reads the structure.
- For multilingual sites (next-intl), keep the cluster graph **within one locale** and
  set `hreflang`/`alternates` per page — never cross-link spokes across locales.
- Sitemap: generate `app/sitemap.ts` from the same cluster data so every spoke is
  discoverable and nothing is orphaned.

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next';
import { pillar, spokes } from '@/content/clusters/topic';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL!;
  return [
    { url: `${base}/guide/${pillar.slug}`, priority: 0.9 },
    ...spokes.map((s) => ({ url: `${base}/guide/${s.slug}`, priority: 0.7 })),
  ];
}
```

---

## Step 7 — Content-gap analysis (filling the topic)

A topic is "covered" when every subtopic a competitor ranks for has a home in your
cluster. To find gaps:

1. List the top 3-5 ranking domains for your pillar head term.
2. For each, enumerate the pages/sections they have that you don't (their nav,
   internal links, and ranking long-tails).
3. Map each missing subtopic to: an existing spoke (expand it), a new spoke, or "out
   of scope" (decide deliberately, don't ignore).
4. Re-run the SERP-overlap check (Step 2) before adding a spoke — confirm it's a
   *separate* page, not something that should merge into an existing one.

Prioritize gaps by: search demand × intent value × how cheaply you can win (low
competition, you already have adjacent authority).

---

## Coverage scoring rubric (0-100)

Score a cluster's structural health. This is about *architecture quality*, not
rankings (rankings are the lagging outcome). Use it as a pre-publish gate and a
periodic audit.

| Dimension | Weight | Full marks when |
|-----------|--------|-----------------|
| Coverage | 25 | Every planned subtopic has a published page; no gaps vs top competitors |
| Internal linking | 20 | Every page ≥ 3 incoming links; pillar↔spoke 100%; in-body anchors |
| No orphans | 15 | 0 pages unreachable; all spokes ≤ 2 clicks from pillar |
| No cannibalization | 15 | 0 duplicate primary keywords; no two pages competing for one query |
| Intent/template fit | 10 | Each page's template matches its dominant intent |
| Depth adequacy | 10 | Pillar 2500-4000w, spokes 1200-1800w, each fully answers its query |
| Anchor quality | 5 | Descriptive keyword anchors, no "click here", no over-optimization |

Bands: **90-100** authoritative cluster · **70-89** solid, minor gaps · **50-69**
structurally weak (orphans/cannibalization likely) · **<50** not a cluster yet.

### Falsifiability — how would we know this failed?

A cluster can score 100 structurally and still fail to build authority. Define the
failure test up front:

- **Hypothesis**: clustering + interlinking grows topical authority → more of the
  cluster ranks page 1 within 8-12 weeks.
- **Leading indicators** (weeks 1-4, before rankings move):
  - Cluster pages get crawled and indexed (Search Console coverage).
  - Internal-link impressions rise; spokes start getting impressions for their target
    long-tails (even if position is low).
  - Avg. crawl depth to spokes drops to ≤ 2.
- **Lagging confirmation** (weeks 8-12): pillar moves up for the head term; ≥ half the
  spokes reach page 1 for their primary keyword; cannibalization flip-flops stop.
- **It failed if**: spokes stay un-indexed or have 0 impressions after 4 weeks
  (discoverability/orphan problem) → re-check the link matrix and sitemap; OR
  impressions exist but positions don't improve over 12 weeks (content-quality or
  intent-mismatch problem, not architecture) → revisit template/depth, not links.

This split matters: a discoverability failure is fixed by *links*, a ranking failure
is fixed by *content*. Misdiagnosing wastes a quarter.

---

## Pre-delivery checklist

- [ ] No two pages share the same primary keyword (cannibalization).
- [ ] Every spoke links to the pillar; pillar links to every spoke.
- [ ] Every page has ≥ 3 planned incoming internal links.
- [ ] No orphan pages; every spoke ≤ 2 clicks from pillar.
- [ ] Template matches dominant intent for each page.
- [ ] Word-count targets met (pillar 2500-4000, spokes 1200-1800).
- [ ] Cluster size sane (2-5 clusters, 2-4 spokes each).
- [ ] SERP overlap supports groupings (no spoke with < 4 overlap to its cluster peers).
- [ ] Links emit real `<a href>` (crawlable), in body content, with keyword anchors.
- [ ] Sitemap and breadcrumbs generated from the same cluster data source.
- [ ] Cross-skill: Article + BreadcrumbList (+ ItemList for the pillar) JSON-LD added.

---

## Common mistakes

- Clustering by text similarity instead of SERP overlap → pages that don't actually
  belong together, or merges that should stay split.
- Pillar trying to rank for spoke long-tails → self-cannibalization.
- Links only in nav/footer → weak topical signal; put them in the body.
- Orphan spokes published but never linked → un-indexed, invisible.
- Padding pillar to 4000 words instead of linking depth out to spokes.
- Cross-linking spokes across locales on a multilingual site → dilutes per-locale graph.

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
