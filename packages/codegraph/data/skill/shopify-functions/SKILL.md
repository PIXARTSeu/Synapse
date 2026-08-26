---
name: shopify-functions
description: Shopify Functions — logica custom eseguita dentro il checkout - sconti, validazioni carrello e checkout, personalizzazione spedizione e pagamento, cart transform e bundle. ATTIVARE SEMPRE quando l'utente menziona "Shopify Functions", "discount function", "validation function", "delivery customization", "payment customization", "cart transform", "shopify app generate extension", "function replay", "shopify.extension.toml", "input query", "Shopify Scripts", "migrare gli Scripts", "sconto custom Shopify", "regole di checkout", "checkout rules", "BOGO", "gift with purchase", "bundle Shopify", "nascondere metodo di spedizione", "nascondere metodo di pagamento", "bloccare il checkout". Attivare anche quando la richiesta descrive una regola commerciale senza nominare le Functions - "sconto del 20% al terzo prodotto", "spedizione gratis sopra i 100 euro", "impedire l'ordine se il carrello contiene X e Y", "prezzi B2B", "limite massimo d'ordine". Se la logica deve valere al checkout, è questa la skill.
---

# Shopify Functions

Le Functions sono codice compilato in WebAssembly che Shopify esegue **dentro** la propria pipeline di checkout. Hanno sostituito gli Scripts (Ruby, solo Plus) e funzionano su tutti i piani.

Sono l'unico modo supportato di cambiare il comportamento del checkout. Se una regola commerciale deve valere al momento del pagamento, non esistono alternative: né il frontend, né un webhook, né un'app possono farlo.

---

## Il modello mentale

Tre passaggi, e il primo è quello che conta:

1. **Input** — dichiari con una query GraphQL esattamente quali dati ti servono (carrello, cliente, prodotti, metafield). Shopify ti passa solo quelli.
2. **Logica** — il tuo codice, compilato in Wasm, gira in una sandbox con un budget di risorse stretto.
3. **Output** — restituisci **operazioni** (applica sconto, aggiungi errore di validazione, nascondi metodo di spedizione), non effetti collaterali.

Da qui derivano i vincoli che sorprendono chi arriva da altri stack:

- **Nessuna chiamata di rete** nel modello base. I dati esterni vanno portati dentro *prima*, come metafield o attributi del carrello, tramite un job dell'app. (Per alcuni tipi di function esiste un accesso di rete documentato: verifica sulla doc se il tuo caso rientra, non darlo per scontato.)
- **Esecuzione deterministica**: niente orologio affidabile, niente casualità reale. Per la logica temporale usa dati preparati a monte.
- **Budget di esecuzione stretto.** Le funzioni che lo superano vengono interrotte e le loro operazioni ignorate — silenziosamente per l'utente, non per il merchant.

Le Functions sono un'**extension di un'app**: anche per un solo merchant serve un'app (custom app) che le contenga.

---

## Workflow

```bash
shopify app generate extension --template cart_checkout_validation --name mia-validazione
```

Alla richiesta del linguaggio: Rust, JavaScript, TypeScript o Wasm. **Shopify consiglia Rust** come scelta più performante per restare dentro i limiti della piattaforma; JavaScript è più che sufficiente per la logica semplice e riduce la barriera d'ingresso se il team non conosce Rust. Per Rust serve il target `wasm32-unknown-unknown`.

```bash
# 1. Definisci l'input in src/<target>.graphql — solo i campi che usi davvero
# 2. Se sei in JS/TS, rigenera i tipi
shopify app function typegen

# 3. Implementa la logica in src/<target>.rs o .js
# 4. Preview sul dev store (rebuild automatico a ogni modifica)
shopify app dev

# 5. Debug: riesegui in locale un'esecuzione reale
shopify app function replay
```

`function replay` è lo strumento che cambia la produttività: riprende un'esecuzione avvenuta davvero e la riesegue in locale, senza dover ricreare il carrello nello store a ogni tentativo.

Dopo il deploy, la function va **attivata** dal merchant nell'admin (per le validazioni: Impostazioni → Check-out → Regole di check-out; per gli sconti, dalla sezione sconti). Deployata non significa attiva: è la causa più comune di "l'ho pubblicata ma non fa niente".

Target disponibili, esempi di codice e configurazione: `references/targets-e-esempi.md`.

---

## Configurazione

`shopify.extension.toml` dichiara i target, la input query e la build:

```toml
[[extensions.targeting]]
target = "cart.validations.generate.run"
input_query = "src/cart_validations_generate_run.graphql"
export = "cart_validations_generate_run"
```

Il `target` determina dove e quando Shopify esegue il codice. Sbagliare target è l'errore strutturale più frequente: una logica di bundle scritta come sconto non funzionerà mai bene, perché serviva una Cart Transform.

---

## Vincoli da verificare, non da ricordare

Esistono limiti espliciti su: numero di function attive per shop e per tipo, budget di istruzioni per esecuzione, dimensione del modulo. **Questi numeri cambiano** e le fonti non ufficiali si contraddicono: prima di progettare qualcosa che ci va vicino, leggili sulla documentazione Shopify.

Il principio che non cambia: le Functions sono progettate per decisioni rapide su dati già disponibili. Se il tuo disegno ha bisogno di più dati, più tempo o una chiamata esterna, il disegno va cambiato — non ottimizzato.

---

## Migrazione dagli Scripts

Gli Scripts sono dismessi. La migrazione **non è 1:1**, perché il modello di programmazione è diverso:

- Le chiamate esterne che alcuni Scripts facevano non sono replicabili: quei dati vanno spostati su metafield
- La logica basata su note cliente va spostata sui tag, interrogabili nell'input query
- Lo stacking degli sconti è ora esplicito: verifica che la strategia scelta corrisponda al comportamento precedente, perché il default può cambiare il risultato commerciale
- I test: gli Scripts si testavano in produzione, le Functions si testano su dev store con `dev` e `replay`

Punto di partenza pratico su un progetto ereditato: esporta il report delle personalizzazioni di checkout dall'admin del merchant. È il backlog di migrazione, già scritto.

---

## Come rispondere

**Scegli il target prima del codice.** Sconto, validazione, spedizione, pagamento, cart transform: sono modelli diversi con input e output diversi. Se la richiesta è ambigua, chiarisci prima.

**Input query minima.** Ogni campo richiesto costa budget. Chiedi solo ciò che la logica legge davvero.

**Return anticipato.** Se il carrello non qualifica, esci subito senza processare le righe.

**Dì dove va configurato.** Una function consegnata senza spiegare come si attiva è una function che il cliente considera rotta.

**Non promettere dati esterni.** Se la regola dipende da un sistema terzo, la risposta corretta è: sincronizzare quel dato in metafield con un job, e leggerlo dalla function.

---

## File di riferimento

- `references/targets-e-esempi.md` — target principali, esempi Rust e JavaScript, input query, testing, errori ricorrenti

## Skill collegate

- **`shopify-apps`** — la function vive dentro un'app: scaffold, deploy e UI di configurazione stanno lì
- **`shopify-core`** — metafield e metaobject, il canale con cui si portano dati esterni dentro una function
- **`shopify-storefront`** — su headless, gli errori di validazione arrivano nelle mutation del carrello e vanno mostrati
- **`shopify-themes`** — su tema, gli errori compaiono nel template carrello
