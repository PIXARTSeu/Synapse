---
name: vitest-next-conventions
description: Vitest in Next.js 15 App Router — vite.config setup, jsdom vs node environments, testing Server Components/Server Actions, mocking next/navigation/headers/cookies, React Testing Library integration, fixtures, MSW for network, coverage with v8, watch mode, parallelization, CI in GitHub Actions. Use when setting up Vitest, fixing test failures around RSC or async hooks, mocking Next.js APIs, or speeding up the test suite.
version: 1.0.0
---

# Vitest in Next.js 15 — Conventions

## Overview

Vitest is the test framework of choice for Next.js 15 apps in this stack: instant TS support, ESM-native, Vite-powered watch mode, Jest-compatible API. It replaces Jest cleanly — most Jest assertions work unchanged.

Two project structures to know:
- **Tests next to code** (`button.tsx` + `button.test.tsx`) — easy refactors, no path mapping pain.
- **Tests in `__tests__/` or `tests/`** — keeps app bundle clean from test files; needs config to find them.

Both work. Pick one per project and stick to it.

## When to Use

- New Next.js project that needs a test framework
- Migrating from Jest (often: SWC + Jest config breaking on App Router) to Vitest
- Adding tests to Server Components, Server Actions, Route Handlers
- Setting up MSW for HTTP mocking
- Standardizing test conventions across multiple Pixarts projects
- Debugging: "ReferenceError: Request is not defined", "cookies() not awaited", "act() warning"

Don't use when:
- E2E testing → `playwright-expert`
- Visual regression → Chromatic / Percy
- Heavy mutation/snapshot tests → Jest is still fine

## Setup

```bash
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',        // for component tests
    setupFiles: ['./vitest.setup.ts'],
    globals: true,               // enables describe/it/expect without imports
    css: false,                  // skip CSS parsing for speed
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['app/**', 'lib/**', 'components/**'],
      exclude: ['**/*.d.ts', '**/types.ts', '.next/**'],
    },
  },
});
```

### `vitest.setup.ts`

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());
```

### `package.json` scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Pattern: Environment Per File

`environment: 'jsdom'` is the global default. Override per file when needed:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/contact/route';
// ...
```

Use `node` for: Route Handlers, Server Actions, Node-only utilities (DB, file system, crypto).
Use `jsdom` for: Client Components, hooks, anything that touches the DOM.

### Or via config — projects

For larger codebases, define multiple projects:

```ts
test: {
  projects: [
    {
      extends: true,
      test: {
        name: 'client',
        include: ['**/*.client.test.{ts,tsx}'],
        environment: 'jsdom',
      },
    },
    {
      extends: true,
      test: {
        name: 'server',
        include: ['**/*.server.test.{ts,tsx}', 'app/api/**/*.test.ts'],
        environment: 'node',
      },
    },
  ],
},
```

Run one: `vitest --project server`.

## Pattern: Client Component Test

```tsx
// components/Button.tsx
'use client';
export function Button({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick}>{children}</button>;
}
```

```tsx
// components/Button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByText('Click'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

Use `userEvent` over `fireEvent` for realistic interaction simulation (focus, click order, debounce).

## Pattern: Mocking next/navigation

```tsx
// header.test.tsx
import { vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams('?tab=overview'),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

import { render } from '@testing-library/react';
import { Header } from './header';

it('renders for /dashboard pathname', () => {
  const { getByText } = render(<Header />);
  expect(getByText('Dashboard')).toBeInTheDocument();
});
```

## Pattern: Mocking cookies() / headers()

`cookies()` and `headers()` are async since Next 15:

```ts
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn((name: string) => name === 'session' ? { value: 'abc123' } : undefined),
    getAll: vi.fn(() => [{ name: 'session', value: 'abc123' }]),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: vi.fn().mockResolvedValue(new Headers({
    'x-forwarded-for': '127.0.0.1',
  })),
}));
```

## Pattern: Testing Route Handlers

Route handlers are async functions that take `Request` and return `Response`. Easy to test as units:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/contact/route';

describe('POST /api/contact', () => {
  it('rejects invalid email', async () => {
    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.any(String) });
  });
});
```

No need for a Next.js server — handlers are pure functions.

## Pattern: Testing Server Actions

Server Actions are async functions too. Test them like any other function:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock the mailer
vi.mock('@/lib/mailer', () => ({
  sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
}));

import { submitContact } from '@/app/contact/actions';
import { sendMail } from '@/lib/mailer';

beforeEach(() => vi.clearAllMocks());

it('sends email on valid submission', async () => {
  const formData = new FormData();
  formData.set('name', 'Mario');
  formData.set('email', 'mario@example.com');
  formData.set('message', 'Voglio una demo del prodotto');

  const result = await submitContact({ ok: false }, formData);

  expect(result.ok).toBe(true);
  expect(sendMail).toHaveBeenCalledOnce();
});
```

## Pattern: Testing Server Components (lite)

Pure server components (no async data, no Next.js APIs) render directly:

```tsx
import { render } from '@testing-library/react';
import { Footer } from '@/components/server/Footer';

it('renders copyright', () => {
  const { container } = render(<Footer year={2026} />);
  expect(container.textContent).toContain('© 2026');
});
```

For Server Components that **await data** (e.g. `const data = await fetch(...)`), call the component as a function:

```ts
const element = await ProductList({ category: 'shoes' });
render(element as React.ReactElement);
```

This works because React Server Components are async functions — you can `await` their output, then hand it to RTL. Vitest 3+ supports this natively.

For Server Components that use `cookies()` / `auth()` / DB clients — mock those before importing the component (see patterns above).

## Pattern: MSW for Network Mocking

```bash
npm install -D msw
```

```ts
// test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://api.example.com/users/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'Mocked User' });
  }),
  http.post('https://api.example.com/leads', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 'new-lead-id', ...body }, { status: 201 });
  }),
];
```

```ts
// test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export const server = setupServer(...handlers);
```

```ts
// vitest.setup.ts (extend)
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './test/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` is strict — every fetch in a test must be mocked. Catches stealth network calls early.

## Pattern: Fixtures

```ts
// test/fixtures/user.ts
export const aUser = (overrides = {}) => ({
  id: 'u-test-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin' as const,
  createdAt: new Date('2025-01-01'),
  ...overrides,
});

// usage
import { aUser } from '@/test/fixtures/user';
const admin = aUser();
const editor = aUser({ role: 'editor' });
```

Factories beat huge JSON fixtures: each test reads as a story, not an inscrutable data dump.

## Pattern: Faking Time

```ts
import { vi } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-06-15T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

it('triggers after 5s', () => {
  const cb = vi.fn();
  setTimeout(cb, 5000);
  vi.advanceTimersByTime(5000);
  expect(cb).toHaveBeenCalled();
});
```

For tests involving `Date.now()`, JWT expiry, scheduled jobs — fake the clock.

## Parallelization & Speed

Vitest runs files in parallel by default. Within a file, tests are sequential. To parallelize within a file:

```ts
import { describe, it } from 'vitest';

describe.concurrent('parallel tests', () => {
  it('a', async () => { /* ... */ });
  it('b', async () => { /* ... */ });
});
```

Be careful: shared state (mocks, DB) needs isolation or it'll race.

Speed wins:
- `css: false` in config — skip CSS parsing.
- `pool: 'threads'` (default) — fast on multi-core.
- `--no-coverage` in watch mode — coverage adds 20-30% overhead.
- Avoid `vi.mock()` in setup file if you only need it in a few tests.

## CI — GitHub Actions

```yaml
# .github/workflows/test.yml
name: test
on: [push, pull_request]
jobs:
  vitest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:run --coverage
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
```

`pnpm test:run` runs once and exits — never use the watch-mode `vitest` in CI.

## Using with Next.js

- Vitest doesn't need the Next.js Babel/SWC pipeline — Vite handles TS+JSX directly.
- Path aliases (`@/components/...`) work via `vite-tsconfig-paths`.
- App router files import from `next/...` packages — mock them as shown above.
- `next/font`: mock it if it causes issues:
  ```ts
  vi.mock('next/font/google', () => ({
    Inter: () => ({ className: 'mock-inter' }),
  }));
  ```
- `next/image`: works in jsdom but slow — mock for speed:
  ```ts
  vi.mock('next/image', () => ({
    default: (props: any) => <img {...props} />,
  }));
  ```
- For Server Action tests, ensure `process.env.NODE_ENV = 'test'` so server-only code doesn't hit dev guards.

## Examples

### Example 1: Standard component test layout
`button.tsx` next to `button.test.tsx`. Each test: render → user interaction → assertion. ~10 lines per test.

### Example 2: Server Action with DB + email mocks
Mock `@/lib/db` and `@/lib/mailer`. Call `submitContact(prevState, formData)`. Assert returned shape + `sendMail` was called with expected args. No DB hit, instant.

### Example 3: Full route handler with MSW
Test `/api/lead` POST that calls Salesforce. MSW handler intercepts the Salesforce call and returns canned response. Verify the route's logic without hitting prod.

## Troubleshooting

### "ReferenceError: Request is not defined"
Cause: jsdom doesn't include `Request` / `Response` / `Headers` (Fetch API) in older versions.
Fix: upgrade to Vitest 3+ + jsdom 25+, which include them. Or set `environment: 'node'` for route handler tests. Or polyfill in setup: `import { Request, Response, Headers, fetch } from 'undici'; Object.assign(globalThis, { Request, Response, Headers, fetch });`.

### "cookies() should be awaited"
Cause: testing code that uses `await cookies()` but mock returns sync object.
Fix: `vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({...}) }))`. Note `mockResolvedValue`, not `mockReturnValue`.

### "Cannot find module '@/...'"
Cause: path alias not resolved.
Fix: add `vite-tsconfig-paths` to plugins (see Setup). Ensure `tsconfig.json` has `"paths": { "@/*": ["./*"] }`.

### "act() warning: An update to X was not wrapped in act"
Cause: state update happens after the assertion, in a microtask.
Fix: `await` your interaction (`await userEvent.click(...)`). Use `await waitFor(() => expect(...).toBe(...))` for async assertions.

### Tests pass locally, fail in CI
Causes: timezone, locale, parallel race, missing env var.
Fix: pin Node version in CI. Set `TZ=UTC` in CI env. Add missing `process.env.*` to the workflow. Run locally with `--no-isolate` to mimic CI more closely (rarely needed).

### MSW handlers not catching requests
Causes: handler URL doesn't match exactly; called before `server.listen()`; `onUnhandledRequest` is `'bypass'`.
Fix: set `onUnhandledRequest: 'error'` to fail loudly. Use `*` patterns: `http.get('*/api/users/:id', ...)` to match any host. Verify handler order — first match wins.

### "vi.mock is not a function"
Cause: imported `vi` from the wrong package, or didn't import at all (with `globals: true`).
Fix: with `globals: true`, no import needed. Without it: `import { vi } from 'vitest'`.

### Coverage report empty
Cause: source files not included, or excludes too broad.
Fix: `coverage.include: ['app/**', 'lib/**', 'components/**']`. Add `--coverage.all` flag to include untested files in the report.

### Server Component test fails with "fetch is not a function"
Cause: Node env but global `fetch` not present in old Node versions.
Fix: use Node 22+ (native fetch). For older Node, polyfill `undici`.

### Slow test suite (> 30s for < 100 tests)
Causes: jsdom + CSS parsing; heavy mocks; bundling on every run.
Fix: `css: false`. Don't mock at module top-level if only one test needs it — mock inline. Use `--changed` in watch mode to only re-run affected tests.

### Test imports a server-only module ("Error: server-only")
Cause: bundle-time check fires in test runtime.
Fix: mock `server-only`: `vi.mock('server-only', () => ({}))` in setup file.
