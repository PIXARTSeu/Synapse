# Matt Pocock Skills — SkillBrain Integration

**Date:** 2026-09-14
**Status:** Draft — awaiting review
**Scope:** `packages/storage` (migration, importer, store), `packages/codegraph` (`skill_read` tool, `entrypoint.sh`, docs), `.agents/skills/` + `packages/codegraph/data/lifecycle-skills/` (17 vendored skills), `AGENTS.md`, `CLAUDE.md`; per-machine: global `~/.claude/CLAUDE.md`, local `.codegraph/graph.db`

---

## Overview

Bring 17 skills from [mattpocock/skills](https://github.com/mattpocock/skills) into the SkillBrain catalog, alongside the superpowers plugin adopted in `2026-09-14-superpowers-integration-design.md`. Seven of them depend on sibling files that SkillBrain cannot serve today, so the work has two parts:

1. **SkillBrain serves skill support files** — a platform capability that also repairs existing skills whose `references/` are unreachable.
2. **Import and wire the 17 skills** — vendored verbatim, attributed, routed from `AGENTS.md`.

Both parts ship in one branch; Part 2 depends on Part 1.

---

## 1. Current State

- `mattpocock/skills` (MIT, commit `3cca18b368ae95cdbdebbff572ccafa662551015`, plugin v1.2.3) contains 37 skills: 25 exposed by its Claude Code plugin, plus `misc/*` and `in-progress/*`. No name collides with the SkillBrain catalog.
- Seven of them overlap with superpowers: `tdd`, `diagnosing-bugs`, `code-review`, `implement`, `to-spec`, `prototype`, `writing-for-agents`.
- `skill_read` returns only the `content` column (the `SKILL.md` text). Sibling files are never imported. Existing skills that cite them are already broken over MCP: `ads` and `aso` cite `references/*.md`, and `hallmark` ships a `LICENSE`.
- The importer's `walkDir` finds `<name>/SKILL.md` or `<name>/AGENT.md` and passes only that path on.
- In the container, `entrypoint.sh` links the whole `/app/data/skill` directory. For process skills it creates `$DATA_DIR/.agents/skills/<name>/` and symlinks only `SKILL.md` into it, so even an importer that read sibling files would not see them in prod for that zone.
- Precedents for third-party packs are inconsistent. The marketing skills live only in `data/skill/`, so Codex cannot see them. `hallmark` and `taste-skill` have three copies.

---

## 2. Decisions

| Question | Decision |
|----------|----------|
| Coexistence with superpowers | Import only skills superpowers does not cover. |
| Issue-tracker flow | Included: `setup-matt-pocock-skills`, `to-tickets`, `triage`, `wayfinder`. |
| Distribution | SkillBrain catalog (not the `mattpocock-skills` plugin); SkillBrain gains support-file serving. |
| Environments | Prod and local both get the capability, the skills and verification. |

---

## 3. Design — Part 1: Support Files

### 3.1 Storage

New migration `packages/storage/src/migrations/037_skill_files.sql`:

```sql
CREATE TABLE IF NOT EXISTS skill_files (
  skill_name TEXT NOT NULL,
  path       TEXT NOT NULL,
  content    TEXT NOT NULL,
  bytes      INTEGER NOT NULL,
  PRIMARY KEY (skill_name, path)
);
```

- `path` is relative to the skill directory and uses `/` separators, e.g. `MISSION-FORMAT.md` or `references/apple-specs.md`.
- Migrations already run on every `openDb()`, so prod applies this on the next boot.
- `SkillsStore` gains:
  - `replaceFiles(skillName, files)`: delete that skill's rows, then insert the given set, in one transaction.
  - `listFiles(skillName)`: path and bytes, ordered by path.
  - `getFile(skillName, path)`: content, or undefined.

### 3.2 Importer

For every directory skill (`SKILL.md` or `AGENT.md` found inside `<name>/`), collect sibling files recursively:

- **Skip:**
  - the `SKILL.md` / `AGENT.md` itself
  - entries starting with `.`
  - files containing a NUL byte in their first 8 KB (binary)
  - any file over 256 KB
- **Per-skill cap:** stop collecting once the running total would exceed 2 MB, and log a warning naming the skill.
- Loose `.md` skills and commands have no support files.

**Symlinks.** `walkDir` currently recognises a skill directory with `Dirent.isDirectory()`, which is `false` for a symlink to a directory. Section 3.5 makes every prod lifecycle skill such a symlink, so without a fix every process skill would silently drop out of the prod import. Both `walkDir` and the support-file collector therefore follow symlinks: an entry counts as a directory, or a file, by its `fs.statSync` target.

Deduplication across zones keeps the skill that wins today (`.agents/skills/` over `.claude/skill/`), and that copy's files. After the skills upsert, every imported skill's file set is replaced, including an empty set, so a file deleted upstream disappears from the DB.

### 3.3 Security gate

- The gate scans a combined text: `SKILL.md`, then each support file prefixed with a `--- file: <path> ---` line.
- The stored `content` is still `SKILL.md` alone.
- A malicious support file (e.g. a `template.sh` piping curl into bash) therefore counts toward the BLOCK/CAUTION verdict.

### 3.4 `skill_read`

New optional parameter `file: string`.

- **Without `file`:** output as today. When the skill has support files, append:
  ```
  ## Supporting files
  - MISSION-FORMAT.md (2.1 KB)
  - ...
  Read one with skill_read({ name: "<name>", file: "<path>" }).
  ```
- **With `file`:** return that file's content under a `# <name> / <path>` heading.
- **Unknown path:** return `File "<path>" not found for skill "<name>".` plus the available list.
- **Lookup:** exact `(skill_name, path)` key match only. No filesystem access, so no traversal surface.
- **Telemetry:** `recordUsage(..., 'loaded')` fires only on the read without `file`.

### 3.5 Container entrypoint

In `run_import()`, link each lifecycle skill's whole directory instead of its `SKILL.md`:

```bash
for d in /app/data/lifecycle-skills/*/; do
  [ -d "$d" ] || continue
  name=$(basename "$d")
  rm -rf "$DATA_DIR/.agents/skills/$name"
  ln -sfn "${d%/}" "$DATA_DIR/.agents/skills/$name"
done
```

The `rm -rf` clears the directory created on earlier boots, which holds only a symlink. `$DATA_DIR` is the persistent volume.

### 3.6 Out of scope for Part 1

- Editing support files from the dashboard or `skill_update`.
- Versioning support files.
- Exposing them on `GET /api/skills/:name`.

Support files are bundle-managed and change only through import.

---

## 4. Design — Part 2: The 17 Skills

### 4.1 Selection

| Group | Skills |
|-------|--------|
| Interviewing | `grilling`, `grill-me`, `grill-with-docs`, `to-questionnaire`, `wait-what` |
| Design | `domain-modeling`, `codebase-design`, `improve-codebase-architecture` |
| Issue flow | `setup-matt-pocock-skills`, `to-tickets`, `triage`, `wayfinder` |
| Utilities | `research`, `teach`, `wizard`, `resolving-merge-conflicts`, `handoff` |

Not imported:

| Skill(s) | Reason |
|----------|--------|
| `tdd`, `diagnosing-bugs`, `code-review`, `implement`, `to-spec`, `prototype`, `writing-for-agents` | Covered by superpowers |
| `ask-matt` | Router over skills that are not imported; `skill_route` is the router |
| `misc/*` | Tied to Matt's courses and libraries (`scaffold-exercises`, `migrate-to-shoehorn`, …) |
| `in-progress/*` | Unstable upstream |

### 4.2 Placement

Each skill's whole upstream directory is copied verbatim, including support files and `agents/openai.yaml`, into two identical locations:

- `.agents/skills/<name>/`: read by Codex and by local imports.
- `packages/codegraph/data/lifecycle-skills/<name>/`: the prod bundle.

There is no copy in `packages/codegraph/data/skill/` and no symlink in `.claude/skills/`; Claude loads these skills through SkillBrain. The importer types them `process` (no name matches `isLifecycleSkill`).

### 4.3 Category

Add the 17 names to `CATEGORY_MAP` in `packages/storage/src/import-skills.ts` as `Process`. Otherwise `detectCategory` returns `Other`.

### 4.4 Attribution

`_ATTRIBUTION-mattpocock-skills.md` goes in both directories. The leading underscore keeps it out of the import. It contains:

- source URL, full commit SHA, import date and the full MIT license text
- the 17 imported skills and the excluded ones with reasons (§4.1)
- the cross-reference map. Upstream text is left verbatim; when an imported skill names an excluded one, use the local equivalent:

| Upstream name | Use instead |
|---------------|-------------|
| `implement` | `superpowers:executing-plans` or `superpowers:subagent-driven-development` |
| `tdd` | `superpowers:test-driven-development` |
| `to-spec` | `superpowers:brainstorming` (spec in `docs/superpowers/specs/`) |
| `prototype` | the spike path of `superpowers:brainstorming` |
| `code-review` | `superpowers:requesting-code-review` |
| `diagnosing-bugs` | `superpowers:systematic-debugging` |

### 4.5 Security gate

All 17 must import as `active` under the gate, which now scans support files too. If any receives BLOCK, stop and report it. MIT text is never edited to get past the gate.

### 4.6 Upstream updates

Manual: re-copy the directories from a newer upstream commit into both locations and update the SHA in both attribution files. No automation.

---

## 5. Design — Workflow Wiring

### 5.1 `AGENTS.md`

In "Workflow tecnico (Superpowers)", add a subsection **"Skill di Matt Pocock (da SkillBrain)"**:

| Quando | Skill |
|---|---|
| Mettere sotto pressione un piano o una decisione ("grill me") | `grilling`, `grill-me`; `grill-with-docs` se deve produrre `CONTEXT.md` e ADR |
| Brainstorming architectural: termini di dominio, `CONTEXT.md`, ADR | `domain-modeling` |
| Brainstorming architectural: interfaccia di un modulo | `codebase-design` |
| REFACTOR senza un punto preciso da cui partire | `improve-codebase-architecture` |
| Piano che supera una sessione o va diviso tra persone | dopo `writing-plans`: `to-tickets`; lavoro enorme e ancora da definire: `wayfinder` |
| Issue o PR in arrivo | `triage` |
| Primo uso del flusso issue in un repo | `setup-matt-pocock-skills` (una volta) |
| Utilità | `research`, `teach`, `to-questionnaire`, `wait-what`, `wizard`, `resolving-merge-conflicts`, `handoff` |

Followed by three rules:

- These skills load with `skill_read`; their support files with `skill_read({ name, file })`.
- `grilling` complements `brainstorming` and never replaces its approval gate.
- When one of these skills names an excluded upstream skill, use the superpowers equivalent (the §4.4 map).

The Fase 4 `REFACTOR` row gains `improve-codebase-architecture` as an optional first step before `superpowers:brainstorming`.

### 5.2 `CLAUDE.md`

- **"Superpowers (process skills)":** state that the 17 Matt Pocock skills live in the SkillBrain catalog, and that the `mattpocock-skills` plugin must not be installed because it duplicates superpowers' process skills.
- **"Adding a Skill":** one line saying files next to `SKILL.md` are imported as support files and served by `skill_read({ name, file })`.

### 5.3 `packages/codegraph/docs/DEPLOY-SKILLS.md`

Document which files become support files and the size limits (§3.2), and the whole-directory linking in the entrypoint (§3.5).

### 5.4 Global `~/.claude/CLAUDE.md` (per machine)

Next to the `skill_read` example in "Skills come ONLY from SkillBrain", add a line on reading support files with `file`.

---

## 6. Out of Scope

- Running `setup-matt-pocock-skills` on the Synapse repo. It is interactive and writes `docs/agents/`, so it runs on first use of the issue flow.
- Installing the `mattpocock-skills` plugin.
- Consolidating the existing `hallmark` / `taste-skill` triple copies.

---

## 7. Rollout and Verification

| # | Step | Verification |
|---|------|--------------|
| 1 | Part 1 code (migration, store, importer, gate, `skill_read`, entrypoint) with tests | `pnpm --filter @skillbrain/storage test` and codegraph tests green. New cases cover: support files stored with limits and exclusions; file set replaced on re-import; gate verdict from a malicious support file; `skill_read` lists, reads and rejects an unknown path |
| 2 | Part 2: vendor the 17 skills, attribution, `CATEGORY_MAP` | Import into a scratch workspace copy: all 17 `active`, category `Process`; besides `agents/openai.yaml`, `teach` has 4 support files and `setup-matt-pocock-skills` has 5 |
| 3 | Wiring: `AGENTS.md`, `CLAUDE.md`, `DEPLOY-SKILLS.md` | Grep checks for the new subsection and lines |
| 4 | PR, CI green, merge | CI `build-and-test` pass |
| 5 | Prod: Coolify redeploy (user) | `skill_read("teach")` lists support files; `skill_read({ name: "teach", file: "MISSION-FORMAT.md" })` returns it; `skill_read("aso")` lists `references/`; `skill_route` for "grill me on this plan", "set up the issue tracker for the skills", "design the module interface" surfaces the matching skills; none of the 17 is `pending` |
| 6 | Local: `git pull`, rebuild skill-guard/storage/codegraph, `import-skills .`, user reconnects `codegraph-local` via `/mcp`, global `CLAUDE.md` line | The step 5 checks via `mcp__codegraph-local__*` with `repo: "Synapse"` |

**Rollback:**
- Revert the PR. The `skill_files` table can stay, since nothing else reads it.
- The entrypoint's directory links are recreated on every boot.
- Deleting the 17 directories and running `import-skills --full` deprecates their rows.
