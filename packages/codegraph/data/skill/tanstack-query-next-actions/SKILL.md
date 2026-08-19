---
name: tanstack-query-next-actions
description: TanStack Query v5 in Next.js 15 App Router — QueryClient + QueryClientProvider setup, prefetch in RSC + HydrationBoundary, mutations with optimistic updates, Server Actions interop, invalidation patterns, infinite queries, suspense queries, devtools. Use when you need rich client-side caching for server data, interactive lists with optimistic updates, infinite scroll, or when Server Components alone can't handle your interaction patterns.
version: 1.0.0
---

# TanStack Query v5 + Next.js 15

## Overview

Server Components + Server Actions cover most data needs in Next.js 15. TanStack Query is for the cases where they aren't enough:

- **Highly interactive UIs** — filters, sort, search that you don't want to round-trip via URL state on every click.
- **Optimistic mutations** with rich rollback.
- **Infinite scroll / pagination** with cached pages.
- **Background refetch** keeping data fresh without user action.
- **Sharing one fetch across many components** without prop-drilling.

When all you need is "render once, action on submit", stick with RSC + Server Actions (`rhf-zod-server-actions`). When the UI is genuinely client-driven, reach for TanStack Query.

## When to Use

- Admin dashboards with filters, search, pagination
- Real-time-ish UIs (polling, optimistic updates)
- Lists with infinite scroll
- Chat / activity feeds with background refresh
- Forms where you need to validate against server data without page reload
- Combining query + mutation in the same component

Don't use when:
- Static-ish pages where RSC + `revalidatePath` does the job
- Just one fetch on mount — `use()` + Suspense is simpler in App Router
- You want the new React 19 `use()` API for promises — start there for simple cases

## Setup

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

Versions (2026): `@tanstack/react-query@^5.62+`.

### `lib/queryClient.ts`

```ts
import { isServer, QueryClient } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, you usually want a higher staleTime so first render isn't refetched
        staleTime: 60 * 1000,        // 1 min
        gcTime: 5 * 60 * 1000,       // 5 min, was cacheTime in v4
        refetchOnWindowFocus: true,
        retry: 2,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) {
    // Always make a new client per request on server
    return makeQueryClient();
  }
  // Browser: make a singleton
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
```

### `components/Providers.tsx`

```tsx
'use client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '@/lib/queryClient';

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### `app/layout.tsx`

```tsx
import { Providers } from '@/components/Providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

The provider lives in a client component; everything below can `'use client'` and use queries.

## Pattern: Basic Query

```tsx
'use client';
import { useQuery } from '@tanstack/react-query';

async function fetchProjects() {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error('Failed');
  return res.json() as Promise<Project[]>;
}

export function ProjectList() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  if (isLoading) return <Skeleton />;
  if (error) return <Error message={error.message} onRetry={refetch} />;
  return <ul>{data.map(p => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

`queryKey` is the cache identifier — anything depending on the same key shares the cache.

## Pattern: Prefetch in Server Component + Hydrate

The killer pattern: server renders initial data so the client has it instantly, then TanStack Query takes over.

```tsx
// app/projects/page.tsx (Server Component)
import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { ProjectList } from './ProjectList';
import { listProjects } from '@/lib/db';

export default async function Page() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ['projects'],
    queryFn: () => listProjects(),     // call DB directly in RSC
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProjectList />
    </HydrationBoundary>
  );
}
```

```tsx
// app/projects/ProjectList.tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { listProjects } from '@/lib/db';   // same function, but called via API or rpc client

export function ProjectList() {
  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: () => fetch('/api/projects').then(r => r.json()),
    initialDataUpdatedAt: Date.now(),
  });
  return <ul>{data?.map(p => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

The server pre-fills the cache; first render uses that data; subsequent interactions refetch as configured.

## Pattern: Mutations + Invalidation

```tsx
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function AddProjectButton() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (newProject: { name: string }) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify(newProject),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return (
    <button
      onClick={() => mutation.mutate({ name: 'New' })}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? '…' : 'Add'}
    </button>
  );
}
```

`invalidateQueries` marks the cache stale; the next render or refetch fires automatically.

## Pattern: Optimistic Mutation

```tsx
const mutation = useMutation({
  mutationFn: updateProject,
  onMutate: async (newData) => {
    // Cancel in-flight refetches
    await qc.cancelQueries({ queryKey: ['projects', newData.id] });
    // Snapshot
    const prev = qc.getQueryData(['projects', newData.id]);
    // Optimistic write
    qc.setQueryData(['projects', newData.id], (old: any) => ({ ...old, ...newData }));
    return { prev };
  },
  onError: (_err, _newData, context) => {
    // Rollback
    qc.setQueryData(['projects', context?.prev?.id], context?.prev);
  },
  onSettled: (_data, _err, variables) => {
    qc.invalidateQueries({ queryKey: ['projects', variables.id] });
  },
});
```

This four-step dance (cancel, snapshot, set, rollback, invalidate) is the canonical optimistic pattern. Wrap in a helper for repetition.

## Pattern: Server Actions Inside Mutations

If you have a Server Action, use it directly as the `mutationFn`:

```tsx
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addProject } from '@/app/projects/actions';

export function AddButton() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (name: string) => {
      const formData = new FormData();
      formData.set('name', name);
      const result = await addProject({ ok: false }, formData);
      if (!result.ok) throw new Error(result.error ?? 'Failed');
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
  // ...
}
```

Server Actions returning `{ ok: boolean, ... }` integrate cleanly. You get TanStack's optimistic + retry capabilities plus the server-side power of Actions.

## Pattern: Infinite Query

```tsx
'use client';
import { useInfiniteQuery } from '@tanstack/react-query';

export function Feed() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => fetch(`/api/feed?cursor=${pageParam ?? ''}`).then(r => r.json()),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  return (
    <>
      {data?.pages.flatMap(p => p.items).map(item => (
        <Card key={item.id} {...item} />
      ))}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? '…' : 'Load more'}
        </button>
      )}
    </>
  );
}
```

Auto-load via IntersectionObserver:

```tsx
import { useEffect, useRef } from 'react';

const sentinelRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!sentinelRef.current || !hasNextPage) return;
  const io = new IntersectionObserver(([e]) => e.isIntersecting && fetchNextPage());
  io.observe(sentinelRef.current);
  return () => io.disconnect();
}, [hasNextPage, fetchNextPage]);

// ... <div ref={sentinelRef} />
```

## Pattern: Suspense Queries

```tsx
'use client';
import { useSuspenseQuery } from '@tanstack/react-query';

export function ProjectDetails({ id }: { id: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ['project', id],
    queryFn: () => fetch(`/api/projects/${id}`).then(r => r.json()),
  });

  // data is guaranteed non-null
  return <h1>{data.name}</h1>;
}

// parent component
<Suspense fallback={<Spinner />}>
  <ProjectDetails id={params.id} />
</Suspense>
```

`useSuspenseQuery` integrates with React Suspense. Cleaner than handling `isLoading`. Pair with error boundaries:

```tsx
<ErrorBoundary fallback={<Error />}>
  <Suspense fallback={<Spinner />}>
    <ProjectDetails id={id} />
  </Suspense>
</ErrorBoundary>
```

## Pattern: Query Keys — Organize Them

```ts
// lib/queryKeys.ts
export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    list: (filters: ProjectFilters) => [...queryKeys.projects.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.projects.all, 'detail', id] as const,
  },
  user: {
    me: ['user', 'me'] as const,
    settings: ['user', 'settings'] as const,
  },
};

// usage
useQuery({ queryKey: queryKeys.projects.list({ status: 'active' }), queryFn: ... });

// invalidate all project queries:
qc.invalidateQueries({ queryKey: queryKeys.projects.all });

// invalidate only one specific filter:
qc.invalidateQueries({ queryKey: queryKeys.projects.list({ status: 'active' }) });
```

Hierarchical query keys = surgical invalidation. The factory makes it type-safe.

## Pattern: Polling / Background Refetch

```tsx
useQuery({
  queryKey: ['notifications'],
  queryFn: fetchNotifications,
  refetchInterval: 30_000,         // poll every 30s while mounted
  refetchIntervalInBackground: false,  // pause when tab hidden (default)
});
```

For real-time SSE/WebSocket data, skip polling — use `setQueryData` from the socket handler to push updates into the cache.

## Pattern: Dependent Queries

```ts
const { data: user } = useQuery({ queryKey: ['user'], queryFn: getUser });

const { data: projects } = useQuery({
  queryKey: ['projects', user?.teamId],
  queryFn: () => fetchProjects(user!.teamId),
  enabled: !!user?.teamId,            // wait for user to load
});
```

`enabled: false` blocks the query until the condition is true.

## Pattern: Manual Cache Updates

When you know the result of a mutation, write directly to the cache instead of refetching:

```ts
const mutation = useMutation({
  mutationFn: updateProject,
  onSuccess: (updated) => {
    qc.setQueryData(['projects', updated.id], updated);
    qc.setQueryData(['projects'], (old: Project[] = []) =>
      old.map(p => p.id === updated.id ? updated : p)
    );
  },
});
```

Saves a round-trip and feels instant. Combine with `invalidate` if the server might have computed extra fields.

## Using with Next.js

- Provider lives in a `'use client'` component imported by `app/layout.tsx`.
- `QueryClient` must be a per-request instance on the server (see `getQueryClient`).
- `HydrationBoundary` lets server-prefetched data flow into the client cache.
- Server Actions can be called from `mutationFn` directly.
- For initial RSC data without TanStack: pass it as `initialData` to `useQuery`:
  ```tsx
  useQuery({ queryKey, queryFn, initialData: serverData });
  ```
- React 19 `use()` hook + Suspense covers single-fetch cases without TanStack overhead.

## Examples

### Example 1: Admin table with filters
URL params drive filters; query key includes filter object; click filter → URL updates → query re-runs → cached pages stay warm if returning to same filter.

### Example 2: Optimistic todo toggle
Click checkbox → optimistically flip in cache → mutation runs → on error rollback → on success invalidate. Feels instant.

### Example 3: Infinite chat feed
`useInfiniteQuery` with cursor pagination. Scroll up → load older messages. New messages via WebSocket → `setQueryData` prepends to first page.

## Troubleshooting

### Hydration mismatch on server-prefetched data
Cause: server-rendered HTML doesn't match the first client render (e.g. relative time formatting).
Fix: format times in client component only via `useEffect`, or use `suppressHydrationWarning` strategically. Ensure `staleTime > 0` on the server-prefetched query so client doesn't refetch immediately.

### "No QueryClient set" error
Cause: component using a hook isn't inside `<QueryClientProvider>`.
Fix: confirm `<Providers>` wraps your app in `layout.tsx`. The provider must be a client component.

### Query refetches on every navigation
Cause: per-request `QueryClient` on the server, no client-side singleton, or `staleTime: 0`.
Fix: use the `getQueryClient` pattern with the browser singleton. Bump `staleTime` to e.g. 60s.

### Optimistic update flickers / wrong rollback
Cause: race between mutation and concurrent refetch.
Fix: always `cancelQueries` in `onMutate` before `setQueryData`. Snapshot must be done after cancel.

### "Cannot read 'pages' of undefined" on infinite query
Cause: accessing `data.pages` before query loads.
Fix: handle `isLoading` state. Pages array is undefined until first fetch returns.

### Devtools doesn't show in production
By design — `<ReactQueryDevtools>` no-ops in production. To enable, gate manually: `{process.env.NODE_ENV !== 'production' && <ReactQueryDevtools />}`.

### Server prefetched data not used by client
Cause: missing `HydrationBoundary` or `dehydrate(queryClient)`.
Fix: wrap the client component subtree with `<HydrationBoundary state={dehydrate(queryClient)}>`. Make sure server `queryKey` exactly matches the client `queryKey`.

### Invalidation doesn't trigger refetch
Cause: query is inactive (no mounted observer), or matcher doesn't match.
Fix: `invalidateQueries` only refetches *active* queries by default. Pass `refetchType: 'all'` to also refetch inactive ones.

### Mutation returns success but UI stays stale
Cause: forgot to invalidate or write to cache.
Fix: in `onSuccess`, either `invalidateQueries` or `setQueryData`. Without either, cached data is untouched.

### Server Action throws but mutation shows success
Cause: action returns `{ ok: false }` instead of throwing — mutation only sees rejection if `mutationFn` throws.
Fix: in the mutationFn wrapper, throw when `result.ok === false`.

### Heavy bundle size
Cause: importing devtools in production.
Fix: lazy-load devtools via `dynamic(() => import('@tanstack/react-query-devtools').then(m => m.ReactQueryDevtools), { ssr: false })`. Devtools v5 is small (< 10KB) but every byte counts.

### "Query data cannot be undefined"
Cause: `queryFn` returned undefined (e.g. forgot `return`, or fetch failed without throwing).
Fix: throw on error (`if (!res.ok) throw new Error(...)`). Never return undefined from a queryFn — return `null` if you need to express absence.
