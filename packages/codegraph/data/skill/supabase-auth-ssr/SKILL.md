---
name: supabase-auth-ssr
description: Supabase Auth + @supabase/ssr for Next.js 15 App Router — server/browser/middleware clients, cookie-based session, RLS-aware queries, magic link / OAuth / password flows, password reset, session refresh, route protection, server actions. Use when setting up Supabase Auth in a Next.js project, debugging "Auth session missing" errors, implementing protected routes, or adding RLS-aware data fetching.
version: 1.0.0
---

# Supabase Auth + Next.js 15 (SSR)

## Overview

Supabase Auth + `@supabase/ssr` is the canonical way to wire Supabase to a Next.js 15 App Router app. It replaces the deprecated `@supabase/auth-helpers-nextjs` and uses **cookies** (not localStorage) so the session is readable from Server Components, Server Actions, Route Handlers, and Middleware.

Three clients, one per execution context:

| Context | Client | File |
|---|---|---|
| Server Component / Server Action / Route Handler | `createServerClient` | `lib/supabase/server.ts` |
| Browser (Client Component) | `createBrowserClient` | `lib/supabase/client.ts` |
| Middleware (refresh expired sessions) | `createServerClient` w/ different cookie methods | `lib/supabase/middleware.ts` |

The middleware is **not optional** — without it, the access token never refreshes and users get logged out silently after 1 hour.

## When to Use

- New Next.js project that needs auth + DB + storage in one platform
- Migrating from `@supabase/auth-helpers-nextjs` to `@supabase/ssr`
- Implementing RLS-aware data fetching from Server Components
- Adding magic link / OAuth (Google/GitHub) / password auth
- Debugging "Auth session missing" or "JWT expired" errors

Don't use when:
- You need NextAuth/Auth.js features (multi-provider abstraction, custom DB adapters with non-Supabase storage)
- You're not using Supabase as the database — for token-only auth use Lucia / custom JWT

## Setup

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Environment variables (in `.env.local` — never commit):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # admin operations only, server-side
```

`NEXT_PUBLIC_*` are bundled to the client. The `service_role` is **server-only** and bypasses RLS — handle with extreme care.

## Pattern: Three Clients

### `lib/supabase/server.ts` — Server Components / Actions / Route Handlers

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — set in middleware instead.
          }
        },
      },
    }
  );
}
```

Note: `cookies()` is **async** in Next.js 15. The `try/catch` around `setAll` lets the same client work from both Server Components (read-only cookies) and Server Actions/Route Handlers (writable cookies).

### `lib/supabase/client.ts` — Client Components

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

The browser client reads cookies set by the server. Don't manage tokens manually.

### `lib/supabase/middleware.ts` — Session Refresh

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Critical: never put logic between createServerClient() and getUser().
  // Doing so risks logging users out at random.
  const { data: { user } } = await supabase.auth.getUser();

  // Optional: redirect unauthenticated users
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}
```

### `middleware.ts` (project root)

```ts
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

## `getUser()` vs `getSession()` — Always `getUser()`

```ts
// ✅ Safe — verifies token with Supabase Auth server
const { data: { user } } = await supabase.auth.getUser();

// ❌ Unsafe — only reads cookie, can be spoofed
const { data: { session } } = await supabase.auth.getSession();
```

`getSession()` returns whatever's in the cookie without validating. Always use `getUser()` for authorization checks on the server.

## Pattern: Sign In / Sign Up via Server Action

```tsx
// app/login/actions.ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  });

  if (error) return { error: error.message };
  redirect('/check-email');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

## Pattern: Email Confirmation Callback

```ts
// app/auth/confirm/route.ts
import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/dashboard';

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL('/auth/error', request.url));
}
```

## Pattern: OAuth (Google, GitHub, etc.)

```ts
// Client Component button — must use browser client for OAuth redirect
'use client';
import { createClient } from '@/lib/supabase/client';

export function SignInWithGoogle() {
  const supabase = createClient();
  return (
    <button
      onClick={() => supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}/auth/callback` },
      })}
    >
      Continue with Google
    </button>
  );
}
```

Callback route:

```ts
// app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
```

Configure providers in the Supabase Dashboard → Authentication → Providers. Set the **Redirect URL allowlist** to include your domain + `/auth/callback`.

## Pattern: Password Reset

```ts
// Step 1: request reset
'use server';
export async function requestReset(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(formData.get('email') as string, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/update-password`,
  });
}

// Step 2: page that user lands on (from email link)
// app/auth/update-password/page.tsx renders a form that calls:
'use server';
export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: formData.get('password') as string,
  });
  if (error) return { error: error.message };
  redirect('/dashboard');
}
```

## Pattern: RLS-Aware Data Fetching

When you query a table from a server component, the user's JWT is passed automatically — Row Level Security policies apply:

```tsx
// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server';

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Only rows where RLS policy allows for this user
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  return <ProjectList projects={projects ?? []} />;
}
```

Example RLS policy:

```sql
-- Only owners can read their projects
create policy "owner_select" on projects
for select using (auth.uid() = user_id);

-- Authenticated users can insert; user_id auto-set
create policy "authenticated_insert" on projects
for insert with check (auth.uid() = user_id);
```

## Pattern: Admin Operations (Bypass RLS)

For background jobs or admin endpoints that need to read/write across users:

```ts
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,   // service role
    { auth: { persistSession: false } },
  );
}
```

**Never** expose service role to the browser. Use only inside Server Actions / Route Handlers / cron jobs that you've verified are not user-callable.

## Pattern: Type Safety with Generated Types

```bash
npx supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts
```

```ts
import type { Database } from '@/lib/supabase/database.types';

export async function createClient() {
  // ... same as above, just generic-typed:
  return createServerClient<Database>(/* ... */);
}
```

Now `.from('projects').select(...)` returns fully typed rows.

## Using with Next.js

This whole skill IS Next.js — but a few extra notes:

- **Cookies are async in 15+**: always `await cookies()`. Same for `headers()`.
- **Server Actions can't read response cookies in the same call**. Set then redirect.
- **Edge runtime**: middleware runs on edge by default — fine for Supabase Auth but means no Node-only deps in the middleware.
- **App Router only**: this skill assumes App Router. Pages Router uses different patterns (`getServerSideProps` + the old auth-helpers).
- **Caching**: Server Components are cached. Wrap auth-dependent fetches with `force-dynamic` or `revalidatePath` after writes:

```ts
// app/dashboard/page.tsx
export const dynamic = 'force-dynamic'; // always fresh, never cache
```

## Examples

### Example 1: Magic link only login
Single form with email input → Server Action calls `signInWithOtp({ email, options: { emailRedirectTo: ... } })` → user clicks link → confirm route exchanges OTP for session → redirect to dashboard.

### Example 2: Multi-tenant with team RLS
Add `team_id` column to all tables. RLS policy: `auth.uid() in (select user_id from team_members where team_id = projects.team_id)`. Switch active team via a server action that sets a cookie.

### Example 3: Protected layout with redirect
`app/dashboard/layout.tsx` calls `getUser()` server-side, redirects to `/login` if absent. Middleware handles the refresh; layout handles the gate. Belt + suspenders.

## Troubleshooting

### "Auth session missing!" right after signing in
Cause: middleware not wired or matcher excludes the route.
Fix: ensure `middleware.ts` exists at project root and the matcher includes the route. Verify `updateSession` is awaited.

### Session expires after 1 hour, user logged out silently
Cause: middleware not refreshing the JWT.
Fix: same as above — middleware must run on every navigation. Test by reading `request.cookies.getAll()` inside the middleware.

### Logout doesn't clear the session client-side
Cause: client-side state stale, only cookie deleted server-side.
Fix: after `signOut()` server action, call `router.refresh()` from a client component OR redirect through a route that revalidates.

### "Failed to set cookies" warning in console
Cause: trying to set cookies from a pure Server Component (read-only context).
Fix: the `try/catch` in `setAll` swallows it. Make sure session writes happen in Server Actions or Route Handlers, never Server Components.

### OAuth redirect goes to localhost in production
Cause: `redirectTo` hardcoded or Site URL in Supabase Dashboard wrong.
Fix: use `${process.env.NEXT_PUBLIC_SITE_URL}` (not `location.origin` in production server context). Set Site URL + Redirect URLs in Supabase Dashboard → Authentication → URL Configuration.

### RLS policy blocks server-side queries
Cause: the anon-key client is being used without a session, or you forgot `auth.uid()` in the policy.
Fix: confirm the user is logged in (`getUser()` returns non-null). Inspect the policy in Supabase Dashboard → Auth → Policies. For privileged ops, switch to the service-role admin client.

### "JWT expired" errors during long-running Server Actions
Cause: action runs longer than the access token's 1-hour lifetime; middleware can't refresh mid-action.
Fix: split the action into smaller steps, or pre-refresh by calling `getUser()` at the start. For very long jobs, queue them and use the admin client.

### `cookies()` not awaited error
Cause: Next.js 15 made `cookies()`, `headers()`, `params`, `searchParams` all async.
Fix: `await cookies()` everywhere. Run `npx @next/codemod@latest next-async-request-api .` to auto-migrate.

### Email confirmation link expired immediately
Cause: link used twice (e.g. user clicked, browser pre-fetched, link consumed).
Fix: disable link pre-fetch (`<a rel="noopener noreferrer" data-prefetch="false">`), or configure Supabase to allow multi-use confirmation tokens within a short window.

### Local dev: Supabase CLI vs hosted project
Cause: env vars point to one but you're testing on the other.
Fix: use `supabase start` for local + `.env.local` with `http://localhost:54321`. Production env uses the hosted URL. Don't mix — schemas drift fast.
