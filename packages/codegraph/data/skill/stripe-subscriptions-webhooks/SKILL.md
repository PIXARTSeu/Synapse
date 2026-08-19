---
name: stripe-subscriptions-webhooks
description: Stripe for SaaS in Next.js — Checkout Sessions (subscription mode), Customer Portal, webhook signature verification, idempotency, subscription lifecycle events, multi-currency, Stripe Tax, metered billing, prorations, trial logic, sync to your DB. Use when adding paid plans, integrating Stripe Checkout, handling webhook events, debugging signature errors, syncing subscriptions, or building a self-serve billing UI.
version: 1.0.0
---

# Stripe Subscriptions + Webhooks (Next.js)

## Overview

A production Stripe integration has four moving parts:

1. **Checkout Session** — hosted Stripe page that takes the payment / starts the subscription.
2. **Customer Portal** — hosted Stripe page for the user to manage their subscription.
3. **Webhooks** — Stripe POSTs events (`customer.subscription.updated`, `invoice.paid`, etc.) to your backend. **This is the source of truth**, not the Checkout response.
4. **Local DB mirror** — a `subscriptions` table that you keep in sync with Stripe via webhooks. Your app queries your DB, never Stripe's API in request paths.

Skip the local mirror and you'll regret it: every page that needs to check entitlements would hit Stripe's API (slow, rate-limited, fragile).

## When to Use

- Adding paid plans, subscriptions, or one-time payments
- Building a self-serve cancel / upgrade flow
- Handling webhook events for subscription lifecycle
- Implementing trials, prorations, multi-currency, metered billing
- Debugging "webhook signature verification failed"
- Migrating from Paddle / Lemon Squeezy / Gumroad to Stripe

Don't use when:
- You're in the EU and need Merchant-of-Record handling for VAT — Lemon Squeezy / Paddle is simpler
- The product is one purchase, lifetime access, no recurring — Stripe Checkout in `payment` mode is overkill; consider PayPal / direct bank
- Selling physical goods — use Shopify or Medusa

## Setup

```bash
npm install stripe @stripe/stripe-js
```

Env:

```bash
STRIPE_SECRET_KEY=sk_test_...               # server-only
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # client-safe
STRIPE_WEBHOOK_SECRET=whsec_...             # server-only, from CLI/dashboard
NEXT_PUBLIC_SITE_URL=https://example.com
```

Server client (singleton):

```ts
// lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.acacia',  // pin a version
  typescript: true,
});
```

Pin the API version — Stripe's API changes; pinning prevents silent breakage.

## Pattern: Create Checkout Session (subscription)

```ts
// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const { priceId } = await req.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // ensure customer exists; cache stripe_customer_id on your user row
  let customerId = user.user_metadata.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await supabase.auth.updateUser({
      data: { stripe_customer_id: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing?canceled=true`,
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 14,                 // optional
      metadata: { user_id: user.id },        // surface on subscription too
    },
    automatic_tax: { enabled: true },        // EU VAT etc.
    // For B2B: collect tax IDs
    tax_id_collection: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
  });

  return NextResponse.json({ url: session.url });
}
```

Client redirect — no Stripe.js JS needed when using hosted Checkout:

```tsx
'use client';
export function CheckoutButton({ priceId }: { priceId: string }) {
  return (
    <button
      onClick={async () => {
        const res = await fetch('/api/checkout', { method: 'POST', body: JSON.stringify({ priceId }) });
        const { url } = await res.json();
        window.location.href = url;
      }}
    >
      Subscribe
    </button>
  );
}
```

## Pattern: Customer Portal

```ts
// app/api/portal/route.ts
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const customerId = user?.user_metadata?.stripe_customer_id;
  if (!customerId) return NextResponse.json({ error: 'no_customer' }, { status: 400 });

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
```

Configure the portal: Stripe Dashboard → Settings → Billing → Customer Portal. Enable: update payment method, cancel/pause subscription, view invoices, change plan, tax IDs.

## Pattern: Webhooks — The Critical Piece

```ts
// app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';        // need Node for raw body

// IMPORTANT: don't use req.json() — we need the raw body for signature verification
export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('stripe-signature');

  if (!signature) return new NextResponse('No signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error('Webhook signature failed:', err);
    return new NextResponse('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await upsertSubscription(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await markSubscriptionCanceled(event.data.object);
        break;
      case 'invoice.paid':
        await recordInvoice(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        // Log unhandled events for visibility
        console.log('Unhandled event:', event.type);
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    // 500 → Stripe will retry. 200 → marked delivered, no retry.
    return new NextResponse('Handler error', { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

### Crucial details

- **Raw body**: Stripe signature is computed over the unmodified bytes. If you parse JSON first, signature verification fails.
- **Idempotency**: Stripe retries failed deliveries. Make handlers idempotent (e.g. `upsert` not `insert`).
- **Fast response**: handler must return < 30s. For heavy work, push to a queue (Inngest, Trigger.dev) and return 200 immediately.
- **Status codes**: return 200 only when fully processed. Return 5xx if you want Stripe to retry.

## Pattern: Sync to Local DB

```sql
create table subscriptions (
  user_id uuid primary key references auth.users(id),
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  status text not null,            -- active, trialing, past_due, canceled, etc.
  price_id text not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  trial_end timestamptz,
  updated_at timestamptz not null default now()
);

create index on subscriptions(stripe_customer_id);
```

```ts
async function upsertSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata.user_id;
  if (!userId) {
    console.warn('Sub without user_id metadata:', sub.id);
    return;
  }

  await db.subscriptions.upsert({
    user_id: userId,
    stripe_customer_id: sub.customer as string,
    stripe_subscription_id: sub.id,
    status: sub.status,
    price_id: sub.items.data[0].price.id,
    current_period_end: new Date(sub.current_period_end * 1000),
    cancel_at_period_end: sub.cancel_at_period_end,
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  });
}
```

Check entitlements from this table — never call Stripe in request paths.

## Pattern: Entitlement Check

```ts
// lib/billing.ts
export async function hasActiveSubscription(userId: string) {
  const sub = await db.subscriptions.findUnique({ where: { user_id: userId } });
  if (!sub) return false;
  return ['active', 'trialing'].includes(sub.status)
      && sub.current_period_end > new Date();
}

// usage in a Server Action / page
const hasPaid = await hasActiveSubscription(user.id);
if (!hasPaid) redirect('/upgrade');
```

## Pattern: Local Dev with Stripe CLI

Webhooks won't reach `localhost` from production Stripe. Use the CLI:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# prints a `whsec_...` — paste into .env.local as STRIPE_WEBHOOK_SECRET (dev)
```

Then trigger events:

```bash
stripe trigger customer.subscription.created
stripe trigger invoice.paid
```

The CLI replays events to your local handler with valid signatures.

## Pattern: Multi-Currency

Stripe supports per-customer presentment currency:

```ts
// at customer creation
await stripe.customers.create({
  email,
  preferred_locales: ['it'],
});

// when creating prices, define a price object per currency
// or use Adaptive Pricing in the Dashboard (auto-converts).
```

For most SaaS: define one price-per-currency-per-product (e.g. `price_eur_pro`, `price_usd_pro`) and pick at Checkout time based on user locale.

## Pattern: Stripe Tax (EU VAT)

Enable in Dashboard → Tax. Add `automatic_tax: { enabled: true }` to Checkout Sessions (shown above). Stripe validates customer address and applies correct VAT. Combined with `tax_id_collection`, business customers get their VAT number on the invoice for reverse-charge.

For Italian projects: add your IVA number in Dashboard → Tax → Registrations.

## Pattern: Metered Billing (Usage)

Define a metered price in Dashboard (per-unit pricing without quantity). Report usage:

```ts
await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
  quantity: 42,         // e.g. API calls made
  timestamp: Math.floor(Date.now() / 1000),
  action: 'increment',
});
```

For real-time accuracy, send usage events as they happen. For cost, batch at end of billing period.

## Pattern: Test Cards

```
4242 4242 4242 4242  → success
4000 0000 0000 9995  → declined (insufficient funds)
4000 0027 6000 3184  → 3DS required
```

Use any future expiry + any 3-digit CVC + any postcode. Full list: docs.stripe.com/testing.

## Using with Next.js

- **Webhook route must be on Node runtime** (`export const runtime = 'nodejs'`). Edge runtime breaks raw body access.
- **Don't import `stripe` from a Client Component** — leaks the secret key into the bundle. Always wrap in a Server Action or Route Handler.
- **Vercel limits**: webhook handler has 10s timeout on Hobby. Move heavy work to a queue.
- **`stripe-signature` header**: read via `headers()` (async in Next 15). Don't rely on direct `req.headers.get`.
- **CSRF**: webhook routes don't need CSRF; signature is the auth.
- **Coolify**: ensure your reverse proxy passes the raw body (don't compress/transform).

## Examples

### Example 1: 3-plan SaaS pricing page
3 Stripe Prices (monthly + annual variants). Pricing page calls `/api/checkout` with the chosen priceId. Webhook sync ensures `subscriptions.status` reflects reality. App uses `hasActiveSubscription()` to gate features.

### Example 2: Annual upgrade in Customer Portal
Stripe Customer Portal configured to allow plan switching. User clicks upgrade → portal handles proration → webhook arrives → DB synced. Zero custom UI needed.

### Example 3: Metered API SaaS
Free tier 1K calls/mo, then $0.001/call metered. Each request increments usage via `createUsageRecord`. Stripe bills at month end. Webhook on `invoice.created` lets you email the customer a heads-up.

## Troubleshooting

### "Webhook signature verification failed"
Cause: body was parsed (lost raw bytes) or wrong secret.
Fix: use `await req.text()`, never `req.json()`. Verify `STRIPE_WEBHOOK_SECRET` matches the endpoint (dashboard "Reveal" button or CLI `stripe listen` output). Test in CLI: `stripe events resend evt_xxx`.

### "Customer has no payment method"
Cause: tried to create a subscription without a successful Checkout.
Fix: always go through Checkout for subscription creation. Don't try `stripe.subscriptions.create` directly from your app — that requires PaymentIntent setup and SCA handling.

### Subscription stays in `incomplete` status
Cause: SCA (Strong Customer Authentication) required, user didn't complete 3DS.
Fix: this is normal during Checkout flow. If it persists, surface `subscription.latest_invoice.payment_intent.next_action` to prompt the user.

### Local webhook handler not receiving events
Cause: Stripe CLI not running, or webhook secret mismatch.
Fix: keep `stripe listen` running in a terminal. The secret it prints must match `STRIPE_WEBHOOK_SECRET` in `.env.local` (different from production secret).

### Duplicate subscription rows in DB
Cause: handler processed the same webhook event twice (Stripe retries).
Fix: use `upsert` on `stripe_subscription_id` unique constraint. Optionally check `event.id` against a "processed events" table.

### Webhook timeout in production
Cause: handler doing heavy work (sending email, updating CRM, etc.).
Fix: push side effects to a queue. Return 200 immediately. Queue worker handles slow stuff.

### Customer charged but webhook never arrived
Cause: handler returned 5xx (Stripe gave up after retries), or endpoint URL wrong.
Fix: check Dashboard → Webhooks → Endpoint → Recent deliveries. Replay failed events. Add monitoring on the route (Sentry / log alerts).

### Tax not calculated
Cause: missing `automatic_tax: { enabled: true }` or customer address invalid.
Fix: add to Checkout Session. Ensure customer has full address (line1, city, postal_code, country). Verify your business location is set in Dashboard → Tax.

### Test mode bleeds into production
Cause: env vars not separated.
Fix: use `STRIPE_SECRET_KEY_TEST` + `STRIPE_SECRET_KEY_LIVE` and pick at runtime, OR keep test/prod in different env files and never mix. Webhook endpoints are also separate (test/live).

### Prices look correct in code but customer sees different amount
Cause: presentment vs settlement currency, or Adaptive Pricing FX conversion.
Fix: log `session.amount_total` and `session.currency` from the webhook. Disable Adaptive Pricing if you want exact local control.

### Cancel link doesn't show in portal
Cause: portal configuration disables it.
Fix: Dashboard → Settings → Customer Portal → Subscriptions → "Customers can cancel" → on.

### Trial doesn't start
Cause: `trial_period_days` set on Checkout but customer already used trial.
Fix: Stripe blocks repeat trials per customer by default. Override with `subscription_data.trial_period_days` + `trial_settings.end_behavior` if you need to.
