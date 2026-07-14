# SkillBrain — Project Instructions

> Project-specific configuration. SkillBrain protocol (sessions, memories, skills, credentials) is in the Global CLAUDE.md.
> Smart Intake, Form/ESLint/CodeGraph protocols, and delegation map are in AGENTS.md.

---

## Architecture

```
.claude/                     → project config + skills + agents
  skill/                     → 120 domain skills (mirror — load via skill_read, not from disk)
  command/                   → 23 slash commands
  agent/                     → 12 agent prompts (old format)
  agents/                    → 23 agents (new format with frontmatter)
  scripts/                   → automation scripts
  guides/                    → reference docs
  SYSTEM.md                  → system registry, versions, MCP status

.agents/skills/              → 112 lifecycle/process/quality skills (mirror)

AGENTS.md                    → Smart Intake + Iron Rules + Delegation Map
Progetti/                    → client project directories
packages/codegraph/          → SkillBrain MCP server (core)
```

---

## Multi-Agent System

### 2-Level Architecture

```
@planner (Opus, effort:max)          @builder (Sonnet, effort:high)
    │                                      │
    ├── ux-designer                        ├── project-architect
    ├── ui-designer                        ├── component-builder
    ├── motion-designer                    ├── api-developer
    ├── growth-architect (Opus)            ├── i18n-engineer
    ├── cro-designer                       ├── test-engineer
    └── seo-specialist                     ├── devops-engineer
         saas-copywriter                   ├── payload-cms
                                           ├── n8n-workflow
                                           ├── performance-engineer
                                           └── security-auditor (read-only)
```

### Agent Routing

| Task type | Lead agent | Parallel subagents |
|-----------|-----------|---------------------|
| New site / landing | @planner → @builder | ux + ui + growth → component-builder + api-developer |
| Marketing / strategy | @planner | growth-architect + cro-designer + saas-copywriter + seo-specialist |
| UI component | @builder | component-builder (+ ui-designer if needed) |
| Fix / debug | @builder | (direct, or systematic-debugging skill) |
| Full audit | @builder | security-auditor + performance-engineer + seo-specialist in parallel |
| Deploy | @builder | devops-engineer |
| CMS setup | @builder | payload-cms + api-developer |
| Refactor | @builder | CodeGraph impact analysis first, then component-builder |

### Effort Levels

| Effort | Use | Equiv temp |
|--------|-----|-----------|
| `max` | Planner, growth-architect — deep reasoning | ~0.7 |
| `high` | Builder, component-builder — precise execution | ~0.3 |
| `medium` | Test, i18n, devops — repetitive tasks | ~0.2 |
| `low` | Mechanical tasks | ~0.1 |

---

## Stack Defaults (Pixarts clients)

| Component | Technology |
|-----------|-----------|
| **Framework** | Next.js 15+ (App Router, RSC) |
| **Styling** | Tailwind CSS + shadcn/ui |
| **CMS** | Payload CMS (multi-tenant, `cms.pixarts.eu`) |
| **i18n** | next-intl |
| **Deploy** | Coolify (Docker multi-stage) |
| **Forms** | react-hook-form + Zod + Server Actions |
| **SEO** | next/metadata + JSON-LD + sitemap.xml |
| **Analytics** | Plausible / PostHog |
| **Odoo** | fl1.cz/odoo (CRM leads via API) |

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/new-project "Name"` | Bootstrap new client project |
| `/new-client` | Full client onboarding workflow |
| `/frontend` | Frontend build workflow |
| `/design` | Design workflow (UI/UX) |
| `/marketing` | Marketing strategy workflow |
| `/audit` | Site audit (perf, a11y, SEO, security) |
| `/clone` | Website cloning pipeline |
| `/video` | Video production (AI gen + Remotion) |
| `/cms-setup` | Payload CMS setup |
| `/cms-module` | Add CMS module |
| `/n8n` | n8n workflow automation |
| `/gdpr-audit` | GDPR compliance audit |
| `/generate-legal` | Generate privacy/cookie/T&C |
| `/generate-sitemap` | Sitemap generation |
| `/review` | Code review |
| `/check` | Health check |
| `/system-sync` | Sync system registry |

To use: read `.claude/command/{name}.md` and follow its protocol.

---

## Codex Integration (second-opinion runtime)

Codex CLI runs in parallel to Claude via the official `codex@openai-codex` plugin. Use for second opinions, deeper investigations, or to offload long tasks while Claude continues other work.

### Slash commands
| Command | Use when |
|---------|----------|
| `/codex:review` | Second-opinion code review of working tree or branch diff |
| `/codex:adversarial-review` | Aggressive review — challenges design choices, not just bugs |
| `/codex:rescue <task>` | Hand a substantial debugging/implementation task to Codex |
| `/codex:status` | List running Codex tasks |
| `/codex:result` | Fetch result of a finished Codex task |
| `/codex:cancel` | Cancel a running Codex task |
| `/codex:setup` | Verify/configure Codex runtime |

Flags: `--wait` (foreground) / `--background` (detach), `--write` (default for rescue, off for reviews), `--resume` (continue last Codex thread in this repo), `--fresh` (start new thread).

### Custom subagents (user-level, available in all projects)
Invoke via the `Agent` tool with `subagent_type`:

| Subagent | When to dispatch |
|----------|------------------|
| `codex-rescue` | Generic rescue — Claude is stuck or needs second implementation pass |
| `codex-security-auditor` | Before merging auth/secrets/input changes — OWASP Top 10 read-only audit |
| `codex-perf-analyst` | Before shipping a page that targets Lighthouse > 90 — RSC/bundle/data-fetching audit |
| `codex-coolify-validator` | Before deploying — catches hardcoded paths, missing env vars, Docker footguns |

All custom subagents run **read-only** by default and default to `--background`. They forward a pre-framed prompt to `codex-companion.mjs task`; do not call Codex directly from the main thread when one of these specialized agents fits.

---

## Auto-hooks (project-scoped)

The following are wired in `.claude/settings.json` and run automatically — do **not** invoke them manually unless the task changes mid-session.

| Event | Script | Purpose |
|-------|--------|---------|
| `SessionStart` | `.claude/scripts/load_project_context.sh` | Prints 5-layer Cortex briefing into the session as system context |
| `PostToolUse` matcher `Skill` | `.claude/scripts/skill-apply-hook.sh` | Inserts an `applied` row into the **local** `.codegraph/graph.db skill_usage` |

Implications:
- Skip manual `cortex_briefing` calls at the start of a session — the briefing is already in context.
- The `Skill` tool (built-in Claude Code skills) is auto-instrumented into the **local** DB. Because the MCP `codegraph` server proxies to prod (`memory.fl1.it`), these local `applied` rows do **not** reach prod's route/health ranking — only MCP `skill_read`/`skill_apply`/`skill_route` record telemetry server-side. See [`packages/codegraph/docs/DEPLOY-SKILLS.md`](packages/codegraph/docs/DEPLOY-SKILLS.md) for the full two-DB / telemetry picture and how to deploy skill changes to prod.
- Both scripts walk upward from `cwd` to locate `.codegraph/graph.db`, so they work from any subdir of the workspace.

---

## Adding a Skill

Skills are team-shared and live in the repo. Two storage zones:

| Path | Type | Use for |
|------|------|---------|
| `.claude/skill/<name>/SKILL.md` | `domain` | Tech/topic knowledge (auth, payments, Next.js, ...) |
| `.agents/skills/<name>/SKILL.md` | `lifecycle` or `process` | Cross-cutting workflows (debugging, testing, code review, ...) |

Both directories are tracked by git. New skills committed here become available to every teammate (Claude *and* Codex) once the importer runs.

### Workflow — Claude (interactive)

1. Run `/skill-creator` or call MCP `skill_add({ name, content, type, ... })` directly. Stored as `pending` draft by default → approve at the dashboard.
2. To go live immediately without review: `skill_add({ ..., draft: false })`.
3. Skill is queryable via `skill_route` and loadable via `skill_read` immediately.

### Workflow — Codex / manual filesystem

1. Create `.claude/skill/<name>/SKILL.md` (or `.agents/skills/<name>/SKILL.md` for process skills) with frontmatter:
   ```yaml
   ---
   name: <name>
   description: One-line trigger phrase. Use when <X>. Triggers on: <keywords>.
   version: 1.0.0
   ---

   # Skill Title

   ## Overview
   ...
   ```
2. Run the importer:
   ```bash
   pnpm --filter @synapse/codegraph build
   node packages/codegraph/dist/cli.js import-skills .
   ```
3. Verify in DB: `sqlite3 .codegraph/graph.db "SELECT name, type FROM skills WHERE name='<name>';"`
4. Commit the new skill file(s).

### What gets imported from where

| Source dir | Skill type | Notes |
|------------|-----------|-------|
| `.claude/skill/<name>/SKILL.md` (or `.opencode/` fallback) | `domain` | Subdir-based |
| `.agents/skills/<name>/SKILL.md` | `lifecycle` or `process` | Type auto-detected from name |
| `.claude/agents/<name>/AGENT.md` | `agent` | Stored as `agent:<name>` |
| `.claude/agent/<file>.md` | `agent` | Flat files |
| `.claude/command/<name>.md` | `command` | Slash commands |

### Quality bar

Every skill must have:
- Frontmatter with `name`, `description`, optional `version` (default `1.0.0`)
- Description that includes **trigger keywords** so `skill_route` can find it via FTS
- Body in markdown — no fixed structure required, but the "Overview / When to use / Process / Examples" template (see `.claude/skill/skill-template-2.0/`) is recommended

All imported/added skills are security-scanned by `@skillbrain/skill-guard`; a `BLOCK` verdict forces `status='pending'` pending human review. This is defense-in-depth, not a sound filter — a single indicator (one `curl | bash`, one secret read) usually scores `CAUTION`/`SAFE` and still activates; admin content-edit, `SkillsStore.rollback()`, and review proposal-apply paths do not re-scan, so a verdict can go stale (see `packages/skill-guard/README.md#limitations`).

Skills with confidence ≤ 3 and ≥ 30 sessions stale are auto-deprecated by `skill_decay`. Skills routed but never loaded after 30 days are flagged by `skill_gc`.

---

## Deployment

| | |
|---|---|
| **Platform** | Coolify (self-hosted) |
| **Container** | Docker multi-stage |
| **CI/CD** | GitHub Actions |
| **SSL** | Let's Encrypt (auto) |
| **CMS** | `cms.pixarts.eu` (separate) |

---

## Quality Standards

### Engineering

| Metric | Target |
|--------|--------|
| Lighthouse Performance | > 90 |
| Lighthouse Accessibility | > 95 |
| Lighthouse SEO | > 95 |
| TypeScript | Strict mode |
| Test Coverage | > 80% |

### Marketing (B2B Tech Benchmarks)

| Metric | Target |
|--------|--------|
| Landing Page CR | 2.5% - 5% |
| Form Completion Rate | 40% - 60% |
| Bounce Rate | < 50% |
| Time on Page | > 2 min |

---

## Environment Variables

Master env: SkillBrain `user_env_get` — contains all shared API keys.

Per project:
- `bash ~/.config/skillbrain/hooks/new-project.sh <path>` → generates `.env.local`
- `bash ~/.config/skillbrain/hooks/env-check.sh <path>` → validates required env vars

Key vars: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CMS_URL`, `TENANT_SLUG`, `REVALIDATION_SECRET`.

---

**Version**: 3.1.0
**Last update**: 2026-05-14 — added auto-hooks + skill add workflow
