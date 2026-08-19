---
name: ai-image-generation
description: >
  AI image generation con Google Imagen 4. Usare quando si devono generare immagini
  con AI per marketing, prodotti, landing page, o come input per generazione video.
  Trigger: "genera immagine", "crea foto AI", "imagen", "product photo AI".
version: 1.0.0
---

# AI Image Generation — Google Imagen 4

Genera immagini ad alta qualità con Google Imagen 4 per marketing, prodotti, landing page, e input per pipeline video.

## Setup

```bash
cd tools/video
pip3 install -r requirements.txt
```

**Requisiti**:
- `GOOGLE_AI_STUDIO_API_KEY` in `tools/video/.env`
- Python 3.8+
- pip packages: `google-generativeai`, `python-dotenv`, `pillow`

Verifica la chiave:
```bash
grep GOOGLE_AI_STUDIO_API_KEY tools/video/.env
```

## CLI Reference

```bash
python3 tools/video/imagen-generate.py --prompt "..." [opzioni]
```

### Parametri

| Parametro | Default | Opzioni | Uso |
|---|---|---|---|
| `--prompt` | required | stringa | Descrizione dell'immagine da generare |
| `--model` | `imagen-4.0-generate-001` | `imagen-4.0-generate-001`, `imagen-4.0-fast-generate-001`, `imagen-4.0-ultra-generate-001` | Modello da usare |
| `--aspect-ratio` | `16:9` | `1:1`, `9:16`, `4:3`, `3:4`, `16:9` | Proporzioni immagine |
| `--count` | `1` | `1`, `2`, `3`, `4` | Numero di varianti da generare |
| `--output` | auto timestamp | nome file | Percorso output PNG (default: `output/imagen-YYYYMMDD-HHMMSS.png`) |

## Selezione Modello

Scegli in base a velocità vs qualità:

| Modello | Velocità | Qualità | Quando usare |
|---|---|---|---|
| `imagen-4.0-fast-generate-001` | ⚡ Veloce | Buona | Iterazioni rapide, test prompt, approvazione cliente |
| `imagen-4.0-generate-001` | ⏱ Bilanciato | Eccellente | Default, maggior parte dei casi |
| `imagen-4.0-ultra-generate-001` | 🐢 Lento | Massima | Output finale, prodotti, hero image, stampa |

## Aspect Ratio per Piattaforma

| Piattaforma | Ratio | Uso |
|---|---|---|
| Web / YouTube / LinkedIn | `16:9` | Hero image, background, banner |
| Instagram Post / Prodotto | `1:1` | Feed post, product shot, social |
| Instagram Story / TikTok / Reel | `9:16` | Vertical content, mobile |
| Stampa / Presentazioni | `4:3` | Slide, brochure, banner A4 |

## Esempi Pratici

### Hero Image per Sito Web

```bash
python3 tools/video/imagen-generate.py \
  --prompt "elegant restaurant exterior, evening, warm golden lights, cobblestone street, people dining, soft focus background" \
  --aspect-ratio 16:9 \
  --model imagen-4.0-ultra-generate-001
```

### Product Shot per E-Commerce

```bash
python3 tools/video/imagen-generate.py \
  --prompt "luxury leather wallet on white background, studio lighting, 3/4 angle, professional product photography, sharp focus, 4K" \
  --aspect-ratio 1:1 \
  --model imagen-4.0-ultra-generate-001 \
  --output context/product-wallet.png
```

### 4 Varianti per Scelta Social

```bash
python3 tools/video/imagen-generate.py \
  --prompt "modern office workspace, natural light, minimal desk setup, coffee cup, laptop" \
  --aspect-ratio 1:1 \
  --count 4 \
  --model imagen-4.0-generate-001
```

### Input per Pipeline Video (Kling/Veo)

Genera frame iniziale per video generation:

```bash
# Step 1: genera frame iniziale
python3 tools/video/imagen-generate.py \
  --prompt "cozy terrace with sea view, sunset, empty tables set for dinner, warm lighting, golden hour" \
  --aspect-ratio 16:9 \
  --model imagen-4.0-ultra-generate-001 \
  --output context/hero-frame.png

# Step 2: genera il video da quella immagine
# (vedi skill ai-video-generation per il passo successivo)
python3 tools/video/kling-generate.py \
  --image context/hero-frame.png \
  --prompt "slow pan right, soft music, people start arriving for dinner" \
  --model kling-v3 \
  --camera-pan 3
```

## Prompt Engineering

### Struttura Consigliata

Usa questa formula per prompt efficaci:

```
[SOGGETTO] + [AMBIENTAZIONE] + [ILLUMINAZIONE] + [STILE] + [ANGOLO CAMERA]
```

### Esempio: Product Shot

```
luxury ceramic mug with coffee, white background, studio lighting,
product photography, sharp focus, professional, 3/4 angle, high resolution
```

### Esempio: Hero Image

```
modern hotel lobby, contemporary design, natural light from large windows,
people checking in, warm color palette, afternoon light, professional photography,
wide angle, inviting atmosphere
```

### Parole Chiave Qualità

Aggiungi per output migliore:
- **Per fotografie**: "photorealistic", "professional photography", "studio lighting", "4K", "sharp focus", "high resolution"
- **Per prodotti**: "on white background", "product photography", "commercial", "macro", "detail shot"
- **Per location**: "architectural photography", "interior design", "ambiance", "professional"
- **Per stile**: "minimalist", "contemporary", "elegant", "modern", "luxury"

### Best Practices

**Per Prodotti**:
```
product photography, [PRODOTTO], isolated on white background,
studio light, professional, sharp focus, 3/4 angle, commercial quality
```

**Per Location**:
- Specifica ora del giorno: "golden hour", "morning light", "evening", "night"
- Specifica stagione: "spring", "summer", "autumn", "winter"
- Specifica atmosfera: "cozy", "vibrant", "peaceful", "busy", "empty"

**Per Persone**:
- NON nominare persone reali (vietato nei ToS)
- Descrivi il ruolo + azione + mood:
  ```
  professional woman in business attire working at desk, focused expression,
  modern office, natural light, confident posture
  ```

**Evita**:
- Descrizioni vaghe ("bella immagine", "bella foto")
- Troppi elementi in una sola immagine
- Nomi propri di brand/persone
- Testo/loghi specifici
- Richieste di stili artistici noti (Monet, Van Gogh)

## Output e Convenzioni

Le immagini generate vengono salvate automaticamente:

```
output/
  ├── imagen-20260417-143022.png      # immagine generata
  ├── imagen-20260417-143022.json     # metadata (prompt, modello, parametri)
  └── ...
```

File metadata JSON:
```json
{
  "model": "imagen-4.0-generate-001",
  "prompt": "...",
  "aspect_ratio": "16:9",
  "count": 1,
  "timestamp": "2026-04-17T14:30:22Z"
}
```

### Usa `--output` per Input Pipeline Video

Salva direttamente con nome significativo:
```bash
python3 tools/video/imagen-generate.py \
  --prompt "..." \
  --output context/hero-frame.png       # Pronto per Kling/Veo input
```

## Workflow Tipico

### 1. Approvazione Rapida (Cliente)

```bash
# Genera velocemente, mostra cliente 4 varianti
python3 tools/video/imagen-generate.py \
  --prompt "[descrizione]" \
  --count 4 \
  --model imagen-4.0-fast-generate-001 \
  --aspect-ratio 1:1
```

### 2. Iterazione Prompt

Cliente approva una variante? Raffina il prompt:
```bash
# Aggiungi dettagli dalle note del cliente
python3 tools/video/imagen-generate.py \
  --prompt "[prompt originale + feedback cliente]" \
  --model imagen-4.0-generate-001
```

### 3. Output Finale

Una volta approvato:
```bash
# Genera in massima qualità
python3 tools/video/imagen-generate.py \
  --prompt "[prompt finale approvato]" \
  --model imagen-4.0-ultra-generate-001 \
  --output context/[nome-significativo].png
```

### 4. Input Video (Opzionale)

Se serve per video generation:
```bash
# Salva come frame iniziale
python3 tools/video/imagen-generate.py \
  --prompt "[descrizione scene]" \
  --model imagen-4.0-ultra-generate-001 \
  --aspect-ratio 16:9 \
  --output context/video-frame.png

# Passa a kling-generate.py per il video
```

## Troubleshooting

### Errore: "API key not found"

```bash
# Verifica .env
cat tools/video/.env | grep GOOGLE_AI_STUDIO_API_KEY

# Se vuoto, aggiungi:
echo "GOOGLE_AI_STUDIO_API_KEY=sk-..." >> tools/video/.env
```

### Immagine non risponde al prompt

- Semplifica il prompt (meno elementi)
- Usa parole chiave più specifiche
- Prova il modello `ultra` per dettagli migliori
- Rimuovi richieste di testo/loghi

### Rate limit raggiunto

- Aspetta 5-10 minuti tra batch grandi
- Non generare più di 10 immagini al minuto
- Usa `fast` model per iterazioni rapide

## Integrazione con Video Pipeline

Vedi skill `ai-video-generation` per:
- Convertire immagine → video (Kling/Veo)
- Sequenze multi-frame
- Camera motion / zoom / pan
- Transizioni video
