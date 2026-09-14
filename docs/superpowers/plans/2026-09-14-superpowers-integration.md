# Superpowers Team Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the superpowers plugin the team's single source for the 14 process skills in Claude Code, wired into Smart Intake and the @planner/@builder prompts, with the old forks retired from SkillBrain routing but kept on disk for Codex.

**Architecture:** Plugin enabled in the tracked project settings; an importer guard (`SUPERSEDED_BY_PLUGIN`) stops `--reactivate` from resurrecting the retired forks; team docs (`AGENTS.md`, `CLAUDE.md`) and bundled agent prompts point at `superpowers:*`; per-machine mirrors and the SkillBrain catalogs (prod, then local) are cleaned up last, with explicit user confirmation for prod.

**Tech Stack:** TypeScript + Vitest (`@skillbrain/storage`), better-sqlite3, pnpm workspace, Claude Code plugin settings, SkillBrain HTTP API.

**Spec:** `docs/superpowers/specs/2026-09-14-superpowers-integration-design.md`

## Global Constraints

- Base branch: `origin/main` (local `main` is stale). Work branch: `feat/superpowers-integration`, in a worktree under `.worktrees/` (already gitignored).
- The main checkout is on `fix/skill-catalog-recovery` with an uncommitted edit to `packages/storage/src/import-skills.ts`. Never modify, stash or commit that edit.
- Plugin id, verbatim: `superpowers@claude-plugins-official`.
- The 14 superseded skill names, verbatim: `brainstorming`, `dispatching-parallel-agents`, `executing-plans`, `finishing-a-development-branch`, `receiving-code-review`, `requesting-code-review`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `using-git-worktrees`, `using-superpowers`, `verification-before-completion`, `writing-plans`, `writing-skills`.
- Do not modify anything under `.agents/skills/` or `packages/codegraph/data/lifecycle-skills/` — Codex still reads those.
- Match each file's language: `AGENTS.md` and agent prompts in Italian; `CLAUDE.md`, `DEPLOY-SKILLS.md` and code comments in English.
- TypeScript strict: no `as any`, `@ts-ignore`, `@ts-expect-error`.
- Prod actions (redeploy, `DELETE /api/skills/:name`) run only after the user explicitly confirms them in the conversation at that moment.
- Every commit message ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

**Paths:** shell state does not persist between commands, so start every shell command with:

```bash
MAIN="/Users/dan/Desktop/Progetti/progetti-web/MASTER_Fullstack session"; WT="$MAIN/.worktrees/superpowers-integration"
```

The plan file itself moves into `$WT` in Task 1 Step 1; read it from `$WT/docs/superpowers/plans/` afterwards.

---

### Task 1: Importer guard — `--reactivate` skips plugin-superseded skills

**Files:**
- Move in: `$MAIN/docs/superpowers/specs/2026-09-14-superpowers-integration-design.md` → `$WT/docs/superpowers/specs/`
- Move in: `$MAIN/docs/superpowers/plans/2026-09-14-superpowers-integration.md` → `$WT/docs/superpowers/plans/`
- Modify: `$WT/packages/storage/src/import-skills.ts` (constants block before `export async function importSkills`, and the `if (opts.reactivate)` block)
- Modify: `$WT/packages/codegraph/docs/DEPLOY-SKILLS.md` (section "4. Recovering from a bad prune")
- Test: `$WT/packages/storage/tests/import-skills.test.ts`

**Interfaces:**
- Consumes: `importSkills(workspacePath: string, opts?: ImportSkillsOptions): Promise<{ skills: number; agents: number; commands: number; pruned: number; reactivated: number; blocked: number }>` (existing).
- Produces: `export const SUPERSEDED_BY_PLUGIN: ReadonlySet<string>` in `packages/storage/src/import-skills.ts`. Task 2's `CLAUDE.md` text refers to this name.

- [ ] **Step 1: Create the worktree and commit the design docs**

```bash
cd "$MAIN"
git fetch origin
git worktree add .worktrees/superpowers-integration -b feat/superpowers-integration origin/main
mkdir -p "$WT/docs/superpowers/specs" "$WT/docs/superpowers/plans"
mv "$MAIN/docs/superpowers/specs/2026-09-14-superpowers-integration-design.md" "$WT/docs/superpowers/specs/"
mv "$MAIN/docs/superpowers/plans/2026-09-14-superpowers-integration.md" "$WT/docs/superpowers/plans/"
cd "$WT"
pnpm install --frozen-lockfile
pnpm --filter @skillbrain/skill-guard build
git add docs/superpowers/specs/2026-09-14-superpowers-integration-design.md docs/superpowers/plans/2026-09-14-superpowers-integration.md
git commit -m "docs(superpowers): team integration design and implementation plan

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Expected: worktree created on `feat/superpowers-integration`; one commit with the two docs.

- [ ] **Step 2: Write the failing test**

In `packages/storage/tests/import-skills.test.ts`, change the import line:

```ts
import { importSkills, SUPERSEDED_BY_PLUGIN } from '../src/import-skills.js'
```

Add this test immediately after the existing `'--reactivate restores bundled deprecated skills but leaves retired and pending ones alone'` test:

```ts
  // The superpowers forks stay on disk for Codex but are retired from SkillBrain —
  // Claude Code gets them from the plugin. A recovery run must not bring them back.
  it('--reactivate leaves skills superseded by the superpowers plugin deprecated', async () => {
    const workspace = makeWorkspace()
    const writeSkill = (zone: string, name: string) => {
      const dir = path.join(workspace, zone, name)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: desc ${name}\n---\n# ${name}\n`)
    }
    writeSkill(path.join('.agents', 'skills'), 'brainstorming')
    writeSkill(path.join('.claude', 'skill'), 'still-bundled')
    await importSkills(workspace)

    const dbPath = path.join(workspace, '.codegraph', 'graph.db')
    const seed = new Database(dbPath)
    seed.prepare("UPDATE skills SET status = 'deprecated' WHERE name IN ('brainstorming', 'still-bundled')").run()
    seed.close()

    const result = await importSkills(workspace, { reactivate: true })
    expect(result.reactivated).toBe(1)

    const db = new Database(dbPath)
    try {
      const status = (n: string) => (db.prepare('SELECT status AS s FROM skills WHERE name = ?').get(n) as { s: string }).s
      expect(SUPERSEDED_BY_PLUGIN.has('brainstorming')).toBe(true)
      expect(status('brainstorming')).toBe('deprecated')   // superseded → stays retired
      expect(status('still-bundled')).toBe('active')       // ordinary recovery still works
    } finally {
      db.close()
    }
  })
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd "$WT" && pnpm --filter @skillbrain/storage exec vitest run tests/import-skills.test.ts -t "superseded by the superpowers plugin"`
Expected: FAIL — `expected 2 to be 1` (both deprecated skills are reactivated today).

- [ ] **Step 4: Add the constant**

In `packages/storage/src/import-skills.ts`, insert directly after the `const PRUNE_GUARD_MIN_SKILLS = 10` declaration and before `export async function importSkills(`:

```ts

/**
 * Process skills whose Claude Code copy now ships as the superpowers plugin
 * (`superpowers:<name>`). Their SkillBrain rows are deprecated on purpose so
 * routing stops suggesting the stale forks, but the files stay in
 * `.agents/skills/` for Codex — so they are always "present in the bundle".
 * `--reactivate` must skip them, or a recovery run would silently resurrect
 * the forks. See docs/superpowers/specs/2026-09-14-superpowers-integration-design.md.
 */
export const SUPERSEDED_BY_PLUGIN: ReadonlySet<string> = new Set([
  'brainstorming',
  'dispatching-parallel-agents',
  'executing-plans',
  'finishing-a-development-branch',
  'receiving-code-review',
  'requesting-code-review',
  'subagent-driven-development',
  'systematic-debugging',
  'test-driven-development',
  'using-git-worktrees',
  'using-superpowers',
  'verification-before-completion',
  'writing-plans',
  'writing-skills',
])
```

- [ ] **Step 5: Skip the constant's names in the reactivate step**

Replace this block:

```ts
  if (opts.reactivate) {
    const names = deduped.map((s) => s.name)
```

with:

```ts
  if (opts.reactivate) {
    const names = deduped.map((s) => s.name).filter((n) => !SUPERSEDED_BY_PLUGIN.has(n))
    const superseded = deduped.length - names.length
```

and, in the same block, replace:

```ts
    console.warn(`[import-skills] --reactivate: restored ${reactivated} deprecated skill(s) present in the bundle back to active.`)
  }
```

with:

```ts
    console.warn(`[import-skills] --reactivate: restored ${reactivated} deprecated skill(s) present in the bundle back to active.`)
    if (superseded > 0) {
      console.warn(`[import-skills] --reactivate: left ${superseded} plugin-superseded skill(s) untouched (SUPERSEDED_BY_PLUGIN).`)
    }
  }
```

- [ ] **Step 6: Run the new test and the whole storage suite**

Run: `cd "$WT" && pnpm --filter @skillbrain/storage exec vitest run tests/import-skills.test.ts -t "superseded by the superpowers plugin"`
Expected: PASS.

Run: `cd "$WT" && pnpm --filter @skillbrain/storage build && pnpm --filter @skillbrain/storage test`
Expected: build succeeds; all tests PASS, including the existing `--reactivate restores bundled deprecated skills…` test.

- [ ] **Step 7: Document the guard in DEPLOY-SKILLS.md**

In `packages/codegraph/docs/DEPLOY-SKILLS.md`, section "### 4. Recovering from a bad prune → `--reactivate`", insert after the paragraph that ends "Recovery is always an explicit step.":

```markdown

**Plugin-superseded skills are never reactivated.** The 14 superpowers process
skills listed in `SUPERSEDED_BY_PLUGIN` (`packages/storage/src/import-skills.ts`)
stay in the bundle for Codex but are deprecated on purpose — Claude Code gets
them from the superpowers plugin. `--reactivate` skips them and logs how many it
left untouched. To bring one back, remove it from that list first.
```

- [ ] **Step 8: Commit**

```bash
cd "$WT"
git add packages/storage/src/import-skills.ts packages/storage/tests/import-skills.test.ts packages/codegraph/docs/DEPLOY-SKILLS.md
git commit -m "fix(import): keep plugin-superseded process skills out of --reactivate

The 14 superpowers process skills stay in .agents/skills/ for Codex but are
retired from SkillBrain routing, since Claude Code now loads them from the
superpowers plugin. --reactivate restores every deprecated skill present in
the bundle, which would silently resurrect those forks.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Enable the plugin for the team and document the skill-source rule

**Files:**
- Modify: `$WT/.opencode/settings.json` (whole file — it is what Claude Code reads as `.claude/settings.json`)
- Modify: `$WT/CLAUDE.md` (Agent Routing row "Fix / debug"; new section before `## Codex Integration (second-opinion runtime)`)

**Interfaces:**
- Consumes: `SUPERSEDED_BY_PLUGIN` (Task 1) — referenced by name in `CLAUDE.md`.
- Produces: `CLAUDE.md` section heading `## Superpowers (process skills)`; Task 3 does not depend on it textually.

- [ ] **Step 1: Enable the plugin in project settings**

Replace the whole content of `.opencode/settings.json` with:

```json
{
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true
  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/scripts/load_project_context.sh",
            "timeout": 15,
            "statusMessage": "Loading SkillBrain Cortex briefing"
          },
          {
            "type": "command",
            "command": "bash .claude/scripts/project_autodetect.sh",
            "timeout": 5,
            "statusMessage": "Checking projects registry"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Skill",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/scripts/skill-apply-hook.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Verify the settings file**

Run: `cd "$WT" && git diff --stat .opencode/settings.json && node -e "const s=JSON.parse(require('fs').readFileSync('.opencode/settings.json','utf8')); console.log(s.enabledPlugins, Object.keys(s.hooks))"`
Expected: `.opencode/settings.json | 3 +++` (only additions) and `{ 'superpowers@claude-plugins-official': true } [ 'SessionStart', 'PostToolUse' ]`.

- [ ] **Step 3: Update the Agent Routing row in CLAUDE.md**

Replace:

```markdown
| Fix / debug | @builder | (direct, or systematic-debugging skill) |
```

with:

```markdown
| Fix / debug | @builder | `superpowers:systematic-debugging` first, then domain skills |
```

- [ ] **Step 4: Add the Superpowers section to CLAUDE.md**

Insert immediately before the line `## Codex Integration (second-opinion runtime)`:

```markdown
## Superpowers (process skills)

The team's engineering process comes from the [superpowers](https://github.com/obra/superpowers) plugin, enabled for this repo in `.opencode/settings.json` (read by Claude Code as `.claude/settings.json`).

| Skills | Source | How to load |
|--------|--------|-------------|
| 14 process skills: `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `systematic-debugging`, `test-driven-development`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `using-git-worktrees`, `finishing-a-development-branch`, `writing-skills`, `using-superpowers` | superpowers plugin | `Skill` tool, as `superpowers:<skill>` |
| Every other skill (domain, marketing, design, …) | SkillBrain | `skill_route` / `skill_read` |

This is the one exception to "skills come only from SkillBrain". The old forks of the 14 skills stay in `.agents/skills/` for Codex only; they are deprecated in the SkillBrain catalog and listed in `SUPERSEDED_BY_PLUGIN` (`packages/storage/src/import-skills.ts`), so `import-skills --reactivate` never restores them.

- **Plugin not installed?** Run `/plugin install superpowers@claude-plugins-official`.
- **Local `.claude/skills/` mirror?** Remove the symlinks for the 14 names above, or Claude sees two versions of each.
- **After `finishing-a-development-branch`:** call `memory_suggest`, as the SkillBrain protocol requires.
- How it fits Smart Intake and the Iron Rules: `AGENTS.md` → "Workflow tecnico (Superpowers)". Design: `docs/superpowers/specs/2026-09-14-superpowers-integration-design.md`.

---

```

- [ ] **Step 5: Verify CLAUDE.md**

Run: `cd "$WT" && grep -n -E "^## Superpowers \(process skills\)|^## Codex Integration|superpowers:systematic-debugging\` first" CLAUDE.md`
Expected: three matches, with the `## Superpowers` line number lower than `## Codex Integration`.

- [ ] **Step 6: Commit**

```bash
cd "$WT"
git add .opencode/settings.json CLAUDE.md
git commit -m "feat(workflow): enable superpowers plugin for the team

Enable superpowers@claude-plugins-official in the tracked project settings and
document the one exception to 'skills come only from SkillBrain': the 14
process skills load from the plugin via the Skill tool.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire superpowers into Smart Intake and the bundled agent prompts

**Files:**
- Modify: `$WT/AGENTS.md` (Fase 0 table end, Fase 3 brief, Fase 4 table, new section before `## REGOLA FERREA: Protocollo Form`)
- Modify: `$WT/packages/codegraph/data/agents/builder/AGENT.md` (`## Workflow`, `## Regole Ferree`)
- Modify: `$WT/packages/codegraph/data/agents/planner/AGENT.md` (`## Regole`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `AGENTS.md` heading `## Workflow tecnico (Superpowers)`, referenced by `CLAUDE.md` (Task 2) and by the builder prompt below. Task 4 applies the identical agent-prompt edits to the per-machine mirror.

- [ ] **Step 1: Fase 0 — state that the two classifications add up**

In `AGENTS.md`, replace:

```markdown
| "gdpr", "privacy", "cookie policy", "legal" | `COMPLIANCE` | MEDIO | NO |

### Fase 1: Estrai Info dal Messaggio (silenzioso)
```

with:

```markdown
| "gdpr", "privacy", "cookie policy", "legal" | `COMPLIANCE` | MEDIO | NO |

> Fase 0 sceglie il **workflow** in base al tipo di richiesta. Per il lavoro di codice, `superpowers:brainstorming` classifica poi **quanto processo** serve (spike / bounded / architectural): le due classificazioni si sommano, non si sostituiscono.

### Fase 1: Estrai Info dal Messaggio (silenzioso)
```

- [ ] **Step 2: Fase 3 — the brief feeds brainstorming**

Replace:

````markdown
Confermo e parto?
```

### Fase 4: Esecuzione
````

with:

````markdown
Confermo e parto?
```

Per task tecnici il brief confermato è l'input di `superpowers:brainstorming`, che non richiede ciò che il brief contiene già.

### Fase 4: Esecuzione
````

- [ ] **Step 3: Fase 4 — route code work through superpowers**

Replace these three rows (leave every other row unchanged):

```markdown
| COMPONENTE | subagent component-builder |
```
```markdown
| FIX | risolvi direttamente |
```
```markdown
| REFACTOR | codegraph_impact → poi procedi |
```

with, respectively:

```markdown
| COMPONENTE | `superpowers:brainstorming` → `superpowers:subagent-driven-development` (implementer con prompt component-builder) |
```
```markdown
| FIX | `superpowers:systematic-debugging` |
```
```markdown
| REFACTOR | codegraph_impact → `superpowers:brainstorming` → `superpowers:subagent-driven-development` |
```

- [ ] **Step 4: Add the "Workflow tecnico" section**

Insert immediately before the line `## REGOLA FERREA: Protocollo Form`:

````markdown
## Workflow tecnico (Superpowers)

Per tutto il lavoro di codice (FIX, COMPONENTE, REFACTOR, feature) il *come* è governato dalle skill del plugin **superpowers**, caricate con il tool `Skill` come `superpowers:<skill>`. Design: `docs/superpowers/specs/2026-09-14-superpowers-integration-design.md`.

```
brainstorming ─┬─ spike ─────────► risposta / raccomandazione
               ├─ bounded ───────► design in chat → implementazione (TDD)
               └─ architectural ─► spec → writing-plans → subagent-driven-development
                                                                   │
FIX → systematic-debugging ────────────────────────────────────────┤
                                                                   ▼
        verification-before-completion → requesting-code-review → finishing-a-development-branch
```

**Il flusso gira nella sessione principale.** brainstorming è un dialogo con l'utente, e i subagent implementer/reviewer non possono lanciare altri subagent. @planner, @builder e gli specialisti sono prompt SkillBrain (`agent_read`) che la sessione principale usa, non orchestratori.

### Regole Ferree dentro le fasi superpowers

| Regola Ferrea | Dove si applica |
|---|---|
| Code Intelligence (`codegraph_impact`, `codegraph_context`) | brainstorming → esplorazione del contesto |
| Protocollo Form | brainstorming → domande di chiarimento |
| ESLint Auto-Fix + `codegraph_detect_changes` | verification-before-completion, prima del commit |
| Delegation (regola 2) | subagent-driven-development: l'implementer è un subagent `general-purpose` il cui prompt include `agent_read({ name: "<specialista>" })` e le skill di dominio da `skill_read` |

### Dove finiscono spec e piani

- Spec: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- Piani: `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`
- Progetti client: stessi percorsi dentro `Progetti/<slug>/`
- `docs/plans/` è archivio: non aggiungere nuovi file lì.

---

````

- [ ] **Step 5: Annotate the builder prompt**

In `packages/codegraph/data/agents/builder/AGENT.md`, replace:

```markdown
1. **ANALIZZA** — Leggi il brief, decomponilo in task atomici
2. **PIANIFICA** — Ordine di esecuzione, dipendenze tra task
3. **DELEGA** — Lancia agenti specializzati (parallelo quando possibile)
4. **VERIFICA** — Controlla ogni output prima di passare al task successivo
5. **CONSEGNA** — Codice funzionante, testato, deployato
```

with:

```markdown
1. **ANALIZZA** — Leggi il brief, decomponilo in task atomici
2. **PIANIFICA** — Ordine di esecuzione, dipendenze tra task → `superpowers:writing-plans`
3. **DELEGA** — Lancia agenti specializzati (parallelo quando possibile) → `superpowers:subagent-driven-development`
4. **VERIFICA** — Controlla ogni output prima di passare al task successivo → `superpowers:test-driven-development` + `superpowers:verification-before-completion`
5. **CONSEGNA** — Codice funzionante, testato, deployato → `superpowers:requesting-code-review` + `superpowers:finishing-a-development-branch`

Il flusso superpowers gira nella sessione principale: vedi `AGENTS.md` → "Workflow tecnico (Superpowers)".
```

and replace:

```markdown
6. **Form Protocol** — Prima di implementare qualsiasi form, chiedi dove inviare i dati
```

with:

```markdown
6. **Form Protocol** — Prima di implementare qualsiasi form, chiedi dove inviare i dati
7. **Debug sistematico** — Ogni bug passa da `superpowers:systematic-debugging`: prima la root cause, poi il fix
```

- [ ] **Step 6: Annotate the planner prompt**

In `packages/codegraph/data/agents/planner/AGENT.md`, replace:

```markdown
4. **Parallela gli agenti** — Lancia ux-designer, growth-architect etc. in parallelo
```

with:

```markdown
4. **Parallela gli agenti** — Lancia ux-designer, growth-architect etc. in parallelo
5. **Lavoro tecnico** — Per feature, refactor e architettura raccogli e sintetizza informazioni per la sessione principale: il dialogo `superpowers:brainstorming`, lo spec e il piano (`superpowers:writing-plans`) li scrive la sessione principale, non @planner
```

- [ ] **Step 7: Verify**

Run:

```bash
cd "$WT"
grep -c "superpowers:" AGENTS.md
grep -n -E "^## Workflow tecnico \(Superpowers\)|^## REGOLA FERREA: Protocollo Form" AGENTS.md
grep -c "superpowers:" packages/codegraph/data/agents/builder/AGENT.md packages/codegraph/data/agents/planner/AGENT.md
git diff --stat
```

Expected (`grep -c` counts matching lines): `AGENTS.md` ≥ 6; `## Workflow tecnico` line number lower than `## REGOLA FERREA: Protocollo Form`; `builder/AGENT.md:5`, `planner/AGENT.md:1`; diff touches exactly the three files of this task.

- [ ] **Step 8: Commit**

```bash
cd "$WT"
git add AGENTS.md packages/codegraph/data/agents/builder/AGENT.md packages/codegraph/data/agents/planner/AGENT.md
git commit -m "docs(workflow): route code work through superpowers in Smart Intake

Smart Intake keeps deciding what to build; superpowers governs how code work
is done. FIX goes through systematic-debugging, COMPONENTE and REFACTOR through
brainstorming and subagent-driven-development, and the Iron Rules are mapped
onto the superpowers phases. The builder and planner prompts point at the
matching skills.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Per-machine cleanup (not committed)

Runs in the **main checkout** (`$MAIN`), because `.claude` there is a per-machine symlink to `.opencode/` and these paths are gitignored.

**Files:**
- Delete (symlinks only): `$MAIN/.claude/skills/<name>` for the 14 names
- Modify: `$MAIN/.claude/agents/builder/AGENT.md`, `$MAIN/.claude/agents/planner/AGENT.md` (same body edits as Task 3 Steps 5–6; these copies have no `tools:` frontmatter — leave frontmatter as is)
- Modify: `/Users/dan/.claude/CLAUDE.md` (user's private global instructions)

**Interfaces:**
- Consumes: the exact replacement text from Task 3 Steps 5 and 6.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Remove the 14 mirror symlinks**

```bash
cd "$MAIN"
for s in brainstorming dispatching-parallel-agents executing-plans finishing-a-development-branch receiving-code-review requesting-code-review subagent-driven-development systematic-debugging test-driven-development using-git-worktrees using-superpowers verification-before-completion writing-plans writing-skills; do
  if [ -L ".claude/skills/$s" ]; then rm ".claude/skills/$s" && echo "removed $s"; else echo "skip $s (not a symlink)"; fi
done
ls -d .agents/skills/brainstorming .agents/skills/writing-plans
```

Expected: 14 `removed` lines; the two `.agents/skills/` directories still listed.

- [ ] **Step 2: Mirror the agent-prompt edits**

Apply to `$MAIN/.claude/agents/builder/AGENT.md` exactly the two replacements of Task 3 Step 5, and to `$MAIN/.claude/agents/planner/AGENT.md` exactly the replacement of Task 3 Step 6.

Run:

```bash
cd "$MAIN"
strip_tools() { awk '/^tools:/{skip=1; next} skip && /^  - /{next} {skip=0; print}' "$1"; }
for a in builder planner; do
  diff <(strip_tools "$WT/packages/codegraph/data/agents/$a/AGENT.md") ".claude/agents/$a/AGENT.md" && echo "$a: mirror matches bundle"
done
```

Expected: `builder: mirror matches bundle` and `planner: mirror matches bundle`, no diff lines (the mirror equals the bundle apart from the `tools:` list).

- [ ] **Step 3: Add the exception to the global CLAUDE.md**

In `/Users/dan/.claude/CLAUDE.md`, insert after the paragraph beginning `**Why:** Skills live on the SkillBrain server (memory.fl1.it)`:

```markdown

**Exception — superpowers process skills.** The 14 process skills (`brainstorming`, `writing-plans`, `systematic-debugging`, `test-driven-development`, `verification-before-completion`, …) come from the superpowers Claude Code plugin and load with the `Skill` tool as `superpowers:<skill>`. SkillBrain remains the only source for every other skill.
```

- [ ] **Step 4: Manual check in a fresh session (user)**

Ask the user to:
1. Open a new Claude Code session in `$MAIN` and confirm the skill list has `superpowers:brainstorming` etc. and no unprefixed `brainstorming` / `writing-plans`.
2. Simulate a teammate: create the per-machine link a teammate has (`ln -s .opencode "$WT/.claude"` — gitignored, so it never gets committed), then open `$WT` with a clean config, `CLAUDE_CONFIG_DIR="$(mktemp -d)" claude`, trust the folder, and report whether Claude Code offers to install `superpowers@claude-plugins-official`.

Expected: (1) no duplicates; (2) install is offered. If (2) does not happen, stop and report — `CLAUDE.md`'s install command is then the only onboarding path and the spec §3.1 note must say so.

---

### Task 5: Merge, redeploy, retire the forks from the catalogs

Every step marked **(confirm)** needs an explicit "yes" from the user at that moment.

**Files:**
- No repo files. Targets: SkillBrain prod (`https://memory.fl1.it`), local `$MAIN/.codegraph/graph.db`.

**Interfaces:**
- Consumes: `SUPERSEDED_BY_PLUGIN` merged and deployed (Task 1); agent bundle changes (Task 3).
- Produces: nothing.

- [ ] **Step 1: Open the PR**

Use `superpowers:finishing-a-development-branch` → push `feat/superpowers-integration` and open a PR against `main` whose body summarises Tasks 1–3, links the spec, and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
Expected: CI (`.github/workflows/ci.yml`: build, `tsc --noEmit`, codegraph/storage/skill-guard tests) green.

- [ ] **Step 2: Baseline prod routing**

Run MCP: `mcp__codegraph__skill_route({ task: "brainstorm and design a new feature before implementing" })`
Record whether any of the 14 names appear (expected today: yes, e.g. `brainstorming`).

- [ ] **Step 3: (confirm) Merge and redeploy**

The user merges the PR and triggers the Coolify redeploy of the SkillBrain service. Then verify:
- MCP `mcp__codegraph__agent_read({ name: "builder" })` contains `superpowers:writing-plans`.
- MCP `mcp__codegraph__skill_read({ name: "brainstorming" })` still returns the fork (still active — nothing retired yet).

- [ ] **Step 4: (confirm) Soft-delete the 14 in prod**

The user provides an admin dashboard session token by setting it in their own shell (`export SB_DASHBOARD_TOKEN=…`, value of the `sb_session` cookie after an admin login at `https://memory.fl1.it`). Never write the token to a file. Then:

```bash
for s in brainstorming dispatching-parallel-agents executing-plans finishing-a-development-branch receiving-code-review requesting-code-review subagent-driven-development systematic-debugging test-driven-development using-git-worktrees using-superpowers verification-before-completion writing-plans writing-skills; do
  printf '%-32s ' "$s"
  curl -s -o /dev/null -w '%{http_code}\n' -X DELETE "https://memory.fl1.it/api/skills/$s" -H "x-dashboard-token: $SB_DASHBOARD_TOKEN"
done
```

Expected: 14 lines ending in `200`. Any `401`/`403`: stop, token is missing or not admin. Any `404`: report the name — it was never in prod.

- [ ] **Step 5: Verify prod routing**

Run MCP: `mcp__codegraph__skill_route({ task: "brainstorm and design a new feature before implementing" })`
Expected: none of the 14 names. Run `mcp__codegraph__skill_stats({})` and confirm no low-active-catalog warning banner.

- [ ] **Step 6: Retire the forks in the local catalog**

```bash
sqlite3 "$MAIN/.codegraph/graph.db" "UPDATE skills SET status = 'deprecated', updated_at = datetime('now') WHERE status = 'active' AND name IN ('brainstorming','dispatching-parallel-agents','executing-plans','finishing-a-development-branch','receiving-code-review','requesting-code-review','subagent-driven-development','systematic-debugging','test-driven-development','using-git-worktrees','using-superpowers','verification-before-completion','writing-plans','writing-skills'); SELECT changes();"
```

Expected: `14`.

Run MCP: `mcp__codegraph-local__skill_route({ task: "brainstorm and design a new feature before implementing", repo: "Synapse" })`
Expected: none of the 14 names.

- [ ] **Step 7: Close out**

Remove the worktree only after the PR is merged: `cd "$MAIN" && git worktree remove .worktrees/superpowers-integration` (if it refuses because of untracked files, stop and list them — never `--force`). Then call `memory_suggest` with the outcome and propose memory candidates to the user.
