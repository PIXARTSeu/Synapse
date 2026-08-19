---
name: skill-syncer
description: Auto-miglioramento delle skills tramite analisi delle memorie accumulate. Usare quando vuoi che le skills si aggiornino automaticamente con i pattern appresi nelle sessioni recenti.
version: 1.0.0
---

# Skill Syncer — Auto-miglioramento Skills

Le skills sono statiche. Le memorie sono dinamiche. Questo sistema fa da ponte:
accumula apprendimenti nelle memorie → periodicamente le consolida nelle skills.

---

## Come funziona

```
Ogni sessione:
  Claude impara qualcosa → memory_add({ tags: ["skill:nextjs", ...] })
                                               ↑
                              tag speciale che indica la skill target

Ogni settimana (Routine automatica):
  @skill-syncer legge memorie recenti con tag "skill:XXX"
  → raggruppa per skill
  → se 3+ memorie nuove per una skill → propone aggiornamento
  → salva proposta in .opencode/skill/_pending/
  → tu revisioni e applichi (o scarta)
```

---

## Convenzione `skill_target`

**Quando salvi una memoria, aggiungi sempre un tag `"skill:nome-skill"`** se la memoria
riguarda un dominio specifico:

```typescript
memory_add({
  type: "Pattern",
  context: "In Next.js 15, quando usi App Router...",
  problem: "...",
  solution: "...",
  reason: "...",
  tags: ["nextjs", "app-router", "performance", "skill:nextjs"],
  //                                              ↑ questo!
  project: "terrae-mare"
})
```

### Mapping skill_target — nomi validi

| Tag | Skill aggiornata |
|-----|-----------------|
| `skill:nextjs` | `nextjs` |
| `skill:payments` | `payments` |
| `skill:payload` | `payload` |
| `skill:tailwind` | `tailwind` |
| `skill:auth` | `auth` |
| `skill:remotion` | `remotion` |
| `skill:ai-video-generation` | `ai-video-generation` |
| `skill:claude-design` | `claude-design` |
| `skill:pixarts` | `pixarts/workflow` |
| `skill:coolify` | `coolify` |
| `skill:database` | `database` |
| `skill:forms` | `forms` |
| `skill:seo` | `seo` |
| `skill:animations` | `animations` |
| `skill:n8n` | `n8n` |

Se la memoria è trasversale (es. riguarda TypeScript in generale): ometti il tag.

---

## Algoritmo del @skill-syncer

```
1. Carica memorie recenti (ultimi 30 giorni):
   memory_search({ query: "skill:", limit: 100 })

2. Raggruppa per skill_target:
   { "nextjs": [m1, m2, m5], "payments": [m3], "remotion": [m4, m6, m7] }

3. Per ogni skill con soglia raggiunta (≥ 3 memorie nuove):

   a. Leggi skill corrente:
      skill_read({ name: "nextjs" })

   b. Analizza gap:
      - Cosa c'è nelle memorie ma NON nella skill?
      - Esempi nuovi? Pattern corretti? Anti-pattern scoperti?
      - Versioni deprecate da rimuovere?

   c. Genera proposta (solo le aggiunte/modifiche, non riscrivere tutto):
      ## Aggiornamenti proposti — [skill] — [data]

      ### AGGIUNTE
      [sezione o paragrafo da aggiungere]

      ### MODIFICHE
      [testo esistente da cambiare + nuovo testo]

      ### DA RIMUOVERE
      [sezione obsoleta]

      ---
      Memorie sorgente: [lista ID o contenuto breve]

   d. Salva in:
      .opencode/skill/_pending/YYYY-MM-DD-[skill].md

4. Report finale:
   "Proposte generate: X skills. Pending in .opencode/skill/_pending/"
```

---

## Review manuale (tu)

Dopo ogni run del syncer, apri i file in `_pending/`:

```bash
ls .opencode/skill/_pending/
# → 2026-04-20-nextjs.md
# → 2026-04-20-remotion.md
```

Per ogni file:
- **Approvi** → copia le sezioni nel SKILL.md corrispondente, cancella il pending
- **Modifichi** → edita il pending, poi applica
- **Scarti** → cancella il file

```bash
# Applica e cancella
cat .opencode/skill/_pending/2026-04-20-nextjs.md  # leggi
# [edita .opencode/skill/nextjs/SKILL.md manualmente o con Claude]
rm .opencode/skill/_pending/2026-04-20-nextjs.md
```

---

## Setup Claude Code Routine (automatico weekly)

Claude Code Routines girano su cloud Anthropic — laptop non necessario.

### Setup (una tantum):

1. Apri **Claude Code Desktop**
2. Sidebar → **Routines** → **+ New Routine**
3. Configura:
   ```
   Name: Weekly Skill Sync
   Schedule: Weekly — Sunday 10:00
   Repository: MASTER_Fullstack session
   Prompt: "Run /skill-sync — analyze memories from last 30 days,
            identify skill:XXX tags, generate skill update proposals
            for skills with 3+ new memories. Save to
            .opencode/skill/_pending/"
   ```
4. Save

Da quel momento ogni domenica mattina il sistema:
- Legge le memorie della settimana
- Genera i file pending
- Quando apri Claude Code lunedì, vedi le proposte pronte

### Trigger manuale
Quando vuoi forzare una sync:
```
/skill-sync
```

---

## Soglie configurabili

| Parametro | Default | Modifica qui |
|-----------|---------|--------------|
| Memorie minime per proposta | 3 | Prompt del @skill-syncer |
| Finestra temporale | 30 giorni | Prompt del @skill-syncer |
| Auto-apply (senza review) | ❌ Mai | Non abilitare — troppo rischioso |

**Auto-apply è disabilitato per design**: una skill modificata male influenza tutte le sessioni future.
La review manuale è il safety net.
