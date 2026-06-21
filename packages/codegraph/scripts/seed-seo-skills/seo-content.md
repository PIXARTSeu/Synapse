---
name: seo-content
description: >
  Content quality, E-E-A-T analysis, search-intent mapping, content-brief
  generation, and AI-citation readiness for Next.js sites. Use when the user
  says "content quality", "E-E-A-T", "content analysis", "content audit",
  "readability check", "thin content", "content brief", "content outline",
  "search intent", or "helpful content". Triggers on: E-E-A-T, content audit,
  content brief, search intent, citability, helpful content, thin content,
  AI citation, GEO content.
version: 1.1.0
---

# Content Quality, E-E-A-T & Content Briefs

Two modes:
1. **Audit** an existing page — score quality, E-E-A-T, citability; emit ranked, falsifiable fixes.
2. **Brief** — produce a competitive content brief / outline a writer can ship.

This skill is for the *content* layer. For rendering meta tags, JSON-LD, and feeds in Next.js, cross-reference `seo-technical`; for AI-search surfaces, `seo-geo`.

---

## Google's "Who / How / Why" test (run this first)

Before scoring sub-factors, every page must pass Google's own three-question helpful-content heuristic. This is the cheapest, highest-signal check.

| Question | What to look for | Fail signal |
|---|---|---|
| **Who** created it? | Visible byline, author bio/credentials. Non-negotiable for YMYL (health, finance, legal, safety). | No author, no bio, generic "admin" |
| **How** was it created? | Process disclosure where a reader would ask — especially AI-assisted content. First-hand evidence, original research, lived experience. | No method, no evidence, scraped/spun feel |
| **Why** does it exist? | "To help people," not "to attract search clicks." | Niche entry without expertise, content churn for freshness, written to a word-count target |

Primary source: https://developers.google.com/search/docs/fundamentals/creating-helpful-content

When all three answers are weak, the page is at risk under the core ranking system's helpfulness signals (formerly the standalone Helpful Content System, **merged into core during the March 2024 core update** — no longer a separate classifier; helpfulness is now weighted continuously in every core update).

---

## E-E-A-T framework

### Experience (first-hand signals)
Original research, case studies, before/after results, personal anecdotes, process documentation, proprietary data, photos/videos from direct experience.

### Expertise
Author credentials and bio, professional background relevant to topic, technical depth matched to audience, accurate well-sourced claims.

### Authoritativeness
External citations and backlinks from authoritative sources, brand mentions, industry recognition, citation by other experts.

### Trustworthiness (weighted highest)
Contact info / physical address, privacy policy & terms, customer testimonials/reviews, date stamps, transparent corrections, HTTPS. For YMYL, Trust is the gate — a page that fails Trust cannot be rescued by the other three.

---

## Search-intent mapping (do this before scoring or briefing)

Misjudged intent is the single most common reason good content under-performs. Classify the target query, then check the page matches.

| Intent | User wants | SERP format Google rewards |
|---|---|---|
| **Informational** | to learn | guide, how-to, definition, FAQ |
| **Commercial** | to compare before buying | "best X" listicle, comparison table, review |
| **Transactional** | to act now | landing/product page, pricing, booking form |
| **Navigational** | a specific site/page | branded result |

Then ask: *does the page format match the rewarded format?* A long essay ranking for a transactional query, or a thin landing page for an informational query, is an intent mismatch — fix the format before tuning words.

**Falsifiability:** *How would we know an intent fix failed?* Position and CTR for the target query do not improve within 2 crawl cycles after the format change. **Leading indicator:** SERP feature alignment (does our page type now match the top 3 results' page type?).

---

## Content metrics

### Word count — coverage floors, NOT targets
| Page type | Floor |
|---|---|
| Homepage | 500 |
| Service page | 800 |
| Blog post | 1,500 |
| Product page | 300+ (400+ complex) |
| Location page | 500–600 |

Word count is **not** a direct ranking factor (Google-confirmed). These are topical-coverage floors. A 500-word page that fully answers the query beats a 2,000-word page that doesn't. Treat under-floor pages as *coverage suspects*, then verify by topic, not length.

### Readability
Flesch Reading Ease 60–70 for general audiences; average sentence 15–20 words; paragraphs 2–4 sentences; grade level matched to audience. Readability is a **quality proxy, not a ranking factor** (Mueller-confirmed; Yoast deprioritized Flesch in v19.3). Use it to find walls of text, not to chase a number.

### Keyword optimization
Primary keyword in title, H1, and first 100 words; natural density ~0.5–2% (above 2% review, above 3% stuffing risk); semantic variations present. First 1–2 mentions carry the most weight — diminishing returns after.

### Structure
Logical heading hierarchy (one H1 → H2 → H3); scannable descriptive headings; lists/tables where they beat prose; ToC for long-form.

### Linking
Internal: 3–5 relevant links per 1,000 words, descriptive anchors, no orphans. External: cite authoritative sources, reasonable count.

---

## Originality & information gain (the helpful-content gate)

Helpfulness is now a core ranking signal, so "information gain" — what this page adds that no current result provides — is the real bar. Acceptable answers are **specific**:

- Proprietary data or original research
- Case studies with real outcomes
- Expert quotes / first-hand experience
- Original synthesis or a unique framework

NOT acceptable: "more detail," "better formatting," "more comprehensive." If the only gain is length, the page has no information gain.

### AI-generated content markers (Sept 2025 QRG)
Google's raters formally assess whether content *appears* AI-generated. AI content is fine **if** it demonstrates genuine E-E-A-T and original value with human oversight. Flag as low-quality when you see: generic phrasing, no original insight, repetitive structure across pages, no author attribution, factual inaccuracies.

---

## Citability & AI-citation readiness (GEO)

To be quoted by AI Overviews, AI Mode, ChatGPT, Perplexity, Copilot, surface content the way an extractor wants it:

- **Quotable, self-contained statements** with concrete stats/facts (a sentence that survives being copied out of context)
- **Answer-first formatting** — lead each section with the answer, then support it
- **Strong heading hierarchy** mapping questions → answers
- **Tables/lists** for comparative or step data
- **First-party data** — original numbers get cited disproportionately
- **Entity clarity** — brand, authors, key concepts defined and backed by `Organization`/`Person` schema (see `seo-technical`)
- **Topical authority** — clusters, not isolated pages

Per Google's own AI-optimization guidance, "AEO"/"GEO" are rebranded SEO: AI Overviews and AI Mode are grounded in the same ranking and quality systems as classic Search. Optimize fundamentals (quotability, attribution, hierarchy, freshness) rather than chasing a "separate" discipline. Note AI Mode and AI Overviews are *distinct citation engines* that share only a minority of cited URLs — optimize for both. Detailed workflows live in `seo-geo`.

**Falsifiability:** *How would we know a citability fix failed?* The page is still absent from AI-answer citations for its target questions after re-indexing. **Leading indicator:** does the answer-first paragraph stand alone as a coherent answer when read in isolation? If not, an extractor can't lift it.

### Freshness
Publication date visible; "last updated" when revised; flag content >12 months stale for fast-moving topics. Freshness theater (date bump with no substantive change) is a *why* failure — do not recommend it.

---

## Implementation: surfacing trust signals in Next.js 15

Audit findings are worthless if the stack can't render the fix. Common patterns for an App Router + Payload + next-intl site:

**Author/E-E-A-T block from Payload, with Person JSON-LD:**
```tsx
// app/[locale]/blog/[slug]/AuthorByline.tsx  (Server Component)
import type { Author } from '@/payload-types'

export function AuthorByline({ author, updatedAt }: { author: Author; updatedAt: string }) {
  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    jobTitle: author.role,
    url: author.profileUrl,
    sameAs: author.socialLinks?.map((l) => l.url) ?? [],
  }
  return (
    <div className="flex items-center gap-3 border-t pt-4 text-sm">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
      {author.avatar && <img src={author.avatar.url} alt={author.name} className="h-10 w-10 rounded-full" />}
      <div>
        <p className="font-medium">{author.name}</p>
        {author.role && <p className="text-muted-foreground">{author.role}</p>}
        <p className="text-muted-foreground">
          Updated <time dateTime={updatedAt}>{new Date(updatedAt).toLocaleDateString()}</time>
        </p>
      </div>
    </div>
  )
}
```

**Honest freshness — only show "updated" when content actually changed.** Persist a `contentRevisedAt` in Payload that you bump on substantive edits (not on every save), and render that, never `new Date()`:
```tsx
// Render only when the body changed, not on metadata-only saves
{post.contentRevisedAt && post.contentRevisedAt !== post.publishedAt && (
  <time dateTime={post.contentRevisedAt}>Updated {fmt(post.contentRevisedAt)}</time>
)}
```

**Article schema with author + dates** belongs alongside content (full helper in `seo-technical`); the content layer's job is to *supply real values* (`author`, `datePublished`, `dateModified`) — never placeholder dates.

---

## Scoring rubric (0–100)

Score each page, weighting toward Trust as Google does.

```
Content Quality Score = E-E-A-T (40) + Helpfulness/Info-gain (25)
                      + Structure & readability (15)
                      + Citability (10) + Freshness/intent match (10)
```

### E-E-A-T breakdown (40 pts, Trust-weighted)
| Factor | Pts | Score when… |
|---|---|---|
| Experience | 0–8 | first-hand evidence present and specific |
| Expertise | 0–10 | named author, relevant credentials, accurate |
| Authoritativeness | 0–10 | external recognition / quality citations |
| Trustworthiness | 0–12 | contact, policies, HTTPS, transparency (gate for YMYL) |

### Band interpretation
| Score | Verdict |
|---|---|
| 85–100 | Strong — minor polish |
| 65–84 | Solid — targeted gaps |
| 45–64 | At risk — structural work needed |
| <45 | Failing — likely suppressed; rebuild around Who/How/Why |

---

## Falsifiability per recommendation (mandatory)

This is the discipline that separates an audit from a wish list. **Every** recommendation must ship with two lines:

- **Falsification:** the observable that would prove the fix *did not* work (e.g. "if position for [query] hasn't moved within 2 crawl cycles after publishing the case study, the info-gain hypothesis was wrong").
- **Leading indicator:** the fast proxy you can read before rankings move (e.g. impressions in Search Console, AI-answer inclusion, SERP-feature alignment, dwell/scroll depth).

A recommendation with no falsification is an opinion. Reject your own suggestions that can't be falsified.

---

## Audit output format

```
### Content Quality Score: XX/100

### Who/How/Why
- Who: pass/fail — <evidence>
- How: pass/fail — <evidence>
- Why: pass/fail — <evidence>

### E-E-A-T Breakdown
| Factor | Score | Key signals |
|--------|-------|-------------|
| Experience | XX/8 | ... |
| Expertise | XX/10 | ... |
| Authoritativeness | XX/10 | ... |
| Trustworthiness | XX/12 | ... |

### Search-intent match: <intent> — match / mismatch (why)
### Citability / AI-readiness: XX/10
### Information gain: <the specific new value, or "none — flag">

### Ranked recommendations
1. <fix> — Impact: H/M/L — Effort: H/M/L
   - Falsification: <observable that proves it failed>
   - Leading indicator: <fast proxy>
```

---

## Content-brief generator (brief mode)

Produce a research-backed brief a writer can execute to outrank current results.

### 1. Pick the mode
- **Improve** (existing URL): fetch it, keep what's strong, list missing/thin/outdated sections, distinguish "keep/strengthen" vs "add new." Don't recommend a full rewrite when targeted improvements win.
- **New page** (keyword only): use the site's homepage/sitemap for business context, build from scratch around competitive gaps.

### 2. Fetch context
Read the target page (improve mode) and the sitemap — sitemap drives the Website-Relevance and internal-linking rules below. (Use your own crawler/tooling.)

### 3. Analyse the SERP
Identify the top ~5 ranking pages for the keyword; **exclude non-competitors** (Wikipedia, Reddit, Pinterest, Amazon, YouTube, gov sites, SEO-tool pages, job boards, directories, news aggregators, social). Score each real competitor: Depth /10, Formatting /10, SEO /10, UX /10. Identify three gap types:
- **Topic gaps** — subtopics competitors miss entirely
- **Depth gaps** — covered but shallow
- **Quality gaps** — outdated, no expert view, poor formatting

Prioritise gaps by `Impact × Competitive Advantage / Effort`.

### 4. Classify intent + rewarded format
Use the intent table above; state which SERP format Google rewards (guide / listicle / comparison / landing / FAQ / local pack).

### 5. Build the brief
Apply the page-type template, customise to gaps and intent.

### Critical brief rules
- **Website-relevance:** every heading, subtopic, keyword, and FAQ must be something *this* site can credibly write about given its real services/products. Before each suggestion ask "can this site actually deliver this?" If no, drop it.
- **Hub coverage:** for hub/overview/category/"types of" pages, the outline must reference **every** real category/service/sub-page that exists (each as its own section + internal link) — and invent none. For spoke pages, suggest relevant internal links without forcing every category in.
- **Plain output language:** never name researchers, frameworks, or tools in the deliverable. Those are internal thinking tools. Write for a business owner or writer, not an SEO academic.

### Keyword placement (brief)
Primary keyword MUST appear in: title (front), H1 (front), URL slug, meta description, first 100 words, ≥1 image alt. It does NOT need to be in every H2/H3 or every paragraph. Secondary: 5–8 close supporting terms + 10–15 broader semantic terms distributed naturally; synonyms aid readability and don't count toward density. Spread the primary evenly — don't cluster.

### Meta-tag rules (brief)
- **Title:** 50–60 chars, primary keyword first, brand last (pipe or dash matching site pattern), lead with outcome/number/specific.
- **Description:** 130–150 chars, active voice, expand the title with USPs, end with a CTA, no brand at end, no quotes (Google truncates at them).

### Brief output
```
## Content Brief: [Primary Keyword]

### Search Intent
[Intent, rewarded SERP format, audience + knowledge level. 3–4 lines.]

### Competitor Analysis
| # | URL | Key H2s | Est. words | Score /40 | Main gap |
|---|-----|---------|------------|-----------|----------|

### Content Gaps & Opportunities
[topic / depth / quality gaps, specific]

### Winning Outline
**H1:** [with primary keyword]
**URL slug:** /[slug]
**Target words:** ~[X] (competitor avg ~[X])
[H2/H3 outline with: words per section, format note (list/table/definition box),
 Featured-Snippet targets marked "FS target", per-section keyword guidance]

### Recommended Meta Tags
**Title** [≤60 chars]
**Meta Description** [≤150 chars]

### Unique Angle & Information Gain
[the exact new value this page adds — must be specific]

### E-E-A-T Requirements
[exact trust signals: author + credentials, expert quotes/citations, dated
 studies/stats, last-updated date; YMYL gets stricter sourcing]

### Internal Linking
[3–5 real targets from the sitemap, with anchor text; mark hub vs spoke]
```

### Outline-only mode
When the user asks for "just an outline," drop Competitor Analysis, Gaps, Information Gain, and E-E-A-T sections; output only the H1/slug/target-words header and the full H2/H3 outline with word counts, format notes, FS targets, keyword guidance, and a 1–2 sentence writing note per section.

---

## Error handling

| Scenario | Action |
|---|---|
| URL unreachable (DNS/refused) | Report clearly; do not guess content; ask user to verify the URL |
| Paywall / login wall (402/403) | Note it's not publicly accessible; analyse only visible meta/headers; flag the limitation |
| Thin content (<100 words retrievable) | Report as-is; flag as possibly JS-rendered or gated; ask for the full text |
| No competitors after filtering (brief) | Broaden to partial-match competitors; note the thin landscape |
| Sitemap missing (brief) | Proceed without site structure; note internal-linking suggestions may be incomplete |
| Page type unspecified | Auto-detect from intent + SERP format; state the detected type |

> Score E-E-A-T against the **main-content text** (boilerplate-stripped: drop nav, footers, cookie banners) so author bios and trust signals score without dilution. Never call a fetcher directly on user-supplied URLs without SSRF/DNS-rebinding protection (use your own crawler/tooling).

---

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
