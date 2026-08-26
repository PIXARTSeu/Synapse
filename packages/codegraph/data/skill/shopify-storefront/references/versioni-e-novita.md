# Versioni, novità e cose che cambiano in fretta

> Questo file ha una data di scadenza. Hydrogen segue le versioni delle API Shopify, che escono **ogni tre mesi** e possono portare breaking change ogni tre mesi. Le informazioni qui sotto sono aggiornate a metà 2026: prima di dare per buono qualcosa, verifica su `hydrogen.shopify.dev/updates` e sul changelog del repo `Shopify/hydrogen`.

## Indice
- [Come leggere i numeri di versione](#come-leggere-i-numeri-di-versione)
- [Timeline delle rotture rilevanti](#timeline-delle-rotture-rilevanti)
- [Route type safety e middleware](#route-type-safety-e-middleware)
- [Il developer preview framework-agnostic](#il-developer-preview-framework-agnostic)
- [Traffico di bot e agenti AI](#traffico-di-bot-e-agenti-ai)
- [Come aggiornare](#come-aggiornare)

---

## Come leggere i numeri di versione

`@shopify/hydrogen@2026.4.x` è allineato alla **Storefront API 2026-04**. Stesso schema per `@shopify/hydrogen-react`. Se il progetto usa una versione API, la corrispondente versione di Hydrogen è quella pienamente compatibile.

Conseguenza pratica: quando un cliente chiede "quanto costa mantenerlo", la risposta include un aggiornamento trimestrale. Non è opzionale a lungo — le versioni API vengono ritirate.

---

## Timeline delle rotture rilevanti

**2025.5** — Migrazione da Remix v2 a **React Router 7** (framework mode). È lo spartiacque: sotto questa versione gli import sono `@remix-run/react`, sopra sono `react-router`. Prerequisiti: compiler classico Remix abbandonato (`hydrogen setup vite`) e tutti i future flag Remix attivati prima del salto.

**2025.x** — Selezione varianti riscritta: `getProductOptions` + `getAdjacentAndFirstAvailableVariants` sostituiscono `<VariantSelector>`.

**2026.4** — Storefront API e Customer Account API a **2026-04**. Il proxy Storefront API è ora sempre attivo e l'opzione `proxyStandardRoutes` è stata rimossa da `createRequestHandler`. Peer dependency di React Router allargate a range con caret (`^7.12.0`), quindi i minor si aggiornano senza conflitti npm. Limite di 128 KB sulle scritture di metafield JSON.

**Metà 2026** — React Router 7.9.x, Miniflare v3, route type safety, middleware, `createHydrogenContext`, e le ricette del **Cookbook** al posto del vecchio flag `--template` nella init.

Se lavori su un progetto ereditato, la prima domanda utile è: *da quale versione partiamo e quante major ci separano dall'attuale?* Tre major di distanza non è un aggiornamento, è un progetto.

---

## Route type safety e middleware

Nei progetti recenti React Router genera i tipi per route: parametri URL, dati del loader e risposte delle action sono inferiti senza doverli scrivere.

```ts
// app/routes/products.$handle.tsx
import type {Route} from './+types/products.$handle';

export async function loader({params, context}: Route.LoaderArgs) {
  // params.handle è tipizzato
}

export default function Product({loaderData}: Route.ComponentProps) {
  // loaderData tipizzato — niente useLoaderData<typeof loader>()
}
```

Perché funzioni serve la generazione dei tipi nello script di dev:

```json
"dev": "react-router typegen --watch && shopify hydrogen dev --codegen"
```

Il **middleware** permette di eseguire logica prima e dopo la generazione della Response per le route che fanno match: autenticazione, redirect, header, logging. È il posto giusto per la logica che prima veniva duplicata in ogni loader.

Entrambe le cose esistono solo dalle versioni recenti: se il progetto non le ha, usa i pattern classici (`useLoaderData<typeof loader>()`) invece di forzare una sintassi che non compila.

---

## Il developer preview framework-agnostic

A partire da metà 2026 Shopify sta portando la logica commerce di Hydrogen **fuori** da React Router, in un core agnostico: client tipizzato per lo Storefront API, primitive del carrello, helper prodotto/collezione, formattazione valuta, Shop Pay, analytics con consenso, request handler. L'obiettivo dichiarato è poter usare i pezzi Shopify anche su altri framework JavaScript, aggiungendoli a un progetto esistente invece di adottare la struttura completa di un'app Hydrogen.

Stato: **developer preview**, con API ancora in movimento (per esempio `createStorefrontRequestContext` è già stato rinominato `createShopifyRequestContext`, senza alias di compatibilità). Nel preview la cache dello Storefront API è opt-in per query, non attiva di default come nell'Hydrogen stabile.

Cosa farne in pratica:

- **Per un progetto cliente in produzione: usa l'Hydrogen stabile.** È la via supportata e non ha API che cambiano nome tra una release e l'altra.
- **Vale la pena seguirlo** se il cliente ha già un frontend Next.js o simile e non vuole riscriverlo: è la strada che rende sensata quella conversazione.
- Prima di scrivere codice basato sul preview, apri le release notes: qui più che altrove la memoria è inaffidabile.

---

## Traffico di bot e agenti AI

Da maggio 2026 Shopify applica limiti di rate più severi su Storefront API e pagine ospitate a bot e agenti che **non firmano** le proprie richieste (Web Bot Auth); chi non si identifica finisce nella fascia più restrittiva.

Rilevante per due motivi opposti, entrambi da spiegare al cliente:

1. Se lo storefront riceve traffico da agenti AI (assistenti che navigano il catalogo), la loro affidabilità dipende ora dalla firma delle richieste.
2. Se il cliente fa scraping o integrazioni automatiche verso il proprio store, quelle chiamate vanno identificate correttamente o verranno throttlate.

Vale anche il caso già noto: un **load test** non coordinato con Shopify viene classificato come traffico malevolo (vedi `deploy-oxygen.md`).

---

## Come aggiornare

```bash
npx shopify hydrogen upgrade
```

Non è un semplice bump: elenca i breaking change tra la versione corrente e quella target e le istruzioni di migrazione. Usalo sempre al posto di modificare a mano il `package.json`.

Procedura che riduce i danni su progetti cliente:

1. Branch dedicato, mai sul main
2. Una major alla volta, mai un salto multiplo
3. `npm run codegen` dopo ogni step — i tipi generati rivelano subito i campi API rimossi
4. `hydrogen build` + `hydrogen preview` prima di ogni deploy, non solo `dev`
5. Deploy su environment **Preview** e giro completo fino al checkout con un ordine di test
6. Solo dopo, promozione in produzione

Il momento in cui gli aggiornamenti diventano dolorosi è quando si saltano: due trimestri di ritardo sono gestibili, sei mesi diventano una riscrittura parziale.
