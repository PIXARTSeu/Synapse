# Polaris, App Bridge e UI dell'app

> Verifica sempre com'è impostato il progetto: lo stack a web components è quello attuale, ma molte app in produzione usano ancora i componenti React di `@shopify/polaris`. Non mescolare i due modelli nello stesso progetto senza una ragione.

## Indice
- [Polaris web components](#polaris-web-components)
- [App Bridge](#app-bridge)
- [Componenti App Bridge fuori dall'iframe](#componenti-app-bridge-fuori-dalliframe)
- [Pattern di pagina](#pattern-di-pagina)
- [Extension UI](#extension-ui)
- [Errori ricorrenti](#errori-ricorrenti)

---

## Polaris web components

Standard Web Components: si usano come elementi HTML nativi, in qualunque framework.

```jsx
<s-page heading="Ordini da sincronizzare">
  <s-section heading="In coda">
    <s-paragraph>3 ordini in attesa di sincronizzazione.</s-paragraph>
  </s-section>
</s-page>
```

- Caricamento da `cdn.shopify.com/shopifycloud/polaris.js` — sempre l'ultima versione
- Tipi TypeScript: `@shopify/polaris-types`, da tenere a `@latest` per restare allineati al CDN
- Sono inclusi nelle app scaffoldate con la CLI: non vanno aggiunti a mano

Puoi anche costruire UI custom con qualsiasi framework, ma pesa la scelta: i componenti Polaris danno accessibilità, coerenza con l'admin e conformità agli standard Built for Shopify senza lavoro aggiuntivo. Un'app che sembra estranea all'admin viene disinstallata prima.

Conseguenza pratica del CDN "sempre ultima versione": non hai un lockfile per la UI. Vale la pena verificare l'app dopo aggiornamenti importanti di Polaris, e tenere i tipi allineati per accorgersi dei cambiamenti in fase di build.

---

## App Bridge

La variabile globale `shopify` espone le API per parlare con l'admin. Nessuna configurazione di autenticazione: l'app gira già dentro una sessione autenticata.

Cose che si fanno con App Bridge:

- **Session token** per autenticare il proprio backend: `await shopify.idToken()`
- **Resource picker** per far selezionare prodotti, collezioni o varianti al merchant
- **Toast e modali** per il feedback
- **Navigazione e deep link** verso altre parti dell'admin
- **Direct API access** all'Admin GraphQL via `fetch('shopify:admin/api/graphql.json')`

Tipi TypeScript: `@shopify/app-bridge-types`, anche questo allineato a `@latest`.

---

## Componenti App Bridge fuori dall'iframe

Title bar e menu di navigazione vivono **fuori** dall'iframe dell'app, nell'admin vero e proprio:

```jsx
import {TitleBar, NavMenu} from '@shopify/app-bridge-react';

export default function App() {
  return (
    <>
      <TitleBar title="Dettaglio prodotto" subtitle="SKU: ABC-123" />
      <NavMenu>
        <a href="/">Home</a>
        <a href="/products">Prodotti</a>
        <a href="/settings">Impostazioni</a>
      </NavMenu>
    </>
  );
}
```

È ciò che fa sembrare l'app parte dell'admin invece di una pagina web incastrata dentro una cornice.

---

## Pattern di pagina

Shopify pubblica template per i pattern ricorrenti — landing page dell'app, pagina impostazioni, tabelle dati, empty state, flussi di setup — allineati agli standard **Built for Shopify**. Prima di progettare una schermata da zero, guarda se il pattern esiste già: risparmia lavoro e allinea l'app ai criteri di review.

Principi che valgono comunque:

- **Empty state con azione**, non una pagina vuota: il primo accesso è il momento in cui si perde il merchant
- **Impostazioni raggruppate** per intento, non per struttura del database
- **Feedback immediato** su ogni azione (toast), e stati di caricamento espliciti
- **Errori che dicono cosa fare**, non solo cosa è andato storto
- Linguaggio del merchant, non del sistema: "sincronizza ordini", non "esegui job di reconciliation"

---

## Extension UI

L'app può estendere altre superfici oltre ad App Home:

| Extension | Dove appare |
|---|---|
| **Admin action** | Azione contestuale su prodotti, ordini, clienti |
| **Admin block** | Riquadro dentro le pagine di dettaglio dell'admin |
| **Theme app extension** | Blocchi inseribili nella vetrina dal theme editor |
| **Checkout UI extension** | Elementi nel checkout (con vincoli di piano) |
| **Customer account extension** | Aree cliente |
| **Functions** | Logica di checkout — vedi skill `shopify-functions` |

La **theme app extension** merita attenzione particolare: è il modo corretto di aggiungere funzionalità a un tema senza modificarne i file. Il merchant inserisce il blocco dal theme editor, e l'aggiornamento del tema non cancella nulla. Se stai per proporre modifiche dirette a un tema per una funzionalità ricorrente, valuta prima questa strada.

---

## Errori ricorrenti

**Auth improvvisata.** Cookie negli iframe: funziona in locale, si rompe da un merchant. Session token, sempre.

**Token trattati come validi solo perché presenti.** La verifica va fatta lato server a ogni richiesta.

**Redirect che perdono i parametri.** L'app perde il contesto embedded e finisce in uno stato incoerente.

**UI custom dove bastava Polaris.** Costa tempo, peggiora l'accessibilità e complica la review.

**Provider annidati copiati da tutorial vecchi.** Se il progetto usa i web components, quel codice non serve e crea conflitti.

**Chiamate Admin API dal client senza direct API access.** O si abilita nella configurazione, o si passa dal backend: non ci sono scorciatoie.
