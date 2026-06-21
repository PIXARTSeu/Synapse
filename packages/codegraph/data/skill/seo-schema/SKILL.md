---
name: seo-schema
description: >
  Detect, validate, and generate Schema.org structured data (JSON-LD) for
  rich-result eligibility, with Next.js 15 App Router injection patterns. Use
  when adding, auditing, or fixing structured data. Triggers on: schema,
  structured data, rich results, JSON-LD, markup, schema.org, rich snippets,
  Organization schema, Product schema, BreadcrumbList, deprecated schema.
version: 1.1.0
---

# Schema Markup: Analysis & Generation

JSON-LD is Google's preferred format. Microdata/RDFa still parse, but every new
implementation should be JSON-LD. This skill covers two jobs: **auditing**
existing markup (methodology + scoring) and **generating/injecting** valid markup
on our Next.js 15 stack.

## Detection

1. Scan rendered HTML for JSON-LD `<script type="application/ld+json">`.
2. Check for Microdata (`itemscope`, `itemprop`) and RDFa (`typeof`, `property`).
3. Recommend JSON-LD as the single source of truth; flag duplicate/conflicting graphs.
4. On SPA/client-rendered sites, compare **raw HTML vs rendered DOM**. Many sites
   inject JSON-LD client-side (React Helmet, `next/head`, vue-meta) so raw HTML is
   empty even when the rendered DOM has the full graph. If you crawl, render the
   page before judging "no schema" (use your own crawler/headless tooling).

## Schema Type Status (as of May 2026)

Keep this current — Google retires rich-result types regularly. When unsure,
verify against Google's "Search gallery of structured data" before recommending.

### ACTIVE — recommend freely
Organization, LocalBusiness, SoftwareApplication, WebApplication, Product (with
Certification markup as of April 2025), ProductGroup, Offer, Service, Article,
BlogPosting, NewsArticle, Review, AggregateRating, BreadcrumbList, WebSite,
WebPage, Person, ProfilePage, ContactPage, VideoObject, ImageObject, Event,
JobPosting, Course, DiscussionForumPosting.

### VIDEO & SPECIALIZED — recommend freely
BroadcastEvent, Clip, SeekToAction, SoftwareSourceCode.

### NO RICH RESULTS — keep for AI/entity resolution
- **FAQPage**: Google retired FAQ rich results for ALL sites on **May 7, 2026**
  (this supersedes the Aug 2023 gov/health-only restriction). No SERP feature
  anymore — but flag existing FAQPage at **Info** priority, not Critical: the
  markup still aids AI Mode / AI Overviews entity resolution. Do not recommend
  removal. For genuine user-generated Q&A pages, use **QAPage** (not FAQPage).

### DEPRECATED — never recommend
- **HowTo**: rich results removed September 2023.
- **SpecialAnnouncement**: deprecated July 31, 2025.
- **CourseInfo, EstimatedSalary, LearningVideo**: retired June 2025.
- **ClaimReview**: retired from rich results June 2025.
- **VehicleListing**: retired from rich results June 2025.
- **Practice Problem**: retired from rich results late 2025.
- **Dataset**: retired from rich results late 2025.
- **Book Actions**: deprecated then reversed — still functional as of Feb 2026
  (historical note; verify before relying on it).

## Rich-Result Eligibility — the rules that actually gate snippets

A type being "active" is necessary but not sufficient. Eligibility fails on:

- **Missing required properties.** Each type has a hard required set (e.g.
  `Product` for the merchant snippet needs `name` + at least one of
  `review`/`aggregateRating`/`offers`; `Offer` needs `price` + `priceCurrency`).
- **Content mismatch.** Markup must describe content **visible to the user** on
  that page. Marking up reviews/prices/FAQs the user can't see is a policy
  violation and a manual-action risk.
- **Wrong data types.** Numbers as strings where a number is required, dates not
  in ISO 8601, ratings outside `bestRating`/`worstRating` bounds.
- **Relative URLs.** `image`, `url`, `logo`, `sameAs` must be absolute.
- **Placeholder text.** `[Company Name]` shipped to production = broken markup.
- **Delayed JS processing.** Per Google's Dec 2025 JS-SEO guidance, JSON-LD
  injected only via client-side JS may face delayed processing. For
  time-sensitive markup (Product, Offer, Event) emit JSON-LD in the **initial
  server-rendered HTML** — on our stack that means RSC, never `useEffect`.

## Next.js 15 (App Router / RSC) — injection patterns

These are our defaults. Inject JSON-LD from a Server Component so it lands in the
initial HTML.

### Inline in a page/layout (server-rendered, recommended)

```tsx
// app/[locale]/products/[slug]/page.tsx  — Server Component
import type { Product, WithContext } from "schema-dts"; // typed authoring

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug); // RSC data fetch

  const jsonLd: WithContext<Product> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images.map((i) => new URL(i, process.env.NEXT_PUBLIC_SITE_URL!).toString()),
    description: product.description,
    offers: {
      "@type": "Offer",
      price: product.price.toFixed(2),
      priceCurrency: product.currency,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: new URL(`/products/${slug}`, process.env.NEXT_PUBLIC_SITE_URL!).toString(),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Stringify ourselves; never pass an unsanitized string. JSON.stringify
        // escapes the data, and we guard the closing-tag sequence below.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {/* ...visible product UI that matches the markup... */}
    </>
  );
}
```

`.replace(/</g, "\\u003c")` prevents a `</script>` inside any string field (e.g.
a description) from breaking out of the tag — the one real XSS/parsing footgun
with inline JSON-LD.

### Reusable `<JsonLd>` component

```tsx
// components/seo/json-ld.tsx  — Server Component (no "use client")
import type { Thing, WithContext } from "schema-dts";

export function JsonLd<T extends Thing>({ data }: { data: WithContext<T> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
```

```tsx
import { JsonLd } from "@/components/seo/json-ld";
// ...
<JsonLd data={jsonLd} />
```

### Multiple types — prefer one `@graph`

Don't scatter many `<script>` tags. Emit a single connected graph with `@id`
cross-references so Google resolves one entity model per page:

```ts
const graph = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${base}/#org`, name: "Acme", url: base, logo: `${base}/logo.png` },
    { "@type": "WebSite", "@id": `${base}/#site`, url: base, publisher: { "@id": `${base}/#org` } },
    {
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: new URL(c.path, base).toString(),
      })),
    },
  ],
};
```

### i18n (next-intl)

Localize `inLanguage`, translatable text fields, and `url` per locale. Keep stable
identifiers (`@id`, SKU, `Organization` name) the same across locales so the
entity is recognized as one thing.

### Payload CMS source data

When markup is driven by CMS content, map fields explicitly and coerce types
(numbers as numbers, dates to ISO). Never pass raw rich-text HTML into a schema
string field — strip to plain text first.

## Generation workflow

1. Identify page type from content (product, article, local business, etc.).
2. Select the minimal set of **active** types that match visible content.
3. Fill all **required** + high-value recommended properties.
4. Use only truthful, verifiable data. Mark unknowns clearly so the user fills them.
5. Validate before shipping (see below).

## Validation checklist

For every schema block verify:
1. `@context` is `https://schema.org` (https, not http).
2. `@type` is valid and **not deprecated**.
3. All required properties present for the intended rich result.
4. Property values match expected types (number/date/URL/enum).
5. No placeholder text (`[Business Name]`).
6. URLs are absolute.
7. Dates are ISO 8601.
8. Markup reflects content **visible on the page**.
9. JSON-LD is in server-rendered HTML for time-sensitive types.

Validate with a schema validator and Google's Rich Results Test equivalent (use
your own tooling). Treat validator *errors* as blockers and *warnings* as
opportunities.

## Audit scoring rubric (0-100)

Score per page (or sitewide average) when running an audit:

| Band | Score | Meaning |
|------|-------|---------|
| Excellent | 90-100 | Correct `@graph`, all eligible types present, zero errors, server-rendered |
| Good | 75-89 | Valid markup, minor missing recommended props or warnings |
| Fair | 50-74 | Present but missing required props on a key type, or relative URLs |
| Poor | 25-49 | Deprecated types in use, content mismatch, or JS-only critical markup |
| Failing | 0-24 | No markup where it clearly applies, or invalid/broken JSON-LD |

Deductions: validator error -15 each; deprecated active type -10; required prop
missing on a rich-result type -10; content mismatch (markup not visible) -20;
relative URL -3 each; client-only critical markup -10; placeholder shipped -15.

## Falsifiability check

State the hypothesis and how you'd know it failed — don't declare victory on
markup presence alone.

- **Hypothesis:** "Adding `Product`/`Offer` markup makes pages eligible for the
  merchant/price rich result."
- **How we'd know it failed:** Search Console > Enhancements shows the item type
  with **errors** or **0 valid items**; or Rich Results Test reports "not
  eligible"; or after 2-4 weeks no rich result renders for known queries.
- **Leading indicator (days, not weeks):** Rich Results Test passes "eligible"
  for the exact production URL immediately after deploy, and the JSON-LD is
  present in `curl` output (server-rendered), not just in the browser DOM.
- **Common silent failure:** markup validates but describes content not on the
  page → eventual manual action, not an immediate error. Always diff markup
  claims against visible content.

## Common templates

### Organization
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "[Company Name]",
  "url": "[Website URL]",
  "logo": "[Logo URL]",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "[Phone]",
    "contactType": "customer service"
  },
  "sameAs": ["[Facebook URL]", "[LinkedIn URL]", "[Twitter URL]"]
}
```

### LocalBusiness
```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "[Business Name]",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "[Street]",
    "addressLocality": "[City]",
    "addressRegion": "[State]",
    "postalCode": "[ZIP]",
    "addressCountry": "US"
  },
  "telephone": "[Phone]",
  "openingHours": "Mo-Fr 09:00-17:00",
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "[Lat]",
    "longitude": "[Long]"
  }
}
```

### Article / BlogPosting
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "[Title]",
  "author": { "@type": "Person", "name": "[Author Name]" },
  "datePublished": "[YYYY-MM-DD]",
  "dateModified": "[YYYY-MM-DD]",
  "image": "[Image URL]",
  "publisher": {
    "@type": "Organization",
    "name": "[Publisher]",
    "logo": { "@type": "ImageObject", "url": "[Logo URL]" }
  }
}
```

## Error handling

| Scenario | Action |
|----------|--------|
| URL unreachable | Report connection error + status code. Verify URL; check if the page requires auth. |
| No markup found | Confirm you rendered the page (SPA check). If truly none, recommend types based on content. |
| Invalid JSON-LD syntax | Report the specific error (missing bracket, trailing comma, unquoted key). Provide corrected JSON-LD. |
| Deprecated type detected | Flag with retirement date; recommend the current replacement or removal. |
| Markup not visible on page | Flag as content mismatch (high severity) — manual-action risk, not just a warning. |

## Output

- Detection results: what markup exists, server- vs client-rendered.
- Validation results: pass/fail per block with specific issues.
- Score (0-100) with deduction breakdown.
- Missing-opportunity recommendations + ready-to-use JSON-LD.

| Schema | Type | Status | Issues |
|--------|------|--------|--------|
| ... | ... | pass/warn/fail | ... |

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
