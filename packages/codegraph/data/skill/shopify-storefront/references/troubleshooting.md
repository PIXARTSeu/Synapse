# Troubleshooting

Errori ricorrenti su Hydrogen, con la diagnosi prima della soluzione.

---

## Import e versioni

**`useLoaderData is not exported` / modulo non trovato**
Import sbagliato per la versione. React Router 7 → `react-router`; Remix → `@remix-run/react`; tipi server e utility Oxygen → `@shopify/remix-oxygen`. Controlla le dependencies, non la memoria. Attenzione: la doc ufficiale in alcune pagine riporta un `@react-router` che non esiste.

**Componente Hydrogen non trovato dopo un upgrade**
Tra major, alcune API vengono deprecate e rimosse (per esempio `<VariantSelector>` sostituito da `getProductOptions` + `getAdjacentAndFirstAvailableVariants`). Usa `npx shopify hydrogen upgrade`, che elenca i breaking change della versione target invece di limitarsi a bumpare le versioni.

---

## Dati e query

**La pagina mostra ancora prodotti Mock.shop dopo `hydrogen link`**
`.env` non ricaricato: riavvia il dev server. Se persiste, `npx shopify hydrogen env pull` e verifica che `PUBLIC_STORE_DOMAIN` non sia più `mock.shop`.

**`storefront.query` restituisce `null` senza errori**
Quasi sempre l'handle non esiste in quel mercato/lingua, o la query non ha `@inContext`. Prova la stessa query su `/graphiql` con le stesse variabili: se lì funziona, il problema è nelle variabili passate dal loader.

**Errori GraphQL silenziosi**
Il Storefront client fa throw sugli errori; il Customer Account client restituisce `{data, errors}` e va controllato a mano. Se una route account fallisce senza messaggio, probabilmente `errors` non viene letto.

**Tipi generati non aggiornati**
`npm run codegen`. Se codegen non vede la query, manca `#graphql` in testa al template literal (o, in TS, l'`as const`).

**404 che restituiscono 200**
Il loader restituisce `null` invece di fare `throw new Response(null, {status: 404})`. Impatta direttamente l'indicizzazione.

---

## Cache

**Le modifiche del merchant non compaiono**
`CacheLong()` su un dato che cambia più spesso di quanto pensavi. Riduci a `CacheShort()` o `CacheCustom` con `maxAge` adeguato. In dev la cache è più permissiva: verifica sempre su preview.

**Dati di un cliente visibili a un altro**
Il caso più grave. Serve `CacheNone()` sulla query **e** `Cache-Control: no-store` (o `private, max-age=<s>`) sulla response del loader. Un solo livello non basta: l'HTML renderizzato finisce nella full-page cache. Controlla ogni route `/account*` e ogni loader che usa `customerAccessToken`.

**`no-cache` sembra ignorato**
Lo è: Oxygen non emette risposte 304, quindi la direttiva non ha effetto. Usa `no-store`.

**Il sito è lento e non si capisce perché**
`http://localhost:3000/subrequest-profiler`. Cerca query duplicate tra root e route figlie, miss di cache inattesi, e dati non critici caricati in `await` che potrebbero essere deferred.

---

## Build e deploy

**Worker oltre i 10 MB**
Dipendenze pesanti importate lato server, import di intere librerie di icone, JSON grandi nel bundle. Analizza il bundle e importa solo ciò che serve.

**Startup oltre i 400 ms**
`npx shopify hydrogen debug cpu` per profilare. Di solito è lavoro fatto a module scope invece che dentro il loader.

**`fs is not defined`, `process is not defined` e simili**
Codice o dipendenza che assume Node. Oxygen è `workerd`: servono alternative edge-compatible. Emerge in `hydrogen dev` (mini-oxygen) — se non hai testato lì, emergerà in produzione.

**Funziona in locale, rotto in preview**
Nell'ordine: variabili d'ambiente mancanti sull'environment remoto (`env list`), CSP che blocca script inline senza nonce, differenze di cache tra dev e produzione.

**Deploy fallito in CI**
Token Oxygen scaduto o mancante, o environment inesistente. `npx shopify hydrogen env list` per verificare i nomi.

---

## Comportamenti strani in produzione

**Traffico legittimo throttlato**
Se è un load test, andava coordinato con Shopify 3-5 settimane prima: l'anti-bot lo classifica come traffico malevolo.

**Problemi SEO dopo il go-live**
Verifica che non ci sia un proxy davanti a Oxygen: non è supportato e genera esattamente questo sintomo. Poi controlla canonical, redirect da `storefrontRedirect`, e le URL prodotto (`/products/:handle`).

**Conversioni assenti in Shopify Analytics**
`<Analytics.Provider>` non montato in root, o mancano gli eventi per pagina (`Analytics.ProductView`, `CartView`, ecc.). Verifica con un ordine di test end-to-end.
