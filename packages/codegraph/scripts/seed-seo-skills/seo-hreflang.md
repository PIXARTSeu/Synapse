---
name: seo-hreflang
description: >
  Hreflang and international SEO audit, validation, and generation for
  Next.js + next-intl. Detects return-tag/self-ref/x-default errors, validates
  language and region codes, scores content parity, and emits correct hreflang
  via metadata, sitemap, or HTTP headers. Use when working on hreflang, i18n SEO,
  international SEO, multi-language, multi-region sites, or alternate language
  tags. Triggers on: hreflang, i18n SEO, international SEO, multi-language,
  multi-region, language tags, x-default, alternate locale, next-intl SEO.
version: 1.1.0
---

# Hreflang & International SEO

Validate existing hreflang implementations or generate correct hreflang for
multi-language / multi-region sites. Covers HTML metadata, HTTP headers, and XML
sitemap implementations, plus content-parity and locale-format auditing.

Our default stack is Next.js 15 (App Router) + next-intl. Prefer generating
hreflang from `next/metadata` `alternates.languages` so it stays in sync with
routing; fall back to a sitemap for large or cross-domain sites.

## Validation Checks

### 1. Self-Referencing Tags
- Every page must include an hreflang tag pointing to itself.
- The self-referencing URL must exactly match the page's canonical URL.
- Missing self-referencing tags cause Google to ignore the entire hreflang set.

### 2. Return Tags (most common failure)
- If page A links to B with hreflang, B must link back to A. Every relationship
  must be bidirectional (A→B and B→A); the cluster must be a full mesh.
- Missing return tags invalidate the hreflang signal for both pages — Google
  silently drops the whole annotation set, so symptoms are invisible on-page.
- Cross-domain return tags must point at the exact alternate URL, including
  protocol and trailing slash.

### 3. x-default Tag
- Designates the fallback page for unmatched languages/regions.
- Typically the language selector or the primary/English version.
- Exactly one x-default per cluster; it also needs return tags from every
  language version.

### 4. Language Code Validation
- Use ISO 639-1 two-letter codes (`en`, `fr`, `de`, `ja`).
- Common errors:
  - `eng` instead of `en` (ISO 639-2 is not valid for hreflang)
  - `jp` instead of `ja` (wrong code for Japanese)
  - `zh` without script qualifier (ambiguous — use `zh-Hans` / `zh-Hant`)

### 5. Region Code Validation
- Optional region uses ISO 3166-1 Alpha-2 (`en-US`, `en-GB`, `pt-BR`).
- Format: `language-REGION` (lowercase language, uppercase region). Google is
  case-insensitive but consistent casing prevents diffing bugs.
- Common errors:
  - `en-uk` instead of `en-GB` (UK is not a valid ISO 3166-1 code)
  - `es-LA` (Latin America is not a country — use specific countries)
  - Region without a language prefix (region alone is invalid)

### 6. Canonical URL Alignment
- Hreflang must only appear on canonical URLs.
- If a page's `rel=canonical` points elsewhere, hreflang on it is ignored.
- Canonical and hreflang URLs must match exactly (including trailing slash).
- Non-canonical pages must not appear in any hreflang set.

### 7. Protocol Consistency
- All URLs in a cluster must use the same protocol. Mixed HTTP/HTTPS fails
  validation. After an HTTPS migration, update every hreflang URL to HTTPS.

### 8. Cross-Domain Support
- Hreflang works across domains (`example.com` ↔ `example.de`).
- Cross-domain requires return tags on both domains and both domains verified
  in Search Console. Prefer sitemap-based hreflang for cross-domain setups.

## Common Mistakes

| Issue | Severity | Fix |
|-------|----------|-----|
| Missing self-referencing tag | Critical | Add hreflang pointing to the same page URL |
| Missing return tags (A→B but no B→A) | Critical | Add matching return tags on all alternates |
| Missing x-default | High | Add x-default pointing to fallback/selector page |
| Invalid language code (e.g., `eng`) | High | Use ISO 639-1 two-letter codes |
| Invalid region code (e.g., `en-uk`) | High | Use ISO 3166-1 Alpha-2 codes |
| Hreflang on non-canonical URL | High | Move hreflang to canonical URL only |
| HTTP/HTTPS mismatch in URLs | Medium | Standardize all URLs to HTTPS |
| Trailing slash inconsistency | Medium | Match canonical URL format exactly |
| Hreflang in both HTML and sitemap | Low | Choose one method (sitemap preferred at scale) |
| Language without region when needed | Low | Add region qualifier for geo-targeted content |

## Implementation in Next.js + next-intl

### Method 1 — `next/metadata` alternates (preferred for App Router)
Generate hreflang from the same locale list that drives routing, so a new locale
can never silently miss its tags.

```ts
// src/i18n/config.ts
export const locales = ["en", "de", "fr", "ja"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

// hreflang value per routing locale (region/script-qualified where needed)
export const hreflangByLocale: Record<Locale, string> = {
  en: "en",
  de: "de-DE",
  fr: "fr-FR",
  ja: "ja",
};
```

```ts
// src/lib/seo/alternates.ts
import { locales, defaultLocale, hreflangByLocale } from "@/i18n/config";

const SITE = process.env.NEXT_PUBLIC_SITE_URL!; // e.g. https://example.com

/** Build alternates.languages for a route path that exists in every locale. */
export function buildLanguageAlternates(pathWithoutLocale: string) {
  const clean = pathWithoutLocale.replace(/^\/+/, "");
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    const prefix = locale === defaultLocale ? "" : `/${locale}`;
    languages[hreflangByLocale[locale]] = `${SITE}${prefix}/${clean}`.replace(/\/+$/, "") || SITE;
  }
  // x-default → the default-locale URL (or a /select language switcher)
  languages["x-default"] = `${SITE}/${clean}`.replace(/\/+$/, "") || SITE;
  return languages;
}
```

```ts
// src/app/[locale]/blog/[slug]/page.tsx
import type { Metadata } from "next";
import { buildLanguageAlternates } from "@/lib/seo/alternates";
import { defaultLocale, hreflangByLocale, type Locale } from "@/i18n/config";

export async function generateMetadata(
  { params }: { params: Promise<{ locale: Locale; slug: string }> },
): Promise<Metadata> {
  const { locale, slug } = await params;
  const path = `blog/${slug}`;
  const self =
    `${process.env.NEXT_PUBLIC_SITE_URL}${locale === defaultLocale ? "" : `/${locale}`}/${path}`;

  return {
    // canonical MUST equal the self-referencing hreflang URL
    alternates: {
      canonical: self,
      languages: buildLanguageAlternates(path),
    },
  };
}
```

Notes:
- `alternates.languages` emits `<link rel="alternate" hreflang="…">` for every
  entry, including the self-referencing one and `x-default` — that satisfies the
  self-ref + return-tag requirements automatically, *as long as every locale
  variant of the page renders the same `buildLanguageAlternates(path)`*.
- Keep `canonical` identical to that locale's entry in `languages`. A mismatch
  (Check 6) silently voids the whole cluster.
- If a page does NOT exist in a given locale, omit it from `languages` for ALL
  variants — never link to a 404 or to a redirect target.

### Method 2 — HTTP headers (non-HTML files: PDFs, feeds)
Set via middleware, server config, or CDN rules:

```
Link: <https://example.com/doc.pdf>; rel="alternate"; hreflang="en-US",
      <https://example.com/fr/doc.pdf>; rel="alternate"; hreflang="fr",
      <https://example.com/doc.pdf>; rel="alternate"; hreflang="x-default"
```

### Method 3 — XML sitemap (large or cross-domain sites)
Centralized, scalable, and the recommended method for cross-domain hreflang.

```ts
// src/app/sitemap.ts  (Next.js MetadataRoute.Sitemap supports alternates)
import type { MetadataRoute } from "next";
import { buildLanguageAlternates } from "@/lib/seo/alternates";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = ["", "blog/intro", "pricing"]; // from CMS/content
  return paths.map((p) => {
    const langs = buildLanguageAlternates(p);
    return {
      url: langs["x-default"],
      lastModified: new Date(),
      alternates: { languages: langs }, // emits <xhtml:link> per locale
    };
  });
}
```

Raw sitemap shape Next.js produces (one full `<url>` block per alternate, mesh):

```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://example.com/page</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/page" />
    <xhtml:link rel="alternate" hreflang="de-DE" href="https://example.com/de/page" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/page" />
  </url>
  <!-- ...one matching <url> block per alternate (full mesh) -->
</urlset>
```

Rules: declare `xmlns:xhtml`; every `<url>` includes ALL alternates (itself
included); each alternate gets its own `<url>` block; split at 50,000 URLs/file.

### Method Comparison
| Method | Best for | Pros | Cons |
|--------|----------|------|------|
| `metadata` alternates | App Router sites | Stays in sync with routing, type-safe | Bloats `<head>` on huge clusters |
| HTTP headers | Non-HTML files | Works for PDFs/feeds | Complex config, not visible in HTML |
| XML sitemap | Large / cross-domain | Scalable, centralized | Not on-page, needs sitemap upkeep |

## Audit Methodology & Scoring (0–100)

Use this when asked to audit an existing site (live URL or content directory).
Crawl every locale variant of each canonical path (use your own crawler/tooling),
build the cluster graph, then score.

### Process
1. **Detect locales** — URL path, subdomain, ccTLD, and `<html lang>`.
2. **Map equivalents** — group corresponding pages into clusters.
3. **Build the graph** — for each page record the alternates it declares.
4. **Validate** — run Checks 1–8 above against every cluster.
5. **Score parity & formats** — see rubrics below.
6. **Emit fixes** — corrected `alternates.languages` / sitemap entries, ready to paste.

### Hreflang Health Score (per cluster, 0–100)
| Dimension | Points | Pass condition |
|-----------|-------:|----------------|
| Self-referencing on every variant | 25 | All variants self-reference correctly |
| Full-mesh return tags | 25 | Every A↔B pair reciprocates |
| x-default present & valid | 15 | Exactly one, with return tags |
| Valid language/region codes | 15 | All codes ISO 639-1 / 3166-1 |
| Canonical alignment | 10 | hreflang URL == canonical, on canonical pages only |
| Protocol/slash consistency | 10 | Uniform protocol and trailing-slash policy |

Interpretation: 90–100 solid · 70–89 minor gaps · 50–69 signal-degrading ·
<50 likely fully ignored by Google.

### Falsifiability check (always include in an audit)
- **How would we know hreflang failed?** Search Console → "International
  Targeting" / page indexing shows *"no return tags"* errors, or the wrong-locale
  URL ranks/serves in a target market's SERP. Hreflang failure is otherwise
  invisible on-page — passing a crawler check is necessary, not sufficient.
- **Leading indicator:** rising impressions on a locale URL in the *wrong*
  country (GSC query → country breakdown) means the cluster is being ignored;
  re-audit return tags first.

## Content Parity Audit

Technical hreflang correctness does not guarantee that each locale provides
equivalent value. After validating tags, audit parity across versions.
Load `references/content-parity.md` for the full matrix and methodology.

Checks: page exists in every declared locale; section structure equivalence
(H2/H3 ±1); FAQ count (±2); localized images/alt; JSON-LD present and localized;
title/meta localized (not English); word-count ratio within expansion norms;
translation freshness (stale if source updated >30d before the translation).

### Parity Score (0–100)
| Dimension | Points |
|-----------|-------:|
| Page-existence parity across locales | 30 |
| SEO-element parity (title, meta, schema) | 30 |
| Content-structure parity (sections, images, FAQ) | 25 |
| Freshness parity | 15 |

Word-count ratios vs English: DE 1.25–1.35×, FR/ES 1.15–1.25×, JA 0.75–0.90×,
ZH 0.70–0.80×. A DE page shorter than EN usually has missing content; a JA page
longer than EN usually has padding.

Output as a matrix:
```
| Page     | EN | DE | FR | ES | JA | Parity |
|----------|----|----|----|----|----| ------ |
| /about   | ✅ | ✅ | ✅ | ❌ | ✅ | 80/100 |
| /pricing | ✅ | ✅ | ⚠️ | ❌ | ❌ | 45/100 |
```

## Cultural Adaptation Assessment

Go beyond translation: check whether content fits each target market. Flag as
Medium severity. Load `references/cultural-profiles.md` for prebuilt profiles.

- CTAs match cultural directness (e.g., aggressive "BUY NOW!" reads poorly in
  formal markets like ja-JP).
- Trust signals are locale-appropriate (local certifications, correct legal
  pages — e.g., DSGVO not CCPA on de-DE; **High** if wrong jurisdiction is cited).
- No foreign brand references or US-only statistics on localized pages.
- Currency/units match the market (no USD on EUR pages, no imperial on metric).
- No untranslated strings in nav, buttons, alt text, or schema.

## Locale Format Validation

Mismatched formats (US date/number on a German page) signal weak localization and
erode trust. Load `references/locale-formats.md` for full tables.

- **Numbers:** de-DE `1.234,56`, fr-FR `1 234,56`, en-US `1,234.56`. Flag
  US-format numbers on non-US pages.
- **Dates:** de-DE `DD.MM.YYYY`, en-US `MM/DD/YYYY`, ja-JP `YYYY年MM月DD日`.
- **Currency:** symbol/placement per market (`1.234,56 €` after with space on
  de-DE; `$1,234.56` before on en-US).
- **Phone:** international format with correct country code.

In Next.js, format with `Intl` / next-intl rather than hardcoding, so locale
formatting follows the active locale:

```ts
import { useFormatter } from "next-intl";
// const f = useFormatter();  f.number(1234.56);  f.dateTime(new Date());
```

## Output

### Hreflang Validation Report
**Summary** — pages scanned, locales detected, issues (Critical/High/Medium/Low),
per-cluster Health Score, Parity Score.

**Validation table**
| Locale | URL | Self-Ref | Return Tags | x-default | Codes | Status |
|--------|-----|----------|-------------|-----------|-------|--------|
| en-US | https://… | ✅ | ✅ | ✅ | ✅ | ✅ |
| fr | https://… | ❌ | ⚠️ | ✅ | ✅ | ❌ |
| de-DE | https://… | ✅ | ❌ | ✅ | ✅ | ❌ |

**Generated fixes** — corrected `alternates.languages` map, sitemap entries, or
HTTP header values, ready to paste.

**Recommendations** — missing implementations, codes to fix, and method-migration
advice (e.g., metadata → sitemap for scale).

## Reference Files
Load on-demand (do NOT load all at startup):
- `references/cultural-profiles.md` — DACH, Francophone, Hispanic, Japanese profiles
- `references/locale-formats.md` — number/date/currency/address/phone tables
- `references/content-parity.md` — parity audit methodology and scoring
- `references/machine-translation-qa.md` — MT quality gates (if present)

## Error Handling
| Scenario | Action |
|----------|--------|
| URL unreachable (DNS/connection failure) | Report the error; do not guess structure. Ask the user to verify the URL. |
| No hreflang tags found | Report the absence; check other i18n signals (subdirs, subdomains, ccTLDs) and recommend the right method. |
| Invalid language/region codes | List each invalid code with its correct replacement and a corrected tag set. |
| Cultural profile missing for a language | Use the Default Profile checklist; note it is general guidance, not a prebuilt profile. |
| Content-parity directory empty | Report no files found; ask for the correct path or a live URL. |

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
