---
name: shopify-storefront
description: Sviluppo di vetrine headless Shopify con Hydrogen (React Router/Remix) e deploy su Oxygen. ATTIVARE SEMPRE quando l'utente menziona "Hydrogen", "Oxygen", "storefront headless", "Shopify headless", "Storefront API", "Customer Account API", "shopify hydrogen dev", "h2 dev", "mock.shop", "CartForm", "createHydrogenContext", "storefront.query", "CacheLong", "CacheShort", "subrequest profiler", "hydrogen deploy", "hydrogen link", "hydrogen codegen", "storefrontapi.generated", "@shopify/hydrogen", "@shopify/remix-oxygen", "mini-oxygen", "e-commerce React Router", "PDP/PLP Shopify custom". Attivare anche quando l'utente descrive il problema senza nominare Hydrogen — "voglio un e-commerce Shopify ma con frontend mio", "il checkout Shopify ma la vetrina in React", "migrare da Liquid a React", "cache che non si invalida sul prodotto", "dati cliente che finiscono nella cache", "il worker supera i 10MB", "deploy Shopify edge". In caso di dubbio su un progetto e-commerce Shopify custom, attivare.
---

# Hydrogen + Oxygen — sviluppo storefront headless Shopify

## Cosa è questo stack

Tre pezzi che vanno sempre pensati insieme:

| Livello | Cosa fa |
|---|---|
| **Hydrogen** (app) | Componenti, utility e client API preconfigurati per Shopify. Un progetto Hydrogen *è* un'app React Router. |
| **React Router** (framework) | Routing, loader/action, SSR, progressive enhancement. Fino alle versioni 2024.x era Remix; le versioni recenti sono migrate a React Router 7. |
| **Oxygen** (hosting) | Runtime serverless edge basato su `workerd` (Cloudflare). Non è Node: molte API Node non ci sono. |

Il checkout resta sempre di Shopify. Hydrogen costruisce solo la vetrina: home, PLP, PDP, cart, account, search, policies, blog, sitemap, robots.

**Requisito non negoziabile:** l'app canale **Hydrogen** deve essere installata sullo store, altrimenti niente Oxygen, niente environment, niente deploy.

---

## Prima regola: verifica la versione prima di scrivere codice

La doc ufficiale di Shopify è **internamente incoerente** sugli import (alcune pagine mostrano `@shopify/remix-oxygen`, altre `react-router`, altre ancora un errato `@react-router`). Non fidarti della memoria né di un singolo esempio: la convenzione dipende dalla versione del progetto.

Prima di generare o modificare codice, ispeziona il progetto:

```bash
bash scripts/inspect-project.sh /percorso/del/progetto
```

Lo script stampa versione di `@shopify/hydrogen`, se il progetto è su React Router 7 o su Remix, il package manager, TS/JS, e quali variabili d'ambiente sono presenti. Poi:

- **React Router 7** (`react-router` in dependencies, Hydrogen 2025.5+) → `import {useLoaderData, Link, Form} from 'react-router'`
- **Remix** (`@remix-run/react` in dependencies, fino a 2025.4) → `import {useLoaderData} from '@remix-run/react'`
- In entrambi i casi i tipi server e le utility Oxygen restano in `@shopify/remix-oxygen`
- Nelle versioni recenti esistono i tipi di route generati (`import type {Route} from './+types/...'`): usali se il progetto li ha, altrimenti resta su `useLoaderData<typeof loader>()`

Se non hai accesso al filesystem del progetto, **chiedi la versione** o chiedi di incollare le dependencies. Non tirare a indovinare: import sbagliati sono l'errore #1 su Hydrogen.

Hydrogen segue le versioni API Shopify, che cambiano ogni trimestre e possono portare breaking change ogni trimestre (`2026.4.x` ↔ Storefront API `2026-04`). Timeline delle rotture rilevanti, route type safety, middleware, developer preview framework-agnostic: `references/versioni-e-novita.md`.

---

## Workflow per tipo di richiesta

### A. Nuovo progetto da zero

```bash
npm create @shopify/hydrogen@latest -- --quickstart
cd hydrogen-quickstart
npm run dev            # oppure: shopify hydrogen dev
```

`--quickstart` usa dati demo da [Mock.shop](https://mock.shop) — perfetto per prototipare senza store. Togli il flag per scegliere TS/JS, strategia CSS, mercati, route.

Collegamento allo store reale:

```bash
npx shopify hydrogen link      # crea/collega lo storefront
npx shopify hydrogen env pull  # scarica le env vars nel .env locale
```

Il `pull` sostituisce `PUBLIC_STORE_DOMAIN="mock.shop"` con i token reali (`PUBLIC_STOREFRONT_API_TOKEN`, `PRIVATE_STOREFRONT_API_TOKEN`, `PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID`, ecc.). Se il sito continua a mostrare prodotti Mock.shop dopo il link, il `.env` non è stato ricaricato: riavvia il dev server.

Dettagli su tutti i comandi CLI: `references/setup-e-cli.md`.

### B. Aggiungere route / feature a un progetto esistente

1. Ispeziona il progetto (vedi sopra) — versione e convenzioni prima di tutto.
2. Se serve una route standard (search, blog, policies, account…), **non scriverla a mano**: `npx shopify hydrogen generate route <nome>` produce lo scaffold allineato alla versione installata.
3. Per query custom, scrivi il GraphQL con il commento magico `` `#graphql `` all'inizio del template literal — è ciò che abilita autocomplete e codegen.
4. Dopo ogni modifica alle query: `npm run codegen` → rigenera `storefrontapi.generated.d.ts`.

Pattern loader/action, paginazione, deferred data, third-party: `references/data-e-caching.md`.

### C. Cart, varianti, analytics

Il carrello passa sempre da `CartForm` + `createCartHandler` sul context, mai da fetch manuali. Le varianti e l'URL della PDP hanno un pattern preciso (opzioni selezionate ↔ query string). Analytics Shopify va montato con `<Analytics.Provider>` e gli eventi per pagina, altrimenti il merchant perde le conversioni.

Codice e pattern: `references/componenti-e-cart.md`.

### D. UI, styling e librerie di componenti

Hydrogen fornisce i componenti *dati* (`Image`, `Money`, `CartForm`), non quelli *visivi*. La UI la scegli tu: strategia CSS all'init (`tailwind`, `vanilla-extract`, `css-modules`, `postcss`, `none`), poi eventualmente una libreria headless sopra.

Due cose da sapere subito:

- **Polaris non c'entra.** È il design system dell'**admin** Shopify, non degli storefront. Usarlo sulla vetrina è un errore ricorrente e costoso.
- **shadcn/ui funziona bene** su Hydrogen (è Radix + Tailwind, e React Router 7 è supportato ufficialmente), ma va allineato ai path alias `~/*` del progetto e gli esempi vanno riscritti con il `<Link>` di React Router.

Setup, mappa componenti → esigenze commerce, peso del bundle rispetto ai limiti Oxygen, font, skeleton, accessibilità e temi di partenza: `references/ui-e-styling.md`.

Per la direzione estetica (palette, tipografia, identità visiva) usa la skill `frontend-design`: è complementare a questa.

### E. Performance e caching

Questa è la parte dove Hydrogen si vince o si perde. Regola mentale: **ogni query al Storefront API è cachata di default**, ogni query al Customer Account API non lo è mai.

| Strategia | Header | Durata | Quando |
|---|---|---|---|
| `CacheShort()` | `public, max-age=1, stale-while-revalidate=9` | 10s | Prezzi, disponibilità, dati volatili |
| `CacheLong()` | `public, max-age=3600, stale-while-revalidate=82800` | 1 giorno | Titoli, descrizioni, menu, policy |
| `CacheNone()` | `no-store` | mai | Qualsiasi cosa personalizzata |
| `CacheCustom()` | custom | custom | Casi intermedi |

Default se non specifichi nulla: `public, max-age=1, stale-while-revalidate=86399`.

⚠️ **Il rischio più serio dello stack.** La query `customer` del *Storefront* API restituisce dati personali ma viene cachata come tutto il resto. Serve disattivare la cache **su due livelli**:

1. `cache: storefront.CacheNone()` sulla query (blocca la subrequest cache)
2. header `Cache-Control` sulla response del loader — `no-store`, oppure `private, max-age=<s>` se vuoi permettere solo la cache del browser dell'utente

Solo il punto 1 non basta: l'HTML renderizzato finirebbe comunque nella full-page cache di Oxygen e verrebbe servito ad altri utenti. Ogni volta che rivedi una route `/account*` o qualsiasi loader con dati cliente, controlla entrambi i livelli e segnalalo esplicitamente all'utente.

Approfondimento, `CacheCustom`, cache di API terze, subrequest profiler: `references/data-e-caching.md`.

### F. Deploy e go-live

```bash
npx shopify hydrogen deploy    # scegli l'environment (Preview per i test)
```

Vincoli Oxygen da rispettare a monte, non da scoprire in fase di build:

- Worker ≤ **10 MB**, startup ≤ **400 ms**, ≤ **30 s** CPU/richiesta, ≤ **128 MB** memoria
- Max **110** variabili d'ambiente custom
- Immagini ≤ 20 MB, video ≤ 1 GB, modelli 3D ≤ 500 MB
- **Niente proxy davanti a Oxygen** — va in conflitto col sistema anti-bot e crea problemi SEO
- Oxygen è incluso in tutti i piani a pagamento (Starter → Plus); non disponibile sui piani Agentic

Checklist di produzione, CI/CD GitHub, log drain, redirect ordini pre-migrazione, feed Meta/Google: `references/deploy-oxygen.md`.

---

## Come rispondere

**Codice completo, non frammenti.** Una route Hydrogen ha loader + componente + query nello stesso file: consegnala intera, con il path corretto (`app/routes/products.$handle.tsx`) come prima riga di commento.

**Ogni query dichiara la sua strategia di cache.** Anche quando è il default: scriverla esplicitamente rende la scelta discutibile in review. Se stai scrivendo un loader e non sai quanto è volatile il dato, chiedi invece di assumere.

**Verifica prima di consigliare pacchetti.** L'ecosistema Hydrogen si muove in fretta e la doc pubblica è in ritardo su sé stessa. Se una feature ti sembra recente o non sei sicuro di un'API, cerca sul web o su `shopify.dev` prima di scriverla — meglio una verifica in più che un import inesistente.

**Segnala i rischi mentre scrivi, non alla fine.** Cache di dati personali, limiti del worker, API Node non disponibili su Oxygen: se il codice che stai producendo ci si avvicina, dillo lì, in una riga.

**Non implementare il checkout.** Se l'utente chiede di gestire pagamenti, tasse o completamento ordine nel frontend, fermalo: quel pezzo è di Shopify e passa dal cart permalink / checkout URL.

---

## File di riferimento

Leggi solo quello che serve al task corrente:

- `references/setup-e-cli.md` — comandi CLI completi, struttura progetto, env vars, GraphiQL, codegen
- `references/data-e-caching.md` — loader/action, Storefront vs Customer Account API, paginazione, deferred, strategie di cache, `createWithCache`
- `references/componenti-e-cart.md` — `Image`, `Money`, `CartForm`, varianti PDP, analytics, SEO
- `references/ui-e-styling.md` — strategie CSS, Tailwind v4, shadcn/ui e alternative, componenti commerce, bundle, font, accessibilità, temi
- `references/deploy-oxygen.md` — environment, deploy, CI/CD, runtime Oxygen, checklist produzione
- `references/versioni-e-novita.md` — timeline breaking change, route type safety, middleware, developer preview, aggiornamenti
- `references/troubleshooting.md` — errori ricorrenti e come diagnosticarli

## Skill collegate

- **`shopify-core`** — scelta dell'architettura, API e autenticazione, livello condiviso a tutte le superfici
- **`shopify-apps`** — se serve anche uno strumento nell'admin o un job di background che alimenta la vetrina
- **`shopify-functions`** — se servono sconti o validazioni: gli errori delle validation Function emergono sull'oggetto `Cart` dello Storefront API e la vetrina deve gestirli
- **`shopify-themes`** — se il progetto è una migrazione da un tema Liquid, o se dopo l'analisi il tema resta la scelta giusta
