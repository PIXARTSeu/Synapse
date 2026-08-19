---
name: nodemailer-transactional
description: Nodemailer + SMTP for transactional emails in Next.js — singleton transporter, HTML+plaintext templates, attachments, SPF/DKIM/DMARC deliverability, retry/queue strategies, Server Action integration, common providers (Postmark, SendGrid, Mailgun, generic SMTP, Gmail). Use when sending contact form submissions, password reset, order confirmations, notifications, or debugging emails landing in spam.
version: 1.0.0
---

# Nodemailer for Transactional Email

## Overview

Nodemailer is the de-facto Node.js SMTP client. It's the right choice when you need to send email from a Next.js Server Action or API route and you want SMTP control (existing provider, on-prem SMTP, multi-tenant senders). For React-templated emails over a hosted API, `resend-react-email` is a friendlier path; pair them when needed.

What this skill covers:
- Singleton transporter (don't create per-request)
- HTML + plaintext templating (both mandatory for deliverability)
- DKIM/SPF/DMARC checklist — the actual reason emails go to spam
- Server Action integration with sensible error handling
- Retry/queue patterns for production reliability

## When to Use

- Sending contact form / lead form submissions
- Password reset / magic link / email verification
- Order confirmations, invoices, receipts
- Admin notifications (new signup, failed payment)
- Any project that already has an SMTP server (cPanel, Workspace, Zoho, custom)

Don't use when:
- You want a hosted API + React templates — use `resend-react-email`
- You're sending bulk marketing — use SendGrid Marketing / Mailchimp / dedicated ESP
- You need delivery analytics / webhooks — Postmark / Resend have first-class support

## Setup

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

Env (`.env.local`):

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=apikey            # or full username
SMTP_PASSWORD=...
SMTP_FROM="My App <noreply@example.com>"
```

Use port `465` with `secure: true` for TLS-from-start, port `587` with `secure: false` + STARTTLS otherwise. Both work; check your provider's docs.

## Pattern: Singleton Transporter

```ts
// lib/mailer.ts
import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

export function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASSWORD!,
    },
    pool: true,              // reuse connections
    maxConnections: 5,
    maxMessages: 100,
  });

  return transporter;
}

export type MailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;              // ALWAYS include plaintext
  replyTo?: string;
  attachments?: nodemailer.SendMailOptions['attachments'];
};

export async function sendMail(options: MailOptions) {
  const t = getTransporter();
  return t.sendMail({
    from: process.env.SMTP_FROM!,
    ...options,
  });
}
```

`pool: true` keeps SMTP connections open — crucial under load. Without it every request opens a new TCP+TLS handshake.

## Pattern: HTML + Plaintext Together

```ts
import { sendMail } from '@/lib/mailer';

export async function sendWelcome(email: string, name: string) {
  await sendMail({
    to: email,
    subject: `Benvenuto, ${name}`,
    text: `Ciao ${name},\n\nGrazie per esserti registrato.\n\nIl team`,
    html: `<!doctype html>
<html lang="it">
<head><meta charset="utf-8"><title>Benvenuto</title></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;background:#f8f8f8;margin:0;padding:24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:32px;">
    <tr><td>
      <h1 style="margin:0 0 16px;">Benvenuto, ${escapeHtml(name)}</h1>
      <p>Grazie per esserti registrato.</p>
      <p style="margin-top:24px;font-size:13px;color:#666;">Il team</p>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  }[c]!));
}
```

**Always escape user input** in the HTML — `${name}` straight into an HTML body is an injection vector.

Plaintext rules:
- Required for spam filters. Many score "HTML-only" as suspicious.
- Should mirror the HTML content; don't ship "see this in HTML to read it".
- Wrap at ~70 chars for older clients.

## Pattern: Server Action — Contact Form

```ts
// app/contact/actions.ts
'use server';
import { z } from 'zod';
import { sendMail } from '@/lib/mailer';

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  message: z.string().min(10).max(5000),
});

export async function submitContact(prevState: any, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const { name, email, message } = parsed.data;

  try {
    await sendMail({
      to: 'leads@yourcompany.com',
      replyTo: email,                    // user replies go back to sender
      subject: `Lead — ${name}`,
      text: `Nome: ${name}\nEmail: ${email}\n\n${message}`,
      html: `<p><strong>Nome:</strong> ${escapeHtml(name)}</p>
             <p><strong>Email:</strong> ${escapeHtml(email)}</p>
             <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>`,
    });
    return { ok: true };
  } catch (err) {
    console.error('mail error:', err);
    return { ok: false, error: 'send_failed' };
  }
}
```

Pair with `rhf-zod-server-actions` skill for the client side.

## Pattern: Attachments

```ts
await sendMail({
  to: customer.email,
  subject: 'La tua fattura',
  text: '...',
  html: '...',
  attachments: [
    { filename: 'fattura.pdf', content: pdfBuffer },              // Buffer
    { filename: 'logo.png',    path: '/abs/path/to/logo.png' },   // local file
    { filename: 'csv.csv',     content: csvString, contentType: 'text/csv' },
  ],
});
```

For inline images (`<img src="cid:logo">`):

```ts
attachments: [{
  filename: 'logo.png',
  path: '/abs/path/to/logo.png',
  cid: 'logo',          // referenced as cid:logo in HTML
}]
```

## Pattern: Verifying Connection (Boot Check)

```ts
// lib/mailer.ts (extension)
export async function verifyMailer() {
  const t = getTransporter();
  await t.verify();
  console.log('SMTP ok');
}
```

Call once at app start (e.g. in an init route). Catches misconfigured creds before users hit the form.

## Pattern: Retry / Queue (Production)

Nodemailer doesn't queue — if the SMTP server is down, your Server Action fails. For production reliability, queue in your DB:

```ts
// 1. Server Action writes to a DB table
await db.email_queue.insert({ to, subject, html, text, status: 'pending' });
return { ok: true };

// 2. Cron / worker picks up:
const pending = await db.email_queue.where({ status: 'pending' }).limit(20);
for (const row of pending) {
  try {
    await sendMail(row);
    await db.email_queue.update(row.id, { status: 'sent', sent_at: new Date() });
  } catch {
    await db.email_queue.update(row.id, {
      status: row.attempts < 5 ? 'pending' : 'failed',
      attempts: row.attempts + 1,
      next_retry_at: backoff(row.attempts),
    });
  }
}
```

Or use a dedicated job runner (Inngest, Trigger.dev, BullMQ). The Server Action becomes "enqueue", the worker becomes "send".

## Deliverability — The Real Reason Emails Go to Spam

SMTP credentials let you send. They don't make the email **arrive**. Deliverability requires **three DNS records** on the sending domain:

### SPF (TXT record on root domain)

Authorizes which servers can send for your domain.

```
example.com  TXT  "v=spf1 include:_spf.google.com include:sendgrid.net ~all"
```

Replace with your provider's documented include. `~all` = soft-fail (recommended); `-all` = hard-fail (strict, can bounce legit mail).

### DKIM (TXT record on selector subdomain)

Cryptographic signature. Your provider gives you the value.

```
selector._domainkey.example.com  TXT  "v=DKIM1; k=rsa; p=MIIB..."
```

Each provider has its own selector name (`google`, `s1`, `mxvault`, etc).

### DMARC (TXT record on `_dmarc` subdomain)

Tells receivers what to do when SPF/DKIM fail.

```
_dmarc.example.com  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@example.com"
```

Start with `p=none` (monitor only). Move to `p=quarantine` after a week of clean reports. `p=reject` is strictest — go there last.

### Verify

```bash
dig TXT example.com +short                    # SPF
dig TXT selector._domainkey.example.com +short  # DKIM
dig TXT _dmarc.example.com +short             # DMARC
```

Or use [mail-tester.com](https://mail-tester.com) — send a test from your app to the address it gives you and read the report. Score < 8 = spam-bound.

### Common deliverability mistakes

- Sending `From: anything@yourdomain.com` but SPF authorizes only the provider. Fix: include both senders in SPF or use the provider's verified `From`.
- Using a free Gmail/Yahoo `From` — those domains' DMARC `p=reject` means non-Gmail mail bounces.
- Domain has no MX record. Even outbound-only senders need an MX; otherwise receivers flag as suspicious.

## Provider Snippets

Most providers are SMTP-compatible — only host/port/user change. Set the right `From` (must match the verified sender on the provider).

| Provider | Host | Port | User |
|---|---|---|---|
| Postmark | `smtp.postmarkapp.com` | 587 | API token |
| SendGrid | `smtp.sendgrid.net` | 587 | `apikey` (literally) |
| Mailgun | `smtp.mailgun.org` | 587 | mailgun login |
| Brevo (Sendinblue) | `smtp-relay.brevo.com` | 587 | SMTP user |
| Resend | `smtp.resend.com` | 465 | `resend` |
| Gmail (low-volume only!) | `smtp.gmail.com` | 587 | account + app password |
| cPanel SMTP | client-specific | 587 / 465 | mailbox user |

For Gmail: needs 2FA + App Password. Rate-limited to ~500/day. Never for production.

## Using with Next.js

- Server-only: `nodemailer` will not build for the Edge runtime. Mark routes/actions `export const runtime = 'nodejs'` if you've forced edge elsewhere.
- Don't import `nodemailer` from a Client Component — it pulls Node built-ins (`net`, `tls`, `stream`).
- Server Actions running on Vercel Hobby have a 10-second timeout. If your SMTP server is slow, queue instead of sending in-line.
- For Coolify-hosted deploys, ensure outbound port 587/465 isn't blocked by the host firewall.

## Examples

### Example 1: Contact form pipeline
RHF + Zod form → Server Action → `sendMail({ to: 'leads@...', replyTo: form.email })` + write lead to Supabase. Pair with `supabase-auth-ssr` and `rhf-zod-server-actions`.

### Example 2: Password reset (custom auth)
User submits email → check user exists → generate one-time token (signed JWT with 30-min exp) → send link `https://app/reset?token=...` → user clicks → page validates token + updates password.

### Example 3: Order confirmation with PDF
Stripe webhook → render invoice PDF in-memory → `sendMail` with attachment to customer + admin copy. Use `pool: true` so back-to-back webhooks don't open new connections.

## Troubleshooting

### "EAUTH: Invalid login" / "535 5.7.8"
Cause: wrong creds, or provider requires app password / API token instead of account password.
Fix: SendGrid uses `apikey` as literal username + the API token as password. Postmark uses the server token for both user and pass (some setups). Gmail needs App Password from Google Account → Security.

### Emails arrive but land in spam
Cause: SPF/DKIM/DMARC missing or misconfigured.
Fix: add all three DNS records (see Deliverability above). Test with mail-tester.com. A score < 8 means at least one issue. Don't use `@gmail.com` as `From` for app mail.

### Connection timeout when sending
Cause: hosting provider blocks outbound SMTP (common on shared / restricted hosting).
Fix: switch port (587↔465), or use the provider's API instead of SMTP (Resend/Postmark/SendGrid all have HTTP APIs). For Coolify, check the host firewall.

### "self signed certificate in certificate chain"
Cause: provider uses self-signed TLS (legacy on-prem SMTP).
Fix: `tls: { rejectUnauthorized: false }` on the transporter — but **only** if you trust the network. Better: install the provider's CA cert.

### Server Action returns success but no email arrives
Cause: SMTP accepted but provider quarantined. Or wrong `From` address rejected silently.
Fix: check the provider dashboard for bounces/quarantines. Verify `From` matches a verified sender. Add logging: `console.log(info.messageId, info.response)` from `sendMail`'s return value.

### Mail body shows HTML tags as text
Cause: forgot to set `html`, only set `text` — or set `html` to plain string.
Fix: pass HTML to the `html` field. Some clients show whichever they prefer; the multipart message needs both.

### Special characters render as garbage (é → Ã©)
Cause: encoding mismatch.
Fix: Nodemailer defaults to UTF-8 — ensure the `subject` and `text` are JS strings (not buffers in a different encoding). Set `charset: 'utf-8'` if behind a legacy proxy.

### Rate limit / "Too many messages per session"
Cause: pool exhausted, or provider rate-cap hit.
Fix: lower `maxConnections` to match provider limits. Add a small `setTimeout` between messages in batch jobs. For >100/min, switch to provider's API + queue.

### "stream is not readable" when sending attachment
Cause: passed a stream that's already been consumed, or a buffer constructed wrong.
Fix: read the file fresh each send (`fs.readFileSync` for small files, or `createReadStream` and let Nodemailer consume).
