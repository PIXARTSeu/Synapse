---
name: seo-technical
description: >
  Technical SEO audit + implementation across 9 categories: crawlability,
  indexability, security headers, URL structure, mobile, Core Web Vitals
  (LCP/INP/CLS), structured data, JavaScript rendering (CSR vs SSR), and
  IndexNow. Includes Next.js robots.ts/headers/metadata patterns and a 0-100
  scoring rubric. Use when working on technical SEO, crawl/index issues, or
  CWV. Triggers on: technical SEO, crawlability, indexability, robots.txt,
  robots.ts, sitemap, canonical, security headers, HSTS, CSP, Core Web Vitals,
  LCP, INP, CLS, JS rendering, SSR, IndexNow, AI crawlers, GPTBot, ClaudeBot.
version: 1.1.0
---

# Technical SEO Audit & Implementation

Two modes:
- **Audit** — score a site across the 9 categories: a 0-100 technical score,
  per-category pass/warn/fail, prioritized fixes, and a falsifiability check per
  finding.
- **Implement** — for our stack (Next.js 15 App Router + RSC, TypeScript,
  Tailwind, Payload CMS, next-intl, Coolify), wire the technical-SEO primitives
  in code (robots, headers, canonical/robots metadata).

Always serve critical SEO elements (canonical, meta robots, structured data,
title, description) in the **initial server-rendered HTML** — never inject them
via client JS (see §8).

---

## Categories

### 1. Crawlability
- robots.txt: exists, valid, not blocking important resources (CSS/JS needed for render)
- XML sitemap: exists, referenced in robots.txt, valid format
- Noindex tags: intentional vs accidental
- Crawl depth: important pages within 3 clicks of homepage
- JavaScript rendering: is critical content present without JS execution? (see §8)
- Crawl budget: for large sites (>10k pages), crawl efficiency matters

**Falsifiability:** "Crawlability passes" is falsified if a fetch of `/robots.txt`
returns non-200, if `Disallow:` covers a path that appears in the sitemap, or if
the sitemap URL in robots.txt 404s. Leading indicator: GSC "Crawled – currently
not indexed" / "Discovered – not indexed" counts trending up.

#### Next.js — `app/robots.ts`
```ts
// app/robots.ts
import type { MetadataRoute } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/draft/', '/*?*sort='] },
      // AI training crawlers — block selectively (see table below)
      { userAgent: 'GPTBot', disallow: '/' },
      { userAgent: 'Google-Extended', disallow: '/' },
      { userAgent: 'Bytespider', disallow: '/' },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  }
}
```
For programmatic / per-locale sitemaps and large-site sharding, defer to the
`seo-sitemap-advanced` skill.

#### AI Crawler Management
AI companies crawl the web to train models and power AI search. Manage these via
robots.txt as a first-class technical-SEO decision.

| Crawler | Company | robots.txt token | Purpose |
|---------|---------|-----------------|---------|
| GPTBot | OpenAI | `GPTBot` | Model training |
| ChatGPT-User | OpenAI | `ChatGPT-User` | Real-time browsing on user request |
| OAI-SearchBot | OpenAI | `OAI-SearchBot` | ChatGPT search index |
| ClaudeBot | Anthropic | `ClaudeBot` | Model training |
| PerplexityBot | Perplexity | `PerplexityBot` | Search index + training |
| Bytespider | ByteDance | `Bytespider` | Model training |
| Google-Extended | Google | `Google-Extended` | Gemini training (NOT search) |
| CCBot | Common Crawl | `CCBot` | Open dataset |

**Key distinctions:**
- Blocking `Google-Extended` stops Gemini training use but does NOT affect Google
  Search indexing or AI Overviews (those use `Googlebot`).
- Blocking `GPTBot` stops OpenAI training but does NOT stop ChatGPT citing you via
  browsing (`ChatGPT-User`) or its search index (`OAI-SearchBot`).
- robots.txt is advisory — well-behaved bots honor it; it is not access control.

**Recommendation:** decide your AI-visibility strategy before blocking. Being
cited by AI systems drives brand awareness and referral traffic. For full AI
visibility optimization, cross-reference the `seo-geo` skill.

### 2. Indexability
- Canonical tags: self-referencing, no conflict with a `noindex` on the same page
- Duplicate content: near-duplicates, parameter URLs, www vs non-www, http vs https
- Thin content: pages below sensible minimum word counts per template
- Pagination: rel patterns / load-more handled coherently
- Hreflang: correct for multi-language/multi-region (defer to `seo-hreflang`)
- Index bloat: filtered/parameter pages consuming crawl budget

**Falsifiability:** "Indexability passes" is falsified if a page sets both
`noindex` and a canonical pointing elsewhere (contradictory), if two URLs serve
identical content with no canonical, or if canonical points to a `noindex` /
redirecting / 404 URL. Leading indicator: GSC "Duplicate without user-selected
canonical" / "Alternate page with proper canonical tag" rising.

#### Next.js — canonical + robots via Metadata API
```ts
// app/[locale]/blog/[slug]/page.tsx
import type { Metadata } from 'next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string; slug: string }> },
): Promise<Metadata> {
  const { locale, slug } = await params
  const post = await getPost(slug, locale) // from Payload CMS

  return {
    metadataBase: new URL(SITE),
    alternates: {
      canonical: `/${locale}/blog/${slug}`,
      languages: { en: `/en/blog/${slug}`, it: `/it/blog/${slug}` },
    },
    robots: post.draft
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
  }
}
```
`metadataBase` makes `canonical` and `alternates` absolute. With next-intl,
generate `languages` from your configured locales rather than hardcoding.

### 3. Security
- HTTPS: enforced, valid certificate, no mixed content
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- HSTS preload: consider preload-list inclusion for high-security sites

**Falsifiability:** "Security passes" is falsified if an HTTP request is not 301'd
to HTTPS, if `Strict-Transport-Security` is absent on the HTTPS response, or if
any subresource loads over `http://`. Verify by inspecting raw response headers
(use your own crawler/tooling or `curl -sI`), not by reading source.

#### Next.js — `next.config` headers (Coolify deployment)
```ts
// next.config.ts
import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Tighten CSP per app; report-only first, then enforce.
  { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data: https:; object-src 'none'; base-uri 'self'" },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}
export default nextConfig
```
Note: a reverse proxy (Coolify/Traefik, Nginx) can also set these — pick one
owner so headers aren't duplicated. A strict `script-src` may need a nonce for
Next.js inline bootstrap; ship `Content-Security-Policy-Report-Only` first.

### 4. URL Structure
- Clean URLs: descriptive, hyphenated, no query params for primary content
- Hierarchy: logical folder structure reflecting site architecture
- Redirects: no chains (max 1 hop), 301 for permanent moves
- URL length: flag >100 characters
- Trailing slashes: consistent (Next.js `trailingSlash` config governs this)

**Falsifiability:** falsified if a single navigation produces 2+ redirects, or if
the same content is reachable at both `/path` and `/path/` with 200s.

### 5. Mobile Optimization
- Responsive design: viewport meta tag, responsive CSS (Tailwind breakpoints)
- Touch targets: minimum 24x24px (WCAG 2.2); aim ~48x48px with spacing
- Font size: minimum 16px base to avoid mobile zoom
- No horizontal scroll at 360px width
- **Mobile-first indexing is 100% complete (since July 5, 2024).** Google crawls
  and indexes all sites with the mobile Googlebot user-agent only — audit the
  mobile rendering, not desktop.

### 6. Core Web Vitals
Targets (Good thresholds), evaluated at the **75th percentile of real-user
(field) data**:

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | < 2.5s | 2.5–4s | > 4s |
| **INP** (Interaction to Next Paint) | < 200ms | 200–500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | < 0.1 | 0.1–0.25 | > 0.25 |

**INP replaced FID on March 12, 2024**; FID was removed from all Chrome tools
(CrUX API, PageSpeed Insights, Lighthouse) on September 9, 2024. Never reference
FID in any output.

- Prefer **field data** (CrUX / RUM). Lab data (Lighthouse) is a proxy only — a
  green lab score does not falsify a poor field score.
- Common Next.js wins: `next/image` (intrinsic sizing → CLS), `next/font`
  (font-display + no layout shift), RSC to cut client JS (→ INP), `priority` on
  the LCP image, avoid hydrating large client trees.

**Falsifiability:** "CWV passes" is falsified by p75 field data exceeding any Good
threshold. If the site has too little traffic for CrUX, state that field data is
unavailable, use lab data as a flagged proxy, and recommend RUM. Leading
indicator: regressions in p75 INP after shipping new client-side interactivity.

### 7. Structured Data
- Detection: JSON-LD (preferred), Microdata, RDFa
- Validate against Google's supported types; emit in server HTML (see §8)
- Full schema generation/analysis: defer to the `seo-schema` skill

**Falsifiability:** falsified if structured data is present only in the
JS-rendered DOM but absent from the raw HTML response, or if required properties
for the declared type are missing.

### 8. JavaScript Rendering (CSR vs SSR)
- Check whether content is in the initial HTML vs requires JS execution
- Identify CSR vs SSR/SSG; flag SPA shells where the raw HTML is an empty `<div id="root">`
- Verify SEO-critical tags are in server HTML, not client-injected

**How to tell CSR from SSR (use your own crawler/tooling):** compare the raw
`fetch`/`curl` HTML against the JS-rendered DOM. If the title, main content, or
canonical exist only after JS runs, you have a CSR/hydration risk. With Next.js
App Router, RSC + SSR give you server HTML by default — the risk appears when
content is gated behind `'use client'` + client-only data fetching.

#### Google JS-SEO clarifications (Dec 2025)
1. **Canonical conflicts:** if a canonical in raw HTML differs from a
   JS-injected one, Google may use EITHER. Keep them identical.
2. **noindex with JS:** if raw HTML has `noindex` and JS removes it, Google may
   still honor the raw-HTML `noindex`. Serve correct directives in initial HTML.
3. **Non-200 status codes:** Google does NOT render JS on non-200 pages — content
   or meta tags injected via JS on error pages are invisible.
4. **Structured data via JS:** Product/Article markup injected via JS can face
   delayed processing. Put time-sensitive markup (e.g. e-commerce Product) in the
   server-rendered HTML.

### 9. IndexNow Protocol
- Faster indexing on Bing, Yandex, Naver (not Google) by pinging on publish/update
- Requires a key file at the site root and a ping with the changed URL(s)

#### Next.js — ping on content publish
```ts
// e.g. from a Payload afterChange hook or a Server Action
const KEY = process.env.INDEXNOW_KEY!            // also hosted at /{KEY}.txt
const SITE = process.env.NEXT_PUBLIC_SITE_URL!

export async function pingIndexNow(urls: string[]) {
  await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(SITE).host,
      key: KEY,
      keyLocation: `${SITE}/${KEY}.txt`,
      urlList: urls,
    }),
  })
}
```

---

## Scoring Rubric (0-100)

Per category, assign **pass / warn / fail**, then map to points:

| Category | Weight | pass | warn | fail |
|----------|:------:|:----:|:----:|:----:|
| Crawlability | 15 | 15 | 8 | 0 |
| Indexability | 15 | 15 | 8 | 0 |
| Security | 10 | 10 | 5 | 0 |
| URL Structure | 10 | 10 | 5 | 0 |
| Mobile | 10 | 10 | 5 | 0 |
| Core Web Vitals | 20 | 20 | 10 | 0 |
| Structured Data | 8 | 8 | 4 | 0 |
| JS Rendering | 7 | 7 | 4 | 0 |
| IndexNow | 5 | 5 | 3 | 0 |

**pass / warn / fail rule of thumb:**
- **pass** — no issue, or only cosmetic; nothing that affects crawl/index/ranking.
- **warn** — degraded but not blocking (e.g. CWV in "Needs Improvement", 1
  redirect hop, missing one non-critical security header).
- **fail** — blocks crawl/index or is a hard ranking/security problem (e.g.
  homepage `noindex`, no HTTPS redirect, CWV "Poor", critical content CSR-only).

A single `fail` in Crawlability or Indexability caps the overall verdict — a site
that can't be crawled/indexed cannot pass overall regardless of total points.

---

## Output

### Technical Score: XX/100

### Category Breakdown
| Category | Status | Score |
|----------|--------|-------|
| Crawlability | pass/warn/fail | XX/15 |
| Indexability | pass/warn/fail | XX/15 |
| Security | pass/warn/fail | XX/10 |
| URL Structure | pass/warn/fail | XX/10 |
| Mobile | pass/warn/fail | XX/10 |
| Core Web Vitals | pass/warn/fail | XX/20 |
| Structured Data | pass/warn/fail | XX/8 |
| JS Rendering | pass/warn/fail | XX/7 |
| IndexNow | pass/warn/fail | XX/5 |

For each finding, include: **what** (the issue), **evidence** (raw header / HTML
diff / field metric — not an assumption), **fix** (concrete, stack-specific),
and **falsifiability** (how we'd know the fix actually worked + the leading
indicator to watch).

### Critical Issues (fix immediately)
### High Priority (fix within 1 week)
### Medium Priority (fix within 1 month)
### Low Priority (backlog)

---

## Error Handling

| Scenario | Action |
|----------|--------|
| URL unreachable | Report connection error + status code. Verify URL, DNS, and that the site is publicly accessible. |
| robots.txt not found | Note no robots.txt at root. Recommend creating one (`app/robots.ts`). Continue auditing other categories. |
| HTTPS not configured | Flag as critical. Report whether HTTP serves without redirect, mixed content exists, or the cert is missing/expired. |
| CWV field data unavailable | Note CrUX data is absent (common for low-traffic sites). Use lab data as a flagged proxy and recommend RUM before re-testing. |

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
