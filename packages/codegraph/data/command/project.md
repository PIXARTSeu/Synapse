# /project Command

Entry point per gestire la **Synapse Projects Registry** direttamente dal terminale Claude Code. Wrappa i tool MCP `project_*` del server `codegraph`.

## Sintassi

```
/project list                              → mostra tutti i progetti (sintetico)
/project list --full                       → con stack/repo/livel URL
/project show <name>                       → dettagli singolo progetto
/project add <name> [...flags]             → crea esplicito (fallisce se esiste)
/project sync [path]                       → auto-scan workspace (cwd se omesso) — upsert silenzioso
/project fix <name>                        → health-check + lista issues con fix proposti
/project update <name> <field>=<value>     → aggiorna campo (es. status=archived)
/project clone <source> <target>           → duplica metadata sotto nuovo nome
/project merge <primary> <alias1>,<alias2> → consolida duplicati
/project rm <name>                         → cancella tutto (sessions + memories + env) — richiede conferma
/project env <name>                        → lista env vars salvate (nomi)
/project env-set <name> <KEY>=<value>      → salva env var criptata
/project env-import <name> <path>          → batch import da .env
```

## Mapping tool MCP

| Azione | Tool MCP chiamato |
|--------|-------------------|
| `list` / `list --full` | `project_list` / `project_list_full` |
| `show <name>` | `project_get` |
| `add <name>` | `project_create` |
| `sync [path]` | `project_scan` con `workspacePath` |
| `fix <name>` | `project_repair` |
| `update <name> ...` | `project_update` |
| `clone <s> <t>` | `project_clone` |
| `merge <p> <a,b>` | `project_merge` |
| `rm <name>` | `project_delete` con `confirm: true` |
| `env <name>` | `project_get_env` con `format: dotenv` |
| `env-set <name> K=V` | `project_set_env` |
| `env-import <name> <path>` | leggi file → `project_set_env_batch` |

## Workflow tipico

### Aggiungere un progetto nuovo
```
/project sync ~/progetti-web/Web_NuovoCliente
→ scanner rileva stack, repo, env var names. Upsert in DB.
→ Se mancano campi (clientName, liveUrl…), il prompt chiede.
```

### Verificare integrità di un progetto
```
/project fix Web_SkillBrain
→ controlla: workspace path esiste, git remote ok, env vars complete, drift stack.
→ ritorna lista issues con `suggestedFix` esatto (comando già pronto da copiare).
```

### Cancellare un progetto orfano
```
/project rm vecchio-progetto-test
→ chiede conferma (irreversibile).
→ cascade: rimuove sessions, memories, env vars.
→ Per soft-delete usa invece: /project update <name> status=archived
```

### Creare un nuovo cliente da template
```
/project clone Web_SkillBrain Web_NuovoCliente --env-schema
→ duplica stack/integrations/team sotto nuovo nome
→ con --env-schema copia anche i NOMI delle env vars (valori = "TODO_SET_ME")
→ workspacePath / repoUrl / liveUrl restano vuoti — vanno settati esplicitamente.
```

## Regole

- **`add` rifiuta se il nome esiste** — uso `project_create`, non upsert silenzioso. Se vuoi modificare un esistente usa `update`.
- **`rm` è irreversibile** — passa sempre `confirm: true` al tool, e prima chiedi conferma scritta all'utente.
- **`fix` è read-only** — non scrive nulla, propone solo. L'utente decide cosa applicare.
- **Slug = nome PK** — niente UUID. Lo slug è case-sensitive e fa da chiave su tutte le tabelle (sessions, memories, env vars).
- **`sync` vs `add`**: `sync` è idempotent (upsert) e legge dal disco; `add` è esplicito (crea) e accetta campi manuali.

## Output style

Tutti i tool restituiscono testo plain con prefisso emoji:
- `✅` operazione riuscita
- `🔍` ispezione / report
- `🗑️` cancellazione
- `❌` errore
- `⚠️` warning parziale (es. batch con alcuni errori)

Per `list` e `show`, il payload JSON è già formattato — passa al modello senza retoccare.

## Note implementative

- Tutti i tool accettano `repo` opzionale per puntare a un memory repo specifico; default è `SKILLBRAIN_MEMORY_REPO` env var o l'unico registry entry presente.
- Per env vars: serve `ENCRYPTION_KEY` configurata, altrimenti `setEnv` lancia.
- L'auto-detect hook (SessionStart) propone `/project sync` quando entri in una cartella git non registrata.
