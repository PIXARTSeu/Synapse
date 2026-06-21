---
name: seo-google-guidelines
description: >
  Ground-truth reference for what Google Search actually says — Search Essentials,
  spam policies, E-E-A-T/YMYL, Core Web Vitals thresholds, structured-data eligibility,
  algorithm-update awareness (core/helpful-content/spam) and how to react, plus a
  falsifiability methodology for SEO claims. Use when verifying an SEO claim against
  primary sources, diagnosing a ranking drop after an update, or deciding whether a
  practice is allowed. Triggers on: "is this allowed by Google", "Google guidelines",
  "Search Essentials", "spam policy", "E-E-A-T", "YMYL", "helpful content", "core update",
  "ranking drop", "manual action", "penalty recovery", "Core Web Vitals", "LCP INP CLS",
  "structured data eligibility", "rich results retired", "what does Google say".
version: 1.0.0
---

# Google Search Guidelines (Ground Truth)

The canonical reference our other SEO skills cite. When a claim about "what works for
Google" is contested, this skill is the arbiter: it distills what Google *publicly
states*, separates confirmed facts from third-party speculation, and gives a method for
testing any SEO claim instead of trusting folklore.

> **Primary-source rule.** Only Google-owned domains count as ground truth:
> `developers.google.com`, `web.dev`, `chrome.com`, `blog.google`, `support.google.com`,
> `status.search.google.com`. Anything reported only by third-party trackers is a
> *hypothesis*, not a fact — label it as such and never encode it into an audit as if confirmed.

---

## How Google Search Works

Three stages. A page must clear all three to rank:

1. **Crawling** — Googlebot discovers URLs via links and sitemaps. Blocked by `robots.txt` Disallow, network errors, or `nofollow`-only discovery.
2. **Indexing** — Google processes content, signals, and canonicals, then stores the page. Blocked by `noindex`, soft-404s, duplicate-canonical selection, or content Google can't render.
3. **Serving** — At query time, algorithms rank indexed pages by relevance, quality, and usability.

**Mobile-first indexing is 100% complete** (since 2024). Google crawls and indexes
*exclusively* with the mobile Googlebot user-agent. If content/links/structured-data exist
only in the desktop render, Google does not see them.

---

## Search Essentials (the only hard requirements)

Formerly "Webmaster Guidelines." Three buckets:

**Technical requirements** — the floor to be eligible at all:
- Reachable by Googlebot (not blocked by `robots.txt`/`noindex`).
- Returns HTTP 200 for indexable content.
- Content in a processable format (HTML preferred; JS-rendered content is supported but slower and riskier — verify the rendered DOM, not just source).
- Served over HTTPS.

**Spam policies** — violating any of these risks demotion or a manual action:
cloaking (different content to Googlebot vs users) · doorway pages · hidden text/links ·
keyword stuffing · link spam (buying/selling links, excessive exchanges) · scraped or
scaled auto-generated content without added value · sneaky redirects · thin affiliate pages ·
**site reputation abuse** (third-party content riding a host's authority — "parasite SEO") ·
**expired-domain abuse**.

**Key best practices** (signals, not pass/fail rules): write for users not engines · clear
crawlable hierarchy · unique descriptive `<title>` + meta description per page · logical
H1–H6 structure · alt text + right-sized images · responsive mobile design · fast pages
(Core Web Vitals) · submit an XML sitemap · use JSON-LD structured data for content Google should understand.

---

## E-E-A-T and YMYL

E-E-A-T is **not a direct ranking factor** — it is the lens the Quality Rater Guidelines
(QRG) use to describe what "high quality" means; the algorithm approximates it via many signals.

| Signal | What Google looks for | How to show it (Next.js) |
|---|---|---|
| **Experience** | First-hand use of the topic | Original photos, named author who used the product, dated changelog |
| **Expertise** | Relevant knowledge/credentials | Author bio + `Person` schema, accurate sourcing, technical depth |
| **Authoritativeness** | Recognized go-to source | Citations, brand mentions, `Organization`/`sameAs` links |
| **Trustworthiness** | Reliable, transparent (the most important of the four) | Contact page, HTTPS, editorial policy, accurate claims, visible publish/update dates |

- **YMYL** ("Your Money or Your Life": health, finance, safety, legal, and — per the Sept 2025 QRG — major political/social topics) is held to the strictest quality bar; inaccurate YMYL content can cause real harm.
- Per the **Dec 2025 core update**, E-E-A-T-style assessment now applies to *all competitive queries*, not only YMYL. Treat trust signals as table stakes everywhere.

Practical: surface a real author entity and dates in the page graph.

```tsx
// app/[locale]/blog/[slug]/page.tsx — author + dates as E-E-A-T signals
import type { Article, WithContext } from "schema-dts";

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug); // your Payload CMS query

  const jsonLd: WithContext<Article> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    datePublished: post.publishedAt,    // ISO 8601 — keep accurate, do not fake freshness
    dateModified: post.updatedAt,
    author: {
      "@type": "Person",
      name: post.author.name,
      url: post.author.profileUrl,      // links the entity (Authoritativeness)
    },
  };

  return (
    <article>
      {/* visible byline + dates must match the schema — never mark up hidden content */}
      <p>By {post.author.name} · Updated {new Date(post.updatedAt).toLocaleDateString()}</p>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </article>
  );
}
```

---

## Core Web Vitals (confirmed ranking signal since 2021)

Assessed at the **75th percentile of field data** (real Chrome users via CrUX), not lab data.

| Metric | Good | Needs Improvement | Poor |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | 2.5s–4.0s | > 4.0s |
| **INP** (Interaction to Next Paint) | ≤ 200ms | 200ms–500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | 0.1–0.25 | > 0.25 |

- **INP replaced FID** (March 2024); FID was removed from all Chrome tooling (CrUX, PageSpeed Insights, Lighthouse) in September 2024. **Never reference FID.**
- **Field data (CrUX) beats lab data (Lighthouse).** A green Lighthouse score with red CrUX means real users are still suffering — believe the field.
- Target = all three at "Good." A single "Poor" fails the page in Search Console's CWV report.
- Sources of measurement: PageSpeed Insights (field + lab), CrUX (field), Lighthouse (lab only), Search Console CWV report (field). Use your own crawler/tooling to collect lab data at scale.

For the Next.js implementation playbook (RSC, `next/image`, font strategy, dynamic imports), defer to `seo-technical` / `seo-performance`. This skill owns only the *thresholds and the field-vs-lab rule*.

---

## Structured Data: eligibility, not decoration

- **JSON-LD is Google's preferred format** (over Microdata/RDFa). Place in `<script type="application/ld+json">`.
- Always include `@context` and `@type`. **Required** properties gate rich-result eligibility; **recommended** ones improve quality.
- Only mark up content **visible on the page**. Marking up hidden/misleading content is a spam-policy violation and can trigger a manual action.
- Keep schema in sync with content; validate with a rich-results validator before deploy.

**Retired / restricted types — do not promise rich results for these:**

| Type | Status |
|---|---|
| `HowTo` | Rich results removed (2023) |
| `FAQPage` | Rich results **fully retired (2026)** for all sites. Still useful as an entity/AI-citation signal; use `QAPage` for genuine single-question pages. |
| `SpecialAnnouncement` | Deprecated (2025) |
| `Course Info`, `EstimatedSalary`, `LearningVideo`, `ClaimReview`, `VehicleListing` | Retired (2025) |

When in doubt about a type's current support, check `developers.google.com/search/docs/appearance/structured-data` rather than assuming. Deep schema patterns live in `seo-schema`.

---

## Algorithm-update awareness

Two failure modes when rankings drop, and they have *different* remedies:

### Manual actions (you get a notification)
Reported in Search Console → Manual actions. Fix the root cause, then submit a
**reconsideration request**. Common triggers and fixes:

| Trigger | Fix |
|---|---|
| Unnatural links | Remove/disavow the bad links, then reconsider |
| Thin content | Add substantial unique value |
| Cloaking / sneaky redirects | Remove deceptive serving |
| User-generated spam | Moderate UGC, `nofollow`/`ugc` user links |
| Structured-data spam | Remove misleading markup |
| Site reputation abuse | Remove/`noindex` the parasitic third-party section (Google has done section-level removals within hours) |

### Algorithmic demotions (no notification — you infer it from a timeline)
Detected by correlating a traffic drop with a confirmed rollout window. No reconsideration
exists; you fix quality and **wait for the next core update** to reassess.

- **Helpful Content System** was *merged into core ranking in March 2024* — it is no longer a standalone update. Helpfulness is now judged inside every core update. Low-value, unhelpful, or scaled AI content still gets demoted, just via core.
- **Core updates** = broad quality reassessment across all signals.
- **Spam updates** = automated detection of spam patterns.
- **Link spam updates** = devaluation of manipulative links.

### Reacting to a suspected update hit — protocol
1. **Confirm a rollout actually happened.** Check `status.search.google.com` and the Search Central blog for an official window. No confirmed update = look for a technical or seasonal cause first.
2. **Align the timeline.** Overlay your Search Console / analytics drop on the rollout dates. A drop *outside* the window is probably not the update.
3. **Segment the damage.** Which URL groups, query clusters, or page types lost? A site-wide drop vs a section-specific drop point to different causes (quality-wide vs parasite/section).
4. **Classify the cause** against the buckets above (manual vs algorithmic; quality vs links vs spam).
5. **Fix the root cause, not the symptom.** Improving the *specific* weak pages beats sitewide cosmetic edits.
6. **Set expectations.** Algorithmic recovery is gated on the next core update — often weeks to months. Do not promise a date.

**Maintaining update awareness:** keep a small, dated, source-cited log of confirmed updates
(date, name, kind ∈ core / spam / policy / QRG / schema / CWV / product, Google-owned source
URL, one-line impact). Promote a third-party-reported update into your confirmed log *only*
after a Google-owned source verifies it. Recent confirmed rollouts illustrate the cadence:
roughly three core updates per year (e.g., core updates landed in Mar, Jun, Dec 2025 and
Mar, May 2026), interleaved with spam updates and periodic QRG revisions.

---

## Falsifiability methodology (claude-seo's core value)

SEO is saturated with untestable folklore. Before acting on any claim — yours, a client's, or a blog's — run it through this filter.

**1. Source tier.** Is the claim backed by a Google-owned URL (fact), an experiment with data (evidence), or an assertion (folklore)? Downgrade folklore to "hypothesis."

**2. State the falsifier.** A claim you can't disprove is worthless. For every recommendation, answer:
> **"How would we know this failed?"**
Name the concrete observation that would prove the claim wrong.

**3. Define the leading indicator.** Rankings are a lagging, noisy signal. Pick something that moves *first* so you learn before months pass.

| Claim | Falsifier ("how would we know it failed?") | Leading indicator (moves first) |
|---|---|---|
| "Adding FAQ schema brings rich results" | No FAQ rich result appears (it can't — retired in 2026) | Rich-results validator shows eligible:false |
| "Fixing LCP will lift rankings" | LCP improves to Good but CTR/position flat after a full reassessment | CrUX p75 LCP crosses 2.5s in field data |
| "This page is thin, so it's demoted" | Page recovers after a core update *without* content changes | Avg position / impressions for its query cluster in Search Console |
| "Our drop was the May 2026 core update" | The drop started outside the confirmed rollout window | Date-aligned overlay of GSC clicks vs the official window |
| "More pages = more traffic" | New pages get crawled but stay unindexed or get zero impressions | Indexed-count and impressions per new URL group (vs crawl-only) |

**4. Prefer the smallest reversible test.** Change one variable on a representative URL set, define the metric and the window *before* shipping, then measure. If you can't define the metric, you can't claim success.

**5. Attribute honestly.** Correlation with a rollout is not proof of causation. State confidence ("consistent with", not "caused by") unless a Google-owned source or a controlled test backs it.

---

## When other skills should cite this one

- `seo-audit` / `seo-technical` / `seo-performance` → CWV thresholds, field-vs-lab rule, mobile-first fact.
- `seo-schema` → structured-data eligibility and retired types.
- `seo-content` / `ai-seo` / `seo-geo` → E-E-A-T/YMYL framing, helpful-content-is-now-core, AI-content spam stance.
- Any "we got hit by an update" investigation → the reacting-to-an-update protocol and falsifiability filter.

## Verification links (Google-owned only)

- Search Essentials — `developers.google.com/search/docs/essentials`
- How Search works — `developers.google.com/search/docs/fundamentals/how-search-works`
- Spam policies — `developers.google.com/search/docs/essentials/spam-policies`
- Creating helpful content (E-E-A-T) — `developers.google.com/search/docs/fundamentals/creating-helpful-content`
- Structured data overview — `developers.google.com/search/docs/appearance/structured-data/intro-structured-data`
- Ranking update history — `developers.google.com/search/updates/ranking-update-history`
- Search status dashboard (live incidents) — `status.search.google.com`
- Search Central blog — `developers.google.com/search/blog`
- Manual actions report help — `support.google.com/webmasters/answer/9044175`
- Core Web Vitals (web.dev) — `web.dev/articles/vitals`

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
