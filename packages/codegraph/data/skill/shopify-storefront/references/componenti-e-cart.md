# Componenti, cart, varianti, analytics, SEO

> ⚠️ Alcune API di questo file sono cambiate tra le major di Hydrogen (in particolare la selezione varianti tra 2024.x e 2025.x). Prima di scrivere codice, controlla la versione con `scripts/inspect-project.sh` e, se l'API non è quella che ti aspetti, verifica su `shopify.dev/docs/api/hydrogen`.

## Indice
- [Componenti di base](#componenti-di-base)
- [Il carrello](#il-carrello)
- [Varianti prodotto e URL della PDP](#varianti-prodotto-e-url-della-pdp)
- [Analytics](#analytics)
- [SEO](#seo)
- [Mercati e i18n](#mercati-e-i18n)
- [Content Security Policy](#content-security-policy)

---

## Componenti di base

Da `@shopify/hydrogen`:

**`<Image>`** — genera `srcset` e `sizes` per il CDN Shopify, con dimensioni corrette per evitare CLS.

```jsx
<Image
  data={product.featuredImage}
  aspectRatio="1/1"
  sizes="(min-width: 45em) 50vw, 100vw"
  loading="eager"   // eager solo per l'immagine above-the-fold
/>
```

Usare `<img>` grezzo su immagini Shopify è uno degli errori più costosi in termini di LCP: si perdono responsive srcset e ottimizzazione formato.

**`<Money>`** — formatta secondo valuta e locale del mercato attivo.

```jsx
<Money data={product.priceRange.minVariantPrice} />
```

Non formattare i prezzi a mano: la valuta cambia per mercato e la formattazione non è la stessa in ogni locale.

**`<RichText>`** — renderizza i campi metafield `rich_text_field` senza `dangerouslySetInnerHTML`.

**`<ProductPrice>` / `<AddToCartButton>`** — presenti negli starter template come componenti dell'app (in `app/components/`), non come export della libreria. Se il progetto li ha, riusali invece di duplicarne la logica.

---

## Il carrello

Il cart handler è sul context (`context.cart`), configurato in `server.js`. Le mutation passano da `CartForm`, che serializza l'azione e i dati nel form: funziona senza JS e viene poi migliorato dal client.

**Aggiunta al carrello:**

```jsx
import {CartForm} from '@shopify/hydrogen';

<CartForm
  route="/cart"
  action={CartForm.ACTIONS.LinesAdd}
  inputs={{lines: [{merchandiseId: variant.id, quantity: 1}]}}
>
  {(fetcher) => (
    <button type="submit" disabled={fetcher.state !== 'idle'}>
      {variant.availableForSale ? 'Aggiungi al carrello' : 'Esaurito'}
    </button>
  )}
</CartForm>
```

**Route `/cart` — action:**

```jsx
export async function action({request, context}) {
  const {cart} = context;
  const formData = await request.formData();
  const {action, inputs} = CartForm.getFormInput(formData);

  let result;
  switch (action) {
    case CartForm.ACTIONS.LinesAdd:
      result = await cart.addLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesUpdate:
      result = await cart.updateLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesRemove:
      result = await cart.removeLines(inputs.lineIds);
      break;
    case CartForm.ACTIONS.DiscountCodesUpdate:
      result = await cart.updateDiscountCodes(inputs.discountCodes);
      break;
    default:
      throw new Error(`Cart action non gestita: ${action}`);
  }

  // il cart handler restituisce anche gli header con il cart id da propagare
  return data(result, {headers: result.headers});
}
```

Azioni disponibili su `CartForm.ACTIONS`: `LinesAdd`, `LinesUpdate`, `LinesRemove`, `DiscountCodesUpdate`, `GiftCardCodesUpdate`, `NoteUpdate`, `BuyerIdentityUpdate`, `AttributesUpdateInput`, `MetafieldsSet`, `MetafieldDelete`.

**Ottimistic UI:** `useOptimisticCart(cart)` (Hydrogen 2024.10+) rende immediati aggiunte e rimozioni senza aspettare il round-trip. Senza, il carrello sembra lento anche quando non lo è.

**Checkout:** non si implementa. Il cart espone `checkoutUrl` — è un URL Shopify, ci si fa un redirect e basta. Vale la pena supportare anche i [cart permalink](https://help.shopify.com/en/manual/checkout-settings/cart-permalink) (`/cart/:lines`) perché li usano campagne e link esterni.

---

## Varianti prodotto e URL della PDP

Principio invariato tra le versioni: **la variante selezionata deve stare nell'URL** come query string (`?Color=Blue&Size=M`), non solo nello state React. Serve per condivisibilità, back button, indicizzazione e analytics.

Nel loader si legge la selezione dalla request:

```jsx
import {getSelectedProductOptions} from '@shopify/hydrogen';

const selectedOptions = getSelectedProductOptions(request);
```

**Hydrogen 2025.x** — le opzioni si costruiscono con `getProductOptions` e `getAdjacentAndFirstAvailableVariants`, che gestiscono anche le combinazioni non disponibili e i prodotti combined-listing:

```jsx
import {getProductOptions, getAdjacentAndFirstAvailableVariants} from '@shopify/hydrogen';
```

**Hydrogen 2024.x** — si usava il componente `<VariantSelector>`, ora deprecato.

Se il progetto è su una versione che non conosci con certezza, verifica quale delle due API è disponibile prima di scrivere il componente: sono incompatibili tra loro.

La query prodotto deve includere `selectedOptions` con `@inContext` e i campi `options { name optionValues { name } }` + `selectedOrFirstAvailableVariant`.

---

## Analytics

Se manca, il merchant perde le conversioni in Shopify Analytics — ed è il primo reclamo dopo un go-live.

In `root.jsx`, avvolgi l'app:

```jsx
import {Analytics, getShopAnalytics} from '@shopify/hydrogen';

<Analytics.Provider cart={data.cart} shop={data.shop} consent={data.consent}>
  {children}
</Analytics.Provider>
```

`getShopAnalytics({storefront, publicStorefrontId: env.PUBLIC_STOREFRONT_ID})` nel loader di root fornisce `shop`. Il `consent` richiede `checkoutDomain` e `storefrontAccessToken` — necessario per il Customer Privacy API e la conformità GDPR.

Poi, per pagina:

```jsx
<Analytics.ProductView data={{products: [{id, title, price, vendor, variantId, variantTitle, quantity: 1}]}} />
<Analytics.CollectionView data={{collection: {id, handle}}} />
<Analytics.CartView />
<Analytics.SearchView data={{searchTerm, searchResults}} />
```

Per eventi custom o integrazioni terze (GA4, Meta), `useAnalytics()` espone il publish/subscribe degli eventi.

---

## SEO

`getSeoMeta` (o le utility SEO della versione in uso) costruisce i meta tag dai dati Shopify:

```jsx
export const meta = ({data}) => {
  return getSeoMeta({
    title: data?.product?.seo?.title ?? data?.product?.title,
    description: data?.product?.seo?.description,
    media: data?.product?.featuredImage?.url,
    jsonLd: {/* Product structured data */},
  });
};
```

Cose che vanno controllate prima del go-live:

- Ogni route ha `meta` con title e description dai campi `seo` di Shopify
- URL canonici coerenti (attenzione ai duplicati generati dalle query string delle varianti)
- Structured data `Product` con prezzo e disponibilità sulle PDP, `BreadcrumbList` sulle PLP
- `sitemap.xml` e `robots.txt` generati (route standard dello starter)
- 404 reali: `throw new Response(null, {status: 404})`, mai una pagina vuota con status 200
- `storefrontRedirect` agganciato in `server.js`, così i redirect configurati nell'admin Shopify continuano a funzionare dopo la migrazione da Liquid

La struttura URL attesa da Shopify per i prodotti è `/products/:handle`. Se il progetto usa altro, serve un redirect 3XX server-side dal path canonico — lo assumono integrazioni, app e feed.

---

## Mercati e i18n

```bash
npx shopify hydrogen setup markets
```

Configura il prefisso locale nell'URL (`/en-ca/products/...`) tramite route `($locale)`. Il locale attivo viene passato allo Storefront client, che inietta `@inContext(country:, language:)` in ogni query — da lì derivano prezzi in valuta locale e traduzioni.

Con i mercati attivi serve anche `hreflang` nei meta e una gestione esplicita del locale di default (di solito senza prefisso).

---

## Content Security Policy

Hydrogen genera un nonce per richiesta in `entry.server.jsx` tramite `createContentSecurityPolicy`. Ogni script inline aggiunto a mano deve ricevere quel nonce, altrimenti viene bloccato in produzione ma non necessariamente in dev — un classico "funziona in locale, rotto in preview".

Domini di terze parti (analytics, chat, recensioni) vanno aggiunti esplicitamente alle direttive CSP.
