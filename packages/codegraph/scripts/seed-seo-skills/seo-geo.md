---
name: seo-geo
description: >
  Generative Engine Optimization (GEO) — audit and implementation for AI search
  surfaces: Google AI Overviews and AI Mode, ChatGPT search, Perplexity, Bing
  Copilot. Covers AI-crawler accessibility, question-based citability scoring,
  passage extraction, server-side rendering checks for AI bots, llms.txt (with
  the primary-source caveat on real support), agent-friendly page checks, and a
  0-100 scoring rubric. Use when user says "AI Overviews", "AI Mode", "SGE",
  "GEO", "AI search", "LLM optimization", "Perplexity", "AI citations",
  "ChatGPT search", "agent-friendly", or "AI visibility". Triggers on: GEO,
  AEO, AI Overviews, AI Mode, generative engine optimization, llms.txt,
  AI crawler, citability, Perplexity, ChatGPT search.
version: 1.1.0
---

# AI Search / GEO Optimization

GEO is the practice of making content **extractable and citable** by AI search
surfaces. This skill is the technical/audit + implementation half: crawler
access, render strategy, passage citability, and a falsifiable scoring rubric.

For the broader content-strategy and AI-visibility-monitoring side (competitive
citation tracking, content briefs, getting cited as a source over time), see the
**ai-seo** skill — cross-reference it, don't duplicate it here.

## Primary Source: Google's AI Optimization Guidance

Google's own position (Search Central): **optimizing for generative AI search is
still SEO.** "AEO" and "GEO" are mostly rebranded labels for the same
fundamentals — quality content, crawlable/indexable pages, good structure,
unique value. Frame GEO findings as **SEO fundamentals applied to AI-search
surfaces**, not as a separate discipline.

Things Google has explicitly said do *not* move the needle (treat community
advice that contradicts this with skepticism, and note the contradiction in any
report):

- `llms.txt` is **not** a citation/ranking signal for Google's AI search.
- Artificially chunking content for "AI parsing" is unnecessary.
- AI-rephrasing existing copy to sound "LLM-friendly" does not help.
- Mention-farming / coordinated brand-mention campaigns are not a ranking lever.

The durable test for any page is the classic quality framing — **Who** made it
(real expertise/authorship), **How** it was made (original effort, not spun),
and **Why** it exists (to help users vs. to game search). If a tactic fails the
Who/How/Why test, drop it.

## Relationship between the two Google AI surfaces

Google runs **two distinct citation engines**, and they cite different URLs:

| Surface | Selection behaviour | Optimize for |
|---------|--------------------|--------------|
| **AI Overviews** | Strongly ranking-correlated — cites pages that already rank well | Classic SEO + passage optimization |
| **AI Mode** | Weakly ranking-correlated; broader pool (~9 domains cited/query) | Freshness, entity authority, citable passages beyond position 5 |

AI Mode and AI Overviews reach the same *conclusion* most of the time but cite
the same *URLs* a small minority of the time (Ahrefs, large query-pair study).
Treat them as separate surfaces and score both: ranking well in classic Search
feeds AI Overviews, but AI Mode draws from a broader pool where freshness and
entity authority outweigh raw position.

## Key Statistics (directional, verify before quoting to a client)

| Metric | Value | Source |
|--------|-------|--------|
| AI Overviews reach | ~1.5B users/month, 200+ countries | Google |
| AI Overviews query coverage | 50%+ of queries | Industry data |
| AI Mode monthly users | 1B+ | Google |
| AI-referred sessions growth | 527% (Jan–May 2025) | SparkToro |
| ChatGPT weekly active users | ~900M | OpenAI |

**Brand mentions correlate ~3x more strongly with AI visibility than backlinks**
(Ahrefs, Dec 2025, 75k brands). Of the mention signals, YouTube mentions show
the strongest correlation (~0.737); Domain Rating from backlinks is weak
(~0.266). Only ~11% of domains are cited by *both* ChatGPT and Google AIO for the
same query — platform-specific optimization is real.

---

## GEO Scoring Rubric (0–100)

Score each dimension 0–100, then weight. Every dimension has a **falsifiability
check**: how you would know it failed, plus the leading indicator to watch.

| # | Dimension | Weight |
|---|-----------|--------|
| 1 | Citability | 25% |
| 2 | Structural readability | 20% |
| 3 | Authority & freshness | 20% |
| 4 | Technical accessibility (AI crawlers + render) | 20% |
| 5 | Multi-modal content | 15% |

`final = round(0.25·cite + 0.20·struct + 0.20·auth + 0.20·tech + 0.15·multi)`

Bands: **80–100** AI-ready · **60–79** competitive, gaps remain · **40–59**
significant work · **<40** largely invisible to AI surfaces.

### 1. Citability (25%)

Run passage scoring against **boilerplate-stripped main text** (strip nav,
header, footer, sidebars — use your own extractor/crawler), not raw HTML, so
chrome doesn't dilute the signal.

- Optimal self-contained answer block: **~134–167 words.**
- Front-load it: a large share of AI citations come from the first ~30% of a
  page (SE Ranking) — put the most citable answer near the top, not below the fold.
- Direct answer in the **first 40–60 words** of each section.
- "X is…" / "X refers to…" definition patterns score high.
- Specific facts/statistics with source attribution; unique data points.
- Penalize: vague generalities, buried conclusions, opinion without evidence.

**Falsifiability:** *Failed if* an AI surface, asked the page's target question,
answers without citing the page despite the page ranking on p1. *Leading
indicator:* of the top question-headings, what % have a clean, extractable
40–60-word answer block immediately under them? Below ~50% predicts low citation.

### 2. Structural readability (20%)

- Clean H1→H2→H3 hierarchy; no skipped levels.
- **Question-based headings** that mirror real query phrasing (see citability
  scoring below).
- Short paragraphs (2–4 sentences); lists for steps/multi-item; tables for
  comparative data; FAQ Q&A blocks.
- Penalize: wall-of-text, inconsistent hierarchy, no lists/tables.

**Falsifiability:** *Failed if* a heading outline extracted from the DOM reads
as topical labels ("Overview", "Features") rather than questions a user types.
*Leading indicator:* ratio of question-form headings to total headings.

### 3. Authority & freshness (20%)

- Author byline with real credentials; Organization + Person entity signals.
- Citations to primary sources (studies, official docs, data).
- Entity presence: Wikipedia/Wikidata, Reddit, YouTube, LinkedIn (`sameAs`).
- **Freshness is high-leverage.** Recent content (under ~3 months) is markedly
  more likely to be cited; pages left stale 6+ months lose citation eligibility
  (SE Ranking, 1.3M-citation study). A scheduled refresh program — with a real
  `dateModified` change, not a touched timestamp — is one of the best GEO plays.
- Penalize: anonymous authorship, missing dates, no sources.

**Falsifiability:** *Failed if* the most valuable pages have `dateModified`
older than 6 months with no substantive update. *Leading indicator:* median age
of top-traffic pages.

### 4. Technical accessibility (20%)

**AI crawlers generally do NOT execute JavaScript** — content that only appears
after client hydration is invisible to most of them. Server render it.

- SSR/RSC vs client-only: is the answer in the initial HTML?
- AI crawler access in `robots.txt` (see table below).
- "Agent-friendly" basics: stable URLs, real `<a href>` links (not JS-only
  click handlers), text content in HTML rather than canvas/image-only.
- `llms.txt` presence (reported, **zero citation weight** — see caveat).

**Falsifiability:** *Failed if* `curl`-ing the URL (no JS) returns a shell
without the primary answer text. *Leading indicator:* ratio of
extractable-text bytes in raw HTML vs. post-hydration DOM.

### 5. Multi-modal content (15%)

Pages with relevant images/video/charts/interactive elements show materially
higher AI selection rates. Check for text + relevant media, supporting
structured data, and that media has real alt/captions (text the crawler reads).

**Falsifiability:** *Failed if* a how-to/comparison page is text-only where the
query clearly wants a visual. *Leading indicator:* presence of at least one
captioned, relevant media element per major section.

---

## Question-based citability scoring (per heading)

AI answers are question-shaped. Score each section heading and its lead passage:

1. **Is the heading a question** (or trivially rephrasable as one matching a real
   query)? Headings like "How do I…", "What is…", "X vs Y" are prime.
2. **Does the first sentence answer it directly** in 40–60 words, self-contained?
3. **Is there a quotable fact/number with attribution** in the block?
4. **Is the block extractable** without surrounding context?

Score each 0/1, average over headings → section citability sub-score. This is the
fastest lever: rewriting H2/H3s as questions and adding a direct lead answer
raises citability without new content.

---

## AI Crawler Access (robots.txt)

| Crawler | Owner | Purpose |
|---------|-------|---------|
| GPTBot | OpenAI | ChatGPT web/search |
| OAI-SearchBot | OpenAI | OpenAI search features |
| ChatGPT-User | OpenAI | ChatGPT browsing on user request |
| ClaudeBot | Anthropic | Claude web features |
| PerplexityBot | Perplexity | Perplexity AI search |
| Google-Extended | Google | Gemini/Vertex training opt-out token |
| CCBot | Common Crawl | Training data (often blocked) |
| Bytespider | ByteDance | TikTok/Douyin AI |

**Recommendation:** allow GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot,
PerplexityBot for AI-search visibility. Note that `Google-Extended` is a
training opt-out token — blocking it does *not* remove you from AI Overviews/AI
Mode (those follow normal Googlebot crawling). Block CCBot / training-only
crawlers only if licensing policy requires it.

### Next.js robots config (App Router)

```ts
// app/robots.ts
import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'
const AI_SEARCH_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      // Explicitly allow AI search crawlers (overrides any future global tightening)
      ...AI_SEARCH_BOTS.map((userAgent) => ({ userAgent, allow: '/' })),
      // Block training-only crawler if licensing requires it:
      { userAgent: 'CCBot', disallow: '/' },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  }
}
```

---

## Server-side rendering: the make-or-break check

Because AI crawlers don't run JS, the citable answer must be in the **initial
HTML payload**. On our stack this means rendering it in a Server Component
(default), not gating it behind a `'use client'` boundary that fetches on mount.

```tsx
// app/[locale]/guides/[slug]/page.tsx — RSC: answer is in the HTML, no JS needed
import { getTranslations } from 'next-intl/server'
import { getGuide } from '@/lib/payload'

export default async function GuidePage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug } = await params
  const guide = await getGuide(slug) // server fetch — rendered before send

  return (
    <article>
      <h1>{guide.title}</h1>
      {/* Lead answer block: 40–60 words, self-contained, first thing in the DOM */}
      <p className="lead">{guide.summary}</p>
      {guide.sections.map((s) => (
        <section key={s.id}>
          {/* Question-form heading mirrors the target query */}
          <h2>{s.question}</h2>
          <p>{s.directAnswer}</p>
          {s.body}
        </section>
      ))}
    </article>
  )
}
```

Verify with a JS-disabled fetch (use your own crawler/tooling, or
`curl -A "GPTBot" <url>`): the answer text must be present in the raw HTML.

---

## llms.txt — implement, but no false hope

The `/llms.txt` convention lets a site advertise its structured content to
agents. **Primary-source caveat:** Google has stated it is *not* a citation or
ranking signal for AI search, and server-log audits show major AI search systems
rarely fetch it. Report its presence in an audit but assign it **zero
citation-ranking weight**. It is cheap and harmless to ship (some agent tooling
reads it), so treat it as hygiene, not a lever — never promise visibility gains
from it.

```
# Example /llms.txt
# Acme Docs
> Developer documentation for the Acme platform.

## Core
- [Quickstart](https://example.com/docs/quickstart): 5-minute setup
- [API reference](https://example.com/docs/api): Full endpoint reference

## Key facts
- Founded 2019, EU-hosted, GDPR-compliant
```

You can serve it statically (`public/llms.txt`) or generate it from the CMS:

```ts
// app/llms.txt/route.ts — generated from Payload content
import { getDocsIndex } from '@/lib/payload'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'

export const revalidate = 3600

export async function GET() {
  const pages = await getDocsIndex()
  const body = [
    '# Acme Docs',
    '> Developer documentation for the Acme platform.',
    '',
    '## Core',
    ...pages.map((p) => `- [${p.title}](${SITE}${p.path}): ${p.summary}`),
  ].join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
```

---

## Structured data for AI discoverability (RSC, JSON-LD)

Emit entity signals server-side. Keep `dateModified` honest — bump it only on a
real content change so the freshness signal stays trustworthy.

```tsx
// Inside the RSC page — Article + Person + Organization signals
function JsonLd({ guide, site }: { guide: Guide; site: string }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt, // real modification date only
    author: {
      '@type': 'Person',
      name: guide.author.name,
      jobTitle: guide.author.role,
      sameAs: guide.author.profiles, // LinkedIn, Wikipedia, etc.
    },
    publisher: {
      '@type': 'Organization',
      name: 'Acme',
      sameAs: [`${site}`, 'https://www.linkedin.com/company/acme'],
    },
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}
```

For FAQ/HowTo markup and full schema patterns, defer to the **seo-schema**
skill rather than re-deriving it here.

---

## Platform-Specific Optimization

| Platform | Key citation sources | Focus |
|----------|---------------------|-------|
| **Google AI Overviews** | Pages that already rank well | Classic SEO + passage optimization |
| **Google AI Mode** | Broader pool, weak rank correlation | Freshness, entity authority, citable passages beyond p5 |
| **ChatGPT** | Wikipedia (~48%), Reddit (~11%) | Entity presence, authoritative sources |
| **Perplexity** | Reddit (~47%), Wikipedia | Community validation, recency, structure |
| **Bing Copilot** | Bing index, authoritative sites | Bing SEO, IndexNow |

---

## Audit Output

Produce `GEO-ANALYSIS.md`:

1. **GEO Readiness Score: XX/100** + per-dimension breakdown
2. **Per-surface scores** (AI Overviews, AI Mode, ChatGPT, Perplexity, Copilot)
3. **AI crawler access status** — exactly which bots allowed/blocked + the
   `robots.txt` directives to fix it
4. **SSR/render check** — does the raw HTML contain the answer text? (per key page)
5. **Passage citability** — question-heading score, identified weak blocks, and
   specific 134–167-word rewrites
6. **Authority & freshness** — author/entity signals, median page age
7. **llms.txt status** — present/absent (zero ranking weight; template if absent)
8. **Top 5 highest-impact changes** with effort estimates
9. **Falsifiability notes** — for each top change, how we'd know it worked
   (leading indicator) and how we'd know it failed

When a community recommendation contradicts Google's primary-source guidance,
defer to Google and flag the contradiction.

### Error handling

| Scenario | Action |
|----------|--------|
| URL unreachable | Report clearly; don't guess content; ask user to verify URL |
| AI crawlers blocked | List exactly which are blocked; provide `robots.txt` fix |
| No `llms.txt` | Note absence (zero weight); provide template; don't oversell it |
| Answer absent from raw HTML | Flag client-only rendering; recommend RSC/SSR move |
| No structured data | Recommend Article/Organization/Person (defer to seo-schema) |

---

## Priority Playbook

**Quick wins** — rewrite H2/H3s as questions; add a 40–60-word direct answer
under each; front-load the most citable block; add specific stats with sources;
publish/updated dates; allow key AI crawlers in `robots.txt`; Person schema for
authors.

**Medium** — move client-only answer content into RSC/SSR; author bios with
credentials + `sameAs`; comparison tables; ship `/llms.txt` (hygiene only);
set up a content-freshness refresh cadence.

**High impact** — original research/surveys (unique citability); entity
presence (Wikipedia/Wikidata, YouTube, Reddit); comprehensive `sameAs` entity
linking; build/own a useful tool or calculator that earns mentions.

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
