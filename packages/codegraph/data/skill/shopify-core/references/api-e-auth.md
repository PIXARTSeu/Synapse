# API, autenticazione e integrazioni

## Indice
- [Quale API per quale caso](#quale-api-per-quale-caso)
- [Storefront API](#storefront-api)
- [Admin GraphQL API](#admin-graphql-api)
- [Customer Account API](#customer-account-api)
- [Access scope](#access-scope)
- [Webhook](#webhook)
- [Rate limit](#rate-limit)
- [Metafield e metaobject](#metafield-e-metaobject)
- [Regole di sicurezza non negoziabili](#regole-di-sicurezza-non-negoziabili)

---

## Quale API per quale caso

| Devi… | API |
|---|---|
| Mostrare prodotti, collezioni, contenuti in una vetrina | Storefront |
| Gestire il carrello di un cliente | Storefront (cart) |
| Leggere o modificare ordini, inventario, clienti dal backoffice | Admin |
| Mostrare a un cliente loggato i suoi ordini e indirizzi | Customer Account |
| Applicare uno sconto o bloccare un checkout | Functions (non è una API che chiami: è codice che Shopify esegue) |

L'errore classico è usare l'Admin API per leggere prodotti in una vetrina: espone un token con permessi di scrittura e viola i rate limit. La vetrina usa la Storefront API, sempre.

---

## Storefront API

GraphQL pubblica, pensata per essere esposta al client.

- **Token pubblico** (`PUBLIC_STOREFRONT_API_TOKEN`): può stare nel browser
- **Token privato** (`PRIVATE_STOREFRONT_API_TOKEN`): solo server-side, alza i rate limit
- Direttiva `@inContext(country:, language:)` per prezzi e traduzioni per mercato
- Le risposte sono cachabili — con l'eccezione critica dei dati cliente (vedi `shopify-storefront`)

---

## Admin GraphQL API

Accesso completo ai dati del merchant. Richiede OAuth e access token.

**Token online** — legati alla sessione dell'utente corrente, scadono. Per azioni fatte da una persona.
**Token offline** — persistono, per job di background e webhook.

Nelle app embedded moderne non si maneggiano token a mano: il template React Router li gestisce, l'app frontend ottiene un **session token** (JWT di durata brevissima, richiesto a ogni chiamata) e il backend lo verifica. Con il direct API access abilitato, il frontend può anche chiamare l'Admin API direttamente tramite App Bridge, che autentica la richiesta.

Dettagli operativi: skill `shopify-apps`.

---

## Customer Account API

Per le aree cliente autenticate: ordini, indirizzi, profilo, e le funzionalità B2B.

- Non viene **mai** cachata: i dati sono personali
- Risposte in forma `{data, errors}` — vanno controllati entrambi
- Sostituisce il vecchio modello `customerAccessToken` dello Storefront API

Attenzione: la query `customer` esiste **anche** sullo Storefront API ed è cachata di default. È la fonte del bug di privacy più grave dello stack headless — vedi `shopify-storefront/references/data-e-caching.md`.

---

## Access scope

Definiscono cosa l'app può leggere e scrivere. Si dichiarano in `shopify.app.toml`:

```toml
[access_scopes]
scopes = "read_products,write_products"
```

Il merchant li approva all'installazione. Due regole:

- **Chiedi solo quello che ti serve.** Gli scope eccessivi abbassano il tasso di installazione e sono un problema in review.
- **Aggiungere uno scope dopo il lancio richiede una riapprovazione** da parte dei merchant già installati: pianificalo prima.

---

## Webhook

Per reagire a eventi: ordini creati, prodotti aggiornati, app disinstallata, richieste GDPR.

Non negoziabili:

- **Verifica HMAC** su ogni webhook prima di fidarti del payload
- **Idempotenza**: Shopify può consegnare lo stesso evento più volte
- **Rispondi in fretta** (2xx), poi elabora in coda: gli handler lenti vengono considerati falliti e ritentati
- **Webhook GDPR obbligatori** per le app: richiesta dati cliente, cancellazione dati cliente, cancellazione dati shop

---

## Rate limit

- **Admin GraphQL**: modello a punti con leaky bucket — il costo dipende dalla complessità della query, non dal numero di chiamate. Query più snelle costano meno; le mutation costano di più.
- **Storefront API**: limiti legati al token; quello privato è più generoso.
- **Bot e agenti**: dal 2026 chi non firma le richieste (Web Bot Auth) finisce nella fascia più restrittiva. Vale per gli agenti AI che navigano il catalogo e per le integrazioni automatiche del cliente.

Pattern corretto quando si sbatte sui limiti: backoff esponenziale, query più piccole, `bulk operations` per i volumi grandi. Non parallelizzare di più: peggiora.

---

## Metafield e metaobject

Il modo supportato di estendere il modello dati, leggibile da tutte le superfici.

- **Metafield**: campi custom su risorse esistenti (prodotto, variante, cliente, ordine…)
- **Metaobject**: entità custom intere (es. "scheda materiale", "punto vendita", "designer")

Vantaggi rispetto a un database esterno: li gestisce il merchant dall'admin, sono interrogabili da Liquid, Storefront API e input query delle Functions, e non aggiungono un servizio da mantenere.

Limite da conoscere: le scritture di metafield JSON hanno un tetto di dimensione (128 KB dalla versione 2026-04). Se il dato è più grosso, il modello è sbagliato.

---

## Regole di sicurezza non negoziabili

- Nessun token Admin nel client, mai
- Nessun segreto nelle variabili `PUBLIC_*`
- Verifica HMAC su webhook e app proxy
- Nessun log di token o secret
- Rotazione dei token quando un collaboratore lascia il progetto
- Su app pubbliche: gestione esplicita dei dati cliente e webhook GDPR implementati davvero, non solo dichiarati
