# Admin API, webhook, billing e deploy

## Indice
- [Admin GraphQL API](#admin-graphql-api)
- [Rate limit e query costose](#rate-limit-e-query-costose)
- [Bulk operations](#bulk-operations)
- [Webhook](#webhook)
- [Billing](#billing)
- [OAuth e installazione](#oauth-e-installazione)
- [Hosting e deploy](#hosting-e-deploy)
- [Built for Shopify e review](#built-for-shopify-e-review)
- [Checklist prima del lancio](#checklist-prima-del-lancio)

---

## Admin GraphQL API

Accesso completo ai dati del merchant: prodotti, ordini, clienti, inventario, fulfillment, metafield.

- Versione API dichiarata esplicitamente e aggiornata ogni trimestre
- Le mutation restituiscono `userErrors`: **vanno sempre controllati**, un 200 non significa che l'operazione sia riuscita
- Le query costano in base alla complessità, non al numero di chiamate

Codegen: mantenere i tipi GraphQL generati evita l'intera classe di bug da campo rinominato o rimosso in una nuova versione API.

---

## Rate limit e query costose

Modello a punti con leaky bucket: ogni query ha un costo calcolato sui campi richiesti, le mutation costano di più. La risposta include il costo effettivo e i punti residui — vale la pena leggerli e non ignorarli.

Quando si sbatte sui limiti:

1. Riduci i campi richiesti — molte query chiedono tre volte i dati che usano
2. Backoff esponenziale sui `THROTTLED`
3. Paginazione a pagine più piccole
4. Per i volumi grandi, bulk operations

Parallelizzare di più peggiora la situazione: il bucket è per app e per shop.

---

## Bulk operations

Per esportare o importare grandi quantità di dati (interi cataloghi, storici ordini) l'API sincrona non è la strada: si usa una bulk operation, che gira asincrona e produce un file JSONL da scaricare.

Pattern: avvii l'operazione → ricevi un ID → controlli lo stato (o ascolti il webhook) → scarichi e processi il file. Più lento a partire, incomparabilmente più affidabile su volumi grandi.

---

## Webhook

Sottoscrizioni dichiarate nel `shopify.app.toml` o create via API.

Regole non negoziabili:

- **Verifica HMAC** prima di fidarti del payload — senza, chiunque può inviarti eventi falsi
- **Idempotenza**: lo stesso evento può arrivare più volte; usa l'ID evento per deduplicare
- **Risposta rapida**: 2xx subito, elaborazione in coda. Gli handler lenti vengono considerati falliti e ritentati, generando duplicati
- **Webhook GDPR obbligatori** per le app pubbliche: richiesta dati cliente, cancellazione dati cliente, cancellazione dati shop
- **`app/uninstalled`**: pulizia dei dati e dello stato di billing

Un webhook non gestito o costantemente in errore può portare Shopify a sospendere le consegne.

---

## Billing

Modelli disponibili: abbonamento ricorrente, prova gratuita, pricing gestito da Shopify, consumo.

Pattern che funziona nel template React Router: il controllo dello stato di billing sta nel loader del layout dell'app, e chi non ha un piano attivo viene rediretto alla pagina di selezione. Così nessuna route protetta è raggiungibile senza piano, senza duplicare il controllo ovunque.

Da testare esplicitamente: prova scaduta, upgrade, downgrade, pagamento fallito, disinstallazione con abbonamento attivo. Sono gli stati in cui le app perdono soldi silenziosamente.

---

## OAuth e installazione

Il flusso lo gestisce il template, ma vale sapere cosa succede: il merchant approva gli scope → l'app riceve il codice → lo scambia per un access token → salva la sessione.

Punti di attenzione:

- **Aggiungere scope dopo il lancio** richiede riapprovazione dai merchant già installati
- **Reinstallazione**: l'app deve gestire il caso di uno shop che si reinstalla con dati residui
- **Sessioni persistenti**: vanno in un database, non in memoria — con più istanze in esecuzione, la memoria non è condivisa

---

## Hosting e deploy

L'app gira su un hosting tuo: Fly.io, Render, Google Cloud Run e simili.

```bash
shopify app deploy     # sincronizza configurazione ed extension con Shopify
```

Attenzione alla distinzione: `deploy` della CLI sincronizza **configurazione ed extension** verso Shopify, non pubblica il codice del tuo server. Quello va deployato sul tuo hosting con il tuo processo. Sono due passaggi, ed è una fonte ricorrente di "ho deployato ma non vedo le modifiche".

Requisiti pratici dell'hosting: HTTPS, latenza bassa verso i merchant, database persistente per sessioni e dati, e capacità di reggere i picchi di webhook (un import massivo del merchant genera migliaia di eventi).

---

## Built for Shopify e review

Per le app pubbliche sull'App Store esistono requisiti di qualità: performance, uso di Polaris e App Bridge, gestione dell'installazione, privacy, supporto. Rispettarli dà visibilità nell'App Store.

Non riguardano le custom app per un singolo merchant — ma buona parte sono comunque buone pratiche.

---

## Checklist prima del lancio

- [ ] Scope minimi e giustificati
- [ ] HMAC verificato su tutti i webhook
- [ ] Webhook GDPR implementati e testati
- [ ] `app/uninstalled` che pulisce davvero i dati
- [ ] Stati di billing testati end-to-end
- [ ] Sessioni persistite in database
- [ ] Gestione dei `userErrors` su ogni mutation
- [ ] Rate limit gestiti con backoff
- [ ] Nessun token o secret nei log
- [ ] Versione API dichiarata e piano di aggiornamento trimestrale
- [ ] Testato su dev store: installazione, reinstallazione, disinstallazione, scope mancanti
