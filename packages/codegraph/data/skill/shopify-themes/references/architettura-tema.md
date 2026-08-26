# Architettura di un tema

## Indice
- [Template JSON vs Liquid](#template-json-vs-liquid)
- [Sezioni](#sezioni)
- [Schema](#schema)
- [Blocchi](#blocchi)
- [App block](#app-block)
- [Section group](#section-group)
- [Snippet](#snippet)
- [Config e locale](#config-e-locale)
- [Template alternativi](#template-alternativi)

---

## Template JSON vs Liquid

Un template JSON non contiene codice: elenca quali sezioni compongono la pagina e con quali impostazioni.

```json
{
  "sections": {
    "main": {"type": "main-product", "settings": {}},
    "related": {"type": "related-products", "settings": {}}
  },
  "order": ["main", "related"]
}
```

I template Liquid contengono codice e non sono componibili dal merchant. Su un tema moderno restano l'eccezione: si usa JSON ovunque possibile, perché è ciò che dà autonomia al merchant.

Ogni tipo di pagina che vuoi renderizzare ha bisogno di almeno un template di quel tipo. Nessun template è obbligatorio in assoluto, ma senza `product` non esiste la pagina prodotto.

---

## Sezioni

File Liquid in `sections/` con markup, stile e schema nello stesso file.

```liquid
{%- comment -%} sections/hero-banner.liquid {%- endcomment -%}

<section class="hero-banner" style="--hero-height: {{ section.settings.height }}px">
  {%- if section.settings.image -%}
    {{ section.settings.image | image_url: width: 2000 | image_tag:
       widths: '400, 800, 1200, 2000',
       sizes: '100vw',
       loading: 'eager',
       alt: section.settings.image.alt }}
  {%- endif -%}

  <h2>{{ section.settings.heading | escape }}</h2>

  {%- for block in section.blocks -%}
    <div {{ block.shopify_attributes }}>
      {{ block.settings.text }}
    </div>
  {%- endfor -%}
</section>

{% schema %}
{ }
{% endschema %}
```

Due dettagli che fanno la differenza nel theme editor:

- `{{ block.shopify_attributes }}` su ogni blocco: senza, il theme editor non riesce a selezionare e evidenziare il blocco
- `| escape` sugli input testuali del merchant

---

## Schema

Lo schema è JSON dentro Liquid, letto da Shopify al caricamento del tema e mai renderizzato nell'HTML.

```json
{
  "name": "t:sections.hero.name",
  "tag": "section",
  "settings": [
    {"type": "image_picker", "id": "image", "label": "t:sections.hero.image"},
    {"type": "text", "id": "heading", "label": "t:sections.hero.heading", "default": "Nuova collezione"},
    {"type": "range", "id": "height", "min": 200, "max": 800, "step": 50, "unit": "px", "default": 500, "label": "t:sections.hero.height"}
  ],
  "blocks": [
    {"type": "text", "name": "Testo", "settings": [
      {"type": "richtext", "id": "text", "label": "Contenuto"}
    ]}
  ],
  "presets": [{"name": "Hero banner", "blocks": [{"type": "text"}]}]
}
```

Punti che determinano se la sezione è usabile:

- **`presets`**: senza, la sezione non compare nel selettore del theme editor. È la dimenticanza più frequente
- **Etichette dalle locale** (`t:...`): rende il tema traducibile
- **Default sensati**: una sezione appena inserita deve avere un aspetto decente, non essere vuota
- I file JSON dei temi supportano commenti e virgole finali negli schema e in `settings_schema.json` — non nei file che gestisce il merchant (`templates/*.json`, `config/settings_data.json`, `locales/*.json`)

---

## Blocchi

Due famiglie:

- **Block di sezione**: dichiarati nello schema della sezione, esistono solo lì
- **Theme block** (`blocks/`): file autonomi riusabili in più sezioni, con schema e preset propri

I theme block sono la struttura più moderna e vanno preferiti quando lo stesso elemento serve in più punti. Vincoli da conoscere: un theme block accede al proprio oggetto `block`, alla `section` che lo renderizza e agli oggetti globali, ma **non** riceve variabili dall'esterno come uno snippet. Se ti serve passare dati, lo strumento giusto è lo snippet.

---

## App block

Permettono alle app di inserire UI nella vetrina senza modificare i file del tema. Per accettarli, la sezione dichiara nello schema blocchi di tipo `@app`.

Se il tema non li supporta, il merchant installa un'app e non riesce a inserirla: è un difetto del tema, non dell'app. Dawn mostra l'implementazione corretta nella sezione prodotto.

Shopify avvolge gli app block di primo livello in una sezione wrapper generata (`apps.liquid`, con fallback `_blocks.liquid`). Puoi fornire il tuo `apps.liquid` per controllarne il rendering: deve accettare blocchi `@app` e includere un preset, altrimenti il theme editor segnala errore.

---

## Section group

Contenitori JSON in `sections/` che rendono componibili aree del layout come header e footer. Prima esistevano solo come markup fisso in `theme.liquid`; oggi il merchant può aggiungere e riordinare sezioni anche lì.

---

## Snippet

Liquid riusabile, invisibile nel theme editor, che **riceve parametri**:

```liquid
{% render 'product-card', product: product, show_vendor: true %}
```

Usa `render`, non l'obsoleto `include`: `render` isola lo scope, il che rende gli snippet prevedibili e più veloci.

Documentali con LiquidDoc per avere supporto dell'estensione VS Code su parametri e tipi.

**Snippet o theme block?** Snippet se serve riuso di codice con parametri, invisibile al merchant. Theme block se il merchant deve poterlo aggiungere, configurare e riordinare.

---

## Config e locale

- `config/settings_schema.json` — impostazioni globali (tipografia, colori, brand). Tue da definire
- `config/settings_data.json` — i **valori** scelti dal merchant. Mai sovrascrivere
- `locales/*.json` — traduzioni della vetrina; `*.schema.json` per le etichette del theme editor

Ogni stringa visibile va nelle locale. Il testo hardcodato è la ragione per cui un tema non si può vendere fuori dal proprio mercato e il merchant non può correggere una parola senza chiamarti.

---

## Template alternativi

Più varianti dello stesso tipo di template, assegnabili per risorsa: `product.bundle.json`, `collection.lookbook.json`. È il modo giusto di gestire prodotti con esigenze diverse — molto meglio di una sezione piena di `if` che gestisce sei casi.
