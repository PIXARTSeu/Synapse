# Scegliere l'architettura di un progetto Shopify

## Indice
- [Le domande da fare prima di preventivare](#le-domande-da-fare-prima-di-preventivare)
- [Le quattro superfici a confronto](#le-quattro-superfici-a-confronto)
- [Segnali che indicano headless](#segnali-che-indicano-headless)
- [Segnali che indicano di restare su tema](#segnali-che-indicano-di-restare-su-tema)
- [Combinazioni comuni](#combinazioni-comuni)
- [Costi ricorrenti da mettere a preventivo](#costi-ricorrenti-da-mettere-a-preventivo)
- [Errori di architettura ricorrenti](#errori-di-architettura-ricorrenti)

---

## Le domande da fare prima di preventivare

In ordine di quanto spostano la decisione:

1. **Cosa deve poter fare il cliente finale che oggi non può?** Se la risposta è "essere più bello", è un tema.
2. **Chi modifica la vetrina dopo la consegna?** Se è il merchant da solo, il theme editor è un requisito, non un dettaglio.
3. **Quante sorgenti dati oltre a Shopify?** CMS, PIM, ERP, listini B2B: da due in su il headless inizia ad avere senso.
4. **Che piano Shopify ha?** Alcune cose (checkout UI extensions estese, log drain, alcune funzionalità B2B) sono legate a Plus.
5. **C'è budget di manutenzione ricorrente?** Non "c'è budget": *ricorrente*. È la domanda che uccide metà dei progetti headless mal venduti.
6. **Quanti prodotti e quante varianti?** Cataloghi molto grandi cambiano le scelte di caching e paginazione.
7. **Mercati e lingue?** La localizzazione costa su tutte le superfici, ma in modo diverso.
8. **Ci sono regole di prezzo o di checkout particolari?** Se sì, serve una Function a prescindere dal resto.

---

## Le quattro superfici a confronto

| | Tema Liquid | Headless (Hydrogen) | App embedded | Functions |
|---|---|---|---|---|
| **Cosa costruisci** | La vetrina, dentro Shopify | La vetrina, fuori da Shopify | Strumenti nell'admin | Logica nel checkout |
| **Linguaggio** | Liquid + JS/CSS | React (React Router) | React o qualsiasi framework | Rust / JS → Wasm |
| **Hosting** | Shopify | Oxygen (o self-host) | Tuo (Fly, Render, Cloud Run…) | Shopify |
| **Autonomia merchant** | Alta (theme editor) | Bassa senza un CMS | N/A | Configurazione via UI dedicata |
| **Time to market** | Giorni/settimane | Settimane/mesi | Settimane | Giorni |
| **Manutenzione** | Bassa | Alta (trimestrale) | Media | Bassa |
| **SEO** | Buono di serie | Ottimo ma va costruito | N/A | N/A |

---

## Segnali che indicano headless

- La UI richiesta non è esprimibile con sezioni e blocchi (configuratori, esperienze interattive, layout data-driven)
- Il contenuto vive in un CMS headless che il cliente non abbandonerà
- Il frontend deve servire anche app mobile o altri canali dagli stessi dati
- Performance su catalogo molto grande con filtri complessi
- Il cliente ha già un team React che manterrà il progetto
- Esiste un'integrazione pesante (ERP, PIM) che deve stare tra Shopify e la vetrina

Nota commerciale: se il cliente sceglie headless, sta pagando soprattutto per **non** sembrare un tema Shopify. Se il risultato assomiglia a Dawn con altri colori, il progetto ha perso la sua giustificazione economica.

---

## Segnali che indicano di restare su tema

- Il merchant vuole cambiare la homepage da solo, di stagione in stagione
- Non c'è budget di manutenzione continuativa
- Il catalogo è standard e le esigenze sono di brand, non di funzionalità
- Servono app dell'App Store che si integrano via app block (su headless vanno reimplementate o perse)
- Time to market stretto

Quest'ultimo punto è sottovalutato: **la maggior parte delle app dell'App Store non funziona su headless**. Se il cliente usa dieci app che iniettano UI nella vetrina, il passaggio a headless significa rifarle o rinunciarci. Va verificato prima del preventivo, app per app.

---

## Combinazioni comuni

- **Tema + Functions** — vetrina standard con regole di sconto o validazioni custom. Ottimo rapporto valore/costo.
- **Tema + app custom + theme app extension** — la funzionalità sta nell'app, il merchant la inserisce nella vetrina come blocco. È il pattern corretto per estendere un tema senza modificarlo (e senza rompersi al prossimo aggiornamento del tema).
- **Headless + app custom** — la vetrina è Hydrogen, l'app gestisce l'admin e i job di background. Le due parti parlano via Admin API e metafield.
- **Headless + Functions** — gli errori delle validation Function emergono anche sull'oggetto `Cart` dello Storefront API, quindi la vetrina headless deve gestirli e mostrarli.

---

## Costi ricorrenti da mettere a preventivo

- **Aggiornamenti API trimestrali**: su headless e app è lavoro reale, non un bump di versione
- **Aggiornamenti del tema** (su Liquid): se il tema base viene aggiornato, le modifiche custom vanno riportate — motivo per cui le personalizzazioni vanno isolate
- **Monitoraggio**: uptime, errori, performance
- **Compliance**: accessibilità e privacy non sono una-tantum

Un modo onesto di presentarlo: canone di manutenzione che copre aggiornamenti trimestrali e monitoraggio, separato dall'evolutivo. Chi non lo mette in offerta lo regala.

---

## Errori di architettura ricorrenti

- **Headless venduto per motivi estetici.** Costa 5-10× un tema per un risultato che il cliente non distingue.
- **App custom dove bastava un metaobject.** Prima di costruire un backend, verifica se metafield e metaobject coprono il modello dati.
- **Logica di prezzo nel frontend.** Se il prezzo dipende da regole, quelle regole vanno in una Function: altrimenti il carrello mostra un prezzo e il checkout ne calcola un altro.
- **Modifiche dirette a un tema dell'App Store.** Al primo aggiornamento si perdono. Usa un tema forkato con Git, o una theme app extension.
- **Ignorare il piano Shopify.** Alcune funzionalità sono Plus-only: scoprirlo a metà progetto è una conversazione sgradevole con il cliente.
