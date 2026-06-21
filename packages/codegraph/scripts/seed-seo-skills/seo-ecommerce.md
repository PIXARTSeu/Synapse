---
name: seo-ecommerce
description: >
  E-commerce SEO for product and category pages — Product/Offer/AggregateRating
  JSON-LD, faceted navigation & crawl control, variant/canonical handling,
  out-of-stock and pagination, category page optimization, and merchant feed
  basics. Includes Next.js 15 App Router + Payload code and a 0-100 audit rubric.
  Use when working on ecommerce SEO, product SEO, shop/store pages, product schema,
  category pages, faceted filters, merchant feed, or shopping visibility.
  Triggers on: ecommerce SEO, product SEO, product schema, Product JSON-LD, Offer,
  AggregateRating, faceted navigation, canonical variants, out of stock SEO,
  pagination SEO, category page SEO, merchant feed, shopping.
version: 1.0.0
---

# E-commerce SEO

Product and category pages have failure modes that generic page SEO misses:
schema gaps that kill rich results, faceted filters that explode crawl budget,
variant URLs that fragment ranking signals, and out-of-stock handling that
silently drops products. This skill is implementation-first for our stack
(Next.js 15 App Router + RSC, Payload CMS) plus an audit rubric for assessing
an existing store.

## When to use

- Building or auditing product detail pages (PDPs) and category/listing pages (PLPs).
- A store has faceted filters (size, color, price, brand) and crawl-budget concerns.
- Products have variants (size/color) and you need canonical + indexing strategy.
- You need Product/Offer/AggregateRating JSON-LD that earns rich results.
- You're preparing a Merchant feed and want on-page data to match it.

---

## 1. Product schema (Product + Offer)

Google rich results need a small set of required fields and a larger set of
recommended ones. Render JSON-LD server-side so it's in the initial HTML — many
storefronts inject it client-side, which is risky for crawling. In the App Router,
emit a `<script type="application/ld+json">` from the server component.

```tsx
// app/[locale]/products/[slug]/ProductJsonLd.tsx  (server component)
import type { Product } from '@/payload-types'

const AVAILABILITY = {
  inStock: 'https://schema.org/InStock',
  outOfStock: 'https://schema.org/OutOfStock',
  preOrder: 'https://schema.org/PreOrder',
} as const

export function ProductJsonLd({ product, url }: { product: Product; url: string }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.seoDescription ?? product.description,
    image: product.images?.map((i) => i.url).filter(Boolean), // array, absolute URLs, >=1
    sku: product.sku,
    ...(product.gtin13 && { gtin13: product.gtin13 }),
    ...(product.mpn && { mpn: product.mpn }),
    brand: { '@type': 'Brand', name: product.brand?.name },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: product.currency, // ISO 4217: EUR, USD, GBP
      price: product.price.toFixed(2), // number string, NO currency symbol
      availability: AVAILABILITY[product.stockStatus],
      itemCondition: 'https://schema.org/NewCondition',
      // priceValidUntil (ISO 8601), shippingDetails, hasMerchantReturnPolicy: see below
    },
    ...(product.reviewCount > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.ratingAvg.toFixed(1),
        reviewCount: product.reviewCount,
      },
    }),
  }

  // < escape avoids breaking out of the <script> tag
  const html = JSON.stringify(ld).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: html }} />
}
```

### AggregateRating + Review

Only emit `aggregateRating` when you have real, on-page reviews — fabricated or
off-page-only ratings violate Google's policy and risk a manual action. Require
both `ratingValue` and `reviewCount`. Optionally include individual `review`
objects with `author` and `reviewRating`.

### Validation rules (these silently disqualify rich results when violated)

1. `price` is a plain number string (`"29.99"`), never `"$29.99"` or `"29,99"`.
2. `availability` uses the full Schema.org URL enum, not `"in stock"`.
3. `priceCurrency` is ISO 4217.
4. `image` is an array of absolute, high-res URLs (>= 1).
5. `brand.name` is non-empty and not a placeholder ("N/A").
6. `priceValidUntil` is ISO 8601 if present (omit it rather than ship a stale past date).
7. If `aggregateRating` is present, both `ratingValue` and `reviewCount` exist and are > 0.

### Shipping + returns (Merchant Center alignment)

For Shopping/free listings, add structured shipping and return data so on-page
matches feed data:

```jsonc
"shippingDetails": {
  "@type": "OfferShippingDetails",
  "shippingRate": { "@type": "MonetaryAmount", "value": "4.90", "currency": "EUR" },
  "deliveryTime": {
    "@type": "ShippingDeliveryTime",
    "handlingTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 1, "unitCode": "DAY" },
    "transitTime":  { "@type": "QuantitativeValue", "minValue": 1, "maxValue": 3, "unitCode": "DAY" }
  }
},
"hasMerchantReturnPolicy": {
  "@type": "MerchantReturnPolicy",
  "applicableCountry": "IT",
  "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
  "merchantReturnDays": 30,
  "returnMethod": "https://schema.org/ReturnByMail",
  "returnFees": "https://schema.org/FreeReturn"
}
```

### Schema scoring (0-100)

| Completeness | Score |
|--------------|-------|
| All required fields valid (name, image, offers.price, priceCurrency, availability) | 50 |
| + valid `aggregateRating` with real reviews | 65 |
| + `sku` / `gtin` / `mpn` | 75 |
| + `shippingDetails` | 85 |
| + `hasMerchantReturnPolicy` | 90 |
| + 3+ `review` objects | 100 |

---

## 2. Variants and canonicalization

Variant handling is where ranking signals fragment most. Pick one model and apply
it consistently across the store.

| Model | When | URL shape | Indexing |
|-------|------|-----------|----------|
| Single canonical PDP | Variants are minor (color/size of same product) | `/p/jacket` with client-side variant switch | Index the canonical; variant params self-canonical to it |
| Distinct variant URLs | Variants differ materially (separate demand, different images/specs/price) | `/p/jacket-red`, `/p/jacket-blue` | Each indexable, each self-canonical |

Default to **single canonical PDP** unless variants have meaningfully different
search demand. Variant state goes in a query param or hash that canonicalizes back:

```tsx
// app/[locale]/products/[slug]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug, locale } = await params
  const product = await getProduct(slug)
  const canonical = `${SITE_URL}/${locale}/products/${product.slug}`
  return {
    alternates: {
      canonical, // variant query params (?color=red) resolve here
      languages: buildHreflang(product, locale), // next-intl locales
    },
    openGraph: { images: product.images?.[0]?.url },
  }
}
```

Rules:
- A `?color=red` URL must carry `<link rel="canonical">` pointing to the clean PDP.
- Never let the same product body live at multiple indexable URLs without canonicals.
- If you DO split variants into distinct URLs, each must be self-canonical (not
  pointing at a "parent") and have unique title, images, and (if applicable) price.

---

## 3. Faceted navigation and crawl control

Faceted filters (size + color + price + brand + sort) generate combinatorial URL
explosion. Left unmanaged, crawlers waste budget on near-duplicate, thin pages
and may index junk like `?sort=price&color=red&color=blue&page=3`.

### Decision: index, canonicalize, or block

| Facet state | Treatment | Mechanism |
|-------------|-----------|-----------|
| Single high-demand facet ("red dresses") | Index — it's a real landing page | Crawlable link, self-canonical, unique title/H1 |
| Multi-facet combos, sorts, pagination noise | Crawlable but not indexable | `robots: noindex, follow` OR canonical to base category |
| Infinite / low-value params (`sessionid`, tracking, `view=grid`) | Block from crawl | `robots.txt` `Disallow`, or keep links non-crawlable |

### Implementation

Curate which facet pages deserve indexing (a finite allowlist) rather than letting
every combination in:

```tsx
// app/[locale]/[category]/page.tsx
type Search = { color?: string; size?: string; sort?: string; page?: string }

export async function generateMetadata({ params, searchParams }): Promise<Metadata> {
  const { category, locale } = await params
  const sp = (await searchParams) as Search
  const base = `${SITE_URL}/${locale}/${category}`

  // Allowlist of indexable single-facet landing pages
  const indexableFacet =
    isCuratedLandingPage(category, sp) // e.g. only {color} alone, no sort/page

  return {
    alternates: { canonical: indexableFacet ? withFacets(base, sp) : base },
    robots: indexableFacet ? undefined : { index: false, follow: true },
  }
}
```

- Keep filter links real `<a href>` (crawlable) only for facets you want crawled;
  render the rest as buttons/JS so crawlers don't discover infinite combinations.
- Use `noindex, follow` (not `nofollow`) so link equity still flows to products.
- Put long-tail block rules in `robots.txt` for tracking/sort/view params:

```
# robots.txt
User-agent: *
Disallow: /*?*sort=
Disallow: /*?*view=
Disallow: /*&color=*&color=   # multi-select duplicate noise
Allow: /
Sitemap: https://example.com/sitemap.xml
```

Caveat: `robots.txt` disallow prevents crawling but a URL can still appear in
results if linked externally. To guarantee de-indexing, allow the crawl and serve
`noindex` instead. Pick one per URL pattern; don't combine them on the same URL
(a noindex on a robots-blocked URL is never read).

---

## 4. Out-of-stock and discontinued products

Don't 404 or delete a temporarily out-of-stock product — you lose its accumulated
ranking and inbound links.

| State | HTTP | Indexing | Schema `availability` | UX |
|-------|------|----------|-----------------------|-----|
| Temporarily OOS, returning | 200 | keep indexed | `OutOfStock` (keep `offers`) | show "notify me", related/alternatives |
| Permanently discontinued, replacement exists | 301 | redirect | — | redirect to successor or category |
| Permanently gone, no replacement | 410 | de-index | — | helpful 410 page with search/category links |
| Seasonal, returns yearly | 200 | keep indexed | `OutOfStock` / `PreOrder` | keep page warm, link from category |

Keep the `offers` block with `availability: OutOfStock` so the product stays
eligible to re-enter rich results when restocked. Surface in-stock alternatives
above the fold to recover the visit.

---

## 5. Pagination on category pages

`rel="next"/"prev"` is no longer used by Google as an indexing signal. Current
guidance:

- Each paginated page (`?page=2`) should be a crawlable, self-canonical, unique URL
  — do NOT canonicalize page 2..N to page 1 (that hides those products from crawl).
- Ensure every product is reachable: either real paginated `<a>` links or a
  crawlable "load more" that updates the URL. Pure JS infinite scroll with no
  crawlable URLs hides deep products.
- Give paginated pages distinct titles (`Category — Page 2`) to avoid duplicate-title
  warnings, but keep the primary keyword on page 1.
- Page 1 of a category is the canonical landing page; deep pages are crawl paths,
  not landing targets.

```tsx
// Reachability: emit crawlable pagination links even with JS load-more
<nav aria-label="Pagination">
  {hasPrev && <a href={`?page=${page - 1}`} rel="prev">Previous</a>}
  {hasNext && <a href={`?page=${page + 1}`} rel="next">Next</a>}
</nav>
```

---

## 6. Category (PLP) optimization

Category pages are usually a store's highest-traffic SEO targets — they rank for
head terms ("running shoes") while PDPs rank long-tail.

- One H1 matching the category's primary keyword.
- A short, unique intro paragraph above or below the grid (not boilerplate across
  categories) — gives the page indexable text beyond product tiles.
- Breadcrumb JSON-LD (`BreadcrumbList`) for the path: Home > Category > Subcategory.
- Internal links to top sub-categories and complementary categories.
- Stable, keyword-clean URLs: `/running-shoes`, not `/c?id=482`.
- LCP is usually the first product image / hero — prioritize it (see CWV below).

```jsonc
// BreadcrumbList JSON-LD
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com/" },
    { "@type": "ListItem", "position": 2, "name": "Shoes", "item": "https://example.com/shoes" },
    { "@type": "ListItem", "position": 3, "name": "Running Shoes", "item": "https://example.com/shoes/running" }
  ]
}
```

---

## 7. Product page on-page checklist

- **Title**: `[Product] - [Key feature] | [Brand]`, under ~60 chars, primary keyword + brand.
- **Meta description**: keyword + benefit + price/CTA, under ~155 chars.
- **H1**: single, matches product name; H2s for Features, Specs, Reviews, Related.
- **Images**: descriptive alt text (product + distinguishing feature), descriptive
  filenames (not `IMG_001.jpg`), modern format (AVIF/WebP), >= 800px for Shopping
  eligibility, >= 3 images, lazy-load below-fold only (eager the LCP hero).
- **Content**: unique description (NOT manufacturer copy-paste — that creates
  cross-site duplication), >= ~200 words, a real specs table, on-page UGC reviews.
- **Internal linking**: breadcrumbs, related/cross-sell, keyword-rich link back to category.
- **Technical**: server-rendered JSON-LD, correct canonical, mobile-clean, fast LCP.

---

## 8. Merchant feed basics

The on-page data and the Merchant feed must agree, or you get feed disapprovals
and "price mismatch" / "availability mismatch" warnings.

| Feed field | Must match on-page | Notes |
|------------|--------------------|-------|
| `id` | stable SKU | never reuse across products |
| `title` / `description` | PDP title/description | front-load attributes (brand, type, size, color) |
| `link` | canonical PDP URL | not a variant param URL |
| `price` | `offers.price` + visible price | currency must match |
| `availability` | `offers.availability` | OOS in feed when OOS on page |
| `gtin` / `mpn` / `brand` | schema identifiers | GTIN strongly improves match rate |
| `image_link` | primary product image | >= 800px, no watermarks/promo overlays |

For AI-generated product imagery, follow the platform's transparency requirement
(IPTC `DigitalSourceType: TrainedAlgorithmicMedia`) to stay feed-compliant.

---

## Audit methodology

When auditing an existing store (use your own crawler/tooling to fetch and render
pages — many storefronts inject schema client-side, so compare raw HTML vs
rendered HTML to confirm JSON-LD is server-rendered).

### Scoring (0-100)

| Category | Weight | What it measures |
|----------|--------|------------------|
| Product schema completeness & validity | 25% | Required + recommended fields, validation rules pass |
| Crawl control (facets/params/pagination) | 20% | No combinatorial index bloat; products reachable |
| Variant/canonical handling | 15% | Consistent model, no fragmented duplicates |
| Image optimization | 15% | Alt text, format, sizing, count, LCP hero |
| Content quality | 15% | Unique descriptions, specs, on-page reviews |
| Category/internal linking & CWV | 10% | Breadcrumbs, related links, LCP < 2.5s |

Report priorities as Critical > High > Medium > Low, each with expected impact and
the data source ("rendered HTML", "raw HTML", "feed export").

### Core Web Vitals (current thresholds)

INP replaced FID as a Core Web Vital. Targets: **LCP < 2.5s**, **INP < 200ms**,
**CLS < 0.1**. On PDPs the LCP element is the hero image (eager-load + sized);
on PLPs it's the first product tile. CLS offenders: late-loading price/badges,
unsized images, sticky add-to-cart bars injected after paint.

### Falsifiability check (do this before claiming a fix worked)

For every recommendation, state how you'd know it FAILED and the leading indicator
to watch — don't wait on rankings alone.

| Change | "How would we know it failed?" | Leading indicator (days, not weeks) |
|--------|--------------------------------|--------------------------------------|
| Added Product schema | Rich Results test still errors; no rich snippet eligibility | Search Console "Products" enhancement report: valid items count rises, errors drop |
| Faceted noindex/robots rules | Index bloat persists or, worse, real products dropped | Crawl stats + "Indexed, not submitted" count; verify product URLs still indexed via URL Inspection |
| OOS kept-indexed (vs 404) | Product loses position after restock | Position history for the product URL; impressions don't collapse during OOS window |
| Variant canonical consolidation | Duplicate variant URLs still indexed | `site:` / Search Console page count for variant params trends to ~0 |
| Unique category intro copy | Page still seen as thin/duplicate | Impressions for category head term; "Duplicate without user-selected canonical" disappears |

If you can't name a failure signal and a leading indicator, the recommendation
isn't testable — sharpen it before shipping.

---

## Cross-skill integration

| Need | Pair with |
|------|-----------|
| Generic JSON-LD generation/validation | `seo-schema` |
| Product image audit (alt, format, dimensions) | `seo-images` |
| Description E-E-A-T and uniqueness | `seo-content` |
| Page-level CWV / rendering / canonicals | `seo-technical` |
| Search Console enhancement reports | `seo-google` |

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
