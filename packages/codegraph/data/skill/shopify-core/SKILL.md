---
name: shopify-core
description: Hub per lo sviluppo su Shopify — sceglie la superficie giusta (tema Liquid, storefront headless, app embedded, Functions) e copre il livello condiviso a tutte - versioni API trimestrali, CLI, dev store, autenticazione, metafield e metaobject, webhook, rate limit, compliance UE. ATTIVARE SEMPRE quando l'utente parla di Shopify senza specificare la superficie ("progetto Shopify", "e-commerce Shopify", "cliente su Shopify", "quanto costa fare X su Shopify", "meglio tema o headless", "sviluppo Shopify"), quando la domanda riguarda API version, access scope, OAuth, Admin API, Storefront API, Customer Account API, metafield, metaobject, webhook, GDPR webhook, rate limit, Shopify CLI, dev store, Partner o Dev Dashboard, Shopify Plus, o quando serve decidere l'architettura prima di scrivere codice. Se la richiesta riguarda chiaramente una sola superficie, questa skill indirizza alla skill specifica invece di rispondere da sola.
---

# Shopify — hub e livello condiviso

Shopify non è una piattaforma sola: sono quattro superfici con stack, limiti e modelli di prezzo diversi. Sbagliare superficie all'inizio è l'errore più costoso di tutto il progetto, perché non si corregge senza riscrivere.

## Instradamento

| La richiesta riguarda | Skill |
|---|---|
| Vetrina headless in React, Hydrogen, Oxygen, Storefront API, migrazione da Liquid a React | **`shopify-storefront`** |
| App embedded nell'admin, Polaris, App Bridge, Admin GraphQL API, OAuth, billing, webhook applicativi | **`shopify-apps`** |
| Tema Liquid, Dawn, Online Store 2.0, sezioni e blocchi, theme editor | **`shopify-themes`** |
| Logica dentro il checkout: sconti, validazioni, spedizione, pagamenti, bundle | **`shopify-functions`** |

Se una richiesta ne tocca due (caso frequente: un'app che installa anche un theme app extension, o uno storefront headless che ha bisogno di una discount Function), leggi entrambe le skill: sono progettate per convivere.

---

## Scegliere la superficie

Prima domanda da fare al cliente, sempre: **cosa deve fare l'utente finale che oggi non può fare?** Quasi tutte le richieste di "rifacimento" si risolvono con un tema ben fatto, e il headless viene proposto per ragioni estetiche che un tema copre a un decimo del costo.

Criteri che spostano davvero la decisione:

**Resta su tema Liquid** se: il catalogo è standard, il budget è sotto la soglia di un progetto custom, il merchant vuole autonomia nel theme editor, non ci sono integrazioni pesanti. È anche l'unica opzione in cui il merchant può modificare la vetrina senza sviluppatore.

**Vai headless** se: serve una UI che il theme editor non può esprimere, ci sono più sorgenti dati (CMS, PIM, ERP), servono performance su cataloghi enormi, o il frontend deve servire anche altri canali. Costo reale: sviluppo iniziale più alto **e** manutenzione trimestrale continua. Se il cliente non ha budget per la seconda, non ha budget per il headless.

**Costruisci un'app** se: la funzionalità va usata da più merchant, o serve toccare l'admin, o serve logica server persistente. Un'app per un solo cliente è una custom app; una per il mercato è una App Store app, con requisiti di review e Built for Shopify.

**Usa una Function** se: la logica deve girare *dentro* il checkout — sconti, validazioni, filtri di pagamento o spedizione. Non è opzionale: il checkout non è modificabile in altro modo.

Approfondimento con costi e domande da fare in fase di preventivo: `references/scelta-architettura.md`.

---

## Versioni API: il vincolo che governa tutto

Shopify rilascia una versione API **ogni trimestre** (`2026-04`, `2026-07`, …) e ogni versione può contenere breaking change. Le versioni vengono poi ritirate.

Conseguenze da mettere nero su bianco al cliente:

- Un progetto Shopify ha un costo di manutenzione ricorrente, non una consegna una tantum
- Le versioni di Hydrogen seguono le API (`2026.4.x` ↔ Storefront API `2026-04`)
- Un progetto fermo da un anno non si aggiorna, si migra

Prima di scrivere codice su qualsiasi superficie, **verifica quale versione API usa il progetto**. E prima di dare per buona un'API a memoria, controlla il changelog: questo ecosistema si muove più in fretta di qualsiasi training data.

---

## Le API e chi le usa

| API | Chi la usa | Autenticazione |
|---|---|---|
| **Storefront API** | Vetrine (headless, temi, canali custom) | Token pubblico + token privato lato server |
| **Admin GraphQL API** | App e integrazioni backoffice | OAuth → access token; nelle app embedded, session token |
| **Customer Account API** | Aree cliente autenticate | Login del cliente, mai cachata |
| **Functions API** | Logica di checkout | Nessuna: input query dichiarativa, sandbox Wasm |

Regola trasversale: **l'Admin API non si chiama mai da codice client**. Se ti trovi a pensarlo, la superficie scelta è sbagliata.

Dettagli su token, scope, OAuth, session token e quale usare quando: `references/api-e-auth.md`.

---

## Livello dati condiviso

**Metafield e metaobject** sono il modo corretto di estendere il modello dati Shopify, e funzionano su tutte le superfici: un metaobject definito una volta è leggibile da un tema Liquid, da uno storefront Hydrogen e da una Function. Prima di aggiungere un database esterno per dati che riguardano prodotti o ordini, verifica se metafield e metaobject bastano — quasi sempre sì, e il merchant li gestisce dall'admin.

**Webhook** per reagire agli eventi (ordini, prodotti, disinstallazione app). Vanno verificati con HMAC, gestiti come idempotenti (Shopify può consegnare più volte) e risposti in fretta: la logica lenta va in coda, non nell'handler.

**Rate limit.** Storefront API a costo, Admin GraphQL a punti con leaky bucket. Dal 2026 bot e agenti che non firmano le richieste (Web Bot Auth) finiscono nella fascia più restrittiva: rilevante sia se il cliente riceve traffico da agenti AI, sia se fa integrazioni automatiche verso il proprio store.

---

## Strumenti

Una CLI unica, con sottocomandi per superficie:

```bash
shopify app ...       # app e Functions
shopify theme ...     # temi
shopify hydrogen ...  # storefront headless
shopify store ...     # gestione store
```

Store di sviluppo dal Dev Dashboard (l'evoluzione del Partner Dashboard): gratuiti, senza limiti di test, ma con vincoli specifici — per esempio niente environment pubblici su Oxygen.

**Shopify AI Toolkit** collega l'assistente di coding a doc, API e CLI aggiornate. Vale la pena installarlo proprio perché compensa il ritardo strutturale del training data su questo ecosistema:

```bash
claude plugin install shopify-ai-toolkit@claude-plugins-official
```

---

## Compliance (mercato UE)

Due cose che sui progetti italiani ed europei vanno messe a preventivo, non scoperte dopo:

- **GDPR**: le app devono implementare i webhook obbligatori di richiesta e cancellazione dati. Per gli storefront, gestione del consenso e Customer Privacy API.
- **European Accessibility Act**: gli e-commerce rientrano nell'ambito. Su tema o headless cambia l'implementazione, non l'obbligo — vedi le sezioni accessibilità nelle skill specifiche.

---

## Come rispondere

**Prima la superficie, poi il codice.** Se la richiesta non chiarisce se si parla di tema, headless, app o Function, chiedilo: la risposta cambia completamente e una risposta sulla superficie sbagliata è peggio di nessuna risposta.

**Verifica le versioni prima di scrivere.** Vale su tutte e quattro le superfici e su questa skill stessa.

**Non promettere quello che il checkout non permette.** Il checkout è di Shopify. Si estende con Functions e checkout UI extensions (queste ultime con vincoli di piano), non si riscrive.

**Sii onesto sul costo ricorrente.** Cadenza trimestrale delle API significa manutenzione. Un preventivo che la omette è un preventivo sbagliato, e il conto arriva comunque.

---

## File di riferimento

- `references/scelta-architettura.md` — framework di decisione tema/headless/app/Function, costi, domande da fare al cliente
- `references/api-e-auth.md` — le quattro API, token, scope, OAuth, session token, webhook, rate limit

## Skill collegate

Questa skill instrada verso: **`shopify-storefront`**, **`shopify-apps`**, **`shopify-themes`**, **`shopify-functions`**.
