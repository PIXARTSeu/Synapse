---
name: seo
description: Umbrella SEO & GEO knowledge base for Next.js 15 App Router — robots/sitemap/metadata/JSON-LD code, Core Web Vitals (INP), primary-source Google guidance, and a router to specialist seo-* skills. Use when implementing SEO, setting up metadata/structured data, optimizing Core Web Vitals, preparing for AI search, or deciding which SEO sub-skill to load. Triggers on: SEO, GEO, metadata, sitemap, robots.txt, JSON-LD, structured data, Core Web Vitals, INP, LCP, CLS, E-E-A-T, AI Overviews, hreflang, technical SEO.
version: 1.1.0
---

# SEO & GEO Knowledge Base

This is the **umbrella** SEO skill. It carries the core Next.js implementation
patterns we ship on every site, a condensed summary of primary-source Google
guidance, and a router to our specialist `seo-*` skills. For deep work in one
area (technical audit, schema, content, hreflang, etc.) load the specialist —
do not duplicate its depth here.

## Specialist skill router

Load the right skill for the job instead of doing everything in one pass:

| Task | Load |
|------|------|
| Full site audit, scoring, action plan | `seo-audit` |
| Single-page deep analysis | `seo-page` |
| Crawlability, indexability, redirects, status codes | `seo-technical` |
| Schema.org / JSON-LD detection + generation | `seo-schema` |
| E-E-A-T, readability, thin-content checks | `seo-content` |
| AI Overviews / ChatGPT / Perplexity readiness | `seo-geo` / `ai-seo` |
| Multi-language, hreflang, content parity | `seo-hreflang` |
| Image SEO + file optimization | `seo-images` |
| Strategic SEO plan by business type | `seo-plan` |
| Programmatic / template-page SEO at scale | `programmatic-seo` / `seo-programmatic` |
| Comparison / "vs" / alternative pages | `seo-competitor-pages` |
| Sitemap architecture beyond the basic route | `seo-sitemap-advanced` |
| Dev-focused SEO implementation patterns | `seo-for-devs` |

## The falsifiability principle (apply to every recommendation)

An audit is findings synthesized into a strategy, not a checklist of complaints.
Every recommendation we emit must carry:

1. **First-principle observation** it rests on (what did we actually measure?).
2. **Dependency / unblock relationship** to other recommendations (sequence it).
3. **"How would we know this failed?"** — an explicit falsifiability check.
4. **Leading indicator** the user can monitor *without re-running the audit*
   (e.g. impressions in Search Console, CrUX INP p75, indexed-page count).

Priority buckets — **Critical** (blocks indexing / triggers penalty),
**High** (material ranking impact, fix within a week), **Medium**
(opportunity, within a month), **Low** (backlog) — are the *output* of that
validation, not a substitute for it.

---

## robots.txt

Use Next.js `MetadataRoute.Robots`:

```typescript
// src/app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/_next/', '/tmp/'],
      },
      // Allow AI crawlers for GEO
      {
        userAgent: ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'],
        allow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

## sitemap.ts

Use `MetadataRoute.Sitemap` with static + dynamic pages (CMS-driven):

```typescript
// src/app/sitemap.ts
import type { MetadataRoute } from 'next';
import { getPosts } from '@/lib/cms';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts();

  const staticPages = ['', '/chi-siamo', '/servizi', '/contatti'].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  const dynamicPages = posts.map(post => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...dynamicPages];
}
```

## Root layout metadata

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL!),
  title: {
    default: 'Brand Name | Main Keyword',
    template: '%s | Brand Name',
  },
  description: 'Persuasive description including main keywords (150-160 chars).',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: './',
  },
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    siteName: 'Brand Name',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@brand_handle',
  },
};
```

Per-page metadata: export `generateMetadata()` from the route and pull copy from
the CMS so titles/descriptions stay unique per page (Google requires unique,
descriptive titles + meta descriptions per page).

## Structured data (JSON-LD)

JSON-LD is Google's preferred format (over Microdata/RDFa). Always include
`@context` and `@type`, only mark up content **visible on the page**, and
validate with the Rich Results Test before shipping.

```tsx
// src/components/seo/schema-org.tsx
export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Brand Name',
    url: process.env.NEXT_PUBLIC_SITE_URL,
    logo: `${process.env.NEXT_PUBLIC_SITE_URL}/logo.png`,
    sameAs: [
      'https://linkedin.com/company/brand',
      'https://twitter.com/brand',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+39-02-12345678',
      contactType: 'customer service',
      availableLanguage: ['Italian', 'English'],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

### Deprecated / restricted schema types (don't recommend)

- **HowTo** — rich results removed (Sept 2023).
- **FAQPage** — Google retired FAQ rich results for all sites (no SERP feature).
  Keep existing `FAQPage` for AI/LLM citation benefit (flag at Info, not
  Critical); do not recommend new `FAQPage` for Google SERP gain. Use `QAPage`
  for genuine user Q&A.
- **SpecialAnnouncement** (deprecated 2025), **ClaimReview**, **CourseInfo**,
  **EstimatedSalary**, **VehicleListing** — retired. See `seo-schema` for the
  live status list before generating any markup.

## Core Web Vitals

Measured at the **75th percentile of real-user field data** (CrUX). Field data
is preferred over lab (Lighthouse) for assessment. CWV is a confirmed ranking
signal since June 2021.

| Metric | Good | Needs improvement | Poor | Levers (Next.js) |
|--------|------|-------------------|------|------------------|
| **LCP** | ≤ 2.5s | 2.5–4.0s | > 4.0s | `next/image` with `priority` + `sizes`, preload hero, `next/font` self-hosted |
| **INP** | ≤ 200ms | 200–500ms | > 500ms | cut client JS / RSC over client components, `useTransition`, defer non-critical handlers |
| **CLS** | ≤ 0.1 | 0.1–0.25 | > 0.25 | explicit width/height on media, reserve space for embeds/ads, `font-display: swap` |

INP replaced FID on 2024-03-12; FID was removed from all Chrome tooling
2024-09-09 — **never reference FID**. Use `next/script` with
`strategy="lazyOnload"` / `worker` for third-party scripts.

Falsifiability for a CWV fix: after deploy, the CrUX p75 for the targeted metric
crosses the "Good" threshold within ~28 days; the leading indicator is the lab
trace on the same route in CI before real-user data accrues.

## GEO (Generative Engine Optimization)

Optimizing to be cited by AI answer engines (ChatGPT, Perplexity, Gemini, AI
Overviews). Full playbook in `seo-geo` / `ai-seo`. Essentials:

- **Direct answers**: first 40–60 words answer the primary query outright.
- **Q&A structure**: H2/H3 as questions, concise paragraph answers.
- **Data density**: a concrete statistic every ~150–200 words raises citability.
- **Authoritative outbound links** and clear sourcing; bullets/tables over walls of text.
- Allow AI crawler user-agents in `robots.ts` (see above).
- Ship a `public/llms.txt` index: an H1 title, a one-line `>` summary, then
  `## Documentation` / `## Core Concepts` / `## Resources` sections of
  `[Label](/path): note` links pointing to your key pages.

## International SEO (hreflang)

With `next-intl`, emit per-locale alternates. Full audit/parity workflow in
`seo-hreflang`.

```typescript
// app/[locale]/layout.tsx
export const metadata = {
  alternates: {
    canonical: 'https://site.com/it',
    languages: {
      it: 'https://site.com/it',
      en: 'https://site.com/en',
      'x-default': 'https://site.com/en',
    },
  },
};
```

## Mobile-first

Mobile-first indexing is 100% complete (2024-07-05) — Google crawls and indexes
exclusively with the mobile Googlebot. Therefore:

- **Touch targets** ≥ 48×48px, **body font** ≥ 16px.
- Viewport: `width=device-width, initial-scale=1`.
- **Content parity**: mobile must contain the same content as desktop (hidden
  mobile content is the content Google sees).

---

## Primary-source Google guidance (condensed)

A working summary of Google's own documentation. Treat this as the ground truth
when a recommendation must be defensible; specialist skills expand each area.

### How Search works
Three stages: **Crawling** (Googlebot discovers via links + sitemaps) →
**Indexing** (content, metadata, signals stored) → **Serving** (ranked by
relevance, quality, usability). A page must be crawlable **and** indexable to
rank at all — verify this before optimizing anything downstream.

### Technical requirements (Search Essentials)
- Reachable by Googlebot (not blocked by robots.txt / `noindex`).
- Returns HTTP 200 for indexable content; served over HTTPS.
- Content in a processable format — HTML preferred; JS-rendered content is
  supported but slower to index.

### Content quality — E-E-A-T
- **Experience** — first-hand use (original media, lived examples).
- **Expertise** — relevant knowledge/credentials, accurate sourcing.
- **Authoritativeness** — recognized as a go-to source (citations, mentions).
- **Trustworthiness** — contact info, secure site, editorial standards.

YMYL topics (health, finance, safety, legal) face the strictest E-E-A-T bar.
As of the Dec 2025 update, E-E-A-T evaluation extends to **all competitive
queries**, not just YMYL.

### Helpful-content & core updates
The Helpful Content System was merged into core ranking (March 2024); it is no
longer standalone. Helpfulness is now judged inside every core update —
low-value or unhelpful content at scale still gets demoted via core updates.

### Spam policies to never trip
Cloaking, doorway pages, hidden text/links, keyword stuffing, link spam
(buying/selling links), scraped or auto-generated content without added value,
sneaky redirects, thin affiliate pages.

### Penalties & recovery
- **Manual actions** — surfaced in Search Console (unnatural links, thin
  content, cloaking, UGC spam, structured-data abuse). Fix root cause →
  submit reconsideration.
- **Algorithmic demotions** — no notice; detected via ranking drops (core,
  spam, link-spam updates). Improve quality and wait for reassessment at the
  next update; monitor recovery in Search Console performance reports.

### Verify against the source
PageSpeed Insights and CrUX (field CWV), Rich Results Test (schema), Search
Console (coverage, manual actions, performance), Google Search Status
Dashboard, and Search Central Blog for the current state of any feature or
deprecation. Use your own crawler/tooling to gather page-level evidence; do not
assume — measure.

---

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
