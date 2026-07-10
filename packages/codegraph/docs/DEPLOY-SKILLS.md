# Deploying skill-catalog changes to production

The skill subsystem spans **two databases**, and updates propagate through
**two independent mechanisms**. Knowing which is which avoids the classic
"I merged new skills but prod didn't change" trap.

## Two databases

| DB | Who reads it | Skills |
|----|--------------|--------|
| **Production** — `/data/.codegraph/graph.db` on `memory.fl1.it` | Every `skill_route` / `skill_read` at runtime (the MCP `codegraph` server is a proxy to `SKILLBRAIN_MCP_URL=https://memory.fl1.it/mcp`) | source of truth for routing |
| **Local** — `<repo>/.codegraph/graph.db` | Direct `sqlite3` queries and the project `skill-apply-hook.sh` only | dev/inspection copy |

The local DB is **not** what Claude routes against. Verifying a fix locally is
necessary but not sufficient — you must deploy for prod to change.

## How changes reach prod

### 1. Schema / FTS fixes → automatic on every boot
`openDb()` runs `runMigrations()` unconditionally, and the MCP server calls
`openDb()` at startup. So any new migration (e.g. `035_skills_fts_triggers.sql`,
whose one-time `rebuild` repairs a corrupted FTS index) applies on the next
redeploy with no manual step.

### 2. Skill *content* → version-gated import on boot
`entrypoint.sh` imports the bundled catalog (`/app/data`) when **either**:
- the DB has zero skills (first boot), **or**
- the bundle's content hash differs from the last imported hash
  (`/data/.codegraph/catalog.hash`).

`/data` is a **persistent named volume**, so before the hash gate a redeploy
with an unchanged count would *skip* import entirely and new skills never
shipped. Now a changed bundle re-imports automatically. The boot import is
**additive** (idempotent, FTS-safe upsert) — it never deprecates.

### 3. Removing skills → manual full-sync
Boot import never prunes (so dashboard-created skills aren't wiped). To make the
DB exactly mirror the filesystem bundle — deprecating skills whose files were
deleted — run inside the container:

```bash
node dist/cli.js import-skills /data --full
```

`--full` soft-deprecates (status `deprecated`, reversible) any **active** skill
absent from the bundle, and **never** touches `System` / `Lifecycle` categories
or `pending` drafts.

## Telemetry reality (usage / apply signal)

`route()` ranking derives ~22% of its score from `skill_usage` (recency +
project affinity). That table is fed on prod **only** by MCP calls
(`skill_read` → `loaded`, `skill_apply` → `applied`, `skill_route` → `routed`),
which `recordUsage()` writes server-side.

It is **not** fed by:
- the project hook `.claude/scripts/skill-apply-hook.sh` — it writes to the
  **local** DB, which prod never reads;
- the user hook `~/.config/skillbrain/skill-tracker.sh` — it POSTs to
  `SKILLBRAIN_TELEMETRY_URL` (default `http://localhost:7777`, usually nothing).
  The `/telemetry/skill-usage` endpoint is localhost-only and, when
  `SKILLBRAIN_TELEMETRY_TOKEN` is set, token-gated.

So the built-in **`Skill` tool** (superpowers etc.) apply-signal does not reach
prod ranking in the default remote-MCP setup. If you want it to, point
`SKILLBRAIN_TELEMETRY_URL` at a reachable, authenticated endpoint — or prefer
the MCP `skill_apply` tool, which records server-side.

## Routing hygiene

`route()` excludes non-task skills from recommendations: `agent:*`, `command:*`,
`lifecycle` types, and `_routing-index`. They remain fully readable via
`skill_read` / `agent_read` / `command_read` — they're just kept out of ranked
task suggestions so specific domain/process skills surface.
