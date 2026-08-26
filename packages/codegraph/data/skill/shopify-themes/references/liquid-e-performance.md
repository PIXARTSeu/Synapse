# Liquid, performance e qualità

## Indice
- [Liquid in pratica](#liquid-in-pratica)
- [Metafield e metaobject](#metafield-e-metaobject)
- [Il costo nascosto delle lookup](#il-costo-nascosto-delle-lookup)
- [Immagini](#immagini)
- [JavaScript e CSS](#javascript-e-css)
- [Il peso delle app](#il-peso-delle-app)
- [Accessibilità](#accessibilità)
- [Personalizzare un tema senza creare debito](#personalizzare-un-tema-senza-creare-debito)
- [Checklist di consegna](#checklist-di-consegna)

---

## Liquid in pratica

Filtri e tag che ricorrono nel lavoro reale:

```liquid
{{ product.price | money }}
{{ product.title | escape }}
{{ 'theme.css' | asset_url | stylesheet_tag }}
{{ product.featured_image | image_url: width: 800 | image_tag }}
{{ page.content | strip_html | truncate: 160 }}
{% render 'snippet-name', param: value %}
{% liquid
  assign discounted = product.compare_at_price > product.price
%}
```

Il tag `{% liquid %}` permette di scrivere più istruzioni senza ripetere le delimitazioni: rende leggibili i blocchi di logica.

Regola di igiene: **`escape` su qualsiasi testo inserito dal merchant**, `strip_html` dove serve testo puro (meta description, attributi).

---

## Metafield e metaobject

Nativi da OS 2.0, si leggono direttamente:

```liquid
{{ product.metafields.custom.materiale }}
{{ product.metafields.custom.scheda_tecnica.value }}
```

Sono la risposta corretta a "il cliente ha bisogno di un campo in più sui prodotti": il merchant li gestisce dall'admin, sono leggibili anche da Storefront API e Functions, e non richiedono un'app di terze parti.

I metaobject modellano entità intere (schede materiale, punti vendita, designer) e hanno template propri in `templates/metaobject/`.

---

## Il costo nascosto delle lookup

Liquid non fa batching: ogni accesso a un metafield o `collections[handle]` è una lookup interna a sé. Le conseguenze si vedono sulle pagine con molti prodotti.

Pattern da evitare:

```liquid
{%- for product in collection.products -%}
  {%- assign related = collections[product.metafields.custom.related_collection] -%}
  {%- for r in related.products -%}   {%- comment -%} lookup annidata: costo esplosivo {%- endcomment -%}
```

Cosa fare invece: limitare i cicli (`limit:`), evitare lookup dentro i loop, e per esigenze davvero complesse passare alla Storefront API lato client o ai metaobject invece di concatenare lookup Liquid.

Il **Theme Inspector** mostra il tempo di render per porzione di template: quando una pagina è lenta, si guarda lì prima di ipotizzare.

---

## Immagini

Sono quasi sempre la voce principale dell'LCP.

```liquid
{{ product.featured_image | image_url: width: 1600 | image_tag:
   widths: '400, 600, 800, 1200, 1600',
   sizes: '(min-width: 990px) 50vw, 100vw',
   loading: 'lazy',
   alt: product.featured_image.alt | escape }}
```

- `loading: 'eager'` **solo** per l'immagine above-the-fold; tutto il resto lazy
- `width` e `height` sempre presenti, contro il CLS
- `alt` dai campi Shopify, non nomi file
- Non servire immagini da 3000px per riquadri da 400

---

## JavaScript e CSS

- `defer` sugli script; niente framework pesanti per interazioni che si fanno in CSS
- CSS di sezione caricato con la sezione, non tutto nel foglio globale
- Attenzione ai file `.js.liquid` e `.css.liquid`: hanno accesso alle impostazioni del tema, ma non sono cachabili come gli asset statici. Usali solo dove le variabili del merchant servono davvero
- I web component nativi sono l'approccio di Dawn: nessuna libreria, comportamento incapsulato

---

## Il peso delle app

Su un tema lento, l'audit delle app viene **prima** dell'ottimizzazione del codice. Ogni app installata può iniettare script e CSS; dieci app superano facilmente il peso di tutto il tema.

Da controllare: app installate ma non più usate, app che caricano su tutte le pagine ciò che serve solo su una, script duplicati (due app di recensioni, due di analytics).

È anche una conversazione commerciale utile: spesso il modo più economico di rendere veloce un sito è disinstallare cose.

---

## Accessibilità

Requisito normativo per gli e-commerce in UE (European Accessibility Act), oltre che punto di conversione:

- HTML semantico: `<nav>`, `<main>`, `<button>` per le azioni, `<a>` per la navigazione
- Ogni campo form con label associata
- Focus visibile e navigazione da tastiera completa (drawer carrello compreso)
- Contrasto adeguato su badge sconto e prezzi barrati
- `alt` significativi
- Aggiornamenti dinamici (carrello, filtri) annunciati con `aria-live`
- Skip link verso il contenuto principale

Il theme editor complica le cose: il merchant può inserire testo con contrasto insufficiente. Vincoli sensati negli schema (palette predefinite invece di color picker liberi) prevengono il problema alla fonte.

---

## Personalizzare un tema senza creare debito

Il conflitto ricorrente: il cliente vuole modifiche a un tema acquistato, ma il tema riceve aggiornamenti.

Strategie, in ordine di preferenza:

1. **Theme app extension** — la funzionalità sta in un'app, il merchant la inserisce come blocco, gli aggiornamenti del tema non la toccano
2. **Sezioni e snippet nuovi** in file propri, richiamati dai template JSON — nessuna modifica ai file originali
3. **Override isolati** — se devi toccare un file originale, isola il blocco con commenti chiari e tienilo tracciato in Git
4. **Fork completo** — rinunci agli aggiornamenti upstream. Scelta legittima solo se dichiarata al cliente

Quello che non va fatto: modifiche sparse nei file del tema senza tracciamento. Al primo aggiornamento si perdono, e nessuno ricorda quali fossero.

---

## Checklist di consegna

- [ ] Ogni sezione ha `presets` e compare nel theme editor
- [ ] Nessuna sezione dipende dall'ordine o dall'esistenza di altre
- [ ] Nessun selettore CSS/JS posizionale (`nth-child` sui figli del template)
- [ ] Tutte le stringhe nelle locale
- [ ] `{{ block.shopify_attributes }}` su ogni blocco
- [ ] Il tema accetta app block nelle sezioni principali
- [ ] `theme check` pulito
- [ ] Lighthouse su home, PLP e PDP; immagini con dimensioni esplicite
- [ ] Accessibilità: tastiera, contrasto, label, alt
- [ ] Testato con `settings_data.json` del merchant, non con il tuo
- [ ] Git con branch collegato via integrazione GitHub
- [ ] Pubblicazione da tema non pubblicato, dopo verifica in preview
