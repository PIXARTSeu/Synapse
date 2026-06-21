---
name: seo-sitemap-advanced
description: >
  Advanced XML sitemaps for Next.js App Router — index/shard files, news/image/video
  sitemaps, lastmod hygiene, 50k sharding, IndexNow ping, plus an audit rubric. Use when
  user says "sitemap", "sitemap index", "news sitemap", "image sitemap", "video sitemap",
  "large site sitemap", "IndexNow", "lastmod", or "sitemap audit".
  Triggers on: sitemap, sitemap.xml, sitemap index, news sitemap, image sitemap,
  video sitemap, lastmod, sharding, IndexNow, robots sitemap reference.
version: 1.1.0
---

# Advanced Sitemaps (Next.js App Router)

Sitemaps are a discovery hint, not an indexing guarantee. Google obeys two hard limits
per file: **50,000 URLs** and **50 MB uncompressed**. Cross either and you must shard
behind a sitemap index. `<priority>` and `<changefreq>` are ignored by Google — do not
spend code on them. `<lastmod>` is honored *only when it is trustworthy*; a dishonest or
all-identical `lastmod` gets the whole signal discounted.

## Stack defaults

- One `app/sitemap.ts` (`MetadataRoute.Sitemap`) for small/medium sites (< 50k URLs).
- A sitemap *index* + generated route handlers for large/sharded sites.
- Localized alternates via `alternates.languages` (next-intl).
- Data comes from Payload CMS (or any source); never hardcode URL lists.

---

## 1. Small/medium site — `app/sitemap.ts`

`MetadataRoute.Sitemap` emits valid XML, escapes URLs, and is statically generated at
build (or revalidated). Use a real `updatedAt` from the CMS for `lastmod`.

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";
import { getPayloadClient } from "@/lib/payload";

const BASE = process.env.NEXT_PUBLIC_SITE_URL!; // e.g. https://acme.com

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayloadClient();

  const { docs: posts } = await payload.find({
    collection: "posts",
    where: { _status: { equals: "published" } },
    select: { slug: true, updatedAt: true },
    limit: 0, // all
  });

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/pricing`, lastModified: new Date() },
  ];

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: new Date(p.updatedAt), // honest lastmod
  }));

  return [...staticRoutes, ...postRoutes];
}
```

### Localized alternates (next-intl)

Emit one `<url>` per canonical with `xhtml:link` alternates so each locale is discoverable.

```ts
const locales = ["en", "it", "de"] as const;

function withAlternates(path: string, lastModified: Date): MetadataRoute.Sitemap[number] {
  return {
    url: `${BASE}/en${path}`,
    lastModified,
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${BASE}/${l}${path}`])) },
  };
}
```

---

## 2. Large site — sitemap index + shards

Next.js auto-generates a sitemap index when `sitemap.ts` exports `generateSitemaps()`.
It produces `/sitemap/0.xml`, `/sitemap/1.xml`, … and a top-level index referencing them.
Shard by **content type first, then by 50k chunks** — type sharding keeps `lastmod`
meaningful and lets you re-ping only the part that changed.

```ts
// app/sitemap.ts  (sharded)
import type { MetadataRoute } from "next";
import { countProducts, getProductPage } from "@/lib/catalog";

const BASE = process.env.NEXT_PUBLIC_SITE_URL!;
const PER_SHARD = 45_000; // headroom under the 50k hard limit

export async function generateSitemaps() {
  const total = await countProducts();
  const shards = Math.ceil(total / PER_SHARD);
  return Array.from({ length: shards }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const rows = await getProductPage({ offset: id * PER_SHARD, limit: PER_SHARD });
  return rows.map((r) => ({
    url: `${BASE}/products/${r.slug}`,
    lastModified: new Date(r.updatedAt),
  }));
}
```

For a hand-rolled index across multiple *named* sitemaps (pages, posts, products,
images, video) serve one per route handler and reference them in an index handler:

```ts
// app/sitemap-index.xml/route.ts
const BASE = process.env.NEXT_PUBLIC_SITE_URL!;
const children = ["pages", "posts", "products", "images", "video", "news"];

export async function GET() {
  const now = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${children.map((c) => `  <sitemap><loc>${BASE}/sitemap-${c}.xml</loc><lastmod>${now}</lastmod></sitemap>`).join("\n")}
</sitemapindex>`;
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}
```

An index may reference up to 50,000 child sitemaps and nests **one level only** — never
point an index at another index.

---

## 3. Specialized sitemaps

`MetadataRoute.Sitemap` covers image and video via `images` / `videos`. News needs a
custom namespace, so emit it from a route handler.

### Image sitemap

```ts
// inside sitemap.ts entries
{
  url: `${BASE}/gallery/${slug}`,
  lastModified: new Date(updatedAt),
  images: [`${BASE}/img/${slug}-hero.webp`, `${BASE}/img/${slug}-2.webp`],
}
```

### Video sitemap

```ts
{
  url: `${BASE}/watch/${slug}`,
  lastModified: new Date(updatedAt),
  videos: [{
    title: video.title,
    thumbnail_loc: `${BASE}/thumbs/${slug}.jpg`,
    description: video.description, // required, <= 2048 chars
    content_loc: `${BASE}/media/${slug}.mp4`, // or player_loc
    duration: video.seconds,        // 1..28800
    publication_date: video.publishedAt,
  }],
}
```

### News sitemap (Google News namespace)

Only include articles from the **last 48 hours** — older entries are dropped and dilute
the file. Keep it small; do not put evergreen content here.

```ts
// app/news-sitemap.xml/route.ts
import { getRecentNews } from "@/lib/news";

const BASE = process.env.NEXT_PUBLIC_SITE_URL!;
const PUB = "Acme News";

export const revalidate = 300; // 5 min — news churns fast

export async function GET() {
  const since = Date.now() - 48 * 3600_000;
  const articles = (await getRecentNews()).filter((a) => +new Date(a.publishedAt) >= since);

  const items = articles
    .map(
      (a) => `  <url>
    <loc>${BASE}/news/${a.slug}</loc>
    <news:news>
      <news:publication><news:name>${PUB}</news:name><news:language>en</news:language></news:publication>
      <news:publication_date>${new Date(a.publishedAt).toISOString()}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>
    </news:news>
  </url>`,
    )
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items}
</urlset>`;
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}
```

---

## 4. lastmod hygiene

`lastmod` is the one optional tag that still carries weight — *if it is honest*. Google
discounts it when it is implausible or static.

- Source it from real `updatedAt` (CMS/db), not build time, not `new Date()` per entry.
- Bump it only when the **content** meaningfully changed (not on every redeploy, not on
  a comment count tick). Touching every `lastmod` on each deploy trains crawlers to ignore it.
- Use ISO 8601 with timezone (`2026-06-21T10:00:00Z`) or a plain date (`2026-06-21`).
- A child `<sitemap>`'s `lastmod` in the index = the newest `lastmod` inside that shard.
- Never ship all-identical `lastmod` across thousands of URLs — that is the classic tell
  of an auto-generated, untrustworthy date.

---

## 5. robots.txt + IndexNow ping

Reference every top-level sitemap (or just the index) from `robots.txt`:

```ts
// app/robots.ts
import type { MetadataRoute } from "next";
const BASE = process.env.NEXT_PUBLIC_SITE_URL!;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${BASE}/sitemap.xml`, // or sitemap-index.xml
    host: BASE,
  };
}
```

**IndexNow** (supported by Bing, Yandex, and others) pushes changed URLs instead of
waiting for a crawl. Host the key file at `${BASE}/<key>.txt` (content = the key), then
ping on publish/update — ideally from a Payload `afterChange` hook or revalidation path.

```ts
// lib/indexnow.ts
const KEY = process.env.INDEXNOW_KEY!;
const HOST = new URL(process.env.NEXT_PUBLIC_SITE_URL!).host;

export async function indexNow(urls: string[]) {
  if (!urls.length) return;
  await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `https://${HOST}/${KEY}.txt`,
      urlList: urls, // up to 10,000 per request
    }),
  });
}
```

Google does **not** use IndexNow; for Google rely on a clean sitemap + internal linking,
and reserve the (rate-limited) Indexing API for `JobPosting`/`BroadcastEvent` only.

---

## 6. Quality gates — what NOT to put in a sitemap

A sitemap should list canonical, indexable, 200-OK URLs only. Including junk teaches the
crawler the file is noisy.

**Exclude:** non-canonical URLs, `noindex` pages, redirected (3xx) URLs, 4xx/5xx URLs,
HTTP (non-HTTPS) URLs, URLs blocked by robots.txt, and paginated/parameter duplicates.

### Programmatic page gates (doorway-page risk)

Mass-generated pages in a sitemap are the fastest way to trigger thin/doorway penalties.

- WARNING at **30+** near-identical location/template pages → require 60%+ unique content each.
- HARD STOP at **50+** → require explicit justification before shipping.

| Safe at scale | Penalty risk |
|---|---|
| Integration pages with real setup docs | Location pages with only the city swapped |
| Glossary entries (200+ word definitions) | "Best [tool] for [industry]" with no real value |
| Product pages with unique specs/reviews | "[Competitor] alternative" with no comparison data |
| User-generated profile/content pages | AI-generated mass pages with no human review |

---

## 7. Sitemap audit (0-100)

Crawl the site (use your own crawler/tooling), pull every declared sitemap, and score:

| Dimension | Weight | What to check |
|---|---|---|
| Validity | 20 | Well-formed XML, correct namespaces, no parse errors, < 50k URLs & < 50 MB per file |
| URL health | 25 | Sample HTTP status: % returning 200 (penalize 3xx/4xx/5xx) |
| Indexability | 20 | No `noindex`, no non-canonical, no robots-blocked URLs present |
| Coverage | 15 | Crawl-discovered indexable pages that are missing from the sitemap |
| lastmod trust | 10 | Dates plausible, not all-identical, match observed content changes |
| Structure | 10 | Index used past 50k; sharded by type; referenced in robots.txt |

Score = weighted sum. **< 70 = needs work.** Report: missing pages (in crawl, not in
sitemap), orphan/dead entries (in sitemap, 404 or redirected), and quality-gate warnings.

### Falsifiability check
- **How would we know this failed?** Google Search Console "Pages" shows
  *Discovered – currently not indexed* / *Crawled – not indexed* climbing, or sitemap
  *Submitted* count diverging sharply from *Indexed*, or a sitemap fetch error in GSC.
- **Leading indicator:** new pages still unindexed 7-14 days after publish despite being
  in the sitemap → suspect lastmod distrust, thin content, or crawl-budget waste from junk URLs.

### Error handling during audit
- Sitemap URL unreachable → report HTTP status; confirm the site is live.
- No sitemap found → probe `/sitemap.xml`, `/sitemap_index.xml`, `/sitemap-index.xml`,
  and the `robots.txt` `Sitemap:` line before declaring "not found".
- Invalid XML → report the parse error with line number.
- Rate limited → back off, report partial results, note retry timing.

---

## Common issues (quick reference)

| Issue | Severity | Fix |
|---|---|---|
| > 50k URLs or > 50 MB in one file | Critical | Shard behind a sitemap index |
| Non-200 URLs listed | High | Remove or fix the broken URLs |
| `noindex` / non-canonical URLs listed | High | Remove from sitemap |
| Redirected (3xx) URLs listed | Medium | Replace with the final URL |
| All-identical / build-time `lastmod` | Medium | Use real per-URL `updatedAt` |
| Sitemap not in robots.txt | Low | Add `Sitemap:` line / `robots.ts` |
| `priority` / `changefreq` present | Info | Harmless but ignored by Google — can drop |

> Parts adapted from [claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT, © 2026 agricidaniel).
