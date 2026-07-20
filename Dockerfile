# ─────────────────────────────────────────────
# SkillBrain MCP Server — monorepo build
# Build context: repo root
# ─────────────────────────────────────────────

ARG CODEGRAPH_AUTH_TOKEN
ARG ANTHROPIC_API_KEY
ARG DASHBOARD_PASSWORD
ARG ENCRYPTION_KEY
ARG LEGACY_TOKEN_USER_EMAIL

# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Build tools for native deps (better-sqlite3, sharp)
RUN apk add --no-cache python3 make g++

# Install workspace deps — copy manifests first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/codegraph/package.json ./packages/codegraph/
COPY packages/storage/package.json ./packages/storage/
COPY packages/skill-guard/package.json ./packages/skill-guard/

RUN corepack enable && pnpm install --frozen-lockfile

# Copy sources
COPY packages/skill-guard/src/ ./packages/skill-guard/src/
COPY packages/skill-guard/tsconfig.json ./packages/skill-guard/

COPY packages/storage/src/ ./packages/storage/src/
COPY packages/storage/tsconfig.json ./packages/storage/

COPY packages/codegraph/src/ ./packages/codegraph/src/
COPY packages/codegraph/tsconfig.json ./packages/codegraph/

# Build skill-guard first (storage depends on it), then storage (codegraph depends on it)
RUN pnpm --filter @skillbrain/skill-guard build
RUN pnpm --filter @skillbrain/storage build

# Build codegraph (package name is "codegraph", not scoped)
RUN pnpm --filter codegraph build

# Deploy: resolve workspace deps into a self-contained folder
RUN pnpm --filter codegraph deploy --prod /deploy

# Stage 2: Production
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache sqlite libstdc++ curl

RUN addgroup --system --gid 1001 codegraph && \
    adduser --system --uid 1001 codegraph

# Deployed app: dist/ + node_modules/ with @skillbrain/storage resolved
COPY --from=builder /deploy ./

# Bundled skills data (258 skills, agents, commands)
COPY packages/codegraph/data/ ./data/

# Dashboard frontend
COPY packages/codegraph/public/ ./public/

# Entrypoint
COPY packages/codegraph/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Persistent data volume
RUN mkdir -p /data/.codegraph /data/.hf-cache && chown -R codegraph:codegraph /data

ARG CODEGRAPH_AUTH_TOKEN
ARG ANTHROPIC_API_KEY
ARG DASHBOARD_PASSWORD
ARG ENCRYPTION_KEY
ARG LEGACY_TOKEN_USER_EMAIL

ENV NODE_ENV=production
ENV PORT=3737
ENV SKILLBRAIN_ROOT=/data
ENV TRANSFORMERS_CACHE=/data/.hf-cache
ENV CODEGRAPH_AUTH_TOKEN=${CODEGRAPH_AUTH_TOKEN}
ENV ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
ENV DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}
ENV ENCRYPTION_KEY=${ENCRYPTION_KEY}
ENV LEGACY_TOKEN_USER_EMAIL=${LEGACY_TOKEN_USER_EMAIL}

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3737/api/health || exit 1

USER codegraph

EXPOSE 3737

CMD ["./entrypoint.sh"]
