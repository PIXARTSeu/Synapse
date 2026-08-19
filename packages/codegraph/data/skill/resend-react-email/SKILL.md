---
name: resend-react-email
description: Resend (resend.com) HTTP API + React Email components for transactional and broadcast email in Next.js — domain verification, DKIM, send/batch/schedule, attachments, idempotency, React-templated emails, audience+broadcast, webhooks (delivered, bounce, complaint), reply-to, preview via React Email Studio. Use when sending transactional email with React templates, setting up Resend in a new project, debugging "domain not verified", or switching from Nodemailer to a hosted API.
version: 1.0.0
---

# Resend + React Email

## Overview

**Resend** is the hosted email API by the Vercel-adjacent team — DKIM/SPF/DMARC managed, React-templated emails, HTTP API (no SMTP needed), competitive pricing. **React Email** is the companion library to write emails as React components and render them to HTML.

Pair them and you get: typed templates + previewable in dev + sent via one HTTP call. Cleaner than `nodemailer-transactional` for new projects; pick Nodemailer when you must use existing SMTP.

This skill assumes Next.js 15 App Router.

## When to Use

- New project that needs transactional email
- Switching from Nodemailer when you don't have existing SMTP infrastructure
- Need React-templated emails with shared styles/components
- Audience + broadcast (newsletter, product updates) without a separate marketing tool
- Webhooks for delivery / bounce / complaint tracking
- Multi-domain setup (per-tenant, per-brand)

Don't use when:
- High volume (> 100k/month) without negotiation — check pricing
- You must use a specific SMTP provider (compliance, contract)
- You're sending bulk marketing > 50k/list — use dedicated ESP (SendGrid Marketing, Mailchimp)

## Setup

```bash
npm install resend react-email @react-email/components
```

Env:

```bash
RESEND_API_KEY=re_...
RESEND_FROM="Acme <noreply@yourdomain.com>"
```

Server client:

```ts
// lib/resend.ts
import { Resend } from 'resend';
export const resend = new Resend(process.env.RESEND_API_KEY!);
```

## Domain Verification (do this first)

Resend requires a verified sender domain. Without it, emails bounce or fall to spam.

1. Resend Dashboard → Domains → Add Domain (`yourdomain.com`).
2. Resend gives you 3 DNS records: **SPF**, **DKIM**, and **MX** (optional but recommended).
3. Add records at your DNS provider (Cloudflare, GoDaddy, Cloudflare, etc.).
4. Wait for propagation (minutes to hours). Click "Verify" in Dashboard.
5. Configure DMARC separately (Resend doesn't manage this for you):
   ```
   _dmarc.yourdomain.com  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com"
   ```

Until the domain shows **Verified**, only sends to internal addresses you control will arrive. Don't send to real customers before verification.

## Pattern: Send a Simple Email

```ts
import { resend } from '@/lib/resend';

await resend.emails.send({
  from: process.env.RESEND_FROM!,
  to: ['user@example.com'],
  subject: 'Benvenuto',
  html: '<p>Ciao!</p>',
  text: 'Ciao!',
});
```

Always include `text` as a plaintext alternative — spam filters score lower for HTML-only emails.

## Pattern: React Email Template

```tsx
// emails/Welcome.tsx
import {
  Html, Head, Body, Container, Text, Button, Hr, Section, Heading,
} from '@react-email/components';

type Props = { name: string; loginUrl: string };

export function Welcome({ name, loginUrl }: Props) {
  return (
    <Html lang="it">
      <Head />
      <Body style={{ fontFamily: 'system-ui, sans-serif', background: '#f8f8f8' }}>
        <Container style={{ background: '#fff', padding: 32, borderRadius: 12, maxWidth: 560 }}>
          <Heading as="h1">Benvenuto, {name}</Heading>
          <Text>Grazie per esserti registrato. Inizia subito qui sotto.</Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button
              href={loginUrl}
              style={{
                background: '#0070f3', color: '#fff',
                padding: '12px 24px', borderRadius: 8, textDecoration: 'none',
              }}
            >
              Accedi
            </Button>
          </Section>
          <Hr />
          <Text style={{ fontSize: 13, color: '#666' }}>
            Se non hai creato l'account, ignora questa email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default Welcome;
```

Send it:

```ts
import { Welcome } from '@/emails/Welcome';

await resend.emails.send({
  from: process.env.RESEND_FROM!,
  to: user.email,
  subject: `Benvenuto, ${user.name}`,
  react: Welcome({ name: user.name, loginUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/login` }),
});
```

Resend renders the React tree to HTML on its servers (or locally if you pass already-rendered HTML). The `react` shorthand handles both the HTML and a generated plaintext fallback.

## Pattern: Server Action Integration

```ts
// app/onboarding/actions.ts
'use server';
import { z } from 'zod';
import { resend } from '@/lib/resend';
import { Welcome } from '@/emails/Welcome';

const schema = z.object({ email: z.string().email(), name: z.string().min(1) });

export async function sendWelcome(_prev: any, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to: parsed.data.email,
    subject: `Benvenuto, ${parsed.data.name}`,
    react: Welcome({ name: parsed.data.name, loginUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/login` }),
  });

  if (error) {
    console.error('Resend error:', error);
    return { ok: false, error: 'send_failed' };
  }
  return { ok: true, id: data?.id };
}
```

Pair with `rhf-zod-server-actions` for the form side.

## Pattern: Local Preview (React Email Studio)

```bash
npx email dev
```

Opens `http://localhost:3000` (different port if your app uses 3000) with a live preview of every template in `emails/`. Edit → instant reload. Crucial for iterating on design.

For a dedicated emails dev script, add to `package.json`:

```json
{
  "scripts": {
    "emails": "email dev --dir emails --port 3333"
  }
}
```

## Pattern: Plaintext Override

Resend auto-generates plaintext from HTML, but the result can be awkward. For full control:

```ts
import { render } from '@react-email/render';
import { Welcome } from '@/emails/Welcome';

const html = await render(Welcome({ name, loginUrl }));
const text = await render(Welcome({ name, loginUrl }), { plainText: true });

await resend.emails.send({ from, to, subject, html, text });
```

The `plainText: true` option produces a hand-tunable plaintext from the same React tree. Override the text with your own copy if needed.

## Pattern: Batch Send

For broadcasts (up to 100 messages per call):

```ts
const { data, error } = await resend.batch.send([
  { from, to: 'user1@example.com', subject: 'Update', react: Newsletter({ name: 'Alice' }) },
  { from, to: 'user2@example.com', subject: 'Update', react: Newsletter({ name: 'Bob' }) },
  // up to 100 entries
]);
```

For > 100, loop in chunks of 100. Add small delay between batches to stay under rate limits (default 2 req/sec on free tier).

## Pattern: Schedule a Send

```ts
await resend.emails.send({
  from, to, subject, react: ReminderEmail({ /* ... */ }),
  scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),  // +24h
});
```

Resend holds the email until the scheduled time. Cancel before sending:

```ts
await resend.emails.cancel(emailId);
```

## Pattern: Attachments

```ts
await resend.emails.send({
  from, to, subject,
  react: InvoiceEmail({ amount }),
  attachments: [
    { filename: 'invoice.pdf', content: pdfBuffer },                  // Buffer
    { filename: 'logo.png', path: 'https://example.com/logo.png' },   // remote URL
  ],
});
```

Max attachment size: 40 MB total per email (free tier 10 MB).

## Pattern: Idempotency

Prevent double-sends from accidental retries:

```ts
await resend.emails.send(
  { from, to, subject, react: Welcome({ name, loginUrl }) },
  { idempotencyKey: `welcome-${userId}-${Date.now() / 60000 | 0}` },  // per minute
);
```

Resend deduplicates within 24 hours. Use a key that includes the action + user + a time bucket appropriate to your case.

## Pattern: Webhooks (Delivery Tracking)

Dashboard → Webhooks → Add Endpoint → enter your URL → select events (`email.delivered`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`).

```ts
// app/api/webhooks/resend/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';   // Resend uses Svix for webhook signing

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.text();
  const h = await headers();
  const svixId = h.get('svix-id');
  const svixTs = h.get('svix-timestamp');
  const svixSig = h.get('svix-signature');

  if (!svixId || !svixTs || !svixSig) {
    return new NextResponse('Missing headers', { status: 400 });
  }

  const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET!);
  let evt: any;
  try {
    evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTs,
      'svix-signature': svixSig,
    });
  } catch {
    return new NextResponse('Bad signature', { status: 400 });
  }

  switch (evt.type) {
    case 'email.bounced':
      await markEmailBounced(evt.data.email_id, evt.data.bounce);
      break;
    case 'email.complained':
      await markUserUnsubscribed(evt.data.to);
      break;
    case 'email.delivered':
      // optional: log success
      break;
  }

  return NextResponse.json({ received: true });
}
```

Critical: when a user bounces or complains, **stop sending to them**. Repeated sends to bad addresses tank your sender reputation.

## Pattern: Audiences + Broadcast (Newsletter)

```ts
// add contact
await resend.contacts.create({
  email: 'subscriber@example.com',
  audienceId: 'aud_...',
  firstName: 'Mario',
  unsubscribed: false,
});

// send broadcast to whole audience
await resend.broadcasts.send('broadcast_id', {
  audienceId: 'aud_...',
  from,
  subject: 'Monthly update',
  react: Newsletter({ /* ... */ }),
});
```

Resend handles unsubscribe links automatically when sending to an audience (one-click unsubscribe required by Gmail/Yahoo since Feb 2024).

## Pattern: Reply-To and From

```ts
await resend.emails.send({
  from: '"Support" <support@yourdomain.com>',
  to,
  subject,
  replyTo: customerCareEmail,    // replies go here, not "from"
  react: SupportReply({ /* ... */ }),
});
```

For contact forms, set `from` to your verified address and `replyTo` to the form's submitter — users hit Reply and the message goes to the lead.

## Using with Next.js

- All sends from server (Server Action / Route Handler / cron). Never client.
- Resend SDK works in Node and Edge runtimes — use Edge for low-latency single sends, Node for batch/webhook handlers.
- React Email components are pure React — they render server-side, no client bundle impact.
- Vercel / Coolify: nothing special needed. HTTP API works through any egress.
- Use `next/og` style image generation if you want personalized email images — generate a PNG endpoint, reference in the email.

## Examples

### Example 1: Welcome email on signup
Supabase Auth signup → DB trigger → Edge Function calls Resend with `Welcome.tsx`. Pair with `supabase-auth-ssr`. Use idempotency key `welcome-{userId}`.

### Example 2: Order confirmation + invoice PDF
Stripe webhook on `invoice.paid` → render `OrderConfirmation.tsx` + attach PDF generated server-side. Pair with `stripe-subscriptions-webhooks`.

### Example 3: Weekly digest broadcast
Cron job (Inngest / Vercel cron) → query active subscribers → broadcast to Resend audience. Unsubscribe handled by Resend's auto link.

## Troubleshooting

### "Domain not verified" when sending
Cause: DNS records not propagated, or wrong domain in `from`.
Fix: wait up to 48h after DNS change. Verify with `dig TXT yourdomain.com +short`. `from` address must use the verified domain.

### Emails arrive in spam
Cause: missing DMARC (Resend handles SPF/DKIM but not DMARC), bad sender reputation on a new domain, no plaintext alternative.
Fix: add DMARC record (see Setup). Warm up sending slowly — don't blast 10k emails on day 1. Always include text alternative.

### React Email template renders blank / weird
Cause: forgot `<Html>` / `<Body>` wrappers, or using non-email-safe CSS.
Fix: use `@react-email/components` primitives (`<Container>`, `<Section>`, `<Text>`, `<Button>`, etc.) — they emit table-based layouts that render in old Outlook. Avoid CSS grid, flex (limited), modern selectors.

### "Failed to verify webhook signature"
Cause: wrong secret, body modified by proxy.
Fix: use the secret from Dashboard → Webhooks → endpoint detail. Ensure body is read as raw text (`await req.text()`), not parsed. Coolify / nginx: pass body unmodified.

### Rate limit exceeded
Cause: > 2/sec on free tier, or 10/sec on Pro.
Fix: add `setTimeout` between sends in loops. For batch use `resend.batch.send` (100/call counts as 1 request). Upgrade tier if needed.

### React Email Studio doesn't preview my templates
Cause: dir flag wrong, or templates outside `emails/`.
Fix: `npx email dev --dir <yourdir>`. Templates must default-export the React component.

### Plaintext looks bad / has leftover HTML
Cause: auto-generation imperfect.
Fix: pass an explicit `text` field; or use `render(Component, { plainText: true })` and edit the result.

### "RESEND_API_KEY not set" in production
Cause: env var not deployed.
Fix: add in Vercel / Coolify env vars dashboard. Restart deploy.

### Webhook events come twice
Cause: multiple endpoint URLs registered, or your handler errors mid-process and Resend retries.
Fix: dedupe by `event.id` in a "processed events" table. Make handlers idempotent.

### High bounce rate
Causes: stale list, typos, sender reputation.
Fix: enable bounce webhook → flag bad addresses in DB → never send again. Validate emails at signup (proper regex + optional MX check). Stay below 5% bounce rate.

### "from" address rejected as invalid
Cause: format wrong, or local part too long.
Fix: use `"Name <email@domain>"` format. Email local part max 64 chars per RFC.

### React component imports CSS that breaks rendering
Cause: import of regular CSS / Tailwind into an email component.
Fix: inline all styles via `style` prop, or use `@react-email/tailwind` (constrained Tailwind subset). Standard Tailwind doesn't work in email clients.
