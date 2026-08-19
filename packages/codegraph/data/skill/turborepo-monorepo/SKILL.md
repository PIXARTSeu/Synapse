---
name: turborepo-monorepo
description: Turborepo + pnpm workspaces monorepo for Next.js apps and shared packages — workspace layout, turbo.json pipeline, task caching (local + remote), shared UI/config/utils packages, internal package imports, env vars per task, CI integration, Vercel deploys, transpilePackages, debugging cache misses. Use when migrating multiple Next.js projects into a monorepo, sharing components/configs across apps, speeding up CI with caching, or setting up internal pkgs.
version: 1.0.0
---

# Turborepo + PNPM Monorepo

## Overview

Turborepo is a task orchestrator + cache. PNPM workspaces handles dependency installation; Turbo handles "run tasks across packages efficiently". Combined: one repo with multiple Next.js apps + shared packages (UI, config, utils, types), every build cached, both locally and in CI.

When to reach for it:
- 2+ Next.js apps sharing components / config / types
- Internal SDK + the app that consumes it in the same repo
- Marketing site + dashboard + docs together
- Team wants atomic PRs across multiple deployable units

Single-app projects don't need Turborepo. Wait until the second app appears.

## When to Use

- Consolidating 3+ Next.js projects (e.g. Pixarts clients with shared UI)
- Building a design system used by multiple apps
- Internal MCP server + the apps that consume it
- Speeding up CI for an already-existing monorepo
- Setting up shared TypeScript / ESLint / Tailwind configs

Don't use when:
- One app, no shared code — overkill, adds tooling
- Heterogeneous stack (Next.js + Rust + Python) — Nx or Bazel handles polyglot better
- Tiny team, simple needs — start with pnpm workspaces alone, add Turbo when caching becomes valuable

## Setup — From Scratch

```bash
pnpm dlx create-turbo@latest
```

Or manually:

```bash
mkdir my-monorepo && cd my-monorepo
pnpm init
```

`package.json`:

```json
{
  "name": "my-monorepo",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "devDependencies": {
    "turbo": "^2.5.0"
  },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "workspaces": ["apps/*", "packages/*"]
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

Directory layout:

```
my-monorepo/
├── apps/
│   ├── web/              # Next.js — pixarts.eu marketing
│   ├── dashboard/        # Next.js — admin app
│   └── docs/             # Next.js — docs site
├── packages/
│   ├── ui/               # shared React components
│   ├── config-tailwind/  # shared Tailwind config
│   ├── config-eslint/    # shared ESLint config
│   ├── config-typescript/# shared tsconfig base
│   └── utils/            # shared TS utilities
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Pattern: `turbo.json` Pipeline

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"],
      "env": ["NODE_ENV", "NEXT_PUBLIC_*"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "env": ["NODE_ENV"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
```

Key concepts:
- `dependsOn: ["^build"]` — run upstream packages' `build` task first.
- `outputs` — files/dirs to cache. Empty means task has no outputs (lint, typecheck).
- `cache: false` — never cache (dev server, clean).
- `persistent: true` — long-running task that doesn't terminate (dev server).
- `env` — env vars that invalidate cache when changed. Without listing, Turbo IGNORES env vars and you'll get stale builds.

## Pattern: Shared UI Package

`packages/ui/package.json`:

```json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./styles.css": "./src/styles.css",
    "./*": "./src/*.tsx"
  },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@repo/config-typescript": "workspace:*",
    "react": "^19.0.0",
    "typescript": "^5.5.0"
  },
  "peerDependencies": {
    "react": "^18 || ^19"
  }
}
```

`packages/ui/src/button.tsx`:

```tsx
import { ButtonHTMLAttributes } from 'react';

export function Button({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props}>{children}</button>;
}
```

In `apps/web/package.json`:

```json
{
  "dependencies": {
    "@repo/ui": "workspace:*"
  }
}
```

In `apps/web/app/page.tsx`:

```tsx
import { Button } from '@repo/ui/button';

export default function Page() {
  return <Button>Click</Button>;
}
```

`workspace:*` is the PNPM marker: "this dep is the workspace package". No publishing, no versioning, no `npm link`. Just import.

## Pattern: transpilePackages (Next.js)

Next.js doesn't auto-compile internal pkgs. Tell it which to include:

```ts
// apps/web/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/ui', '@repo/utils'],
};

export default nextConfig;
```

This is the #1 gotcha. Without it, internal packages fail with "Module not transformed" or similar.

## Pattern: Shared TypeScript Config

`packages/config-typescript/package.json`:

```json
{
  "name": "@repo/config-typescript",
  "version": "0.0.0",
  "private": true,
  "files": ["base.json", "next.json", "react-library.json"]
}
```

`packages/config-typescript/base.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "target": "es2022",
    "lib": ["dom", "dom.iterable", "es2022"]
  }
}
```

`packages/config-typescript/next.json`:

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "jsx": "preserve",
    "module": "esnext"
  }
}
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "@repo/config-typescript/next.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
}
```

Same idea for ESLint, Tailwind, Prettier configs.

## Pattern: Filter (Run on Specific Package)

```bash
# only run build for web app + its dependencies
pnpm turbo build --filter=web...

# only the dashboard app, not dependencies
pnpm turbo build --filter=dashboard

# all apps but not packages
pnpm turbo build --filter='./apps/*'

# packages changed since main branch
pnpm turbo build --filter='...[main]'
```

`...` syntax: trailing = upstream deps; leading = downstream consumers; `[main]` = since main.

## Pattern: Remote Cache (Vercel)

```bash
pnpm turbo login
pnpm turbo link
```

Connects your repo to Vercel's free remote cache. Subsequent CI builds + teammate builds reuse each other's cache. **Speed gain: 90% on cached tasks.**

For self-hosted (Coolify, S3-compatible):

```yaml
# turbo.json (Turborepo 2+)
"remoteCache": {
  "enabled": true,
  "apiUrl": "https://cache.example.com",
  "signature": true
}
```

Self-hosted option: [`turborepo-remote-cache`](https://github.com/ducktors/turborepo-remote-cache) on Coolify.

## Pattern: Env Vars per Task

Turbo invalidates cache when env vars listed in `env` change:

```json
{
  "tasks": {
    "build": {
      "env": [
        "NODE_ENV",
        "NEXT_PUBLIC_SITE_URL",
        "NEXT_PUBLIC_*",                // wildcard
        "DATABASE_URL"
      ],
      "outputs": [".next/**", "!.next/cache/**"]
    }
  }
}
```

For dev-only env vars that don't affect build:

```json
"globalEnv": ["NODE_ENV"],
"globalPassThroughEnv": ["MY_VAR"]    // pass to task without invalidating cache
```

Hash the values? Yes — change in any listed env var = cache miss. List too much = constant misses. List too little = stale builds. Pick what genuinely affects output.

## Pattern: CI — GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 2 }              # for filter [main]
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build lint typecheck test
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

`TURBO_TOKEN` + `TURBO_TEAM` enable remote cache. Without them, every CI run rebuilds from scratch.

Affected-only:

```bash
pnpm turbo build --filter='...[origin/main]'
```

In Turbo 2+, the `turbo run` command auto-detects affected packages with `--affected` in CI mode.

## Pattern: Vercel Deploy per App

In Vercel: create one project per app, point each to its subdirectory:

| Vercel Project | Root Directory | Install Command | Build Command | Output Dir |
|---|---|---|---|---|
| web | `apps/web` | `cd ../.. && pnpm install --frozen-lockfile` | `cd ../.. && pnpm turbo build --filter=web` | `apps/web/.next` |
| dashboard | `apps/dashboard` | (same) | `--filter=dashboard` | `apps/dashboard/.next` |

Each Vercel project shares the same Turborepo remote cache. First deploy is full; subsequent only rebuilds what changed.

For Coolify: one Dockerfile per app, similar pattern — `turbo build --filter=<app>` inside Docker, copy only the app's `.next` to the runtime image.

## Pattern: Dependency Versioning

```bash
# add a dep to a single workspace
pnpm add react -F web

# add a dev dep to all workspaces
pnpm add -D typescript -w

# add another workspace package as a dep
pnpm add @repo/ui -F web
```

For versioned releases of internal packages, use [Changesets](https://github.com/changesets/changesets). For private monorepos, you usually don't version internal pkgs — they all move together.

## Performance — Cache Tuning

Run `pnpm turbo build --summarize` to see what was cached vs run. Common cache-miss reasons:

- **File changed**: trivially expected.
- **Env var changed**: listed in `env`; new value invalidates.
- **Outputs changed**: check `outputs` glob is correct.
- **`dependsOn` package rebuilt**: upstream change cascades.
- **`globalDependencies` file changed**: any file in this list invalidates ALL tasks.

For dev speed: run only what you need (`pnpm turbo dev --filter=web`).

## Using with Next.js

- **Always set `transpilePackages`** for internal pkgs you import.
- **Server Components from packages**: pure components work. If a pkg's component touches `next/*` APIs, mark it `'use client'` or use proper Server-only imports.
- **App Router config**: each app has its own `next.config.ts`. Share configs as helpers from a package if you want consistency.
- **Tailwind v4**: each app has its own `tailwind.config` but can extend a shared config package.
- **Server Action between apps?** Not possible directly. Server Actions are scoped to their app. Use a shared API package or a service.

## Examples

### Example 1: Pixarts monorepo migration
9 client Next.js projects + a shared `@pixarts/ui` package. Add Turbo, Vercel remote cache, CI build time drops from 12 min to 90 sec on cache hit.

### Example 2: SaaS with marketing + dashboard
`apps/web` (marketing, public) + `apps/app` (dashboard, auth-walled) + `packages/ui` (atomic components) + `packages/auth` (Supabase wrapper). Both apps import from packages.

### Example 3: SDK + Test Suite
`packages/sdk` (the published SDK) + `apps/playground` (interactive demo). Turbo rebuilds SDK then refreshes playground on change.

## Troubleshooting

### "Cannot find module '@repo/ui'"
Cause: Next.js didn't transpile the internal package.
Fix: add to `transpilePackages: ['@repo/ui']` in `next.config.ts`. Also confirm `@repo/ui` is listed in the app's `dependencies` (not just at root).

### Cache hit rate low
Cause: env vars not declared, `globalDependencies` too broad, or outputs misconfigured.
Fix: run with `--summarize`. Check that env vars actually used in build are listed in `env`. Verify outputs path. Move broad files out of `globalDependencies`.

### "EACCESS" when running turbo
Cause: `node_modules/.bin/turbo` not in PATH.
Fix: use `pnpm turbo` (resolves via pnpm). Or `pnpm install` to wire bins.

### Vercel build picks wrong app
Cause: root directory misconfigured.
Fix: in Vercel project settings → General → Root Directory → set to `apps/web` (or whichever). Then build command includes filter.

### Build fails locally but works on CI
Causes: `node_modules` out of sync after switching branches; stale Turbo cache.
Fix: `pnpm install`. If still failing: `pnpm turbo run build --force` to bypass cache. Last resort: `rm -rf node_modules .turbo apps/*/.next && pnpm install`.

### Internal pkg changes don't show in dev
Cause: dev server has stale module map (HMR doesn't watch outside the app dir by default).
Fix: usually `transpilePackages` includes hot-reload. If not, restart dev server. For deeper integration: configure Webpack `watchOptions` or use Turbopack (Next 15+).

### `turbo dev` doesn't run all apps in parallel
Cause: default behavior is parallel, but `--filter` may limit.
Fix: `pnpm turbo dev` with no filter runs all `dev` tasks (with `persistent: true`).

### Cyclic dependency error
Cause: package A imports B which imports A.
Fix: extract shared code to a 3rd package (`@repo/shared`). Cyclic monorepo deps are a code smell, not just a tool quirk.

### Remote cache miss when expected hit
Cause: different Node/pnpm versions, different OS, env vars differ.
Fix: pin versions in `packageManager` field + `engines`. Ensure CI and local use the same package manager version. Check `TURBO_TOKEN` is set in CI.

### Turbo daemon hangs
Cause: stale daemon process.
Fix: `pnpm turbo daemon stop` then `pnpm turbo daemon start`. Or disable in `turbo.json` with `"daemon": false`.

### `pnpm install` doesn't pick up new workspace
Cause: directory not in `pnpm-workspace.yaml` glob.
Fix: confirm new package is under `apps/*` or `packages/*` (or whatever pattern). Run `pnpm install` after creating.

### Tests in one package can't import code from another
Cause: missing workspace dep declaration.
Fix: `pnpm add @repo/utils -F my-test-package`. Make sure imports use the package name, not relative paths.
