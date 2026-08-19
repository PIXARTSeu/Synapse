---
name: sentry-nextjs
description: Sentry for Next.js 15 — SDK installation (client/server/edge configs), source maps upload, performance tracing, session replay, error boundary integration, instrumenting Server Actions and Route Handlers, alert rules, environments (dev/staging/prod), release tracking, user feedback widget. Use when adding error monitoring to a Next.js app, debugging production crashes, setting up performance tracing, configuring source maps, or building observability into Server Actions.
version: 1.0.0
---

# Sentry for Next.js 15

## Overview

Sentry catches errors and traces in production that you'd never see otherwise. The Next.js SDK (`@sentry/nextjs`) wires up:

- **Errors** — uncaught exceptions, promise rejections, fetch failures, in browser + Node.js + Edge runtimes.
- **Performance** — automatic instrumentation of pageloads, navigations, API calls, DB queries.
- **Session Replay** — DOM recording for the minute before each error (privacy-aware).
- **Releases** — link errors to git commits, surface "regressed in v1.2.3" insights.
- **Server Actions / Route Handlers** — covered by the SDK with one wrapper.

This skill is the practical setup + the patterns that catch real bugs.

## When to Use

- Production app where you can't be on every user's machine
- New launch, want a baseline of what breaks
- Performance regressions ("the app got slower last week")
- Need user-context for errors (who hit this, what page, what action)
- Auditing third-party SDK errors (Stripe webhook fails, Resend timeout)

Don't use when:
- You only need logs — Pino/Winston + log aggregator (Logtail, Axiom) is lighter
- Static site without forms/auth — there's nothing to error
- Budget-zero side project — Sentry free tier is 5K errors/month; consider self-hosted GlitchTip

## Setup

### Install + Wizard

```bash
npx @sentry/wizard@latest -i nextjs
```

The wizard handles: SDK install, generates `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, updates `next.config.ts` with the Sentry webpack plugin, creates `app/global-error.tsx`, asks for your DSN.

Or manually:

```bash
npm install @sentry/nextjs
```

### Env

```bash
NEXT_PUBLIC_SENTRY_DSN=https://...@o1234.ingest.sentry.io/5678
SENTRY_AUTH_TOKEN=sntrys_...      # for source map upload (CI only)
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

DSN is public-safe. Auth token is **secret** — store in CI / Coolify env, never commit.

## Configuration Files

### `sentry.client.config.ts`

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Performance
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Session Replay
  replaysSessionSampleRate: 0.1,    // 10% of normal sessions
  replaysOnErrorSampleRate: 1.0,    // 100% of sessions with errors
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,             // privacy: mask text by default
      blockAllMedia: true,           // privacy: block images/video
    }),
  ],
});
```

### `sentry.server.config.ts`

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // For better traces on Server Actions
  integrations: [
    Sentry.nativeNodeFetchIntegration(),
  ],
});
```

### `sentry.edge.config.ts`

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

### `next.config.ts` Wrapper

```ts
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = { /* your config */ };

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,        // upload source maps for ALL JS chunks
  hideSourceMaps: true,               // remove .map files from public output
  disableLogger: true,
  // tunnelRoute: '/monitoring',      // bypass ad-blockers (optional)
});
```

### `app/global-error.tsx`

```tsx
'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <h2>Qualcosa è andato storto</h2>
        <button onClick={reset}>Riprova</button>
      </body>
    </html>
  );
}
```

This catches errors that escape all per-route boundaries.

## Pattern: Error Boundaries

```tsx
// app/projects/error.tsx
'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <div>
      <h2>Errore caricamento progetti</h2>
      <button onClick={reset}>Riprova</button>
    </div>
  );
}
```

Per-route `error.tsx` files automatically get error boundary behavior. Add `Sentry.captureException` to wire them up.

## Pattern: Capture Custom Errors

```ts
import * as Sentry from '@sentry/nextjs';

try {
  await riskyOperation();
} catch (err) {
  Sentry.captureException(err, {
    tags: { feature: 'payment' },
    extra: { orderId, customerId },
  });
  throw err;     // re-throw if you want the error to propagate
}

// Just messages without exception
Sentry.captureMessage('Unusual state hit', 'warning');
```

## Pattern: User Context

Tag errors with the logged-in user so you can filter by user / contact them:

```ts
// after login
Sentry.setUser({
  id: user.id,
  email: user.email,           // optional — privacy implication
});

// on logout
Sentry.setUser(null);
```

Wrap in a layout effect:

```tsx
'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export function SentryUserContext({ userId, email }: { userId?: string; email?: string }) {
  useEffect(() => {
    if (userId) Sentry.setUser({ id: userId, email });
    return () => Sentry.setUser(null);
  }, [userId, email]);
  return null;
}
```

Mount inside your auth-aware layout.

## Pattern: Server Action Instrumentation

```ts
'use server';
import * as Sentry from '@sentry/nextjs';

export const submitContact = Sentry.withServerActionInstrumentation(
  'submitContact',                       // action name in Sentry
  async (prev: any, formData: FormData) => {
    // your action body
  },
);
```

Wraps the action with automatic error capture + performance tracing. Errors get the action name; performance shows you the slow ones.

## Pattern: API Route Wrapping

Sentry SDK auto-instruments Route Handlers via the webpack plugin. To capture errors thrown inside:

```ts
// app/api/lead/route.ts
import * as Sentry from '@sentry/nextjs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await processLead(body);
    return Response.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return Response.json({ error: 'failed' }, { status: 500 });
  }
}
```

## Pattern: Performance Tracing

Auto-instrumented:
- Pageloads + navigations (browser)
- Fetch calls (browser + server)
- Route handler execution

For custom spans (DB queries, AI calls):

```ts
import * as Sentry from '@sentry/nextjs';

const result = await Sentry.startSpan(
  { name: 'claude.summarize', op: 'ai.generate' },
  async (span) => {
    span.setAttribute('model', 'claude-sonnet-4-6');
    return await anthropic.messages.create({ /* ... */ });
  },
);
```

Spans nest automatically when called inside an active trace. Use `op: 'db.query'` for DB calls, `op: 'http.client'` for external APIs.

## Pattern: Session Replay (Privacy First)

```ts
// sentry.client.config.ts
integrations: [
  Sentry.replayIntegration({
    maskAllText: true,
    blockAllMedia: true,
    // Whitelist specific elements
    unmask: ['.public-text'],
    unblock: ['.public-image'],
    // Or use data attributes
    // <input data-sentry-mask="false" />
    // <img data-sentry-block="false" />
  }),
],
```

Defaults are aggressively private. Selectively unmask only what's safe (e.g. button labels, logos). Never unmask form fields with PII.

## Pattern: Filtering Errors

```ts
Sentry.init({
  // ...
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',     // benign Chrome warning
    /^NetworkError when attempting to fetch/,
    'ChunkLoadError',                          // user navigating between deploys
  ],
  denyUrls: [
    /chrome-extension:/,
    /safari-extension:/,
  ],
  beforeSend(event, hint) {
    // Drop events from internal IPs
    if (event.request?.headers?.['cf-connecting-ip']?.startsWith('10.')) return null;
    // Strip PII
    if (event.user?.email) {
      event.user.email = event.user.email.replace(/.+@/, 'x@');
    }
    return event;
  },
});
```

## Pattern: Releases + Source Maps

The Sentry webpack plugin (in `withSentryConfig`) auto-uploads source maps during build IF `SENTRY_AUTH_TOKEN` is set.

For releases, set in CI:

```bash
SENTRY_RELEASE=$(git rev-parse --short HEAD)
```

The plugin associates the build with this release. Errors then show "first seen in release abc123". Combine with Sentry's "Suspect Commits" to surface the likely-guilty commit.

## Pattern: Feedback Widget

```ts
Sentry.init({
  // ...
  integrations: [
    Sentry.feedbackIntegration({
      colorScheme: 'system',
      autoInject: false,                  // call .openDialog() manually
    }),
  ],
});

// open programmatically
import { getFeedback } from '@sentry/nextjs';
getFeedback()?.openDialog();
```

Pop the feedback dialog after a user error or on a "Report bug" button.

## Pattern: Alerts

Configure in Sentry Dashboard → Alerts:
- **Frequency** — N events in M minutes
- **Regression** — error resolved, but came back
- **First occurrence** — never seen before
- **Performance** — P95 > threshold

Channels: Email, Slack, PagerDuty, Discord, Webhook. Hook into Slack / Discord for fast team feedback.

## Using with Next.js

- All three SDK initialization files (client / server / edge) are needed; the wizard creates them.
- The `withSentryConfig` wrapper around `next.config.ts` is mandatory — it enables source map upload + auto-instrumentation.
- Server Actions: wrap each with `Sentry.withServerActionInstrumentation` for proper tracing.
- App Router error boundaries: `error.tsx` files + `global-error.tsx` for the unrecoverable case.
- Edge runtime (middleware, edge functions): edge config is leaner — no source map, no replay.
- Coolify / VPS: nothing special; SDK posts events over HTTPS to ingest endpoint.
- Vercel: works out of the box, integrate via Vercel-Sentry integration for env var management.

## Examples

### Example 1: First production launch
Wizard install → set DSN → ship. Watch errors trickle in over 24h. Triage: dismiss noise, fix real ones, set alerts for "first occurrence" on new error types.

### Example 2: Slow page investigation
Look at Performance → Web Vitals. Find page with worst INP. Check transaction trace — which API call is slow. Drill into trace → identify N+1 DB query.

### Example 3: Stripe webhook reliability
Wrap webhook handler. Alert on N consecutive failures. Get notified before customers complain. Replay events from Stripe CLI when debugging.

## Troubleshooting

### Errors show up but with minified stack traces
Cause: source maps not uploaded.
Fix: set `SENTRY_AUTH_TOKEN` in CI/build env. Confirm `withSentryConfig` is the outermost wrapper in `next.config.ts`. Check build logs for "Source maps uploaded" line. Verify `hideSourceMaps: true` so `.map` files aren't publicly served.

### Server-side errors not captured
Cause: missing `sentry.server.config.ts` or not loading.
Fix: file must be at project root. Next.js auto-loads it via the SDK. Check console: `Sentry.init` should log on first server boot.

### Session Replay records sensitive data
Cause: defaults too permissive, or unmask too broad.
Fix: keep `maskAllText: true` and `blockAllMedia: true`. Use `data-sentry-mask` / `data-sentry-block` per-element instead of CSS selectors when possible.

### Performance overhead noticeable
Cause: `tracesSampleRate: 1.0` in production.
Fix: drop to `0.1` (10%) or lower. Use `tracesSampler` for adaptive sampling — full rate on errors, low on normal traffic.

### High event volume → quota hit
Cause: noisy errors (ResizeObserver, ChunkLoadError), or runaway exceptions in a loop.
Fix: add to `ignoreErrors`. For runaway: fix root cause; meanwhile, rate-limit in `beforeSend` (drop if same hash sent > 10x in 60s).

### Source map upload fails in CI
Cause: missing `SENTRY_AUTH_TOKEN`, or wrong org/project slug.
Fix: get auth token at sentry.io → Settings → Auth Tokens. Verify slug matches Dashboard URL. Pass `--debug` to `sentry-cli` for verbose log.

### Server Actions not in Performance dashboard
Cause: forgot `Sentry.withServerActionInstrumentation` wrapper.
Fix: wrap every server action. Or check the experimental auto-instrumentation flag in SDK 9+.

### Replay missing in production but works in dev
Cause: ad-blocker, or `tunnelRoute` needed.
Fix: configure `tunnelRoute: '/monitoring'` in `withSentryConfig`. Sentry events POST to same-origin first, bypassing ad-blockers.

### Cannot find module '@sentry/nextjs' at build time
Cause: SDK installed but Next.js cache stale, or wrong workspace.
Fix: `rm -rf .next node_modules && npm install`. Confirm `package.json` includes `@sentry/nextjs`. For monorepos, install at the consuming app's package.json too.

### "Sentry.init was never called"
Cause: config file missing or has a syntax error.
Fix: ensure `sentry.{client,server,edge}.config.ts` exist at project root. Restart `next dev`. Check console for SDK init message.

### Edge runtime errors not appearing
Cause: Edge config missing or DSN wrong env.
Fix: `sentry.edge.config.ts` must be present even if minimal. Edge runtime has reduced feature set (no replay, no source maps automatic) — only errors + minimal traces.
