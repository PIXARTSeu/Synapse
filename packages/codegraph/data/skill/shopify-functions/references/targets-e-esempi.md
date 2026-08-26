# Target, esempi e testing

## Indice
- [I target principali](#i-target-principali)
- [Anatomia di una function](#anatomia-di-una-function)
- [Esempio: validazione del checkout](#esempio-validazione-del-checkout)
- [Input query](#input-query)
- [Configurazione via metafield](#configurazione-via-metafield)
- [Testing e debug](#testing-e-debug)
- [Errori ricorrenti](#errori-ricorrenti)

---

## I target principali

| Tipo | A cosa serve | Template CLI |
|---|---|---|
| **Discount** | Sconti su righe carrello, subtotale ordine, spedizione | `discount` |
| **Cart & checkout validation** | Bloccare il checkout se il carrello non rispetta certe regole | `cart_checkout_validation` |
| **Delivery customization** | Nascondere, rinominare, riordinare i metodi di spedizione | `delivery_customization` |
| **Payment customization** | Nascondere, rinominare, riordinare i metodi di pagamento | `payment_customization` |
| **Cart transform** | Unire o espandere righe: bundle, kit, prodotti componibili | `cart_transform` |

Scegliere il tipo giusto è metà del lavoro:

- Un **bundle** non è uno sconto. Se vuoi che tre prodotti appaiano come un articolo unico, serve Cart Transform; farlo con uno sconto produce un carrello che mostra tre righe con prezzi strani.
- **Nascondere** un corriere è una delivery customization, non una validazione. Le validazioni bloccano, non filtrano.
- Uno sconto **rifiutato** e un checkout **bloccato** sono esperienze diverse per l'utente: scegli in base a cosa deve capire chi compra.

---

## Anatomia di una function

Ogni target ha tre file:

```
extensions/mia-function/
├── shopify.extension.toml          # target, input query, export, build
└── src/
    ├── <target>.graphql            # cosa Shopify ti passa
    └── <target>.rs  oppure  .js    # cosa restituisci
```

Il nome del file GraphQL, quello del file sorgente e la proprietà `export` devono corrispondere al target dichiarato nel TOML. Un disallineamento qui produce errori poco leggibili.

---

## Esempio: validazione del checkout

Regola: ordini sopra i 1.000 € consentiti solo a clienti con storico.

**Input query** (Rust e JavaScript differiscono nel nome della query per via della generazione dei tipi):

```graphql
query Input {
  cart {
    buyerIdentity { customer { numberOfOrders } }
    cost { subtotalAmount { amount } }
  }
}
```

**JavaScript:**

```js
// @ts-check
export function cartValidationsGenerateRun(input) {
  const error = {
    message: "Ordine massimo di 1.000 € per i clienti senza storico ordini",
    target: "cart",
  };

  const orderSubtotal = parseFloat(input.cart.cost.subtotalAmount.amount);
  const errors = [];

  if (orderSubtotal > 1000.0) {
    const numberOfOrders = input.cart.buyerIdentity?.customer?.numberOfOrders ?? 0;
    if (numberOfOrders < 5) errors.push(error);
  }

  return {operations: [{validationAdd: {errors}}]};
}
```

**Rust** (stessa logica, con la macro `#[shopify_function]` e i tipi generati dallo schema):

```rust
use super::schema;
use shopify_function::prelude::*;
use shopify_function::Result;

#[shopify_function]
fn cart_validations_generate_run(
    input: schema::cart_validations_generate_run::Input,
) -> Result<schema::CartValidationsGenerateRunResult> {
    let mut errors = Vec::new();
    let order_subtotal: f64 = input.cart().cost().subtotal_amount().amount().as_f64();

    if order_subtotal > 1000.0 {
        let new_customer = input
            .cart()
            .buyer_identity()
            .and_then(|b| b.customer().as_ref().map(|c| *c.number_of_orders() < 5))
            .unwrap_or(true);

        if new_customer {
            errors.push(schema::ValidationError {
                message: "Ordine massimo di 1.000 € per i clienti senza storico ordini".to_owned(),
                target: "cart".to_owned(),
            });
        }
    }

    Ok(schema::CartValidationsGenerateRunResult {
        operations: vec![schema::Operation::ValidationAdd(
            schema::ValidationAddOperation { errors },
        )],
    })
}
```

Nota importante per chi lavora su headless: **gli errori di validazione emergono anche sull'oggetto `Cart` dello Storefront API**, nel campo `userErrors` delle mutation del carrello. Una vetrina Hydrogen deve gestirli e mostrarli, altrimenti l'utente vede un'aggiunta al carrello che non succede senza spiegazione.

Il campo `target` dell'errore può puntare a un campo specifico del checkout (per esempio il CAP di consegna), così il messaggio compare accanto al campo giusto invece che in cima alla pagina.

---

## Input query

Regole che determinano se la function starà nei limiti:

- **Chiedi solo i campi che leggi.** Ogni campo costa budget di esecuzione.
- Usa le variabili nell'input query quando servono valori dinamici.
- I metafield sono accessibili dall'input query: è così che si portano dentro dati esterni.

---

## Configurazione via metafield

Una function con valori hardcodati è utile una volta sola. Il pattern corretto:

1. L'app espone una UI (App Home, o una extension nella pagina sconti) dove il merchant imposta i parametri
2. I valori vengono salvati come metafield
3. L'input query legge quei metafield
4. La logica li usa al posto delle costanti

Così la stessa function serve soglie, percentuali e prodotti diversi senza redeploy — ed è ciò che distingue una function da progetto una tantum da una vendibile.

---

## Testing e debug

```bash
shopify app dev                  # preview con rebuild automatico; l'output mostra le esecuzioni
shopify app function replay      # riesegue in locale un'esecuzione reale
```

`replay` è il flusso principale di debug: scegli un'esecuzione avvenuta sullo store e la ripeti in locale quante volte serve, senza ricostruire il carrello ogni volta.

Da verificare prima di considerare finito:

- Carrello vuoto, cliente non loggato, cliente senza storico
- Combinazioni con altri sconti attivi (lo stacking cambia il risultato)
- Comportamento sul carrello e sul checkout, e — su headless — sulle mutation dello Storefront API
- Il comportamento in caso di eccezione a runtime: nelle regole di checkout si può scegliere se, in caso di errore, il checkout resta permesso o viene bloccato. È una decisione commerciale, non tecnica: falla prendere al cliente

Dopo il rilascio, controlla il tasso di successo delle esecuzioni. Una function che supera il budget fallisce in silenzio: nessun errore visibile, semplicemente lo sconto non viene applicato.

---

## Errori ricorrenti

**Target sbagliato.** Bundle fatti con gli sconti, filtri fatti con le validazioni. Si scopre tardi e si riscrive.

**Dipendenza da dati esterni.** Non esiste chiamata di rete nel modello base: il dato va sincronizzato prima in metafield.

**Logica temporale con l'orologio.** L'esecuzione è deterministica; le finestre temporali si gestiscono con dati preparati a monte o con l'attivazione della regola.

**Input query gonfia.** Campi richiesti e mai usati che bruciano budget.

**Function deployata ma non attivata.** Va abilitata nell'admin: senza, non gira e sembra rotta.

**Stacking non verificato.** La strategia di combinazione degli sconti determina il risultato finale: va confrontata con il comportamento atteso dal cliente, non lasciata al default.

**Valori hardcodati.** Funziona in demo, inutilizzabile in produzione appena il merchant vuole cambiare una soglia.
