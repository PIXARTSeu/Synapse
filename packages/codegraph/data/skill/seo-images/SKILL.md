---
name: seo-images
description: >
  Image SEO and performance for Next.js. Covers alt text, descriptive filenames,
  next/image responsive output, AVIF/WebP, lazy loading and LCP priority, CLS
  prevention, IPTC/XMP metadata, AI-generated image labeling
  (DigitalSourceType TrainedAlgorithmicMedia), OG/social images, and image
  sitemaps. Use when working on image optimization, alt text, image audit, or
  image SEO. Triggers on: image SEO, alt text, next/image, image optimization,
  image audit, WebP, AVIF, image metadata, OG image, image sitemap.
version: 1.1.0
---

# Image SEO & Optimization

Two modes: **implement** (write correct image markup/config in our Next.js
stack) and **audit** (score an existing site against the rubric below and tell
the team what to fix first). Both are covered here.

---

## Part 1 — Implement (Next.js 15 + Tailwind)

### `next/image` is the default

`next/image` gives us responsive `srcset`, lazy loading, async decoding, blur
placeholders, and CLS-safe dimensions for free. Prefer it over raw `<img>` for
any content/hero image. Reach for raw `<img>` only for cases the component can't
serve well (e.g. inline SVG, or a CMS HTML blob you don't control).

```tsx
import Image from "next/image";

// Above-the-fold / LCP image: priority loads eagerly + sets fetchpriority="high".
// Never use loading="lazy" here — it directly harms LCP.
<Image
  src="/blue-running-shoes.jpg"
  alt="Blue mesh running shoes on a wooden floor"
  width={1200}
  height={630}
  priority
  sizes="(max-width: 768px) 100vw, 1200px"
/>

// Below-the-fold image: lazy by default, give real intrinsic dimensions for CLS.
<Image
  src="/team-meeting.jpg"
  alt="Team meeting in a modern office conference room"
  width={800}
  height={600}
  sizes="(max-width: 768px) 100vw, 800px"
/>
```

Rules that matter:

- **One** `priority` image per route — the LCP element. More than one defeats the
  purpose (everything competes for bandwidth).
- Always pass `width`/`height` (or `fill` + a sized parent) so the box is
  reserved before load → no layout shift.
- `sizes` must reflect the real rendered width at each breakpoint, or Next ships
  an oversized variant. Match it to your Tailwind layout.
- For a layout-driven image (card, full-bleed hero) use `fill`:

```tsx
<div className="relative aspect-[16/9]">
  <Image src="/hero.jpg" alt="..." fill priority
         sizes="100vw" className="object-cover" />
</div>
```

### Format & quality config

Configure modern formats globally; Next negotiates AVIF → WebP → original per
`Accept` header.

```ts
// next.config.ts
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"], // AVIF first = best compression
    // qualities: [50, 75, 90],            // Next 16: whitelist allowed quality values
    remotePatterns: [
      { protocol: "https", hostname: "cms.pixarts.eu" }, // Payload media
    ],
  },
};
export default nextConfig;
```

Format priority and current support: **AVIF** (~93%) best compression, **WebP**
(~96%) safe default, JPEG/PNG fallback handled by the browser via negotiation.
(JPEG XL is feature-complete in Chromium behind a Rust decoder but not yet in
stable — monitor, don't deploy.)

### Payload CMS media

For CMS-driven images, generate sizes in the Media collection so the front end
gets right-sized derivatives and `next/image` doesn't upscale:

```ts
// Media collection (Payload)
imageSizes: [
  { name: "thumb", width: 400 },
  { name: "card",  width: 800 },
  { name: "hero",  width: 1600 },
],
formatOptions: { format: "webp", options: { quality: 82 } },
```

Always require `alt` on the Media collection (`required: true`) so editors can't
upload an image with no alt text. Map Payload's stored `alt` straight into the
`<Image alt={...}>` prop — never fall back to the filename.

### Alt text (this is the #1 image ranking signal)

- Present on every meaningful image. Decorative-only images get `alt=""` (empty,
  not absent) so screen readers skip them.
- Describe the content, not the file: "Blue mesh running shoes on a wooden
  floor", not "image.jpg".
- Natural keywords where they fit. Never stuff: "shoes shoes running shoes" is a
  quality flag, not a boost.
- Length ~10–125 chars. Longer than that usually means it's a caption, not alt.

| Good | Bad | Why |
|------|-----|-----|
| "Professional plumber repairing a kitchen sink faucet" | "image.jpg" | filename, not description |
| "Red 2024 Toyota Camry sedan, front three-quarter view" | "plumber plumbing plumber services" | keyword stuffing |
| "" (decorative divider) | "Click here" | non-descriptive |

### Filenames

Descriptive, lowercase, hyphenated, keyworded: `blue-running-shoes.webp`, not
`IMG_1234.jpg`. The filename is a real Google Images signal. For Payload uploads,
slugify the original filename on upload rather than keeping camera names.

### LCP, lazy loading, CLS — the perf triad

- `priority` on the LCP image; everything else lazy by default (`next/image`
  handles this).
- Reserve space (`width`/`height` or `fill` + aspect ratio) → CLS < 0.1.
- Don't lazy-load above-the-fold. Don't eager-load below-the-fold.

If you must drop to raw `<img>` (uncontrolled HTML), the manual equivalents are
`fetchpriority="high"` for LCP, `loading="lazy"` + `decoding="async"` below the
fold, and explicit `width`/`height`:

```html
<img src="/hero.webp" alt="..." width="1200" height="630" fetchpriority="high">
<img src="/photo.webp" alt="..." width="600" height="400" loading="lazy" decoding="async">
```

### OG / social preview image

Each route needs an `og:image` for link previews (a soft SEO/CTR signal, not a
ranking factor). Generate it dynamically with the App Router:

```tsx
// app/[locale]/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from "next/og";
export const size = { width: 1200, height: 630 }; // min 1200x630, 1.91:1
export const contentType = "image/png";

export default async function Image({ params }) {
  const post = await getPost(params.slug);
  return new ImageResponse(
    <div style={{ display: "flex", /* ...brand layout... */ }}>{post.title}</div>,
    { ...size },
  );
}
```

### Image sitemap

Google discovers images through page crawl, but an explicit `<image:image>`
extension in the sitemap helps for image-heavy/gallery pages. Emit it from
`app/sitemap.ts` when a route has notable imagery:

```ts
// app/sitemap.ts — add image entries to relevant routes
return posts.map((p) => ({
  url: `${base}/blog/${p.slug}`,
  lastModified: p.updatedAt,
  images: [`${base}${p.heroImage.url}`], // Next emits <image:image> for these
}));
```

### IPTC / XMP metadata & AI-generated labeling

File-embedded metadata (use your own image tooling / CLI to read+write EXIF /
IPTC / XMP):

- **IPTC Creator / Credit / Copyright** → Google Images shows these in the
  rich-result panel. **Display + attribution only, NOT a ranking factor.** Worth
  setting for brand attribution; not worth obsessing over.
- **EXIF camera data, IPTC keywords** → ignored by Google for SEO. Don't rely on
  them.
- WebP supports EXIF + XMP but **not** IPTC natively — write the equivalent XMP
  fields for WebP assets (most metadata tools handle the IPTC→XMP mapping).

**AI-generated images — operational requirement, not ranking.** For
generative-AI imagery (especially product images in a Merchant Center / shopping
feed), Google requires the IPTC `DigitalSourceType` label. Missing it can get a
product feed disapproved — so treat it as a compliance step, not an optimization.

Set the XMP-iptcExt `DigitalSourceType` to the matching IPTC vocabulary URI:

| Value (URI suffix on `cv.iptc.org/newscodes/digitalsourcetype/...`) | Use for |
|---|---|
| `trainedAlgorithmicMedia` | Fully AI-generated (diffusion-model product/hero imagery) |
| `compositeSynthetic` | Mix of captured + AI-generated elements |
| `digitalCapture` | Fully captured photograph, no AI element |

When optimizing AI-generated assets, confirm the source type with the user and
embed the matching value. Separately, AI-generated product **titles/descriptions**
must be labeled at the feed layer (Merchant Center), not the page — flag that to
whoever owns the product feed.

---

## Part 2 — Audit (methodology + scoring)

When auditing an existing site (use your own crawler/headless tooling to fetch
rendered HTML and image responses), classify and score.

### Detect the lazy-loading mechanism before flagging

A missing native `loading="lazy"` is **not** a regression if a JS lazy-loader is
in use. Classify each image's mechanism, then report it alongside `loading`:

| Mechanism | Signal | Note |
|---|---|---|
| `native` | `loading="lazy"` attribute | Modern default |
| `js-generic` | `data-src` / `data-srcset` / `data-original`, or class `lazyload`/`lazy` | Lazysizes, vanilla-lazyload, etc. — native attr intentionally absent |
| `plugin` | vendor-specific `data-*` attrs / classes | WordPress optimizer plugins, etc. |
| `none` | no signal | Genuinely not lazy-loaded |

### Thresholds

File size by category:

| Category | Target | Warning | Critical |
|----------|--------|---------|----------|
| Thumbnails | < 50 KB | > 100 KB | > 200 KB |
| Content images | < 100 KB | > 200 KB | > 500 KB |
| Hero / banner | < 200 KB | > 300 KB | > 700 KB |

CWV gates the image touches: **LCP < 2.5s**, **CLS < 0.1** (INP < 200ms is
mostly JS, but oversized images compete for the main thread on decode).

### 0–100 scoring rubric

Start at 100, subtract per issue, floor at 0.

| Check | Deduction |
|-------|-----------|
| `<img>`/`<Image>` missing meaningful alt (per image, cap −25) | −5 each |
| Alt present but non-descriptive or keyword-stuffed (cap −10) | −2 each |
| LCP image lazy-loaded (or not `priority`) | −15 |
| Image with no reserved dimensions → CLS risk (cap −15) | −3 each |
| Oversized image at Critical threshold (cap −20) | −5 each |
| No modern format offered (AVIF/WebP) where photos served | −10 |
| Generic/camera filenames at scale | −5 |
| Missing `og:image` on a shareable route | −5 |
| AI-generated product image missing `DigitalSourceType` (feed compliance) | −10 |

Bands: 90–100 excellent · 75–89 good · 50–74 needs work · <50 failing.

### What actually moves Google Images

| Factor | Impact | Where set |
|--------|--------|-----------|
| Alt text | CRITICAL (ranking) | `<Image alt>` / `<img alt>` |
| Filename | HIGH (ranking) | file system, slugified |
| Surrounding page context | HIGH (ranking) | nearby copy, heading, caption |
| File size / speed | MEDIUM (indirect via CWV) | format + compression |
| IPTC Creator/Copyright | LOW (display only) | embedded metadata |
| EXIF camera data, IPTC keywords | NONE | ignore for SEO |

### Falsifiability — how would we know this failed?

Don't declare an image pass "done" without a measurable check:

- **Claim:** "Images are optimized for LCP." → **Falsify:** field LCP for the
  page is still > 2.5s on mobile after deploy (check CrUX / RUM, not just lab).
- **Claim:** "Alt text is complete." → **Falsify:** a crawl still returns
  meaningful `<img>` with empty/missing alt, OR Search Console Image indexing
  doesn't rise over ~4 weeks.
- **Claim:** "Modern formats shipped." → **Falsify:** response `Content-Type` is
  still `image/jpeg`/`png` for content images when the client sent
  `Accept: image/avif`.
- **Leading indicator:** total image bytes per page and count of dimensionless
  images both trend down in the next crawl. If they don't, the change didn't
  land.

### Audit output template

**Summary**

| Metric | Status | Count |
|--------|--------|-------|
| Total images | – | XX |
| Missing alt | fail | XX |
| Oversized (Critical) | warn | XX |
| Legacy format only | warn | XX |
| No dimensions (CLS risk) | warn | XX |
| LCP image lazy-loaded | fail | 0/1 |
| **Score** | – | **NN/100** |

**Prioritized fix list** — sort by byte savings × traffic, largest first:

| Image | Current | Format | Issues | Est. savings | Fix |
|-------|---------|--------|--------|--------------|-----|
| /hero.jpg | 640 KB | JPEG | oversized, lazy LCP, no AVIF | ~480 KB | `priority`, AVIF, compress |

**Recommendations** — concrete, ordered: convert N images to AVIF/WebP
(~XX KB), add alt to N images, reserve dimensions on N, set `priority` on the
LCP image, slugify N camera filenames, add `og:image` to N routes.

### Error handling

| Scenario | Action |
|----------|--------|
| URL unreachable | Report status code; suggest checking auth/availability |
| No `<img>`/`<Image>` found | Note images may be CSS `background-image` or JS-injected; re-check rendered DOM |
| Images behind CDN/auth | Report markup-derived data (alt, dims, format) and flag size as inaccessible |
| Metadata tooling unavailable | Report HTML-level findings; note embedded metadata couldn't be inspected |

---

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
