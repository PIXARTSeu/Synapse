---
name: claude-design
description: Come usare Claude Design (Anthropic Labs) per generare prototipi, mockup, pitch deck e UI. Usare quando si deve presentare un design al cliente prima di codificarlo, o pianificare una feature visivamente.
version: 1.0.0
---

# Claude Design Skill

Claude Design è lo strumento AI di Anthropic per creare prototipi interattivi, mockup, pitch deck,
one-pager e UI — partendo da testo, senza tool di design tradizionali.
Powered by **Claude Opus 4.7**. Disponibile su Pro/Max/Team/Enterprise.

---

## Quando usarlo

| Scenario | Claude Design? |
|---|---|
| Cliente vuole vedere il sito prima che venga codificato | ✅ Sì — mockup prima di scrivere una riga |
| Hai una feature complessa da pianificare visivamente | ✅ Sì — mockup → approval → implementa |
| Devi creare un pitch deck / presentazione | ✅ Sì — da testo a slide in pochi minuti |
| Social media asset, one-pager, brochure | ✅ Sì |
| Refactor di un componente esistente | ❌ Vai diretto a Claude Code |
| Bug fix o tweak minore | ❌ Vai diretto a Claude Code |
| Hai già mockup approvato | ❌ Implementa direttamente |

**Regola pratica**: se il cliente deve *approvare l'aspetto* prima che tu costruisca, usa Claude Design.

---

## Come aprirlo

- Web: `claude.ai` → barra laterale → **Design**
- Mac: Claude Desktop → toolbar → **Design**
- Shortcut: `Cmd+Shift+D` (desktop app)

---

## Come alimentarlo (input ottimali)

### 1. Testo descrittivo
```
Crea una landing page per un ristorante di pesce di lusso a Milano.
Sezioni: Hero (foto mare + CTA "Prenota"), Menu (3 categorie), 
Testimonianze (3 card), Location (mappa + orari), Footer.
Brand: colori navy e oro, font serif elegante.
```

### 2. Puntare al codebase (brand integration)
Durante il primo utilizzo su un progetto:
1. Claude Design → Settings → **Link codebase**
2. Punta al repo del progetto (es. `Progetti/ristorante-da-mario/`)
3. Claude legge `tailwind.config.js`, `globals.css`, componenti shadcn → estrae design system
4. Da quel momento usa automaticamente i tuoi colori/font/componenti

### 3. Upload files
- `DOCX`, `PPTX`, `XLSX` → content esistente come base
- Immagini → screenshot di UI esistente da replicare/migliorare
- PDF brand guidelines → Claude estrae palette e stile

### 4. Web capture
- "Cattura questo sito: [URL]" → Claude fa screenshot e lo usa come base

---

## Workflow tipico

```
1. Descrivi → Claude genera prima versione (30-60s)
      ↓
2. Raffina inline:
   - Click su elemento → commento diretto ("rendi il titolo più grande")
   - Adjustment knobs: spacing / color / layout (live preview)
   - Chat: "sposta la CTA in alto", "aggiungi sezione testimonianze"
      ↓
3. Condividi con cliente:
   - Share → URL interno (solo org) oppure link pubblico
   - Commenti del cliente inline nel design
      ↓
4. Export:
   - HTML standalone → docs/design-mockup.html (→ Claude Code)
   - PDF/PPTX → presentazione formale
   - Canva → editing grafico avanzato
      ↓
5. Handoff a Claude Code:
   "Implementa questo design: docs/design-mockup.html"
```

---

## Prompt templates

### Landing page cliente
```
Crea una landing page per [tipo business] a [città].
Target: [descrizione cliente ideale].
Obiettivo principale: [CTA principale — es. "prenota", "chiama", "acquista"].
Sezioni: [lista sezioni].
Stile: [parole chiave — es. "minimalista", "lusso", "moderno", "caldo"].
Colori brand: [hex o descrizione].
Font: [serif/sans-serif/display].
```

### Dashboard / web app
```
Crea il mockup di un dashboard [tipo] con:
- Sidebar navigation: [voci menu]
- Main content: [tipo di dati/cards/tabelle]
- Header: [elementi]
- Color scheme: dark/light, accent [colore]
Stile: [SaaS moderno / enterprise / minimal]
```

### Mobile screen
```
Crea il mockup di una schermata mobile [iOS/Android] per [funzione].
Dimensione: 390x844px (iPhone 15).
Elementi: [header, body content, bottom nav, CTA]
```

### Component exploration
```
Genera 3 varianti del componente [nome]:
- Variante A: [stile]
- Variante B: [stile]
- Variante C: [stile]
Mostrali affiancati per comparison.
```

### Pitch deck
```
Crea un pitch deck [5/10/15] slide per [prodotto/azienda].
Struttura: Problema → Soluzione → Demo → Traction → Team → Ask.
Brand: [colori, stile].
```

---

## Export workflow → Claude Code

Quando il design è approvato:

```bash
# 1. In Claude Design: Export → HTML Standalone
# Salva come: docs/design-mockup.html

# 2. In Claude Code (questo session):
"Implementa il design in docs/design-mockup.html.
Stack: Next.js 15 + Tailwind + shadcn/ui.
Adatta alla struttura del progetto esistente."

# Claude Code legge l'HTML, estrae pattern visivi, implementa componenti
```

**Nota**: L'HTML export è un reference visivo, non codice production-ready.
Claude Code lo usa come blueprint e implementa con lo stack del progetto.

---

## Integrazione Pixarts workflow

Nel workflow Pixarts, Claude Design viene usato in **Phase 0.5** (dopo client intake, prima di CMS setup):

```
Phase 0: Client Intake → brief.json
      ↓
Phase 0.5: Claude Design mockup → approvazione cliente
      ↓
Phase 1: CMS Setup (con design system già definito)
```

Questo elimina revisioni costose in fase di build — il cliente vede e approva PRIMA.

---

## Limitazioni da conoscere

| Cosa non fa | Alternativa |
|---|---|
| Animazioni Framer Motion | Implementa dopo con `animations` skill |
| Data binding / API real | Solo visual layer — Claude Code per logica |
| Componenti shadcn esatti | Usa come reference — adatta manualmente |
| Export React/Next.js diretto | Export HTML → Claude Code adatta |
| File .pen (Pencil) | Usa Pencil MCP per design in .pen format |

---

## Tips per risultati migliori

1. **Sii specifico sulle sezioni** — elenca ogni sezione nell'ordine in cui deve apparire
2. **Dai reference** — "simile a [sito noto] ma con stile più [aggettivo]"
3. **Una cosa alla volta** — in chat, una modifica per messaggio = risultati più precisi
4. **Brand onboarding prima** — collega il codebase in Settings per coerenza automatica
5. **Export dopo ogni sessione** — non perdere il lavoro, esporta HTML anche solo come backup
