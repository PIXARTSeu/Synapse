---
name: skill-sync
description: Analizza le memorie recenti con tag skill:XXX e propone aggiornamenti per le skills corrispondenti. Salva le proposte in .opencode/skill/_pending/ per review manuale.
user-invocable: true
argument-hint: "[opzionale: nome skill specifica, es. 'nextjs']"
---

# /skill-sync

Trigger manuale del sistema di auto-miglioramento skills.

## Comportamento

Senza argomenti: analizza TUTTE le skills con ≥ 3 memorie nuove (ultimi 30 giorni).

Con argomento: analizza SOLO quella skill, indipendentemente dalla soglia.
```
/skill-sync nextjs       → analizza solo nextjs
/skill-sync payments     → analizza solo payments
```

## Esecuzione

Invoca **@skill-syncer** con il contesto:

```
Sei @skill-syncer. Esegui una skill sync completa:
1. Carica memorie ultimi 30 giorni con tag skill:XXX via memory_search
2. Raggruppa per skill_target
3. [Se argomento fornito: filtra per quella skill specifica]
4. Per ogni skill con ≥ 3 memorie: skill_read → analizza gap → genera proposta
5. Salva in .opencode/skill/_pending/YYYY-MM-DD-[skill].md
6. Report: X proposte generate

Working directory: root del repo (quella che contiene .opencode/)
```

## Output atteso

```
✅ Skill Sync completato
Proposte generate: 2
  → .opencode/skill/_pending/2026-04-27-nextjs.md  (5 memorie)
  → .opencode/skill/_pending/2026-04-27-remotion.md (3 memorie)

Per revisionare:
  cat .opencode/skill/_pending/2026-04-27-nextjs.md
```

## Review dei pending

Dopo la sync, hai 3 opzioni per ogni file pending:

| Azione | Come |
|--------|------|
| **Approva** | Copia le sezioni nel SKILL.md corrispondente → `rm` il pending |
| **Modifica** | Edita il pending → poi applica → `rm` il pending |
| **Scarta** | `rm .opencode/skill/_pending/[file].md` |

O chiedi a Claude: `"Applica il pending nextjs alla skill"` →
Claude legge il pending + skill, applica le modifiche, cancella il pending.

## Quando usarlo

| Quando | Trigger |
|--------|---------|
| Fine sprint / fine settimana | Manuale: `/skill-sync` |
| Hai imparato molto su un dominio | `/skill-sync [skill]` |
| Automatico weekly | Claude Code Routine (vedi `skill-syncer` skill) |
| Prima di un progetto importante | `/skill-sync` per avere skills aggiornate |
