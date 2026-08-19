---
name: rhf-zod-server-actions
description: Canonical Next.js 15 form stack — react-hook-form + Zod resolver + Server Actions + useActionState + Progressive Enhancement + revalidation. Use when building forms (contact, login, signup, multi-step, file upload), debugging duplicate validation logic between client and server, adding optimistic updates, or handling field/global errors and pending states without losing PE.
version: 1.0.0
---

# RHF + Zod + Server Actions — Next.js 15 Form Stack

## Overview

The recommended Next.js 15 form pattern: **one schema, two enforcement points**.

- **Zod schema** is the single source of truth for shape + validation rules.
- **Server Action** parses with the schema → safe data → DB / email / etc. Returns a typed state object.
- **react-hook-form** wires the schema to the form UI for instant client-side feedback.
- **`useActionState`** (React 19) wires the Server Action to pending state + return value.

Result: progressive enhancement (works without JS), zero duplicated validation, type-safe end-to-end.

## When to Use

- Any form: contact, login, signup, multi-step, file upload, settings
- Migrating from "useState + fetch" forms to Server Actions
- Adding optimistic updates on form submit
- You need both inline field errors (RHF) and form-level errors / success state (Server Action)
- Multi-step wizards where each step writes to backend

Don't use when:
- The form is purely client-side (e.g. search filter UI) — RHF alone is fine
- You need realtime collab on form state — use Liveblocks / Yjs
- The action takes >10 sec → push to queue (`nodemailer-transactional` retry/queue pattern)

## Setup

```bash
npm install react-hook-form zod @hookform/resolvers
```

Versions (Apr 2026): `react-hook-form@^7.55`, `zod@^3.24`, `@hookform/resolvers@^3.10`.

## Pattern: Minimal Form

### 1. Shared schema

```ts
// app/contact/schema.ts
import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio').max(100),
  email: z.string().email('Email non valida'),
  message: z.string().min(10, 'Almeno 10 caratteri').max(5000),
});

export type ContactInput = z.infer<typeof contactSchema>;

export type ContactState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ContactInput, string[]>>;
};
```

### 2. Server Action

```ts
// app/contact/actions.ts
'use server';
import { contactSchema, type ContactState } from './schema';
import { sendMail } from '@/lib/mailer';
import { revalidatePath } from 'next/cache';

export async function submitContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await sendMail({
      to: 'leads@example.com',
      subject: `Lead — ${parsed.data.name}`,
      text: parsed.data.message,
      html: `<p>${parsed.data.message}</p>`,
      replyTo: parsed.data.email,
    });
    revalidatePath('/contact');
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, error: 'Invio fallito, riprova' };
  }
}
```

### 3. Form Component — RHF + useActionState

```tsx
// app/contact/form.tsx
'use client';
import { useActionState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { contactSchema, type ContactInput, type ContactState } from './schema';
import { submitContact } from './actions';

const initial: ContactState = { ok: false };

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitContact, initial);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: 'onBlur',
  });

  return (
    <form
      action={formAction}
      // RHF validates first; if OK, the form submits as a normal FormData POST
      onSubmit={(e) => {
        // RHF doesn't auto-submit form actions — manually trigger
        handleSubmit(() => {
          // Validation passed; let the native submit run
        })(e);
      }}
      noValidate
      className="space-y-4"
    >
      <Field
        label="Nome"
        error={errors.name?.message ?? state.fieldErrors?.name?.[0]}
        {...register('name')}
      />
      <Field
        label="Email"
        type="email"
        error={errors.email?.message ?? state.fieldErrors?.email?.[0]}
        {...register('email')}
      />
      <TextArea
        label="Messaggio"
        error={errors.message?.message ?? state.fieldErrors?.message?.[0]}
        {...register('message')}
      />

      {state.error && <p className="text-red-600 text-sm">{state.error}</p>}
      {state.ok && <p className="text-green-700 text-sm">Inviato. Ti rispondiamo presto.</p>}

      <button type="submit" disabled={isPending} className="btn">
        {isPending ? 'Invio…' : 'Invia'}
      </button>
    </form>
  );
}
```

`Field` / `TextArea` are simple wrappers using `forwardRef` to forward register's ref:

```tsx
import { forwardRef, type InputHTMLAttributes } from 'react';

export const Field = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }
>(function Field({ label, error, ...props }, ref) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input ref={ref} {...props}
        className="mt-1 block w-full rounded border px-3 py-2"
        aria-invalid={!!error}
        aria-describedby={error ? `${props.name}-err` : undefined}
      />
      {error && <span id={`${props.name}-err`} className="text-xs text-red-600">{error}</span>}
    </label>
  );
});
```

## Pattern: Progressive Enhancement

The form **works without JavaScript**:
- `action={formAction}` is a real HTTP POST when JS is off.
- Zod validates server-side regardless.
- Server Action returns `ContactState`; the page re-renders with `state.fieldErrors`.
- The browser's native `required` is gated by `noValidate` so Zod is the source of truth.

To test: in DevTools → Settings → Debugger → "Disable JavaScript", then submit. The form should still validate and post.

## Pattern: useActionState — pending + return state

`useActionState` (React 19) replaces the legacy `useFormState`. It returns `[state, action, isPending]`. The `isPending` is **automatic** — no need to track loading yourself.

```ts
const [state, formAction, isPending] = useActionState(action, initialState);
```

Use `isPending` to disable the submit button, show a spinner, or render an optimistic UI block.

## Pattern: useFormStatus (button-side pending)

If your submit button is a child component, use `useFormStatus` instead — it reads pending state from the surrounding form without prop-drilling:

```tsx
'use client';
import { useFormStatus } from 'react-dom';

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn">
      {pending ? '…' : children}
    </button>
  );
}
```

Drop `<SubmitButton>Invia</SubmitButton>` inside any `<form action={...}>` — works automatically.

## Pattern: File Upload

Server Actions accept `FormData` natively, including `File` instances:

```ts
const fileSchema = z.object({
  avatar: z.instanceof(File)
    .refine((f) => f.size <= 5 * 1024 * 1024, 'Max 5 MB')
    .refine((f) => ['image/png', 'image/jpeg'].includes(f.type), 'PNG o JPG'),
});

'use server';
export async function uploadAvatar(_prev: any, formData: FormData) {
  const parsed = fileSchema.safeParse({ avatar: formData.get('avatar') });
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const file = parsed.data.avatar;
  const buffer = Buffer.from(await file.arrayBuffer());
  // upload to Supabase Storage / S3 / local FS
  return { ok: true };
}
```

Client side: standard `<input type="file" name="avatar" accept="image/*">`.

Vercel free tier limits Server Action payload to 1 MB. For larger uploads use a signed upload URL → client uploads directly → form sends only the resulting URL.

## Pattern: Multi-Step Wizard

Each step is its own form + Server Action that updates a session-scoped record. Carry state via:

- **URL search params** for fully shareable wizards.
- **Cookies** (HttpOnly) for short-lived sensitive flows like signup.
- **DB row** with `status='draft'` for long-lived flows like onboarding.

Avoid storing all steps' data in `useState` on the client — refresh loses everything.

## Pattern: Async / Cross-Field Validation

Zod `.refine()` and `.superRefine()` handle cross-field:

```ts
const schema = z.object({
  password: z.string().min(8),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  path: ['confirm'],
  message: 'Le password non corrispondono',
});
```

For async (e.g. email uniqueness), validate on the server only — client RHF can't await. Show as `state.fieldErrors.email`:

```ts
const exists = await db.user.findUnique({ where: { email } });
if (exists) {
  return { ok: false, fieldErrors: { email: ['Email già registrata'] } };
}
```

## Pattern: Optimistic Updates

```tsx
'use client';
import { useOptimistic } from 'react';
import { addTodo } from './actions';

export function TodoList({ todos }: { todos: Todo[] }) {
  const [optimistic, addOptimistic] = useOptimistic(todos, (state, newTodo: Todo) =>
    [...state, newTodo]
  );

  async function handleAdd(formData: FormData) {
    const text = formData.get('text') as string;
    const optimisticTodo = { id: crypto.randomUUID(), text, pending: true };
    addOptimistic(optimisticTodo);
    await addTodo(formData);
  }

  return (
    <>
      <form action={handleAdd}>
        <input name="text" />
        <SubmitButton>Aggiungi</SubmitButton>
      </form>
      <ul>{optimistic.map(t => <li key={t.id} style={{ opacity: t.pending ? 0.5 : 1 }}>{t.text}</li>)}</ul>
    </>
  );
}
```

The optimistic UI is shown immediately; the real state replaces it when the action resolves (success or rollback).

## Pattern: redirect() Inside Action

```ts
'use server';
import { redirect } from 'next/navigation';

export async function login(prev: any, formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  await authenticateUser(parsed.data);
  redirect('/dashboard');   // ← throws NEXT_REDIRECT; do NOT wrap in try/catch
}
```

`redirect()` works by throwing. Wrapping in `try/catch` swallows it. Either don't catch, or rethrow `NEXT_REDIRECT`.

## Using with Next.js

- React 19 / Next.js 15: use `useActionState` (not the deprecated `useFormState` from `react-dom`).
- Server Actions are POST-only — they bind to forms via `<form action={fn}>` or invocable as functions from client components.
- Form actions defined in Server Components run inline. Defined in `'use server'` files they get a hash-based RPC endpoint.
- Vercel Hobby: 10s timeout, 1 MB payload. Coolify / VPS: configurable.
- For React Server Components: schemas live in shared `.ts` files, imported by both server (action) and client (form). They tree-shake correctly.

## Examples

### Example 1: Login form
Schema = `{ email, password }`. Action calls Supabase Auth (`supabase-auth-ssr` skill). On error → field-level message. On success → `redirect('/dashboard')`.

### Example 2: Signup with email check
RHF for instant required/length checks. Server Action also checks DB for existing email. Returns `fieldErrors.email = ['Email già usata']`. UI shows it under the field.

### Example 3: Settings page
Multi-section form. Each section is its own `<form action={updateSection}>`. `useActionState` per section. Saves independently, shows per-section "Salvato" toast.

## Troubleshooting

### Form submits but Server Action doesn't run
Cause: `onSubmit` swallows the native submit, or component is not wrapped in `'use client'`.
Fix: ensure `<form action={formAction}>` is used. If you also use `onSubmit`, don't call `e.preventDefault()` unconditionally — let RHF's handler run the validation then return without preventing default.

### `useActionState` returns old state after navigation
Cause: server state cached; revalidatePath not called.
Fix: call `revalidatePath()` in the action after mutations. For navigation-on-success, use `redirect()` and don't rely on stale state.

### Server Action throws `NEXT_REDIRECT` error in logs
Cause: `redirect()` was caught somewhere. It's designed to throw.
Fix: remove `try/catch` around the call, or rethrow if you must catch:
```ts
try { ... redirect('/x'); } catch (e) {
  if (isRedirectError(e)) throw e;
  // handle other errors
}
```

### Zod errors don't show on the field
Cause: `error` prop in your `<Field>` component reads from `errors.name?.message` but the form structure differs.
Fix: console.log `errors` and `state.fieldErrors` to verify shape. RHF uses `errors.field.message`; Zod `flatten()` gives `fieldErrors.field: string[]`.

### Submit button never re-enables after action
Cause: action throws unhandled exception; React 19 keeps `isPending` true.
Fix: always catch in the action and return an error state — never let it throw silently.

### Progressive enhancement broken: form needs JS to submit
Cause: `<form>` lacks `action={...}` (only has `onSubmit`), or component isn't a Server Component-compatible client component.
Fix: always include `action={serverAction}`. The action is a real RPC endpoint; the browser POSTs to it even without JS.

### File upload returns empty
Cause: `<form>` missing `enctype="multipart/form-data"`, or input has no `name`.
Fix: Server Actions auto-set the right encoding only via the `action` attribute. Inline `<form>` HTML for SSR posts may need explicit `enctype`. Always set `name` on inputs.

### "Schema is undefined" / circular import
Cause: schema file imports the action, action imports the schema.
Fix: keep schemas in a pure `.ts` (no `'use server'`, no `'use client'`). Action imports schema; component imports schema + action. Schema imports nothing from either.

### Optimistic update flashes back briefly
Cause: action returns success before revalidation completes.
Fix: that's expected; the flash is the gap between optimistic state and real state. Make optimistic IDs identical to server IDs where possible (e.g. `crypto.randomUUID()` on both sides) to avoid layout shift.

### State persists across forms / pages
Cause: `useActionState` lives in the component that mounts it. If the parent stays mounted across navigations, state persists.
Fix: reset by remounting (`key={pathname}`), or store result-only state and not the input fields' data.
