---
name: shopify-themes
description: Sviluppo di temi Shopify in Liquid — architettura Online Store 2.0, sezioni, blocchi, template JSON, theme editor, performance e accessibilità. ATTIVARE SEMPRE quando l'utente menziona "tema Shopify", "Liquid", "Dawn", "Online Store 2.0", "OS 2.0", "sezioni", "sections", "blocchi", "theme blocks", "app blocks", "schema", "settings_schema", "template JSON", "snippet", "section group", "theme editor", "shopify theme dev", "shopify theme push", "theme check", "Theme Inspector", "Lighthouse CI Shopify", "Theme Store", "theme app extension", "metafield in Liquid", "personalizzare un tema", "modificare il tema". Attivare anche quando la richiesta lo implica senza dirlo - "il cliente vuole cambiare la homepage da solo", "aggiungere una sezione al sito Shopify", "il sito Shopify è lento", "migrare un tema vecchio", "il tema si rompe quando lo aggiorno". NON è la skill per vetrine React headless - quella è shopify-storefront.
---

# Temi Shopify (Liquid, Online Store 2.0)

Un tema controlla organizzazione, funzionalità e stile della vetrina, e gira dentro l'infrastruttura Shopify. La differenza fondamentale rispetto al headless: **il merchant può modificarlo da solo** dal theme editor. Quella autonomia è il valore del tema — e ogni scelta tecnica che la riduce va giustificata.

---

## Architettura

Sei componenti che compongono ogni pagina:

1. **Layout** (`layout/theme.liquid`) — la base: `<head>`, elementi ripetuti, section group di header e footer
2. **Template** — cosa si vede su un tipo di pagina. I template JSON sono contenitori di sezioni; quelli Liquid contengono codice
3. **Section group** — contenitori JSON che permettono di aggiungere e riordinare sezioni in aree del layout
4. **Section** — moduli riusabili e personalizzabili, con il proprio schema
5. **Block** — moduli più piccoli dentro le sezioni, aggiungibili e riordinabili dal merchant
6. **Snippet** — pezzi di Liquid riusabili, invisibili nel theme editor

Struttura di directory obbligatoria (altre sottodirectory non sono supportate):

```
.
├── assets      # CSS, JS, immagini
├── blocks      # theme blocks riusabili tra sezioni
├── config      # settings_schema.json, settings_data.json
├── layout      # theme.liquid (unico file davvero obbligatorio)
├── locales     # traduzioni
├── sections
├── snippets
└── templates
    ├── customers
    └── metaobject
```

Il riferimento di fatto per tutto questo è il repository di **Dawn**: quando un pattern non è chiaro, guarda come lo risolve Dawn prima di inventarlo.

Dettaglio su sezioni, blocchi, schema, preset e app block: `references/architettura-tema.md`.

---

## Online Store 2.0: cosa cambia davvero

Prima di OS 2.0 le sezioni funzionavano solo in homepage. Oggi **ogni tipo di pagina** supporta sezioni, i template sono JSON, i metafield sono nativi e le app si integrano tramite app block invece di iniettare script.

Il test per capire se un tema è davvero 2.0 o solo "in una cartella 2.0":

- La pagina prodotto è un `product.json` che compone sezioni, non un `product.liquid` con tutto dentro
- Blog e pagine supportano i blocchi
- I metafield si leggono direttamente in Liquid, senza app di terze parti
- Le sezioni sono **autonome**: nessuna dipende dall'esistenza o dalla posizione di un'altra

Quest'ultimo punto è il più violato. Se il CSS assume un ordine di sezioni, o il JavaScript seleziona elementi con `nth-child`, il tema si rompe appena il merchant riordina qualcosa nel theme editor — cioè esattamente ciò per cui il theme editor esiste.

---

## Workflow

```bash
shopify theme init          # nuovo tema (parte da Dawn)
shopify theme dev           # server locale con hot reload sul dev store
shopify theme pull          # scarica il tema dallo store
shopify theme push          # carica (attenzione: --unpublished per non toccare il live)
shopify theme check         # linter ufficiale
```

Disciplina che evita disastri sui progetti cliente:

- **Git obbligatorio**, con l'integrazione GitHub di Shopify per collegare un branch a un tema
- **Mai `push` diretto sul tema pubblicato.** Si lavora su un tema non pubblicato e si pubblica dopo verifica
- **`settings_data.json` è del merchant**, non tuo: sovrascriverlo cancella la sua configurazione. È l'incidente più comune e il più difficile da spiegare al cliente
- **Theme Access app** per dare accesso a collaboratori senza dare l'accesso completo allo store

Strumenti utili: estensione VS Code per Liquid, plugin Prettier, LiquidDoc per documentare gli snippet, Theme Inspector e Lighthouse CI per le performance.

---

## Performance

I temi girano su infrastruttura Shopify, ma è facile renderli lenti:

- **Liquid non ha batching.** Ogni accesso a `product.metafields` o `collections[handle]` è una lookup a sé. Cicli annidati su collezioni grandi sono la causa numero uno di pagine lente
- **Immagini**: usa i filtri di Shopify per generare `srcset`, con `width` e `height` espliciti contro il CLS
- **JavaScript**: `defer`, niente librerie pesanti per effetti che si fanno in CSS
- **CSS**: evita di caricare l'intero foglio di stile per una sezione usata su una sola pagina
- **App**: ogni app installata inietta il suo peso. Su un tema lento, l'audit delle app viene prima dell'ottimizzazione del codice

Approfondimento su Liquid, performance e pattern: `references/liquid-e-performance.md`.

---

## Estendere senza rompere

Se la funzionalità serve al merchant in modo ricorrente, la strada corretta **non** è modificare i file del tema: è una **theme app extension** (skill `shopify-apps`), che aggiunge un app block inseribile dal theme editor e sopravvive agli aggiornamenti del tema.

Regola per capire quando: se stai per scrivere codice che andrà riportato a mano al prossimo aggiornamento del tema, stai creando debito. Le modifiche custom vanno isolate in file propri, mai sparse nei file originali.

---

## Come rispondere

**Codice Liquid completo e nel file giusto**, con il path come commento iniziale (`sections/hero-banner.liquid`) e lo `{% schema %}` incluso: una sezione senza schema non è configurabile, quindi non serve al merchant.

**Ogni sezione autonoma.** Nessuna dipendenza dall'ordine, nessun selettore posizionale.

**Testo dalle locale, non hardcodato.** Le stringhe visibili vanno in `locales/`: è ciò che rende il tema traducibile e personalizzabile dal merchant.

**Pensa a chi userà il theme editor.** Impostazioni con etichette comprensibili, valori di default sensati, preset definiti. Uno schema fatto male trasforma un buon tema in un tema che il cliente non sa usare.

**Attenzione al file del merchant.** Prima di qualsiasi operazione che tocca `settings_data.json` o il tema live, dillo esplicitamente.

---

## File di riferimento

- `references/architettura-tema.md` — sezioni, blocchi, schema, preset, template JSON, section group, app block, locale
- `references/liquid-e-performance.md` — Liquid, metafield, performance, accessibilità, checklist di consegna

## Skill collegate

- **`shopify-core`** — quando è ancora aperta la scelta tra tema, headless e app
- **`shopify-apps`** — theme app extension: estendere il tema senza modificarlo
- **`shopify-functions`** — regole di sconto e validazioni, che il tema non può implementare
- **`shopify-storefront`** — se emerge che il progetto ha davvero bisogno del headless
