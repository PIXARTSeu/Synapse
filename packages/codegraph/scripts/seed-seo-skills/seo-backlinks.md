---
name: seo-backlinks
description: "Off-page/backlink audit: link-profile analysis, referring-domain quality, anchor-text distribution, toxic-link detection, disavow guidance, expired-domain heritage risk, parasite-SEO exposure, and digital-PR link earning. Use when auditing or building backlinks, assessing a link profile, judging link toxicity, or planning link acquisition. Triggers on: backlinks, link profile, referring domains, anchor text, toxic links, disavow, link gap, link building, digital PR, expired domain, parasite SEO, off-page SEO."
version: 1.0.0
---

# Backlink / Off-Page SEO Audit

Off-page SEO is the part of ranking you do not fully control: who links to a site,
with what anchor text, and how trustworthy those sources are. This skill is an
**audit + acquisition methodology**, not a vendor wrapper. Backlink discovery needs a
crawl of the web's link graph, which no public crawler gives in full — so the metrics
here depend on a **backlink data source** (a backlink API, search-console link export,
or an open web-graph dataset). See the `seo-rank-data` skill for sourcing that data and
its confidence weighting. Everything below is the analysis you run *on top of* that data.

## When to use

- Auditing why a site under- or over-performs vs. its link profile.
- Vetting a domain before purchase (expired/aged domain heritage risk).
- Detecting toxic links and deciding whether to disavow.
- Finding link-building opportunities (competitor gap, digital PR).
- Checking exposure to parasite-SEO / negative-SEO patterns.

## Data sources and confidence

You will almost never have a complete link graph. Label every metric with its source
and a confidence weight, and never present an inferred number as a measured fact.

| Source | What it gives | Confidence | Freshness |
|--------|---------------|------------|-----------|
| Commercial backlink API (e.g. a SaaS index) | Backlinks, referring domains, authority, anchors, follow ratio, velocity | 1.0 | days–weeks |
| Search Console link export (own site only) | Top linking sites + anchors (sampled, no authority) | 0.85 | ~days |
| Open web-graph dataset (e.g. Common Crawl) | Domain-level in-degree, harmonic centrality, top referrers (no authority scores) | 0.5 | quarterly |
| Live verification crawl (your own crawler) | Whether a *known* backlink still exists, follow/nofollow, anchor | 0.95 | real-time |

**Data sufficiency gate (falsifiability):** of the 7 scored factors below, count how many
have at least one source. If fewer than 4 are covered, do **not** emit a numeric 0–100
score — emit `INSUFFICIENT DATA (X/7 factors)` plus the factor scores you do have. A
confident number built on one weak source reads as "poor health" when the truth is
"we lack data". When only an open web-graph dataset is available, cap the score at 70/100.

## Audit framework (produce all 7 sections)

### 1. Profile overview

Pull totals: backlinks, referring domains, follow ratio, authority/rank, trend.

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Referring domains | >100 | 20–100 | <20 |
| Follow ratio | >60% | 40–60% | <40% |
| Single-domain concentration | no domain >5% of links | one domain >10% | one domain >25% |
| Trend | growing or stable | slow decline | rapid decline (>20%/quarter) |

### 2. Anchor-text distribution

Over-optimized anchors are the classic algorithmic-penalty (Penguin-lineage) signal.

| Anchor type | Healthy range | Over-optimization flag |
|-------------|---------------|------------------------|
| Branded (company/domain) | 30–50% | <15% (looks built, not earned) |
| Naked URL | 15–25% | — |
| Generic ("click here", "read more") | 10–20% | — |
| Exact-match keyword | 3–10% | **>15%** |
| Partial-match keyword | 5–15% | >25% |
| Long-tail / natural sentence | 5–15% | — |

Flag exact-match anchors over 15%, especially when concentrated from few domains —
that is a manipulation fingerprint, not natural editorial linking.

### 3. Referring-domain quality

- **TLD mix:** .edu/.gov/.org skew authoritative; a flood of cheap .xyz/.top/.info skews spam.
- **Geo mix:** should roughly match the target market; 80%+ from irrelevant countries is a PBN tell.
- **Authority spread:** healthy profiles have links across all authority tiers, not only the top.
- **Per-domain follow/nofollow:** domains that *only* nofollow pass branding but little ranking value.

### 4. Toxic-link detection

High-risk patterns (flag immediately, candidates for disavow):
- Private Blog Network (PBN) footprints: shared hosting/IP, identical themes, thin reciprocal money sites.
- 100% exact-match anchors from a single domain.
- Links from penalized or deindexed domains.
- Mass directory dumps (50+ low-quality directory links).
- Link farms / pages with 10k+ outbound links.
- Sitewide footer/sidebar links across an entire domain (paid-link footprint).

Medium-risk (review manually before acting):
- Links from unrelated niches; reciprocal A↔B patterns; links from thin pages (<100 words);
  >50 backlinks all from one domain.

### 5. Expired / aged-domain heritage risk

Before buying or migrating onto an aged domain, audit its *past life* — Google carries
history forward, and a domain can arrive pre-penalized.
- Pull historical snapshots (web archive) for prior content: was it a real site, or a spam/PBN/adult/gambling flip?
- Check the existing backlink profile against sections 2–4 *before* relaunch.
- Confirm it was not previously deindexed; verify a clean reindex after relaunch.
- A domain with strong raw metrics but a toxic anchor profile or off-niche history is a liability, not a shortcut.

### 6. Parasite-SEO / negative-SEO exposure

- **Parasite SEO (inbound risk):** spam pages hosted on a high-authority host (UGC subdomains,
  open profile/forum pages, abandoned subfolders) can borrow your authority. Audit subdomains
  and user-generated areas for content you did not publish.
- **Negative SEO:** a sudden spike of toxic links pointed at you. The defense is the *velocity*
  baseline in section 7 — without it you cannot tell an attack from organic growth.

### 7. Link velocity & gap

- **New/lost links over 30/60/90 days** (needs a time-series source). Watch for:
  unexplained spikes (possible negative-SEO injection), mass losses (penalty or content removal),
  and steadily declining velocity (content no longer earning links).
- **Competitor gap:** domains linking to a competitor but *not* to the target = the prioritized
  acquisition list; domains linking to both = relationships to deepen.

## Backlink health score (0–100)

| Factor | Weight | Preferred source order |
|--------|--------|------------------------|
| Referring-domain count | 20% | API > web-graph in-degree |
| Domain-quality distribution | 20% | API authority > web-graph centrality |
| Anchor-text naturalness | 15% | API > Search Console anchors |
| Toxic-link ratio | 20% | API spam signals > verification crawl |
| Link-velocity trend | 10% | API time-series only |
| Follow/nofollow ratio | 5% | API > verification crawl |
| Geographic relevance | 10% | API country data |

Score each factor 0–100, weight, sum. Redistribute the weight of any unsourced factor
proportionally across the rest. Always print which factors were scored vs. skipped, with
their source and confidence — apply the sufficiency gate from above before showing a number.

## Falsifiability check (run before delivering)

State, for every material claim, **how you would know it was wrong** and the **leading
indicator** to watch.

| Claim | How would we know it's wrong? | Leading indicator |
|-------|-------------------------------|-------------------|
| "This link is toxic / disavow it" | Disavowing a borderline link drops a ranking it was actually helping | Track rankings 4–8 weeks post-disavow; disavow conservatively, in batches |
| "We have a toxic-anchor problem" | The over-optimized anchors come from scraper copies of one real editorial link, not built links | Group anchors by *root domain*, not by raw count |
| "Link removed" | The page is JS-rendered and the `<a>` exists post-hydration | Mark `unverifiable_js` instead of `removed` when the source is an SPA shell |
| "Negative-SEO attack" | The spike is a legitimate viral/PR event | Compare against the velocity baseline + check anchor/topic relevance of new links |
| "This aged domain is safe to buy" | Post-relaunch it fails to index or rankings never materialize | Verify reindex + run a fresh profile audit 30 days after relaunch |
| "Referring-domain count = N" | N counts links, or counts duplicate subdomains as distinct | Deduplicate to registrable domains; reconcile summary vs. the verified link list |

If any check fails, fix the finding before reporting. Distinguish "not crawled" vs.
"below threshold" vs. "error" — never collapse them into "not found".

## Disavow guidance

Disavow is a last resort, scoped to **manipulative links you cannot get removed**.
1. Attempt manual removal first (outreach to the linking site).
2. Disavow at **domain** level (`domain:example.com`) for whole-domain spam; per-URL only for surgical cases.
3. Keep it conservative — disavowing healthy links removes ranking signal. Re-measure after 4–8 weeks.
4. Google's own guidance: most sites never need a disavow file; the algorithm ignores most spam automatically.

## Link earning (digital PR — the durable strategy)

The only links that survive algorithm updates are *editorially earned*. Prioritize creating
link-worthy assets over chasing volume:
- **Original data / research:** surveys, benchmarks, "state of X" reports — journalists cite primary data.
- **Free tools & calculators:** a small Next.js utility page earns links passively for years.
- **Expert commentary / reactive PR:** respond to journalist requests in your niche.
- **Genuinely useful long-form** that becomes the canonical reference for a query.

For our stack, ship link-bait assets as fast, indexable RSC routes:

```tsx
// app/[locale]/tools/roi-calculator/page.tsx — a linkable free-tool page (RSC + client island)
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Calculator } from "./calculator"; // "use client" island for interactivity

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "roiTool" });
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/${locale}/tools/roi-calculator`;
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: url }, // stable canonical = links consolidate to one URL
    openGraph: { url, title: t("title"), description: t("description") },
  };
}

export default function Page() {
  // Server-render the explanatory copy (crawlable, link-worthy);
  // hydrate only the interactive widget. Keeps the asset fast + indexable.
  return (
    <article className="prose mx-auto max-w-3xl py-12">
      <h1>ROI Calculator</h1>
      <Calculator />
    </article>
  );
}
```

JSON-LD that makes original research citable (helps journalists and AI assistants attribute you):

```tsx
// Inline in the asset page's RSC body
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "2026 SaaS Onboarding Benchmark",
  description: "Survey of 1,200 B2B SaaS onboarding flows.",
  creator: { "@type": "Organization", name: "Your Org" },
  license: "https://creativecommons.org/licenses/by/4.0/",
  url: `${process.env.NEXT_PUBLIC_SITE_URL}/research/onboarding-2026`,
};
// <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
```

**Protect earned equity on our stack:**
- When a linked URL changes, add a **301 redirect** in `next.config` (or middleware) so link equity transfers — never 404 a page that has backlinks.
- Reclaim links pointing at 404s: export referring URLs to dead pages, then 301 them to the nearest live equivalent.
- Keep canonicals stable; locale variants (`next-intl`) should canonical to the right localized URL so links to a campaign consolidate instead of splitting.

## Output format

```
Backlink Health Score: XX/100   (or INSUFFICIENT DATA — Y/7 factors scored)

| Section                   | Status        | Score  | Source (confidence) |
|---------------------------|---------------|--------|---------------------|
| Profile overview          | pass/warn/fail| XX/100 | API (1.0)           |
| Anchor distribution       | pass/warn/fail| XX/100 | SC (0.85)           |
| Referring-domain quality  | pass/warn/fail| XX/100 | web-graph (0.5)     |
| Toxic links               | pass/warn/fail| XX/100 | API (1.0)           |
| Expired/heritage risk     | info          | N/A    | archive + API       |
| Parasite/negative exposure| pass/warn/fail| XX/100 | crawl (0.95)        |
| Link velocity & gap       | pass/warn/fail| XX/100 | API time-series     |

Critical (fix now) · High (≤1 month) · Medium (ongoing) · Link-building opportunities (top 10)
```

Do not duplicate other skills: send crawlability/redirect-mechanics deep-dives to
`seo-technical`, E-E-A-T/content authority to `seo-content`, and data-source setup to
`seo-rank-data`.

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
