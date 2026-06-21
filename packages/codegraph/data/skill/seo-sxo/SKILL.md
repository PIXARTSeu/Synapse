---
name: seo-sxo
description: >
  Search Experience Optimization — the SEO×UX×CRO overlap. Reads the SERP
  backwards to detect page-type mismatch, derives user stories from intent
  signals, scores a page from multiple persona perspectives, and fixes
  engagement/page-experience problems (dwell, pogo-sticking, CWV) that block
  ranking even on technically perfect pages. Includes a 0-100 SXO gap rubric
  with falsifiability checks and Next.js patterns. Use when the user says
  "SXO", "search experience", "page type mismatch", "intent mismatch",
  "why isn't my page ranking", "pogo-sticking", "dwell time", "engagement
  signals", "conversion-aware content", "persona scoring", or "SERP analysis".
  Triggers on: SXO, search experience optimization, page-type mismatch, intent
  mismatch, pogo-sticking, dwell time, engagement signals, persona scoring,
  SERP backwards analysis, conversion-aware SEO, page experience.
version: 1.0.0
---

# Search Experience Optimization (SXO)

SXO sits where **SEO** (what the engine rewards), **UX** (what the visitor needs),
and **CRO** (what the business needs) overlap. A page only "wins" when all three
are satisfied in one pass: the searcher lands, immediately recognizes they're in
the right place, gets the answer, and converts — without bouncing back to the SERP.

Technical SEO asks "is the page healthy?". SXO asks a harder question:
**"Does this page deserve to rank for this query, given what the engine is
actually rewarding, and does it satisfy intent end-to-end so the searcher never
returns to results?"**

## Core insight: the page-type trap

A page can score 95/100 on technical SEO and still never rank because it is the
**wrong page type** for the query. If the top 10 results are 8 product pages and
2 comparison tables, a blog post will not break through — no matter how clean its
schema or how fast its LCP. Page-experience and content quality are necessary but
not sufficient; *format-intent alignment* gates everything else.

This is why SXO is **scored separately** from the technical SEO health score. A
page can be 95 technical + 30 SXO: perfectly built, strategically misaligned.

## Two modes

1. **Audit** — score a page's search experience, detect mismatch, emit ranked
   falsifiable fixes (the methodology below).
2. **Implement** — apply the Next.js patterns to fix the engagement, page-type,
   and conversion-readiness gaps the audit surfaces.

For meta/JSON-LD/feeds see `seo-technical`; for content depth & E-E-A-T see
`seo-content`; for AI-search surfaces see `seo-geo`.

---

## The engagement loop (the signal SXO actually optimizes)

```
query → click → [land] → dwell? → satisfied? → task done
                  │                     │
                  └── pogo-stick ───────┘  (back to SERP, click next result)
```

- **Pogo-sticking** — user returns to the SERP within seconds and clicks a
  competitor. Strong negative signal. Causes: intent mismatch, slow/janky load,
  hidden answer, intrusive interstitials, wrong page type.
- **Dwell time** — time between click and return. Long dwell + no return = task
  satisfied. Not a documented direct ranking factor, but a leading indicator of
  the satisfaction the engine *does* reward.
- **Last-click wins** — the result that ends the session is the one the engine
  learns to trust for that query. SXO's job: be the **last click**.

---

## Methodology (audit)

### Step 1 — Acquire the target

Fetch the **rendered** DOM, not raw HTML — search experience is about what the
visitor actually sees, and JS often produces the above-the-fold content (use your
own headless crawler / Playwright; force a render so above-fold analysis matches
reality). Extract: page type, title, H1, meta description, heading hierarchy,
word count, schema types, primary CTA(s), media (img/video/interactive), and the
above-the-fold content block. If no keyword is given, infer the primary keyword
from the title∩H1 overlap and validate it is non-empty.

### Step 2 — Read the SERP backwards

Run the query (your SERP source of choice; note reduced precision if you only
have generic web search). For the **top 10 organic** results record:

- domain authority tier (brand / niche authority / unknown)
- **page type** (see taxonomy below)
- content format (long-form, listicle, how-to, comparison, tool, video)
- depth estimate, schema signals, media signals

And the SERP furniture (each is a free intent signal):

- featured snippet format (paragraph / list / table / video)
- People Also Ask — capture every question
- ads top/bottom — count + copy themes (reveals commercial triggers)
- related searches (reveals the journey before/after)
- knowledge panel / local pack / shopping / AI Overview + its source types

**SERP consensus**: dominant page type (>60% = strong, 40-60% = mixed, <40% =
fragmented), depth norm (avg word-count tier), expected schema, media expectation.

### Step 3 — Page-type mismatch detection (the lead finding)

Classify the target with the same taxonomy and compare to consensus. If a
mismatch exists, **lead with it** — it dwarfs every other fix.

**Page-type taxonomy (classify by dominant signal):**

| Type | Tells |
|------|-------|
| Informational / blog | prose, explanatory H2s, no purchase CTA |
| Comparison | matrix/table of N options, "vs", "best X for Y" |
| Product / PDP | single SKU, price, add-to-cart, specs |
| Category / listing | grid of items, filters, faceted nav |
| Tool / calculator | interactive input → output |
| Landing / service | one offer, lead CTA, proof blocks |
| Local | NAP, map, hours, location signals |

**Mismatch severity & fix:**

| Target | SERP expects | Severity | Fix |
|--------|-------------|----------|-----|
| Blog | Product/Category | CRITICAL | Build a dedicated product/category page; keep blog as supporting link |
| Blog | Comparison | HIGH | Restructure as comparison + decision matrix |
| Product | Informational | HIGH | Add an educational/explainer layer above the buy block |
| Landing | Tool/Calculator | HIGH | Build the interactive tool component |
| Service | Local pack | MEDIUM | Add location signals + LocalBusiness schema (`seo-technical`) |
| Match | — | ALIGNED | Compete on depth, page-experience, and conversion clarity |

If the SERP is **fragmented** (no dominant type), that's a differentiation
opportunity — the format is up for grabs.

### Step 4 — Derive user stories from SERP signals

Every SERP element encodes a need. Convert clusters into stories (3-5, covering
≥2 journey stages — awareness/consideration/decision). Each story **must cite the
signal that produced it** (no invented personas).

```
As a [persona from signal],
I want to [goal from query intent],
because [driver from ad copy / PAA tone],
but I'm blocked by [barrier from PAA / related searches].
```

| Signal | Reveals |
|--------|---------|
| PAA questions | knowledge gaps, objections |
| Ad copy themes | commercial triggers, value props |
| Related searches | the journey (before/after) |
| Featured-snippet format | expected answer shape |
| AI Overview | what the engine treats as definitive |

### Step 5 — Gap analysis → 0-100 SXO score

Score the target across 7 dimensions (lower total = larger gap). Give **specific
evidence** for each — never a bare number.

| Dimension | Compare | Pts |
|-----------|---------|-----|
| Page-type fit | target type vs SERP dominant | 0-15 |
| Content depth | word count, heading depth, topic coverage vs norm | 0-15 |
| UX / above-fold | does the answer + intent confirmation appear in the first viewport? CTA clarity, mobile layout | 0-15 |
| Schema | present vs expected structured-data types | 0-15 |
| Media richness | images/video/interactive vs SERP norm | 0-15 |
| Authority (E-E-A-T) | author, credentials, social proof, citations | 0-15 |
| Freshness | last-updated, date signals, recency | 0-10 |

**Total = SXO Gap Score /100** — reported alongside, never merged into, the
technical SEO health score.

### Step 6 — Persona scoring

Derive 4-7 personas by clustering PAA by theme, segmenting ad copy by audience,
and mapping related searches to journey stages. Score each persona on 4 axes
(25 pts each):

- **Relevance** — does the page address this persona's need?
- **Clarity** — can they find the answer in ≤10 seconds (the dwell test)?
- **Trust** — enough proof for *this* persona to believe it?
- **Action** — is there a clear, persona-appropriate next step?

Output one card per persona; **sort fixes weakest-persona-first** (biggest lift).

### Step 7 — IST/SOLL wireframe (only on request)

Generate a current-state (IST) outline from the parsed DOM and a target-state
(SOLL) outline matching SERP consensus + gap + persona findings. Use
**ultra-concrete placeholders**, never vague ones:

- NO: "add a CTA here"
- YES: "add pricing CTA with annual-savings badge below the hero, linking to
  `/pricing#enterprise`"

Emit as a semantic HTML section outline with annotations.

---

## Falsifiability — how would we know each fix failed?

SXO recommendations are hypotheses about behavior. Every fix ships with a
**leading indicator** (moves in days/weeks) and a **failure condition**. If the
indicator doesn't move, the hypothesis was wrong — revert or rethink, don't pile
on more changes.

| Fix | Leading indicator | Failure condition (revert/rethink) |
|-----|-------------------|------------------------------------|
| Resolve page-type mismatch | impressions appear for the query cluster within 2-4 wks (GSC) | still zero impressions after re-index + 4 wks → wrong type or topical authority gap |
| Lift answer above the fold | scroll-to-answer depth ↓; SERP return-rate ↓ | bounce/return-rate flat → answer wasn't the blocker (intent mismatch?) |
| Cut INP / fix layout shift | INP <200ms, CLS <0.1 (field, p75) | field metrics unchanged after 28-day window → lab-only win, real users unaffected |
| Add proof for weak persona | conversion rate for that segment ↑ | CR flat → trust wasn't the barrier; re-score relevance/clarity |
| Strengthen CTA clarity | CTA click-through ↑ | CTR flat → wrong offer or wrong page-type, not wording |
| Tighten title/meta to match snippet format | organic CTR ↑ in GSC | CTR flat/down → snippet promised something the page doesn't deliver |

Rule: **one change per hypothesis where feasible**, so a moved (or unmoved)
indicator is attributable.

---

## Page experience as a Core Web Vitals problem (current thresholds)

Page experience is the UX leg the engine can measure directly. Field (CrUX) p75
targets — **INP replaced FID in March 2024**:

| Metric | Good | Why it's an SXO lever |
|--------|------|-----------------------|
| **LCP** | < 2.5s | slow hero → pogo-stick before the page even paints |
| **INP** | < 200ms | janky taps after load → frustration, abandon |
| **CLS** | < 0.1  | content jumping → mis-taps, lost trust |

CWV are a *tiebreaker among relevant results*, not a substitute for relevance —
fix intent first, then page experience. Implementation lives in `seo-technical`;
SXO just demands the field numbers as a gate before declaring an experience "good".

---

## Next.js patterns (implement)

### Put the intent-confirming answer in the first viewport (RSC, no client JS)

The single biggest dwell lever: the searcher must confirm "right page" instantly.
Render the answer block server-side, above any heavy/interactive content.

```tsx
// app/[locale]/[slug]/page.tsx — RSC, answer-first layout
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  return (
    <article>
      {/* Above the fold: directly satisfies the query, no scroll, no JS needed */}
      <header className="mx-auto max-w-3xl pt-10">
        <h1 className="text-3xl font-semibold tracking-tight">{page.h1}</h1>
        {/* The "answer in 10 seconds" block — the dwell/pogo-stick defense */}
        <p className="mt-3 text-lg text-muted-foreground">{page.answer}</p>
        {page.primaryCta && (
          <a href={page.primaryCta.href} className="mt-6 inline-flex h-11 items-center rounded-md bg-primary px-6 font-medium text-primary-foreground">
            {page.primaryCta.label}
          </a>
        )}
      </header>
      {/* Defer heavy/interactive depth below — never block first paint */}
      <PageBody blocks={page.blocks} />
    </article>
  );
}
```

### Defer non-critical interactivity to protect LCP/INP

Keep the above-fold static; lazy-load comparison tables, calculators, embeds.

```tsx
import dynamic from "next/dynamic";

const ComparisonMatrix = dynamic(() => import("@/components/ComparisonMatrix"), {
  loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted" />,
});
```

### Eliminate CLS on hero media (intrinsic dimensions + priority)

```tsx
import Image from "next/image";

<Image
  src={hero.src}
  alt={hero.alt}          // descriptive alt = relevance + a11y
  width={1200}
  height={630}            // reserve space → CLS 0
  priority                // hero is the LCP element → preload
  sizes="(max-width: 768px) 100vw, 768px"
/>;
```

### Conversion-aware metadata: make the snippet a promise the page keeps

CTR is an SXO signal too — but only if the title/description match what the page
delivers, in the snippet format the SERP rewards. Mismatched promises raise CTR
then spike pogo-sticking, which is worse than a lower CTR.

```ts
// app/[locale]/[slug]/page.tsx
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPage(slug);
  return {
    title: p.metaTitle,                         // mirrors the H1 promise
    description: p.metaDescription,             // states the concrete payoff, no clickbait
    alternates: { canonical: `/${slug}` },
    openGraph: { title: p.metaTitle, description: p.metaDescription },
  };
}
```

### Match the featured-snippet format with structured markup

If the SERP rewards a list/table snippet, give the answer that shape and back it
with the matching schema (`FAQPage`, `HowTo`, `Product`) — see `seo-technical`
for the JSON-LD helpers. The format must exist in the DOM, not just the schema.

### Don't sabotage experience with interstitials

Intrusive interstitials (full-screen popups on load, especially mobile) are a
documented demotion signal and a direct pogo-stick cause. Gate consent/marketing
modals so they never cover the above-fold answer on the first interaction.

---

## Output format (audit)

```
## SXO Analysis: [URL] — keyword: [keyword]

1. SERP landscape — dominant type ([confidence]%), features, depth norm, schema norm
2. Page-type alignment — your type vs expected → ALIGNED | MISMATCH (severity) + impact
3. User stories (3-5, each citing its source signal)
4. Gap analysis — SXO Gap Score XX/100 (7-dimension table with evidence)
5. Persona scores (4-7 cards, weakest first)
6. Page-experience gate — LCP/INP/CLS field p75 vs thresholds
7. Priority actions — mismatch first, then weakest-persona gaps; each with a
   leading indicator + failure condition
8. Limitations — what couldn't be assessed; data-source precision note
```

## Cross-skill handoffs

| Finding | Hand off to |
|---------|-------------|
| E-E-A-T / depth gaps in scoring | `seo-content` |
| Missing/format-mismatched schema | `seo-technical` (or `seo-schema`) |
| Local intent in the SERP | `seo-geo` / local handling |
| CWV / crawl / index issues during fetch | `seo-technical` |
| AI Overview as dominant surface | `seo-geo` |

## Quality checklist

- [ ] Target fetched as **rendered** DOM (above-fold matches what users see)
- [ ] ≥5 SERP results classified with the taxonomy
- [ ] Mismatch severity rated and **led with** if present
- [ ] Every user story cites a specific SERP signal
- [ ] Persona scores include concrete, persona-specific fixes
- [ ] SXO Gap Score labeled **separate** from technical SEO health
- [ ] CWV field thresholds applied as a gate (LCP<2.5s, INP<200ms, CLS<0.1)
- [ ] Every fix carries a leading indicator + failure condition
- [ ] Limitations section present and honest

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
