# Frontend & Marketing Multi-Agent System v3.0

Sistema multi-agente per sviluppo frontend professionale e marketing digitale.

> SkillBrain protocol (sessions, memories, skills, credentials) is in Global CLAUDE.md.
> Project architecture, stack, agents, deploy is in Project CLAUDE.md.
> This file: Smart Intake + Iron Rules + Delegation Map.

---

## SMART INTAKE PROTOCOL

**Prima di eseguire qualsiasi richiesta, segui questo protocollo.**

### Fase 0: Classifica (silenzioso, automatico)

| Segnali nel messaggio | Tipo | Complessità | Brief? |
|---|---|---|---|
| "landing page", "sito", "website", "homepage" | `NUOVO_SITO` | COMPLESSO | SI |
| "conversione", "funnel", "CRO", "lead gen" | `MARKETING` | COMPLESSO | SI |
| "setup", "scaffold", "nuovo progetto" | `SETUP_PROGETTO` | COMPLESSO | SI |
| "design", "mockup", "wireframe", "UI" | `DESIGN` | MEDIO | SI |
| "componente", "implementa", "feature", "form" | `COMPONENTE` | SEMPLICE | NO |
| "audit", "controlla", "performance", "SEO" | `AUDIT` | SEMPLICE | NO |
| "clona", "analizza", "competitor" | `ANALISI` | MEDIO | NO |
| "fix", "bug", "errore", "non funziona" | `FIX` | SEMPLICE | NO |
| "refactor", "rinomina", "sposta", "split" | `REFACTOR` | MEDIO | NO |
| "video", "remotion", "clip", "social" | `VIDEO` | MEDIO | SI |
| "cms", "payload", "collection", "tenant" | `CMS` | MEDIO | NO |
| "nuovo cliente", "client", "sito per" | `CLIENT` | COMPLESSO | SI |
| "n8n", "workflow", "automazione" | `AUTOMATION` | MEDIO | NO |
| "gdpr", "privacy", "cookie policy", "legal" | `COMPLIANCE` | MEDIO | NO |

> Fase 0 sceglie il **workflow** in base al tipo di richiesta. Per il lavoro di codice, `superpowers:brainstorming` classifica poi **quanto processo** serve (spike / bounded / architectural): le due classificazioni si sommano, non si sostituiscono.

### Fase 1: Estrai Info dal Messaggio (silenzioso)

Scansiona ed estrai: **target**, **prodotto**, **goal**, **esiste** (sito/brand/repo?), **tono**, **vincoli**.

### Fase 2: Gap Analysis — Chiedi Solo il Mancante

**Task COMPLESSI** — chiedi solo campi mancanti, max 3 domande:

| Campo | NUOVO_SITO | MARKETING | CLIENT |
|---|---|---|---|
| target | Chi è il cliente finale | Chi convertire | Nome azienda |
| prodotto | Cosa promuovi | Cosa ottimizzare | Tipo attività |
| goal | Lead/demo/vendita | KPI target | Obiettivi sito |

**Task SEMPLICI** — parti diretto se hai cosa + dove.

### Fase 3: Brief (solo COMPLESSI)

```
BRIEF COMPILATO:
  Tipo:      [classificazione]
  Target:    [chi]
  Prodotto:  [cosa]
  Goal:      [obiettivo]
  Workflow:  [quale comando/flusso]
Confermo e parto?
```

Per task tecnici il brief confermato è l'input di `superpowers:brainstorming`, che non richiede ciò che il brief contiene già.

### Fase 4: Esecuzione

| Tipo | Workflow |
|------|----------|
| NUOVO_SITO | `/frontend` |
| MARKETING | `/marketing` |
| SETUP_PROGETTO | subagent project-architect |
| COMPONENTE | `superpowers:brainstorming` → `superpowers:subagent-driven-development` (implementer con prompt component-builder) |
| AUDIT | `/audit` |
| FIX | `superpowers:systematic-debugging` |
| VIDEO | `/video` |
| CMS | `/cms-setup` |
| DESIGN | subagent ui-designer |
| CLIENT | `/new-client` |
| COMPLIANCE | `/gdpr-audit` o `/generate-legal` |
| AUTOMATION | subagent n8n-workflow |
| REFACTOR | codegraph_impact → `superpowers:brainstorming` → `superpowers:subagent-driven-development` |

---

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

## REGOLA FERREA: Protocollo Form

**Ogni volta che si crea un form**, fermarsi e chiedere:

```
FORM DETECTED: Dove vuoi inviare i dati?
1. Odoo CRM Lead    2. Payload CMS    3. Email    4. Custom    5. Multiplo
```

Se Odoo → `skill_read({ name: "odoo-crm-lead" })`. Se form generico → `skill_read({ name: "forms" })`.

---

## REGOLA FERREA: ESLint Auto-Fix

Su qualsiasi errore ESLint/TypeScript durante build/lint/test:

1. Esegui `npm run lint:fix` immediatamente
2. Correggi manualmente i rimanenti
3. Mai `// eslint-disable`, `@ts-ignore`, `as any`
4. Riesegui il comando originale per verificare

---

## REGOLA FERREA: Code Intelligence (CodeGraph)

**Prima di modificare codice esistente:**

```
codegraph_impact({ target: "NomeSymbol", direction: "upstream" })
codegraph_context({ name: "NomeSymbol" })
```

Se risk = HIGH/CRITICAL → avvisa prima di procedere.

**Prima di commit:** `codegraph_detect_changes({ scope: "all" })` per verificare scope.

**Mai** modificare una funzione senza impact analysis. **Mai** rinominare con find-and-replace → usare `codegraph_rename`.

---

## REGOLA FERREA: Separazione Directory

```
MASTER_Fullstack session/     ← ROOT (config workflow)
├── .claude/                  ← agents, skills, commands
├── AGENTS.md                 ← questo file
├── CLAUDE.md                 ← project instructions
└── Progetti/                 ← TUTTI i progetti client
    └── nome-cliente/         ← progetto completo
```

- Ogni progetto client → `Progetti/<slug-cliente>/`
- Mai file di progetto nella root
- Nome cartella = slug kebab-case

---

## Delegation Map

### Agenti principali

| Agente | `subagent_type` | Quando |
|--------|-----------------|--------|
| @planner | `planner` | Analisi, pianificazione, strategia |
| @builder | `builder` | Implementazione, bug fix, deploy |
| @ux-designer | `ux-designer` | User flows, wireframes |
| @ui-designer | `ui-designer` | Visual design, palette |
| @component-builder | `component-builder` | Componenti UI |
| @api-developer | `api-developer` | Backend, API, CMS |
| @i18n-engineer | `i18n-engineer` | Traduzioni IT/EN/CZ |
| @test-engineer | `test-engineer` | Unit, E2E tests |
| @seo-specialist | `seo-specialist` | Meta, schema.org, sitemap |
| @devops-engineer | `devops-engineer` | Docker, Coolify, CI/CD |
| @payload-cms | `payload-cms` | Collections, multi-tenancy |
| @n8n-workflow | `n8n-workflow` | Workflow automation |
| @security-auditor | `security-auditor` | Headers, CSP, audit |
| @performance-engineer | `performance-engineer` | Bundle, CWV |

### Agenti Marketing

| Agente | Quando |
|--------|--------|
| @growth-architect | Strategy, funnel design |
| @saas-copywriter | Copy persuasivo, headline, CTA |
| @cro-designer | Layout CRO, A/B test |
| @tech-seo-specialist | SEO tecnico, GEO |

### Regole di Delegation

1. Sempre `subagent_type` se disponibile
2. Sempre `skill_read` le skill pertinenti prima di delegare — il subagent è stateless
3. Nel prompt: specificare quale skill consultare

---

## Skills — Adding & Using

Skills are team-shared and live in the repo. Codex (and any other agent without MCP `skill_read`) reads them directly from the filesystem; Claude uses the MCP catalog backed by `.codegraph/graph.db`. Both pipelines see the same skills.

### Reading an existing skill (Codex / Bash)

```bash
# By topic — fastest
ls .claude/skill/ .agents/skills/ | grep -i <topic>
cat .claude/skill/<name>/SKILL.md
# or for process/lifecycle skills:
cat .agents/skills/<name>/SKILL.md
```

### Adding a new skill (works for both Claude and Codex)

```bash
bash bin/skill-new <name> <type>
# type ∈ { domain | lifecycle | process | agent | command }
# Example: bash bin/skill-new stripe-checkout domain
```

The wrapper:
1. Scaffolds the directory with a `SKILL.md` template
2. Pre-fills the frontmatter
3. Runs the importer so the DB picks it up
4. Prints next steps

After scaffold: edit the file, then `git add` + commit. Importer is idempotent — re-run any time you change `SKILL.md` content.

### Quality bar

- Frontmatter must have `name` + `description` (with trigger keywords) + optional `version`
- Description should include phrases users would naturally type ("when X happens", "to do Y")
- Keep body actionable — checklists, code snippets, decision tables — not prose
- See `.claude/skill/skill-template-2.0/` for a full template

### Lifecycle

- Skills routed but never loaded for 30 days → flagged by `skill_gc`
- Skills with confidence ≤ 3 and 30+ stale sessions → auto-deprecated
- Reinforce useful skills with `skill_decay({ usefulSkills: [...] })` at session end

---

## Quality Gates

### Sicurezza
- Mai hardcodare secrets → `process.env.VAR_NAME` o `user_env_get`
- Mai committare `.env` → solo `.env.template`
- Sanitize input con Zod su ogni API boundary

### Codice
- Conventional commits: `type(scope): description`
- No `console.log` in prod → usa logger (Pino)
- Error handling: mai swallow errors

### Performance
- Bundle budget: first-load JS < 300KB per route
- No barrel imports da librerie heavy
- Sempre `next/image` con `sizes` e `priority` su LCP

### Accessibilità
- Semantic HTML, ARIA labels su interattivi senza testo
- WCAG AA minimo (4.5:1 contrasto)

---

**Version**: 3.1.0
**Last update**: 2026-05-14 — added skill add workflow (works for Claude + Codex)
