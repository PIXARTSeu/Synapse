# Setup, CLI e struttura progetto

## Indice
- [Requisiti](#requisiti)
- [Creazione progetto](#creazione-progetto)
- [Struttura di un progetto Hydrogen](#struttura-di-un-progetto-hydrogen)
- [Pacchetti](#pacchetti)
- [Comandi CLI completi](#comandi-cli-completi)
- [Variabili d'ambiente](#variabili-dambiente)
- [GraphiQL e codegen](#graphiql-e-codegen)
- [Shopify AI Toolkit](#shopify-ai-toolkit)

---

## Requisiti

- Node.js v16.20+ e npm v8.19+ (in pratica: usa una LTS recente)
- App canale **Hydrogen** installata sullo store (`apps.shopify.com/hydrogen`)
- Shopify CLI — invocabile con `npx shopify` o installata globalmente

Store utilizzabili: development store, Plus Partner Sandbox, e qualsiasi piano a pagamento. Nota: i development store **non hanno environment pubblici**, quindi ogni URL di deploy richiede login allo store.

---

## Creazione progetto

```bash
# Con dati demo Mock.shop, opzioni consigliate preimpostate
npm create @shopify/hydrogen@latest -- --quickstart

# Interattivo: scegli TypeScript/JavaScript, CSS strategy, mercati, route
npm create @shopify/hydrogen@latest
```

Route generate dal quickstart: home (`/` e `/:catchAll`), page (`/pages/:handle`), cart (`/cart/*`, `/discount/*`), products (`/products/:handle`), collections (`/collections`, `/collections/:handle`), policies, blogs, account (`/account/*`), search (`/search`, `/api/predictive-search`), `robots.txt`, `sitemap.xml`.

Dev server:

```bash
npm run dev
# oppure
shopify hydrogen dev
```

Gira su http://localhost:3000 dentro **mini-oxygen**, che emula il worker Oxygen. È il motivo per cui vale la pena usarlo invece di un dev server generico: gli errori da API Node mancanti emergono in locale invece che in produzione.

---

## Struttura di un progetto Hydrogen

```
hydrogen-quickstart/
├── app/
│   ├── assets/
│   ├── components/
│   ├── graphql/          # fragment e query condivise
│   ├── lib/              # context, session, utility (fragments, variants, search)
│   ├── routes/           # file-based routing React Router
│   ├── styles/
│   ├── entry.client.jsx
│   ├── entry.server.jsx  # SSR, CSP, nonce
│   └── root.jsx          # layout, dati globali (header, footer, cart)
├── public/
├── customer-accountapi.generated.d.ts
├── storefrontapi.generated.d.ts   # generato da codegen — non editare a mano
├── env.d.ts
├── server.js             # entry Oxygen: crea il context e gestisce la richiesta
└── vite.config.js
```

`server.js` è dove vive `createHydrogenContext` (o, nei progetti più vecchi, `createStorefrontClient` + `createCartHandler` + `createCustomerAccountClient` separati) e dove si aggancia `storefrontRedirect` per gestire i redirect configurati nell'admin Shopify.

Convenzione route: `app/routes/products.$handle.tsx` → `/products/:handle`. Con i mercati via URL diventa `app/routes/($locale).products.$handle.tsx`.

---

## Pacchetti

| Pacchetto | Ruolo |
|---|---|
| `@shopify/hydrogen` | Componenti e utility Shopify per React Router. Estende `@shopify/hydrogen-react` (framework-agnostic). |
| `@shopify/hydrogen-cli` | CLI del progetto |
| `@shopify/mini-oxygen` | Dev server che emula Oxygen |
| `@shopify/remix-oxygen` | Adapter per servire l'app su Oxygen; esporta anche i tipi server (`LoaderFunctionArgs`, `ActionFunctionArgs`) |

`@shopify/hydrogen-react` è utile a parte solo se stai costruendo su Next.js o altro stack non-Oxygen.

---

## Comandi CLI completi

```bash
# Progetto
npx shopify hydrogen init                  # nuovo storefront
npx shopify hydrogen dev                   # dev server (mini-oxygen)
npx shopify hydrogen build                 # build di produzione
npx shopify hydrogen preview               # serve la build di produzione in locale
npx shopify hydrogen check                 # verifica la presenza delle route standard Shopify

# Store e storefront remoto
npx shopify hydrogen login                 # login e salvataggio del dominio nel progetto
npx shopify hydrogen logout
npx shopify hydrogen list                  # storefront remoti disponibili
npx shopify hydrogen link                  # collega il progetto locale a uno storefront
npx shopify hydrogen unlink

# Environment
npx shopify hydrogen env list
npx shopify hydrogen env pull              # remoto → .env locale
npx shopify hydrogen env push              # .env locale → remoto

# Generazione codice
npx shopify hydrogen generate route <nome> # una route standard
npx shopify hydrogen generate routes       # tutte le route standard
npx shopify hydrogen setup                 # scaffold route + funzionalità base
npx shopify hydrogen setup css             # aggiunge una strategia CSS
npx shopify hydrogen setup markets         # mercati multipli via URL
npx shopify hydrogen codegen               # tipi GraphQL dalle query del progetto

# Deploy e manutenzione
npx shopify hydrogen deploy                # build + deploy su Oxygen
npx shopify hydrogen upgrade               # aggiorna dipendenze + guida ai breaking change
npx shopify hydrogen customer-account-push  # push della config Customer Account all'admin
npx shopify hydrogen debug cpu             # profila il tempo di startup del server
npx shopify hydrogen shortcut              # crea l'alias globale `h2`
```

Dopo `shortcut`, tutti i comandi funzionano come `h2 dev`, `h2 deploy`, ecc.

`hydrogen upgrade` è il comando da usare per gli aggiornamenti di versione: stampa i breaking change rilevanti e le istruzioni di migrazione invece di limitarsi a bumpare i numeri di versione.

---

## Variabili d'ambiente

Dopo `hydrogen link` + `env pull` il `.env` contiene tipicamente:

```
SESSION_SECRET=...
PUBLIC_STORE_DOMAIN=...
PUBLIC_STOREFRONT_ID=...
PUBLIC_STOREFRONT_API_TOKEN=...
PRIVATE_STOREFRONT_API_TOKEN=...
PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID=...
PUBLIC_CUSTOMER_ACCOUNT_API_URL=https://shopify.com/<id>
```

Regole:

- `PUBLIC_*` finisce nel bundle client — non metterci mai segreti
- `PRIVATE_STOREFRONT_API_TOKEN` alza i rate limit lato server; resta server-side
- `.env` non va committato; le env di produzione vivono negli environment Oxygen (admin Hydrogen o `env push`)
- Limite Oxygen: **110** variabili custom per worker
- I tipi delle env vanno dichiarati in `env.d.ts`, altrimenti TypeScript non le vede sul context

Per lavorare in locale contro un environment remoto specifico: `h2 dev --env-branch <branch>`.

---

## GraphiQL e codegen

Con il dev server attivo, `http://localhost:3000/graphiql` apre un client GraphiQL già autenticato con i token del progetto — è il modo più rapido per esplorare lo schema e prototipare query prima di incollarle in un loader.

`http://localhost:3000/subrequest-profiler` mostra tutte le subrequest della pagina, con hit/miss di cache e durata. È lo strumento giusto quando l'utente dice "il sito è lento": prima si guarda il profiler, poi si ipotizza.

Codegen:

```bash
npm run codegen        # oppure: npx shopify hydrogen codegen
npx shopify hydrogen codegen --watch
```

Perché funzioni, ogni query deve iniziare con il commento magico:

```ts
const PRODUCT_QUERY = `#graphql
  query Product($handle: String!, $country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    product(handle: $handle) { id title }
  }
` as const;
```

Il `#graphql` abilita autocomplete e validazione; `as const` (in TS) permette a codegen di inferire il tipo esatto della response. I file `*.generated.d.ts` sono artefatti: si rigenerano, non si editano.

---

## Shopify AI Toolkit

Opzionale ma consigliato quando si lavora con un assistente di coding: collega l'assistente a doc, API e CLI Shopify aggiornate.

```bash
claude plugin install shopify-ai-toolkit@claude-plugins-official
```

Disponibile anche per Codex, Cursor, VS Code, Antigravity, e altri. Utile soprattutto perché compensa il ritardo della doc pubblica sulle versioni più recenti.
