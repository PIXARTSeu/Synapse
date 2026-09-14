# Superpowers — Team Integration

**Date:** 2026-09-14
**Status:** Draft — awaiting review
**Scope:** `.opencode/settings.json`, `AGENTS.md`, `CLAUDE.md`, `packages/codegraph/data/agents/{planner,builder}/AGENT.md`, `packages/storage/src/import-skills.ts`, SkillBrain prod catalog; per-machine: `.claude/skills/` symlinks, `.claude/agents/` mirror, local `.codegraph/graph.db`, global `~/.claude/CLAUDE.md`

---

## Overview

Make [obra/superpowers](https://github.com/obra/superpowers) the team's engineering process for Claude Code: one version of each process skill, distributed as a plugin, wired into Smart Intake and the @planner/@builder agents. Codex is unaffected.

---

## 1. Current State

Superpowers already reaches Claude through three routes that serve two different versions of the same 14 skills:

| Route | Version | Consumers |
|-------|---------|-----------|
| Plugin `superpowers@claude-plugins-official`, enabled only in one user's `~/.claude/settings.json` | 6.3.0 (2026-08-12), auto-updating | That user's Claude Code, as `superpowers:<skill>`, plus a SessionStart hook injecting `using-superpowers` |
| `.agents/skills/<skill>/` (tracked) symlinked into `.claude/skills/` (per-machine mirror, not in git) | Early fork (`version: 1.0.0`); 13–655 diff lines from 6.3.0 per skill | Claude Code as unprefixed `<skill>` on machines that have the mirror; Codex from disk |
| SkillBrain catalog (bundle `packages/codegraph/data/lifecycle-skills/`, identical to `.agents/skills/`) | Same early fork | `skill_route` / `skill_read` over MCP |

The 14 skills: `brainstorming`, `dispatching-parallel-agents`, `executing-plans`, `finishing-a-development-branch`, `receiving-code-review`, `requesting-code-review`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `using-git-worktrees`, `using-superpowers`, `verification-before-completion`, `writing-plans`, `writing-skills`.

The forks carry no SkillBrain-specific customisation (no references to SkillBrain, memory tools, CodeGraph, Pixarts or Coolify outside `using-superpowers`'s generic tool text); they are simply older.

Two rule conflicts exist today:

- Global `CLAUDE.md` says skills come **only** from SkillBrain `skill_read`; superpowers loads skills through the `Skill` tool.
- `AGENTS.md` Smart Intake classifies requests (SEMPLICE / MEDIO / COMPLESSO) while `brainstorming` classifies them again (spike / bounded / architectural).

No command or agent file references any superpowers skill.

### Repository layout that shapes this design

- `.claude` is a per-machine symlink to `.opencode/` (the link itself is gitignored). Git ignores `.opencode/*` except `.opencode/settings.json` and `.opencode/scripts/`. So **`.opencode/settings.json` is the team-shared project settings file** — the channel the existing SessionStart/PostToolUse hooks already use — while `.claude/skills/` and `.claude/agents/` are per-machine.
- `@planner`, `@builder`, `component-builder` etc. are **SkillBrain agent prompts** (`agent:<name>`, loaded with `agent_read`), not native Claude Code subagent types — Claude Code only registers flat `.claude/agents/*.md` files. Their team-shared source is the tracked bundle `packages/codegraph/data/agents/<name>/AGENT.md`, which reaches prod through the hash-gated boot import.

---

## 2. Decisions

| Question | Decision |
|----------|----------|
| Who uses superpowers | Whole team, **Claude Code only**. Codex keeps reading `.agents/skills/` as today. |
| Old forks | **Hide from Claude**, keep on disk for Codex. |
| Relationship to Smart Intake | **Engineering backbone**: Smart Intake decides *what* and routes; superpowers governs *how* code work is done. |
| Protecting the hide against `--reactivate` | Exclusion list in the importer, not documentation alone. |
| Artifact location | Superpowers defaults (`docs/superpowers/specs/`, `docs/superpowers/plans/`). |

---

## 3. Design

### 3.1 Distribution

**One version visible to Claude: the plugin's.**

- `.opencode/settings.json` (tracked; read by Claude Code as `.claude/settings.json`) gains:
  ```json
  "enabledPlugins": { "superpowers@claude-plugins-official": true }
  ```
  Teammates who trust the repo are offered the plugin; `claude-plugins-official` is the built-in official marketplace, so no `extraKnownMarketplaces` entry is needed. The exact first-open behaviour for a teammate without the plugin is verified during implementation (§5).
- No version pin — upstream releases arrive without anyone re-syncing copies.
- The 14 symlinks in `.claude/skills/` are a per-machine mirror, so removing them is a **local cleanup, not a commit**. The new `CLAUDE.md` section (§3.3) tells any teammate who keeps such a mirror to remove the same 14 links. The directories in `.agents/skills/` stay untouched.

**Risk — teammate declines the plugin:** without it they have no process skills in Claude Code. Mitigation: the new `CLAUDE.md` section states the one-line install command `/plugin install superpowers@claude-plugins-official`.

### 3.2 SkillBrain Catalog

**Forks stay in the database but leave routing.**

- **Prod (`memory.fl1.it`):** the 14 skills are soft-deleted through the existing admin route `DELETE /api/skills/:name` (sets `status='deprecated'`, preserves versions, writes an audit log entry — the same path the dashboard uses). `skill_route` and the catalog list queries filter on `status = 'active'`, so the forks stop being suggested. Codex is unaffected because it reads the filesystem.
- **Survives redeploys:** the container entrypoint runs an additive import, and `SkillsStore.upsert` preserves the existing `status` when the importer passes none. A deprecated row stays deprecated.
- **Local `.codegraph/graph.db`:** the same 14 rows are set to `deprecated`, so the `codegraph-local` fallback matches prod. This DB is not shared; a direct status update is acceptable there.

**Importer guard.** `import-skills --reactivate` flips back to `active` every deprecated skill still present in the bundle — which would silently undo this change, since the files remain on disk for Codex. Add to `packages/storage/src/import-skills.ts`:

- an exported constant `SUPERSEDED_BY_PLUGIN` listing the 14 names, with a comment pointing to this spec;
- the `reactivate` step skips those names and logs how many it skipped.

Normal imports, `--full` prune and the security gate are unchanged. Covered by a new case in `packages/storage/tests/import-skills.test.ts`, alongside the existing `--reactivate` test.

### 3.3 Workflow Wiring

**Constraint — orchestration runs in the main session.** `brainstorming` is a dialogue with the human, which a subagent cannot hold; since 6.3.0, implementer and reviewer subagents may not spawn their own subagents. So the superpowers flow is driven from the main session, and specialist agents are what it dispatches.

**`AGENTS.md`**

- Smart Intake Fase 0 and `brainstorming` are stated as complementary: Fase 0 classifies the request *type* and picks the workflow; `brainstorming` classifies the *ceremony* (spike / bounded / architectural).
- The Fase 3 brief (COMPLESSI tasks) is the input to `brainstorming`, which does not re-ask what the brief already answers.
- Fase 4 routing table:

  | Tipo | Before | After |
  |------|--------|-------|
  | `FIX` | risolvi direttamente | `superpowers:systematic-debugging` |
  | `COMPONENTE` | subagent component-builder | `superpowers:brainstorming` → `subagent-driven-development` dispatching component-builder |
  | `REFACTOR` | codegraph_impact → poi procedi | codegraph_impact → `superpowers:brainstorming` → … |
  | `MARKETING`, `VIDEO`, `AUDIT`, `CMS`, `COMPLIANCE`, `AUTOMATION`, `NUOVO_SITO`, `CLIENT`, `DESIGN`, `SETUP_PROGETTO` | — | unchanged |

- New section **"Workflow tecnico (Superpowers)"** mapping the Iron Rules onto superpowers phases:

  | Iron Rule | Where it runs |
  |-----------|---------------|
  | CodeGraph `codegraph_impact` / `codegraph_context` | `brainstorming` → explore project context |
  | Form Protocol question | `brainstorming` → clarifying questions |
  | ESLint auto-fix, `codegraph_detect_changes` | `verification-before-completion`, before commit |
  | Delegation rule 2 (`skill_read` before delegating) | `subagent-driven-development` dispatches `general-purpose` implementers whose prompt embeds the specialist prompt from `agent_read({ name: "component-builder" })` (or `api-developer`, …) and the domain skills from `skill_read` |

Agent edits land in the tracked bundle `packages/codegraph/data/agents/<name>/AGENT.md` (team + prod via `agent_read`); the same body change is mirrored into this machine's `.claude/agents/<name>/AGENT.md`, which differs from the bundle only by lacking the `tools:` frontmatter.

**`planner/AGENT.md`** — UX / marketing / SEO briefs unchanged. New note: for technical work, @planner researches and returns findings to the main session, which owns the `brainstorming` dialogue, the spec and the plan.

**`builder/AGENT.md`** — the five steps stay, each annotated with its skill:

| Step | Skill |
|------|-------|
| PIANIFICA | `writing-plans` |
| DELEGA | `subagent-driven-development` |
| VERIFICA | `test-driven-development` + `verification-before-completion` |
| CONSEGNA | `requesting-code-review` + `finishing-a-development-branch` |

**Project `CLAUDE.md`** (team-shared)

- New section **"Superpowers (process skills)"**: the 14 process skills load through the `Skill` tool as `superpowers:<skill>`; all domain skills still come from SkillBrain `skill_read`. Includes the install command from §3.1 and a pointer to this spec.
- Agent Routing row "Fix / debug" references `superpowers:systematic-debugging`.
- `memory_suggest` after `finishing-a-development-branch` — already required by the global protocol, restated at the point it applies.

**Global `~/.claude/CLAUDE.md`** (per user, not in the repo) — one exception line under "Skills come ONLY from SkillBrain" so the two rules no longer contradict. Teammates are covered by the project `CLAUDE.md`; each may add the same line to their own global file.

### 3.4 Artifact Locations

- New specs: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. New plans: `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`. These are the skill defaults and already hold 6 specs and 3 plans; no override to maintain across plugin updates.
- `docs/plans/` (28 files) stays as an archive. Nothing moves.
- Client projects use the same relative paths inside `Progetti/<slug>/docs/superpowers/`, next to their code — the directory separation rule still holds.
- `.superpowers/` (brainstorm companion) and `.worktrees/` are already in `.gitignore`.

---

## 4. Out of Scope

- `/frontend` and the other slash commands — `/frontend` already has its own design → build → quality-gate phases; merging them is a separate follow-up, not needed to adopt the process.
- Superpowers for Codex (upstream ships a Codex plugin; not adopted now).
- Refreshing the `.agents/skills/` forks to 6.3.0.
- Moving or rewriting `docs/plans/`.
- Correcting the `subagent_type` column of the `AGENTS.md` Delegation Map, which presents SkillBrain agent prompts as native subagent types. The new "Workflow tecnico" section avoids repeating it; the existing table is a separate fix.
- Making the `.claude` → `.opencode` symlink part of team onboarding (pre-existing; this design uses the same channel as the current hooks).

---

## 5. Rollout and Verification

Work happens on a branch from `main`, separate from `fix/skill-catalog-recovery` (which holds an unrelated uncommitted edit to the same importer file).

| # | Step | Verification |
|---|------|--------------|
| 1 | Importer guard + test | `pnpm --filter @skillbrain/storage test` — new case proves `--reactivate` skips `SUPERSEDED_BY_PLUGIN` names and still restores others |
| 2 | Committed config: `enabledPlugins` in `.opencode/settings.json`, `AGENTS.md`, `CLAUDE.md`, bundle `planner`/`builder` | `.opencode/settings.json` parses; CI green on the PR |
| 3 | Per-machine: remove the 14 `.claude/skills/` symlinks, mirror agent edits into `.claude/agents/`, global `CLAUDE.md` exception line | Fresh Claude Code session in the repo: skill list has no unprefixed duplicates of the 14; `superpowers:*` present. Confirm first-open prompt behaviour for a user without the plugin (e.g. clean `CLAUDE_CONFIG_DIR`) |
| 4 | Merge and redeploy prod (bundle hash changes because agents changed, so the boot import re-runs) | Boot log shows a successful import; `agent_read({ name: "builder" })` shows the skill annotations; the 14 are still `active` (not yet touched) |
| 5 | Soft-delete the 14 in prod (admin `DELETE /api/skills/:name`) — **confirmed with the user immediately before running** | `skill_route({ task: "brainstorm a feature" })` returns none of the 14 |
| 6 | Same status update on local `.codegraph/graph.db` | `mcp__codegraph-local__skill_route` matches prod |

**Rollback:** each step reverses independently — `git revert` restores the committed docs and settings; recreating the symlinks restores the local mirror; setting `enabledPlugins` to `false` disables the plugin; removing a name from `SUPERSEDED_BY_PLUGIN` and running `import-skills --reactivate` restores its catalog row.
