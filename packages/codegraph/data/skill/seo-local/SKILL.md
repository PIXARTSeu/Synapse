---
name: seo-local
description: Local SEO for brick-and-mortar, service-area, and multi-location businesses — Google Business Profile signals, NAP consistency, citations, reviews, local pack & Maps ranking factors, LocalBusiness JSON-LD, and location-page quality. Use when working on local search, map pack, store locator, or location pages. Triggers on: local SEO, Google Business Profile, GBP, map pack, local pack, NAP, citations, local rankings, service area, multi-location, LocalBusiness schema, geo-grid, store locator.
version: 1.0.0
---

# Local SEO

Local search ranks on three buckets Google has stated for years: **relevance**, **distance** (proximity to the searcher — outside your control, ~half of ranking variance), and **prominence** (signals you can build: profile completeness, reviews, citations, links). Optimize the levers you control; do not over-promise on proximity.

This skill covers both implementation (LocalBusiness schema, location pages on Next.js) and audit/analysis (scoring rubric, NAP consistency, GBP completeness). For pure on-page technical SEO see `seo-technical`; for AI-search/answer-engine visibility see `seo-geo`.

## Current ranking-factor weight (use as priors, not gospel)

| Bucket | Approx. share of local pack | Notes |
|--------|------------------------------|-------|
| Proximity / distance | ~50%+ | Searcher GPS-dependent. Mostly uncontrollable — disclose this in every report. |
| Google Business Profile signals | ~30% | Primary category is the single strongest controllable factor. |
| Reviews | ~15-20% | Velocity and recency matter more than raw count. |
| On-page / website signals | ~15% | Dedicated service pages are the #1 controllable organic local factor. |
| Citations / links | declining for the pack, but central to AI-search visibility | |

Treat these as directional. The falsifiability question (below) is what keeps an audit honest.

## Business-type detection (decides which checks apply)

Detect before scoring; the wrong checks produce false negatives.

- **Brick-and-mortar** — visible street address, embedded map / directions link, "visit us at". Run full NAP + map + physical-address checks.
- **Service-area business (SAB)** — no public address, "serving [area]", "we come to you", `areaServed` in schema with no `streetAddress`. Skip embedded-map and physical-address consistency checks; require named `areaServed`.
- **Hybrid** — both a physical address and service-area language. Run both sets.

## Industry vertical (decides schema subtype + citation sources)

| Vertical | Signals | Schema subtype |
|----------|---------|----------------|
| Restaurant | menu, cuisine, reservations, dine-in/takeout | `Restaurant` (+ `Menu`/`MenuItem`, `ReserveAction`) |
| Healthcare | insurance, appointments, "Dr.", HIPAA notice | `MedicalClinic`/`Dentist`/`Physician` |
| Legal | attorney, practice areas, bar admission | `LegalService` (not deprecated `Attorney`) |
| Home services | service area, emergency, "free estimate", licensed/insured | base subtype + `areaServed` + `Service` |
| Real estate | listings, MLS, agent bio, brokerage | `RealEstateAgent` |
| Automotive | inventory, VIN, dealership, service dept | `AutoDealer` (+ `Car`, `Offer`) |

If no vertical is detected, fall back to generic `LocalBusiness`.

## Analysis dimensions and scoring rubric (0-100)

| Dimension | Weight | Scored Full / Partial / Low |
|-----------|--------|------------------------------|
| GBP signals | 25 | embed + correct category signals + posts + photos / some / none |
| Reviews & reputation | 20 | 10+ reviews, 4.5+, recent, owner responses, multi-platform / gaps / thin |
| Local on-page | 20 | city in title+H1, NAP visible, dedicated service pages, no doorway / partial / generic |
| NAP consistency & citations | 15 | consistent across page/schema/profile + tier-1 citations / minor drift / discrepancies |
| Local schema | 10 | correct subtype + recommended props valid / generic type / missing |
| Local links & authority | 10 | chamber/BBB/press + community signals / some / none |

Score each dimension Full=100/Partial=50/Low=0 of its weight, sum to a 0-100 total. For SABs that legitimately skip map checks, redistribute the affected sub-weight rather than penalizing.

### Dimension detail

**1. GBP signals (25).** Primary category is the strongest controllable factor; a wrong primary category is the most common avoidable mistake. Check: detectable GBP integration on the page (Maps iframe, place ID, review widget), category appropriateness inferred from page content, photo evidence (listings with photos get materially more direction requests), business hours present (open-now lifts ranking at query time). Do **not** link the GBP website field to your single strongest page — diversify to avoid suppressing the organic ranking of that page. Recreate any old GBP Q&A as on-site FAQ content (GBP Q&A was deprecated and is not exportable).

**2. Reviews & reputation (20).** Velocity beats total count. Rule of thumb: a multi-week gap with zero new reviews correlates with a ranking dip — aim for a steady cadence rather than batches. Check: visible Google review count and star rating, recency, `aggregateRating` in schema (`ratingValue`, `reviewCount`), owner-response rate, presence across multiple review platforms. **Review gating is prohibited** — never pre-screen satisfaction before routing only happy customers to a review page (violates Google policy and, in some jurisdictions, consumer-protection law). Healthcare: do not confirm/deny that a reviewer is a patient in responses (privacy law). Legal: respect privilege in responses.

**3. Local on-page (20).** Dedicated per-service pages are the top controllable organic local factor. Check: city/service keyword in title and H1; NAP visible in HTML (footer/contact), not only in an image; click-to-call `tel:` link; contact form reachable above the fold; hub-and-spoke internal linking with every key page within ~3 clicks of home.
- **Location-page quality (multi-location):** require **>60-70% unique content** per page. Apply the **swap test** — if you can swap the city name and the copy still reads fine, it is a doorway page and a core-update liability. Add local photos, area-specific testimonials, and local FAQs.

**4. NAP consistency & citations (15).** Extract Name/Address/Phone from three sources — visible HTML, LocalBusiness JSON-LD, and any visible profile data — and flag every discrepancy (name mismatch = critical, address = high, phone = medium). Confirm presence on tier-1 directories via `site:` checks (e.g. `site:yelp.com "Business Name"`, `site:bbb.org "Business Name"`). Recommend claiming the major map platforms (the second-largest map ecosystem and the search engine that feeds several AI assistants) and submitting to data aggregators for downstream distribution.

**5. Local schema (10).** Schema is not a direct ranking factor but enables rich results and helps machines (and answer engines) parse the business. Require correct subtype (table above), required `name` + `address` (PostalAddress), and recommended `geo` (5+ decimal places), `openingHoursSpecification`, `telephone`, `url`, `image`, `priceRange` (<100 chars). Multi-location: each location page gets its own `LocalBusiness` with a unique `@id`, linked via `branchOf` to the `Organization`. Do **not** emit self-serving `review`/`aggregateRating` you authored — Google ignores first-party review markup; only mark up genuine third-party reviews shown on the page.

**6. Local links & authority (10).** Chamber of Commerce and BBB membership (authority + verification), local press/news mentions, sponsorships and community involvement, and "best of [city]" list placements. Brand mentions correlate more strongly with answer-engine visibility than raw backlinks — pursue earned mentions, not just links.

## Falsifiability check (the part that keeps audits honest)

For every recommendation, before shipping the report, answer two questions:

- **How would we know this failed?** Define the negative signal. Example: "Added unique location-page content" fails if, 8 weeks post-publish, those URLs still have no impressions in Search Console for `[service] [city]` queries, or average position is stuck >20.
- **What is the leading indicator?** Pick a metric that moves before rankings do, so you can course-correct early. Examples: GBP-listed-business profile views and direction requests (move within ~2 weeks); review velocity; map-pack impressions in Search Console's "Search Appearance"; geo-grid Share of Local Voice (% of grid points where you rank top-3).

A finding without a falsification condition is an opinion, not an audit result.

## Next.js implementation

### Single-location LocalBusiness JSON-LD (App Router)

Inject as a `<script type="application/ld+json">` from a Server Component so it ships in the initial HTML (crawlers must see it without executing JS).

```tsx
// app/(site)/components/LocalBusinessJsonLd.tsx  — Server Component
import type { Restaurant, WithContext } from "schema-dts";

export function LocalBusinessJsonLd() {
  const data: WithContext<Restaurant> = {
    "@context": "https://schema.org",
    "@type": "Restaurant", // swap to the correct subtype per vertical
    "@id": "https://example.com/#business",
    name: "Trattoria Aurora",
    url: "https://example.com",
    telephone: "+39-051-1234567",
    priceRange: "€€",
    image: "https://example.com/og/storefront.jpg",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Via Roma 12",
      addressLocality: "Bologna",
      addressRegion: "BO",
      postalCode: "40121",
      addressCountry: "IT",
    },
    geo: {
      "@type": "GeoCoordinates",
      // 5+ decimal places
      latitude: 44.49381,
      longitude: 11.34298,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "12:00",
        closes: "23:00",
      },
    ],
    servesCuisine: "Italian",
    acceptsReservations: "https://example.com/reserve",
    sameAs: [
      "https://www.facebook.com/...",
      "https://www.instagram.com/...",
      // link claimed map/profile listings here
    ],
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe; do not interpolate unescaped user input
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

Render it once per location page (or in the layout for a single-location site). Validate with Google's Rich Results Test and Schema.org validator before shipping.

### Service-area business variant

Drop `geo`/`streetAddress` if no public address; declare named areas served:

```tsx
const data = {
  "@context": "https://schema.org",
  "@type": "Plumber",            // a LocalBusiness subtype
  "@id": "https://example.com/#business",
  name: "RapidoIdraulica",
  telephone: "+39-051-1234567",
  url: "https://example.com",
  areaServed: [
    { "@type": "City", name: "Bologna" },
    { "@type": "City", name: "Modena" },
  ],
  address: { "@type": "PostalAddress", addressRegion: "BO", addressCountry: "IT" },
};
```

### Multi-location with next-intl: crawlable store locator

Generate one static, server-rendered URL per location — never a client-only locator. Subdirectory paths (`/locations/[city]`) consolidate link equity better than subdomains.

```tsx
// app/[locale]/locations/[city]/page.tsx
import { notFound } from "next/navigation";
import { getLocations, getLocation } from "@/lib/locations"; // e.g. Payload CMS

export async function generateStaticParams() {
  const locations = await getLocations();
  return locations.map((l) => ({ city: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; locale: string }>;
}) {
  const { city } = await params;
  const loc = await getLocation(city);
  if (!loc) return {};
  return {
    title: `${loc.serviceLabel} in ${loc.cityName} | ${loc.brand}`,
    description: loc.metaDescription, // must be unique per location
    alternates: { canonical: `https://example.com/locations/${city}` },
  };
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const loc = await getLocation(city);
  if (!loc) notFound();

  return (
    <main>
      <h1>{loc.serviceLabel} in {loc.cityName}</h1>
      {/* Unique, non-swappable body: pass the swap test.
          Local photos, area-specific testimonials, local FAQs. */}
      <a href={`tel:${loc.phoneE164}`}>{loc.phoneDisplay}</a>
      {/* Per-location JSON-LD with a unique @id, branchOf the Organization */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildLocationJsonLd(loc)) }}
      />
    </main>
  );
}
```

Guardrails for programmatic location pages: warn at ~30 pages and enforce the 60%+ unique-content bar; treat 50+ near-identical pages as a hard stop until a human confirms each is genuinely distinct. Lazy-load any embedded map so it does not wreck LCP/INP. Core Web Vitals thresholds still apply: LCP < 2.5s, INP < 200ms (INP replaced FID), CLS < 0.1.

## Maps & geo-grid intelligence (analysis layer)

To measure how a business appears across the map ecosystem rather than on its own site:

- **Geo-grid / Share of Local Voice** — simulate map searches from a grid of GPS points (e.g. 7×7 over a 5km radius using a Haversine offset), record the target's rank at each point, then `SoLV = top_3_count / total_points × 100`. Render as a heatmap. Requires a SERP/maps data source (use your own crawler or a SERP API); always show a cost estimate before a paid grid scan.
- **Review intelligence** — pull reviews newest-first, compute reviews/month over the last 6 months, flag multi-week gaps, and chart rating distribution (a healthy curve skews to 5-star without being uniformly 5-star). Owner-response rate = responses / total.
- **Fake-review signals** — flag clusters matching 2+ of: uniform timing, single-review reviewer accounts, geographic inconsistency, an exclusively-5-star spike vs baseline, near-identical text, volume spikes with no marketing trigger.
- **Cross-platform NAP** — verify Name/Address/Phone consistency across the major map and search platforms and OpenStreetMap (free via Overpass/Nominatim for competitor discovery and geocoding). Recommend claiming any unclaimed profile.

## Audit output (report shape)

1. Local SEO score XX/100 with the dimension breakdown table.
2. Business type (brick-and-mortar / SAB / hybrid) and detected vertical.
3. GBP checklist: detected vs missing signals.
4. Review health: rating, count, velocity indicator, owner-response rate, platform spread.
5. NAP consistency audit: page vs schema vs profile, with each discrepancy flagged by severity.
6. Citation presence: tier-1 directory status.
7. Local schema status: present / generic / missing, plus a ready-to-paste fix.
8. Location-page quality (multi-location): unique-content %, doorway risk, locator crawlability.
9. Top 10 prioritized actions: Critical > High > Medium > Low, each with its falsifiability condition and leading indicator.
10. **Limitations disclaimer** — what this could NOT assess (live geo-grid position, full backlink profile, GBP Insights internals, real-time pack position) and that those require additional tooling/data.

## Error handling

- URL unreachable: report the error; do not guess page content.
- No local signals on page: report it and ask the user to confirm this is a local business / supply the profile URL.
- NAP absent from HTML: check schema/meta; if still missing, flag Critical and recommend visible NAP in footer + contact page.
- Vertical ambiguous: present the top two candidates with evidence and ask before applying vertical-specific advice.
- JS-injected map/review widgets: audit the rendered DOM (use your own headless renderer), since these are commonly client-injected and a raw fetch will miss them.

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
