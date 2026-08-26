---
name: shopify-apps
description: Sviluppo di app Shopify embedded nell'admin — Polaris, App Bridge, Admin GraphQL API, session token, webhook, billing, extension. ATTIVARE SEMPRE quando l'utente menziona "app Shopify", "app embedded", "Polaris", "App Bridge", "shopify app init", "shopify app dev", "shopify app deploy", "shopify.app.toml", "access scope", "OAuth Shopify", "session token", "Admin API", "admin GraphQL", "authenticate.admin", "app extension", "admin action", "admin block", "webhook Shopify", "billing API", "Built for Shopify", "App Store Shopify", "custom app", "app proxy", "s-page", "s-section", "polaris web components". Attivare anche senza queste parole quando la richiesta descrive uno strumento per il merchant dentro il pannello Shopify - "una schermata nell'admin per gestire X", "un pannello dove il cliente configura Y", "sincronizzare ordini Shopify col gestionale", "automatizzare qualcosa lato backoffice". NON è la skill per la vetrina - quella è shopify-storefront o shopify-themes.
---

# App Shopify embedded

Un'app embedded vive in un iframe dentro l'admin Shopify (**App Home**), parla con l'admin via **App Bridge** e usa i componenti **Polaris** per sembrare parte di Shopify e non un corpo estraneo.

Questa è la superficie del *merchant*, non del cliente finale. Se la richiesta riguarda quello che vede chi compra, sei nella skill sbagliata.

---

## Attenzione: Polaris è cambiato

Il modello attuale usa **Polaris web components**, non i vecchi componenti React di `@shopify/polaris`:

```jsx
export default function App() {
  return (
    <s-page heading="La mia app">
      <s-section heading="Benvenuto">
        <s-paragraph>Contenuto della pagina.</s-paragraph>
      </s-section>
    </s-page>
  );
}
```

Sono standard Web Components: funzionano in React, Vue o vanilla JS come un `<button>` qualsiasi. Si caricano da `cdn.shopify.com/shopifycloud/polaris.js` (sempre l'ultima versione) e i tipi TypeScript arrivano da `@shopify/polaris-types`, da tenere allineato con `@latest`.

Stessa cosa per App Bridge: si carica da `cdn.shopify.com/shopifycloud/app-bridge.js`, espone la variabile globale `shopify`, e i tipi stanno in `@shopify/app-bridge-types`.

**Perché è importante saperlo:** buona parte del materiale in circolazione (e la memoria di qualsiasi modello addestrato prima) descrive lo stack precedente a componenti React con `<AppProvider>`, `@shopify/app-bridge-react` v3 e provider annidati. Se stai per scrivere quel codice, fermati e verifica com'è impostato il progetto.

---

## Scaffold

```bash
shopify app init          # scegli "Build a React Router app"
cd my-app
shopify app dev           # crea il tunnel e apre l'app nel dev store
```

Il template include App Bridge, Polaris e la gestione dell'autenticazione. Non ricostruire a mano ciò che il template già fa: l'auth di un'app embedded è il punto in cui l'improvvisazione si paga di più.

---

## Autenticazione

**Session token, mai cookie.** L'app frontend ottiene un JWT di durata brevissima da App Bridge e lo manda al proprio backend, che lo verifica con il secret condiviso.

```js
const token = await shopify.idToken();
await fetch('/api/sync-products', {
  method: 'POST',
  headers: {Authorization: `Bearer ${token}`},
});
```

I token vanno richiesti a ogni chiamata: hanno vita di circa un minuto e non si mettono in cache. Gli approcci basati su cookie falliscono negli iframe in modi che in locale non si vedono.

Nel template React Router, le route protette passano da `authenticate.admin(request)` prima di leggere qualsiasi dato del merchant.

**Direct API access.** Con la configurazione giusta, il frontend può chiamare l'Admin GraphQL API direttamente: App Bridge autentica la richiesta.

```js
const response = await fetch('shopify:admin/api/graphql.json', {
  method: 'POST',
  body: JSON.stringify({query: `query { products(first: 10) { edges { node { id title } } } }`}),
});
```

Va abilitato nel `shopify.app.toml`:

```toml
[access_scopes]
scopes = "read_products,write_products"

[access.admin]
embedded_app_direct_api_access = true
direct_api_mode = "online"
```

`online` lega il token alla sessione utente; `offline` persiste ed è quello che serve ai job di background.

---

## Struttura di lavoro

1. **Configura** `shopify.app.toml`: scope minimi necessari, URL, webhook, direct API access
2. **Costruisci le pagine** con Polaris web components; per gli elementi che stanno *fuori* dall'iframe (title bar, menu di navigazione) usa i componenti App Bridge
3. **Leggi e scrivi dati** via Admin GraphQL — dal backend con il token, o dal frontend con direct API access
4. **Reagisci agli eventi** con i webhook (HMAC verificato, handler idempotenti e veloci)
5. **Estendi altre superfici** con le extension (admin action, admin block, theme app extension, checkout UI extension, Functions)
6. **Testa** su dev store: installazione, disinstallazione, sessione di ritorno, scope mancanti, stati di billing, webhook, errori API

Dettagli su Polaris, App Bridge e pattern di pagina: `references/polaris-e-app-bridge.md`.
Admin API, webhook, billing, OAuth e deploy: `references/admin-api-e-deploy.md`.

---

## Come rispondere

**Verifica lo stack prima di scrivere.** Web components o React legacy? Template React Router o Remix? È la stessa disciplina della skill storefront, per la stessa ragione.

**Non improvvisare l'autenticazione.** Se ti trovi a scrivere logica di sessione con i cookie in un'app embedded, il progetto sta prendendo la strada sbagliata.

**Scope minimi.** Ogni permesso in più è attrito all'installazione e una domanda in più in review.

**Usa Polaris salvo motivo esplicito.** Un'app che non somiglia all'admin viene percepita come meno affidabile e disinstallata prima. Questo è l'unico contesto Shopify in cui "non fare design originale" è il consiglio giusto — l'opposto di quanto vale per una vetrina.

**Distingui custom app e app pubblica.** Un'app per un solo merchant non passa dalla review e non ha bisogno dei requisiti Built for Shopify. Una da App Store sì, e vanno considerati fin dal preventivo.

---

## File di riferimento

- `references/polaris-e-app-bridge.md` — web components, API di App Bridge, pattern di pagina, extension UI
- `references/admin-api-e-deploy.md` — Admin GraphQL, webhook, billing, hosting, deploy, Built for Shopify

## Skill collegate

- **`shopify-core`** — scelta dell'architettura, API e autenticazione, livello condiviso
- **`shopify-functions`** — le Functions sono extension di un'app: se la richiesta tocca il checkout, si lavora lì
- **`shopify-themes`** — per le theme app extension, cioè il modo corretto di portare la funzionalità dell'app dentro la vetrina
- **`shopify-storefront`** — se il merchant ha una vetrina headless che consuma i dati gestiti dall'app
