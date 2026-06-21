---
name: seo-content-drift
description: >
  Content and translation drift detection: find pages decaying over time, machine-translation
  quality drift on i18n sites, staleness signals, and prioritize what to refresh. Methodology,
  thresholds, a 0-100 freshness score, and refresh cadence tied to Next.js + next-intl + hreflang.
  Use when content is going stale, traffic is decaying on old pages, translations drifted from
  source, deciding what to refresh, or planning a content-decay audit. Triggers on: content drift,
  content decay, stale content, translation drift, machine translation quality, i18n parity drift,
  refresh priority, content freshness, content rot, decaying pages, next-intl drift, hreflang parity.
version: 1.0.0
---

# Content & Translation Drift

Detect content that has decayed since publish, machine-translation that has drifted from its
source, and turn the findings into a ranked refresh queue. Two failure modes, one discipline:

1. **Content decay** — a page that ranked and converted slowly loses relevance, traffic, and
   rank as the topic, competitors, or facts move on. The page didn't change; the world did.
2. **Translation drift** — localized variants fall out of sync with the source locale: stale
   facts, missing sections, untranslated fragments, or low machine-translation quality that
   tanks the localized variant while the source ranks fine.

This is an **audit/analysis** skill. It gives you the methodology, thresholds, a 0-100 score,
and a falsifiability check — not a vendor product. Use your own crawler, analytics export, and
Search Console data; the techniques are tool-agnostic.

Default stack: Next.js 15 (App Router, RSC) + next-intl, deployed on Coolify. Where freshness
must surface in markup we generate it from `next/metadata` so it stays in sync with routing.

---

## Part 1 — Baseline, then diff against time

Drift is only measurable against a known-good snapshot. Capture a baseline per URL+locale, then
re-measure on a cadence and diff. Persist snapshots (SQLite, JSON in the repo, or a CMS field)
keyed on a **normalized URL** (lowercase host, strip default ports, sort query params, drop UTM,
strip trailing slash) plus the locale.

Capture per snapshot:

| Field | Why it matters |
|-------|----------------|
| `title`, `meta_description` | CTR signal; drift here moves clicks before rank |
| `h1`, `h2[]` | Topic + section structure |
| `word_count`, `body_text_hash` (SHA-256) | Detects silent content edits / shrinkage |
| `published_at`, `modified_at` | Age and last-touch — the core staleness inputs |
| `internal_links_out`, `internal_links_in` | Decay correlates with losing internal links |
| `outbound_links_alive` | Dead external links are a decay smell |
| Search Console: clicks, impressions, avg position (28-day) | The ground truth for decay |
| `schema[]` / schema hash | Stale `datePublished`/`dateModified`, removed types |

For i18n sites, snapshot **every locale of the same logical page**, not just the source. Drift
is a per-locale property.

---

## Part 2 — Content decay signals & thresholds

No single metric proves decay. Score the evidence; a page is "decaying" when multiple signals
agree. Thresholds below are starting points — calibrate to the site's own seasonality.

| Signal | Threshold (decaying) | Leading vs lagging |
|--------|----------------------|--------------------|
| Clicks trend (last 90d vs prior 90d) | Down ≥ 25% | Lagging |
| Impressions trend (90d vs prior) | Down ≥ 20% | **Leading** — impressions fall before clicks |
| Avg position trend | Worse by ≥ 3 positions | Leading |
| Content age since `modified_at` | > 365 days for YMYL/fast-moving; > 540d otherwise | Leading |
| Internal links in | Dropped vs baseline | Leading |
| Dead outbound links | ≥ 1 | Leading |
| SERP recency mismatch | Top-3 competitors updated < 90d ago, you > 365d | Leading |
| Body word count vs baseline | Shrank ≥ 15% (silent gutting) | Leading |

Key insight: **impressions and position regress before clicks do.** Watch impressions as the
early-warning indicator; by the time clicks crater you've already lost the quarter.

### Freshness score (0-100)

Compute per URL+locale. Higher = healthier. Drives the refresh queue.

```
freshness = 100
  − min(40, clicks_drop_pct * 0.8)          # traffic loss, capped 40
  − min(20, impressions_drop_pct * 0.6)      # demand loss, capped 20
  − min(15, max(0, position_delta) * 3)      # rank slip, 3 pts per position, capped 15
  − age_penalty(modified_at)                 # 0 / 5 / 12 / 20 by age bucket
  − min(10, dead_outbound_links * 5)         # capped 10
  − (10 if body_shrank_15pct else 0)
  + min(10, internal_links_in_gained * 2)    # recovery credit, capped 10
```

`age_penalty`: 0 (<180d), 5 (180-365d), 12 (365-540d), 20 (>540d) for fast-moving topics;
halve the buckets for evergreen reference content.

Bands: **80-100 healthy**, **60-79 watch**, **40-59 refresh soon**, **<40 refresh now / consider
consolidate-or-prune**.

### Refresh prioritization

Don't refresh by score alone — refresh by **opportunity = traffic potential × fixability**.

```
priority = (impressions_90d / 1000) * (1 - freshness/100) * position_leverage
```

`position_leverage` is highest where a small rank gain yields outsized clicks: ~2.0 for avg
position 4-10 (page-1 striking distance), ~1.0 for 11-20, ~0.4 for 21+. A page sitting at
position 6 with high impressions and a low freshness score is the textbook refresh win; a page
at position 45 with 30 impressions is a prune candidate, not a refresh.

Outcome buckets:
- **Refresh** — high impressions, page-1-adjacent, decayed. Update facts, expand thin sections,
  re-earn internal links, bump `dateModified` only when content genuinely changed.
- **Consolidate** — multiple thin pages competing for the same intent → merge + 301.
- **Prune** — near-zero traffic, no internal links, no strategic value → 410/redirect.

---

## Part 3 — Translation / i18n drift

On a next-intl site each locale is a separate page that can rot independently. Three drift types:

### 3a. Parity drift (source moved, locale didn't)

The source locale was edited; the translation still reflects the old version.

| Signal | Threshold |
|--------|-----------|
| Source `modified_at` newer than locale `modified_at` | > 30 days gap |
| Source `word_count` vs locale (length-ratio adjusted) | Diverged ≥ 20% beyond expected expansion |
| Section count: source `h2[]` count ≠ locale `h2[]` count | Any mismatch = missing/extra sections |
| Source has schema/CTA the locale lacks | Any |

Expected length expansion (used to normalize the word-count check): EN→DE ≈ +20-35%,
EN→FR/ES/IT ≈ +15-25%, EN→FI ≈ −10 to +10%. A locale far below its expected ratio is likely
truncated or partially untranslated; far above with no source change can signal MT padding.

### 3b. Untranslated fragments

Detect source-language leakage inside a non-source locale: hardcoded English in a German page,
a missing translation key falling back to source, mixed-script runs. Heuristics that work
without a paid API:

- Per-block language-detect; flag blocks whose detected language ≠ the page locale above a
  coverage threshold (e.g., > 10% of body blocks off-locale).
- Scan rendered HTML for next-intl fallback markers / raw message keys (`messages.about.title`)
  that escaped to output — a sign of a missing key, not a translation.
- Compare the set of message keys per locale JSON; missing keys = guaranteed fallback leakage.

### 3c. Machine-translation quality drift

MT output that is grammatical but wrong, robotic, or off-brand drags the localized variant's
engagement and rankings while the source is healthy. You can't fully grade MT mechanically, but
these proxies catch the worst:

| Proxy | Smell |
|-------|-------|
| Localized variant CTR ≪ source CTR at same position | Title/desc reads unnatural in-locale |
| Localized variant bounce/dwell far worse than source | Body reads like a bad machine |
| Repeated literal idioms / calques | Word-for-word MT, not localized |
| Brand terms / product names translated when they shouldn't be | No glossary / do-not-translate list |
| Number, date, currency, units not localized | MT translated text but not formats |

For the qualitative read, sample affected blocks and have an LLM rate fluency/adequacy/terminology
1-5 against the source — but treat that as advisory, and confirm with a native reviewer before
acting on B2B or YMYL content. The mechanical proxies above decide *which* pages get the human read.

### Cross-reference

Parity and untranslated-fragment findings feed the `seo-hreflang` skill's content-parity check.
If parity drift is severe, the hreflang set is technically valid but semantically lying about
equivalence — fix the content, not the tags.

---

## Part 4 — Surfacing freshness in Next.js

Where freshness should be a ranking/markup signal, emit it from metadata and schema so it tracks
the actual content, never a hardcoded "updated today" lie.

```tsx
// app/[locale]/blog/[slug]/page.tsx
import type { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string; slug: string }> }
): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPost(slug, locale);
  return {
    title: post.title,
    description: post.description,
    alternates: {
      // hreflang stays in sync with routing; only emit locales that actually exist
      languages: Object.fromEntries(
        post.availableLocales.map((l) => [l, `/${l}/blog/${slug}`])
      ),
    },
    openGraph: {
      type: "article",
      // Only set modifiedTime when content truly changed — never bump on a redeploy
      publishedTime: post.publishedAt,
      modifiedTime: post.modifiedAt,
    },
  };
}
```

```tsx
// JSON-LD: dateModified must reflect real edits, not build time
function ArticleJsonLd({ post }: { post: Post }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    inLanguage: post.locale,
    datePublished: post.publishedAt,
    dateModified: post.modifiedAt, // sourced from CMS, not new Date()
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
```

Payload CMS pattern: keep a real `modifiedAt` updated only on content-bearing field changes
(use a `beforeChange` hook that ignores layout/SEO-only edits), and store `availableLocales` per
document so metadata never advertises a locale that 404s. Faking freshness (auto-stamping
`dateModified` on every deploy) is an anti-pattern: it teaches crawlers to ignore the signal and
can be treated as a manipulation pattern.

---

## Part 5 — Monitoring cadence

| Site profile | Decay re-scan | Translation parity check |
|--------------|---------------|--------------------------|
| News / fast-moving / YMYL | Weekly | On every source publish + weekly |
| B2B SaaS / marketing | Monthly | On every source edit + monthly |
| Evergreen reference / docs | Quarterly | On source edit |

Wire parity into CI: when a source-locale document is edited, flag every dependent locale whose
`modified_at` now lags, and open a refresh task. Catching drift at edit time is far cheaper than
discovering it in a quarterly traffic post-mortem.

---

## Falsifiability — how would we know this failed?

State the hypothesis before refreshing, then check it. A "refresh" with no measured lift is a
guess, not a fix.

- **Hypothesis**: "This page decayed from staleness; a content refresh recovers rank/clicks."
- **Leading indicator (2-4 weeks)**: impressions and average position recover toward baseline,
  before clicks move. If impressions stay flat post-refresh, the cause was not content staleness
  (suspect intent shift, SERP feature loss, or a technical/indexability issue) — stop refreshing
  and re-diagnose.
- **Lagging confirmation (8-12 weeks)**: clicks return to within ~10% of baseline.
- **Translation drift**: after fixing parity / re-translating, the localized variant's CTR and
  dwell should converge toward the source variant at comparable positions. If they don't, the
  problem is demand or competition in that market, not translation quality.

Guardrail: only credit a refresh when `dateModified` reflects a *real* content change and the
leading indicator moves. No movement after two cycles = wrong hypothesis, not "needs more time."

---

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
