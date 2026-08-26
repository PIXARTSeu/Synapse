# UI, styling e librerie di componenti

## Indice
- [Prima cosa: Polaris non è per gli storefront](#prima-cosa-polaris-non-è-per-gli-storefront)
- [Strategie CSS supportate da Hydrogen](#strategie-css-supportate-da-hydrogen)
- [Tailwind](#tailwind)
- [shadcn/ui](#shadcnui)
- [Alternative a shadcn](#alternative-a-shadcn)
- [Cosa non sostituire con componenti generici](#cosa-non-sostituire-con-componenti-generici)
- [Mappa componenti → esigenze commerce](#mappa-componenti--esigenze-commerce)
- [Peso del bundle e limiti Oxygen](#peso-del-bundle-e-limiti-oxygen)
- [Font](#font)
- [Loading states](#loading-states)
- [Accessibilità in contesto e-commerce](#accessibilità-in-contesto-ecommerce)
- [Starter e temi già pronti](#starter-e-temi-già-pronti)
- [Direzione estetica](#direzione-estetica)

---

## Prima cosa: Polaris non è per gli storefront

Errore ricorrente. **Shopify Polaris è il design system dell'admin Shopify**, pensato per app che vivono dentro il pannello merchant. Non va usato per la vetrina: aspetto da back-office, peso inutile, e nessuna delle primitive commerce che servono su una PDP.

Per lo storefront Shopify non fornisce un design system: la UI la scegli tu. Hydrogen dà i componenti *dati* (`Image`, `Money`, `CartForm`), non i componenti *visivi*.

---

## Strategie CSS supportate da Hydrogen

Selezionabili in fase di init o aggiunte dopo:

```bash
npm create @shopify/hydrogen@latest -- --styling tailwind
# oppure su progetto esistente
npx shopify hydrogen setup css
```

Opzioni: `tailwind`, `vanilla-extract`, `css-modules`, `postcss`, `none`.

| Strategia | Quando conviene |
|---|---|
| **Tailwind** | Default de facto. Iterazione rapida, ottimo con librerie copy-paste come shadcn, zero CSS morto in produzione. |
| **vanilla-extract** | Design system tipizzato, zero runtime. Ha senso se il cliente ha token di brand rigidi e più team che scrivono UI. |
| **CSS Modules** | Nessuna dipendenza aggiuntiva, scoping garantito. La scelta conservativa quando il team non conosce Tailwind. |
| **PostCSS / none** | Quando esiste già un CSS di brand da portare dentro. |

Un'avvertenza pratica: cambiare strategia a metà progetto costa più di quanto sembri. Vale la pena decidere all'init, insieme al cliente, non dopo la prima PDP.

---

## Tailwind

Il setup automatico di Hydrogen installa **Tailwind v4**, che non usa più `tailwind.config.js`. La configurazione vive nel CSS:

```css
/* app/styles/tailwind.css */
@import "tailwindcss";

@theme {
  --color-brand: oklch(0.72 0.16 45);
  --font-display: "Söhne", sans-serif;
  --radius-card: 0.75rem;
}
```

Da lì derivano automaticamente le utility (`bg-brand`, `font-display`, `rounded-card`). Se un progetto o un tutorial fa riferimento a `tailwind.config.js` e `npx tailwindcss init`, è materiale v3: si può fare downgrade, ma verifica prima quale versione ha il progetto — mescolarle genera errori confusi.

I token di brand vanno dichiarati una volta in `@theme` e mai hardcodati nei componenti: quando il cliente cambia il colore primario, deve essere una riga.

---

## shadcn/ui

Non è una libreria da installare: è codice che copi nel progetto (Radix UI + Tailwind sotto). Su Hydrogen funziona bene perché Hydrogen è React Router 7, che shadcn supporta ufficialmente.

```bash
npx shadcn@latest init
npx shadcn@latest add button dialog sheet accordion skeleton
```

Cose da sistemare **prima** di aggiungere componenti, altrimenti si passa il pomeriggio a correggere import:

**1. Path alias.** Hydrogen usa `~/*` nel `tsconfig.json`, shadcn di default assume `@/*`. Allinea `components.json` alla convenzione del progetto:

```json
{
  "aliases": {
    "components": "~/components",
    "utils": "~/lib/utils",
    "ui": "~/components/ui"
  }
}
```

**2. Il modulo `cn`.** Serve `clsx` + `tailwind-merge` in `app/lib/utils.ts`. Lo crea la init di shadcn, ma se il progetto ha già un `utils.ts` va fuso a mano.

**3. Link e navigazione.** Gli esempi shadcn usano `next/link` o `<a>`. In Hydrogen devono diventare `<Link>` di `react-router`, altrimenti perdi la navigazione client-side e il prefetch.

**4. SSR.** Niente accesso a `window`, `document` o `localStorage` a module scope o durante il primo render: il componente viene renderizzato nel worker Oxygen, dove non esistono. Radix gestisce bene l'idratazione, ma il codice che ci aggiungi intorno no.

**5. `asChild` con `CartForm`.** Per usare un bottone shadcn come submit del carrello:

```jsx
<CartForm route="/cart" action={CartForm.ACTIONS.LinesAdd} inputs={{lines}}>
  {(fetcher) => (
    <Button type="submit" disabled={fetcher.state !== 'idle'} className="w-full">
      Aggiungi al carrello
    </Button>
  )}
</CartForm>
```

Il bottone resta un `<button type="submit">` dentro il form: è ciò che fa funzionare il carrello anche senza JavaScript.

---

## Alternative a shadcn

- **Radix UI primitives** direttamente — se non vuoi il livello copy-paste e preferisci stilare tu. Stessa base accessibile.
- **Base UI** — successore spirituale di Radix dagli stessi autori, headless, agnostico rispetto allo styling.
- **Headless UI** — più snello, ottimo se usi già Tailwind e ti servono solo dialog, menu, combobox.
- **Ark UI** — se il design system deve servire anche team non-React.
- **Embla Carousel** — lo standard per gallerie prodotto e caroselli collezione; leggero e accessibile. È anche ciò che sta sotto il carousel di shadcn.
- **Motion** (ex framer-motion) — animazioni; da valutare rispetto al peso (vedi sotto).

Se il progetto è una vetrina one-off per un cliente, shadcn fa risparmiare giorni. Se è un design system che verrà riusato su più storefront, partire dalle primitive Radix/Base UI evita di ereditare convenzioni di stile che poi combatti.

---

## Cosa non sostituire con componenti generici

Su una vetrina Shopify alcune scelte non sono estetiche ma funzionali:

| Non usare | Usa | Perché |
|---|---|---|
| `<img>` o wrapper generici | `<Image>` di `@shopify/hydrogen` | srcset e formati dal CDN Shopify; è la voce principale dell'LCP |
| Formattazione prezzi a mano | `<Money>` | valuta e locale cambiano per mercato |
| Fetch/state per il carrello | `CartForm` + `useOptimisticCart` | funziona senza JS, gestisce gli header del cart |
| `<a href>` interni | `<Link>` di `react-router` | navigazione client-side e prefetch |
| Slider custom da zero | Embla | accessibilità da tastiera e touch già risolte |

---

## Mappa componenti → esigenze commerce

Cosa serve davvero su uno storefront, e cosa lo copre:

| Elemento | Componente |
|---|---|
| Cart drawer | `Sheet` (shadcn) / `Dialog` Radix in modalità laterale |
| Quick view prodotto | `Dialog` |
| Selettore varianti | `RadioGroup` o `ToggleGroup` — **non** `Select`, che nasconde le opzioni non disponibili |
| Swatch colore | Radio custom sui valori `swatch` esposti dal Storefront API (meglio dei colori dedotti dal nome) |
| Stepper quantità | Input numerico custom con `aria-label` esplicito |
| Filtri PLP | `Accordion` + `Checkbox`, con lo stato nell'URL |
| Ricerca | `Command` / combobox su predictive search |
| Dettagli PDP, spedizioni, FAQ | `Accordion` |
| Feedback "aggiunto al carrello" | `Toast` / `Sonner` + region `aria-live` |
| Caricamento | `Skeleton` dentro `<Suspense>` |

Regola trasversale: **ogni stato che l'utente può condividere o su cui può tornare indietro sta nell'URL**, non nello state React. Vale per varianti, filtri, ordinamento e paginazione — è SEO e usabilità insieme.

---

## Peso del bundle e limiti Oxygen

Il worker Oxygen ha un tetto di **10 MB** e **400 ms** di startup, e il bundle SSR ci rientra: le scelte di UI hanno un costo lato server, non solo lato client.

- Importa le icone singolarmente (`import {ShoppingBag} from 'lucide-react'`), mai l'intero barrel
- Librerie di animazione e componenti pesanti solo dove servono davvero; per l'uso puntuale, import dinamico
- Il codice esclusivamente client va isolato (suffisso `.client` o `lazy`) invece di finire nel bundle SSR
- Dopo aver aggiunto una libreria UI significativa, un `hydrogen build` di controllo dice subito se il peso è cambiato in modo anomalo

---

## Font

Self-host in `public/` con `@font-face` e `font-display: swap`, più `<link rel="preload">` sul peso usato above-the-fold. Le richieste runtime a Google Fonts costano un round-trip su un dominio terzo, peggiorano LCP e CLS e aprono una questione GDPR che sul mercato europeo i clienti sollevano.

Se usi font di brand caricati come asset Shopify, valgono gli stessi limiti di dimensione degli altri file statici.

---

## Loading states

Con i dati deferred (vedi `data-e-caching.md`), lo skeleton non è decorazione ma parte della strategia di performance:

```jsx
<Suspense fallback={<ProductGridSkeleton count={4} />}>
  <Await resolve={recommended} errorElement={null}>
    {(data) => <ProductGrid products={data?.products?.nodes ?? []} />}
  </Await>
</Suspense>
```

Lo skeleton deve avere **le stesse dimensioni** del contenuto reale, altrimenti si guadagna in LCP e si perde in CLS. E `errorElement`: un blocco "prodotti correlati" che fallisce non deve portarsi via la pagina prodotto.

---

## Accessibilità in contesto e-commerce

Non è solo conformità: sono gli stessi punti dove si perdono conversioni.

- Aggiornamenti carrello annunciati in una region `aria-live="polite"`
- Focus trap nel drawer e ritorno del focus al trigger alla chiusura
- Selettore varianti navigabile da tastiera, con le opzioni esaurite marcate `aria-disabled` e non nascoste
- Ogni campo form con label associata (non solo placeholder)
- Badge sconto e prezzi barrati con contrasto sufficiente e testo alternativo comprensibile (`Prezzo scontato 29 €, prezzo originale 49 €`)
- Immagini prodotto con `alt` dai campi Shopify, non nomi file
- Focus visibile: mai `outline: none` senza sostituto

In UE questi punti sono anche requisito normativo per gli e-commerce sotto lo European Accessibility Act — vale la pena includerli nel preventivo invece di scoprirli dopo.

---

## Starter e temi già pronti

- **Skeleton template** — lo starter ufficiale di Hydrogen, non stilizzato: base neutra su cui costruire.
- **Hydrogen Cookbook** — le ricette ufficiali hanno sostituito il vecchio flag `--template` per partire da esempi funzionanti (mercati, B2B, CMS, ecc.).
- **Temi di terze parti** (Weaverse Pilot, Frontvibe Fluid e simili) — stack tipico React Router 7 + Tailwind + Radix/shadcn + a volte Sanity per il contenuto. Fanno risparmiare settimane su un progetto cliente, ma prima di adottarne uno verifica licenza, frequenza di manutenzione e su quale versione di Hydrogen è allineato: un tema fermo a una major precedente è debito tecnico dal giorno uno.

---

## Direzione estetica

Questo file copre le scelte *tecniche* di UI. Per la direzione visiva vera e propria — palette, tipografia, layout, identità che non sembri un template — usa la skill `frontend-design`: è complementare, non sovrapposta.

Nota di merito commerciale: su un headless il cliente paga soprattutto per non sembrare un tema Shopify. Se il risultato finale assomiglia a Dawn con altri colori, il progetto ha perso la sua giustificazione economica.
