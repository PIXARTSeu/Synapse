# Data fetching e caching

## Indice
- [Il modello mentale](#il-modello-mentale)
- [Query al Storefront API](#query-al-storefront-api)
- [Query al Customer Account API](#query-al-customer-account-api)
- [Mutation con le action](#mutation-con-le-action)
- [Dati critici vs non critici](#dati-critici-vs-non-critici)
- [Paginazione](#paginazione)
- [Strategie di cache](#strategie-di-cache)
- [Dati cliente e cache — il rischio da non sbagliare](#dati-cliente-e-cache--il-rischio-da-non-sbagliare)
- [API di terze parti](#api-di-terze-parti)
- [Diagnosi](#diagnosi)

---

## Il modello mentale

Tutti i dati passano dai **loader** (lettura, server-side) e dalle **action** (scrittura). Niente `useEffect` + `fetch` per dati Shopify: rompe l'SSR, peggiora LCP e SEO, e bypassa la cache di Oxygen.

I client API arrivano dal `context`, già autenticati:

- `context.storefront` → Storefront API (catalogo, contenuti, cart) — **cachato di default**
- `context.customerAccount` → Customer Account API (ordini, indirizzi, profilo) — **mai cachato**
- `context.cart` → cart handler
- `context.env` → variabili d'ambiente tipizzate
- `context.session` → sessione

Le route annidate caricano in parallelo: è il motivo per cui conviene spezzare il layout in route annidate invece di caricare tutto in un unico loader di root.

---

## Query al Storefront API

```jsx
// app/routes/products.$handle.jsx
// NOTA: l'import di useLoaderData dipende dalla versione —
// React Router 7 → 'react-router' | Remix → '@remix-run/react'
import {useLoaderData} from 'react-router';

export async function loader({params, context}) {
  const {handle} = params;
  const {storefront} = context;

  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle},
    cache: storefront.CacheLong(),
  });

  if (!product) {
    throw new Response('Product not found', {status: 404});
  }

  return {product};
}

export default function Product() {
  const {product} = useLoaderData();
  return <h1>{product.title}</h1>;
}

const PRODUCT_QUERY = `#graphql
  query Product($handle: String!, $country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      title
    }
  }
`;
```

Punti che fanno la differenza:

- `throw new Response(..., {status: 404})` invece di restituire `null`: React Router intercetta il throw e mostra la ErrorBoundary con lo status HTTP corretto. Restituire `null` produce un 200 su una pagina vuota — pessimo per SEO.
- La direttiva `@inContext(country:, language:)` è ciò che fa funzionare prezzi e traduzioni per mercato. `storefront.query` inietta automaticamente `country`/`language` dalla configurazione i18n.
- Sempre `#graphql` in testa alla query.

---

## Query al Customer Account API

```jsx
// app/routes/account.orders.$id.jsx
import {useLoaderData} from 'react-router';

export async function loader({params, context}) {
  const orderId = atob(params.id);

  const {data, errors} = await context.customerAccount.query(CUSTOMER_ORDER_QUERY, {
    variables: {orderId},
  });

  if (errors?.length || !data?.order) {
    throw new Error('Order not found');
  }

  return {order: data.order};
}
```

Differenze rispetto al Storefront client, da tenere a mente:

- La response ha forma `{data, errors}` — vanno controllati entrambi
- Nessuna opzione `cache`: questo client non cacha mai, per design (i dati sono personali)
- Gli ID ordine nell'URL sono base64: `atob(params.id)`
- Richiede sessione autenticata; le route `/account*` vanno protette con il login flow del Customer Account API

---

## Mutation con le action

```jsx
export async function action({request, context}) {
  const formData = await request.formData();
  const {storefront} = context;

  const result = await storefront.mutate(SOME_MUTATION, {
    variables: {input: Object.fromEntries(formData)},
  });

  if (result.userErrors?.length) {
    return {errors: result.userErrors};
  }
  return {success: true};
}
```

`storefront.mutate` non cacha mai. Le mutation del carrello passano invece da `CartForm` (vedi `componenti-e-cart.md`) — non ricostruirle a mano.

Le action lavorano su `FormData` web-standard: se il markup usa `<Form method="post">`, la feature funziona anche senza JavaScript e viene poi migliorata dal client. È il motivo per cui vale la pena non sostituirle con handler `onClick` + fetch.

---

## Dati critici vs non critici

Non tutto deve bloccare il rendering. Pattern standard su PDP e PLP: carica in `await` solo ciò che serve per l'above-the-fold, e lascia il resto come promise non attesa.

```jsx
export async function loader(args) {
  const deferredData = loadDeferredData(args);   // NON awaited
  const criticalData = await loadCriticalData(args);
  return {...criticalData, ...deferredData};
}

function loadDeferredData({context, params}) {
  // niente await, niente throw: gli errori vanno gestiti nel .catch
  const recommended = context.storefront
    .query(RECOMMENDED_QUERY, {variables: {handle: params.handle}})
    .catch((error) => {
      console.error(error);
      return null;
    });
  return {recommended};
}
```

Lato componente si consuma con `<Await>` dentro `<Suspense>`. Regola: un errore in un blocco deferred non deve mai far fallire la pagina — sempre un `.catch` che degrada.

---

## Paginazione

Per collezioni grandi, `getPaginationVariables` + il componente `Pagination`:

```jsx
import {getPaginationVariables, Pagination} from '@shopify/hydrogen';

export async function loader({request, context, params}) {
  const paginationVariables = getPaginationVariables(request, {pageBy: 24});
  const {collection} = await context.storefront.query(COLLECTION_QUERY, {
    variables: {handle: params.handle, ...paginationVariables},
  });
  return {collection};
}
```

La query deve accettare `$first, $last, $startCursor, $endCursor` ed esporre `pageInfo { hasPreviousPage hasNextPage startCursor endCursor }`. Il componente `Pagination` gestisce lo stato URL, così la pagina è condivisibile e indicizzabile — a differenza di un infinite scroll fatto in client state.

---

## Strategie di cache

| Strategia | Header | Durata effettiva |
|---|---|---|
| `CacheShort()` | `public, max-age=1, stale-while-revalidate=9` | 10 secondi |
| `CacheLong()` | `public, max-age=3600, stale-while-revalidate=82800` | 1 giorno |
| `CacheNone()` | `no-store` | nessuna cache |
| `CacheCustom()` | definito da te | custom |

Default applicato se ometti `cache`: `public, max-age=1, stale-while-revalidate=86399`.

```js
storefront.CacheCustom({
  mode: 'must-revalidate, no-transform',
  maxAge: 30,
});
```

Opzioni di `CacheCustom`:

| Opzione | Tipo | Significato |
|---|---|---|
| `mode` | string | direttive separate da virgola: `public`, `private`, `no-store`, `must-revalidate`, `no-transform` |
| `maxAge` | number | secondi di freschezza |
| `staleWhileRevalidate` | number | secondi in cui servire stale mentre si rigenera in background |
| `sMaxAge` | number | secondi di storage per proxy/CDN |
| `staleIfError` | number | secondi di stale in caso di 5xx — **ignorato sulle subrequest**, lì usa `staleWhileRevalidate` |

`no-cache` **non è supportato** da Oxygen: implica una risposta 304 che Oxygen non emette, quindi la direttiva non ha alcun effetto. Se serve "sempre fresco", è `no-store`.

Criterio pratico per scegliere: `CacheLong` per ciò che cambia con un deploy o con un'edit del merchant (titoli, descrizioni, menu, pagine, policy); `CacheShort` per ciò che cambia da solo (stock, prezzi in promo, badge disponibilità); `CacheNone` per tutto ciò che dipende dall'utente.

---

## Dati cliente e cache — il rischio da non sbagliare

Il Customer Account API è al sicuro per costruzione. Il problema è la query `customer` del **Storefront** API: restituisce dati personali e viene cachata come qualsiasi altra query.

Servono **due** interventi, non uno.

**1. Subrequest cache off:**

```jsx
const {customer} = await storefront.query(CUSTOMER_QUERY, {
  variables: {customerAccessToken: context.session.get('customerAccessToken')},
  cache: storefront.CacheNone(),
});
```

**2. Full-page cache off** — altrimenti l'HTML già renderizzato con nome ed email finisce nella full-page cache di Oxygen e viene servito ad altri utenti:

```jsx
return data(
  {customer},
  {headers: {'Cache-Control': 'no-store'}},
);
// oppure, per permettere solo la cache del browser dello stesso utente:
// {headers: {'Cache-Control': 'private, max-age=60'}}
```

Un header `public` — o l'assenza di header — su una route con dati cliente espone nomi, email e storico ordini ad altri visitatori. Quando revisioni codice altrui, questa è la prima cosa da cercare su ogni route `/account*`.

---

## API di terze parti

CMS, recensioni, servizi esterni: si chiamano dal loader come qualsiasi fetch, ma conviene passare da `createWithCache` (configurato in `server.js`) per ottenere lo stesso comportamento di cache delle query Shopify.

```js
const data = await context.withCache.fetch(
  'https://api.esempio.com/reviews',
  {headers: {Authorization: `Bearer ${context.env.REVIEWS_TOKEN}`}},
  {cacheKey: ['reviews', productId], cacheStrategy: CacheLong()},
);
```

I nomi esatti e la firma variano tra versioni di Hydrogen: verifica su `shopify.dev` o nel `server.js` del progetto prima di scriverlo. Il concetto che non cambia: **una chiave di cache esplicita e una strategia esplicita**, perché una API esterna lenta o giù non deve trascinare giù la pagina prodotto.

Vincolo Oxygen: le richieste in uscita devono completarsi entro **2 minuti**, e ogni richiesta ha un budget di 30 secondi di CPU.

---

## Diagnosi

Quando la performance non torna:

1. `http://localhost:3000/subrequest-profiler` — quali subrequest partono, quali fanno hit e quali miss, quanto durano
2. Query duplicate tra `root.jsx` e le route figlie: sintomo classico, si risolve spostando il dato nel loader giusto
3. Query cachate `CacheNone` senza motivo (copiate da un esempio account)
4. Dati non critici in `await` che bloccano il primo byte — candidati al deferred
5. `npx shopify hydrogen debug cpu` se il problema è il tempo di startup del worker (limite: 400 ms)
