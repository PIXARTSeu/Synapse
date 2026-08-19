---
name: ai-video-generation
description: >
  AI video generation knowledge base — Kling e Google Veo. Usare quando si devono generare
  video con AI da immagini o testo (Kling image-to-video, Kling text-to-video, Veo).
  Trigger: "genera video", "crea clip AI", "kling", "veo", "image to video", "video AI".
version: 1.0.0
---

# AI Video Generation — Kling & Google Veo

**Skill Purpose**: Insegnare QUANDO e COME generare video con AI usando Kling (Kuaishou) e Google Veo.

## Decision Matrix: Quale tool usare?

| Scenario | Tool | Comando |
|---|---|---|
| Ho un'immagine + voglio camera motion preciso | Kling v3 con camera control | `kling-generate.py --model kling-v3 --camera-*` |
| Ho un'immagine + voglio video realistico | Google Veo | `veo-generate.py --image` |
| Interpolazione due frame (inizio→fine) | Kling o Veo | `kling-generate.py --last-frame` / `veo-generate.py --last-frame` |
| Solo testo, voglio video realistico | Google Veo o Kling T2V | `veo-generate.py` / `kling-t2v.py` |
| Voglio audio nativo nel video | Kling v2.6+ pro | `kling-generate.py --audio` |
| Massima qualità cinematografica 4K | Google Veo | `veo-generate.py --resolution 4k` |
| Camera control preciso (drone, pan, tilt) | Kling v3 | `kling-generate.py --model kling-v3 --camera-type/--camera-*` |
| Budget limitato / test rapido | Kling text-to-video std | `kling-t2v.py --mode std --model kling-v2-6` |
| Prodotto / showcase oggetto | Kling v3 o Veo con rotation | `kling-generate.py --model kling-v3` / `veo-generate.py` |

---

## Setup Iniziale

### 1. Installare dipendenze

```bash
cd /Users/dan/Desktop/progetti-web/MASTER_Fullstack\ session/tools/video
pip3 install -r requirements.txt
```

**File di requirements**: Deve contenere `requests`, `python-dotenv`, `pillow`, `moviepy` (verifica che esista).

### 2. Configurare credenziali

```bash
cp .env.example .env
```

Popolare `.env` con:

```env
# Google AI Studio (Veo)
GOOGLE_AI_STUDIO_API_KEY=sk-***

# Kling Kuaishou
KLING_ACCESS_KEY=***
KLING_SECRET_KEY=***
```

Ottenere le chiavi:
- **Google AI Studio**: https://aistudio.google.com/apikey → generar una nuova chiave
- **Kling Kuaishou**: https://openapi.kuaishou.com/ → register account → API dashboard

---

## Kling Image-to-Video (`kling-generate.py`)

### Sintassi base

```bash
python3 tools/video/kling-generate.py --image <path> --prompt "<descrizione>" [opzioni]
```

### Parametri completi

| Parametro | Type | Default | Descrizione |
|---|---|---|---|
| `--image` | path | RICHIESTO | Immagine iniziale (JPG/PNG) |
| `--prompt` | string | RICHIESTO | Descrizione del movimento/azione |
| `--model` | string | kling-v2-6 | Model: kling-v1, kling-v1-5, kling-v2, kling-v2-6, kling-v3 |
| `--mode` | string | pro | std (budget) o pro (premium, audio, camera control) |
| `--duration` | int | 10 | 5 o 10 secondi |
| `--aspect-ratio` | string | 16:9 | 16:9, 9:16, 1:1 |
| `--cfg-scale` | float | 0.5 | Fedeltà immagine: 0.0–1.0 (0.3–0.5 creativo, 0.7–0.9 fedele) |
| `--last-frame` | path | — | Immagine ultimo frame (interpolazione) |
| `--audio` | flag | — | Audio nativo (solo v2.6+ pro) |
| `--negative-prompt` | string | — | Cosa evitare nel video |
| `--output` | path | output/ | Directory output video |

### Modelli Kling

| Modello | Qualità | Camera Control | Audio | Pro only |
|---|---|---|---|---|
| kling-v1 | Base | No | No | No |
| kling-v1-5 | Buona | No | No | No |
| kling-v2 | Ottima | No | No | No |
| kling-v2-6 | Eccellente | No | Si (pro) | Si (per audio) |
| kling-v3 | Massima | **Si (7 tipi)** | Si (pro) | Si (per camera) |

### Camera Control (solo `kling-v3` + `--mode pro`)

Parametri disponibili:

| Parametro | Range | Descrizione | Esempio |
|---|---|---|---|
| `--camera-type` | enum | Preset di movimento: simple, down_back, forward_up, right_turn_forward, left_turn_forward | `--camera-type forward_up` |
| `--camera-horizontal` | -10 to +10 | Pan laterale (sinistra/destra) | `--camera-horizontal 3` |
| `--camera-vertical` | -10 to +10 | Tilt verticale (su/giu) | `--camera-vertical -2` |
| `--camera-pan` | -10 to +10 | Rotazione orizzontale camera | `--camera-pan 5` |
| `--camera-tilt` | -10 to +10 | Rotazione verticale camera | `--camera-tilt 3` |
| `--camera-roll` | -10 to +10 | Rotazione assiale (barrel roll) | `--camera-roll 2` |
| `--camera-zoom` | -10 to +10 | Zoom in/out (negativo = zoom out) | `--camera-zoom -3` |

**Preset `--camera-type`**:
- `simple`: Static con lievi movimenti
- `down_back`: Camera retrocede verso l'alto (reveal dal basso)
- `forward_up`: Camera avanza verso l'alto (forward dolly + crane up)
- `right_turn_forward`: Gira a destra e avanza (tracking circolare)
- `left_turn_forward`: Gira a sinistra e avanza

### Esempi pratici

#### Esempio 1: Base semplice
```bash
python3 tools/video/kling-generate.py \
  --image context/foto.jpg \
  --prompt "people seated at table, animated scene, conversation"
```

#### Esempio 2: Camera reveal (drone)
```bash
python3 tools/video/kling-generate.py \
  --image context/car.jpg \
  --prompt "luxury car reveal, cinematic lighting" \
  --model kling-v3 \
  --mode pro \
  --camera-type forward_up \
  --camera-zoom -3 \
  --camera-vertical 5
```

#### Esempio 3: Interpolazione (due frame)
```bash
python3 tools/video/kling-generate.py \
  --image context/start.jpg \
  --last-frame context/end.jpg \
  --prompt "smooth lateral tracking shot" \
  --cfg-scale 0.7 \
  --model kling-v2-6
```

#### Esempio 4: Con audio nativo
```bash
python3 tools/video/kling-generate.py \
  --image context/restaurant.jpg \
  --prompt "lively restaurant ambience, people dining, clinking glasses" \
  --model kling-v2-6 \
  --mode pro \
  --audio
```

#### Esempio 5: Negazione creativa
```bash
python3 tools/video/kling-generate.py \
  --image context/product.jpg \
  --prompt "product rotating, luxurious, high-end lighting" \
  --negative-prompt "dark, blurry, low quality" \
  --cfg-scale 0.8
```

#### Esempio 6: Camera tracking circolare
```bash
python3 tools/video/kling-generate.py \
  --image context/building.jpg \
  --prompt "architectural showcase, building exterior" \
  --model kling-v3 \
  --mode pro \
  --camera-type right_turn_forward \
  --camera-pan 7 \
  --camera-zoom -2
```

---

## Kling Text-to-Video (`kling-t2v.py`)

### Sintassi base

```bash
python3 tools/video/kling-t2v.py --prompt "<descrizione>" [opzioni]
```

### Parametri

Stessi di `kling-generate.py`, ma SENZA `--image` e `--last-frame`.

| Parametro | Type | Default | Descrizione |
|---|---|---|---|
| `--prompt` | string | RICHIESTO | Descrizione video da generare |
| `--model` | string | kling-v2-6 | kling-v2-6, kling-v3 |
| `--mode` | string | pro | std, pro |
| `--duration` | int | 10 | 5, 10 |
| `--aspect-ratio` | string | 16:9 | 16:9, 9:16, 1:1 |
| `--cfg-scale` | float | 0.5 | 0.0–1.0 |
| `--audio` | flag | — | Audio nativo (v2.6+ pro) |
| `--negative-prompt` | string | — | Cosa evitare |

### Esempi

#### Semplice
```bash
python3 tools/video/kling-t2v.py \
  --prompt "outdoor restaurant terrace, cobblestone, golden hour, people dining"
```

#### Con modello e modalità specifica
```bash
python3 tools/video/kling-t2v.py \
  --prompt "product showcase, rotating luxury watch, white background, premium lighting" \
  --model kling-v3 \
  --mode pro
```

#### Video cinematografico
```bash
python3 tools/video/kling-t2v.py \
  --prompt "cinematic aerial view, mountain landscape, drone flying forward, sunset" \
  --model kling-v3 \
  --duration 10 \
  --cfg-scale 0.6
```

---

## Google Veo (`veo-generate.py`)

### Sintassi base

```bash
python3 tools/video/veo-generate.py --prompt "<descrizione>" [opzioni]
```

### Parametri

| Parametro | Type | Default | Descrizione |
|---|---|---|---|
| `--prompt` | string | RICHIESTO | Descrizione video |
| `--image` | path | — | Primo frame (image-to-video) |
| `--last-frame` | path | — | Ultimo frame (interpolazione) |
| `--ref` | path | — | Reference image per consistenza soggetto (ripetibile) |
| `--resolution` | string | 1080p | 720p, 1080p, 4k |
| `--output` | path | output/ | Directory output |

### Modelli Veo disponibili

(Modificabili nello script `veo-generate.py`):

- `veo-3.1-generate-preview` (default, massima qualità)
- `veo-3.1-fast-generate-preview` (rapido)
- `veo-3.1-lite-generate-preview` (lightweight)
- `veo-3.0-generate-001` (versione precedente, più stabile)

### Esempi

#### Text-to-Video semplice
```bash
python3 tools/video/veo-generate.py \
  --prompt "slow dolly forward through restaurant, golden hour, cozy ambience"
```

#### Image-to-Video
```bash
python3 tools/video/veo-generate.py \
  --image context/foto.jpg \
  --prompt "camera pans left slowly, revealing background"
```

#### Interpolazione (due frame)
```bash
python3 tools/video/veo-generate.py \
  --image context/start.jpg \
  --last-frame context/end.jpg \
  --prompt "smooth lateral tracking, consistent lighting"
```

#### Con reference images (consistenza soggetto)
```bash
python3 tools/video/veo-generate.py \
  --prompt "chef plating dish, professional kitchen, precise hands" \
  --ref context/chef1.jpg \
  --ref context/chef2.jpg \
  --ref context/kitchen.jpg
```

#### Alta qualità 4K
```bash
python3 tools/video/veo-generate.py \
  --prompt "cinematic establishing shot, luxury hotel lobby, slow push forward" \
  --resolution 4k
```

---

## Output Conventions

### Struttura file salvati

Tutti i video vengono salvati in `tools/video/output/`:

```
output/
  kling-20250417-143022.mp4           # Kling image-to-video
  kling-20250417-143022.json          # Metadati (prompt, modello, parametri)
  veo-20250417-143025.mp4             # Veo text-to-video
  veo-20250417-143025.json            # Metadati
```

### File JSON metadati

Ogni video genera un `.json` con:

```json
{
  "tool": "kling-generate",
  "model": "kling-v3",
  "mode": "pro",
  "prompt": "luxury car reveal, cinematic lighting",
  "image": "context/car.jpg",
  "duration": 10,
  "aspect_ratio": "16:9",
  "cfg_scale": 0.5,
  "camera_type": "forward_up",
  "camera_settings": {
    "zoom": -3,
    "vertical": 5
  },
  "timestamp": "2025-04-17T14:30:22Z",
  "status": "completed"
}
```

---

## Prompt Engineering Tips

### Per prodotti e showcase

Descrivi illuminazione + background + movimento camera, NON il prodotto stesso.

**Cattivo**:
> "Questo è un orologio di lusso"

**Buono**:
> "luxury watch rotating on white background, studio lighting with rim lights, slow 360-degree rotation"

### Per persone

Specifica azione/mood, NON identità o dettagli fisiognomici.

**Cattivo**:
> "un uomo con gli occhiali che mangia"

**Buono**:
> "person seated at restaurant table, dining elegantly, warm ambient lighting, relaxed expression"

### Per location/environment

Ora del giorno + atmosfera + dettagli specifici.

**Esempio**:
> "Mediterranean coastal village street, golden hour sunlight, cobblestone pavement, cafe tables with umbrellas, people walking"

### Per movimenti camera

Usa termini cinematografici:

| Termine | Descrizione |
|---|---|
| Dolly | Avanti/indietro |
| Pan | Rotazione orizzontale |
| Tilt | Rotazione verticale |
| Tracking | Movimento laterale (lato) |
| Crane | Movimento verticale (elevato) |
| Drone reveal | Avanzamento + elevazione |
| Orbit | Rotazione attorno a soggetto |
| Push-in | Avanzamento verso soggetto |

**Esempio completo**:
> "slow dolly forward through luxury restaurant interior, warm overhead lighting, tables set with fine dining, soft ambient music atmosphere"

### cfg-scale: come usarlo

| Range | Effetto | Uso |
|---|---|---|
| 0.3–0.5 | Massima creatività, meno fedele all'immagine | Stile, rielaborazione creativa |
| 0.5–0.7 | Bilancia creativo + fedele | **RECOMMENDED** per la maggior parte |
| 0.7–0.9 | Massima fedeltà all'immagine | Consistenza con immagine specifica |

---

## Negative Prompts (cosa evitare)

Elenco comune di cose da evitare:

```
"dark, blurry, low quality, grainy, distorted, unnatural, stuttering, 
 jerky motion, watermarked, text overlay, unrealistic, oversaturated,
 desaturated, monochrome, flickering, artifacts, out of focus, badly 
 positioned, cropped, static, no motion, awkward, stiff"
```

Personalizza in base al risultato desiderato:
- Per prodotti: evita "blurry", "motion blur"
- Per persone: evita "distorted faces", "unnatural"
- Per ambiente: evita "dark", "gloomy"

---

## Integrazione con Remotion (Post-processing)

Dopo aver generato il video AI, puoi usarlo come background o overlay in Remotion:

```typescript
// remotion/Composition.tsx
import { OffthreadVideo, staticFile } from "remotion";

export const VideoWithAIBackground = () => (
  <div style={{ position: "relative", width: 1920, height: 1080 }}>
    {/* AI-generated background video */}
    <OffthreadVideo
      src={staticFile("videos/generated-bg.mp4")}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
    
    {/* Overlay: testo, logo, effetti */}
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h1 style={{ color: "white", fontSize: 80, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
        Your Title Here
      </h1>
    </div>
  </div>
);
```

Poi renderizzare:

```bash
npx remotion render VideoWithAIBackground output.mp4
```

---

## Troubleshooting

### Errore: "API key not found"

**Soluzione**:
```bash
# Verificare che .env esista
cat tools/video/.env

# Verificare che le variabili siano caricate
python3 -c "import os; from dotenv import load_dotenv; load_dotenv(); print(os.getenv('KLING_ACCESS_KEY'))"
```

### Errore: "Invalid image format"

**Soluzione**:
- Immagine deve essere JPG o PNG
- Risoluzione massima: 4K (4096x2304)
- Minima: 256x256
- Convertire se necessario:
  ```bash
  convert input.webp -format jpg output.jpg
  ```

### Video generato è statico o senza movimento

**Soluzione**:
- Verificare il prompt contiene termini di movimento (camera, motion, dynamic)
- Aumentare `--cfg-scale` a 0.6–0.7
- Per Kling v3, usare `--camera-type` esplicito

### Qualità bassa, artefatti

**Soluzione**:
- Usare `--model kling-v3` o `--resolution 4k` per Veo
- Aumentare `--cfg-scale` a 0.8
- Verificare immagine source sia di qualità alta

### Timeout o errore di connessione

**Soluzione**:
- Verificare connessione internet
- Controllare rate limits API (Kling: 10 req/min, Veo: dipende da piano)
- Attendere 1-2 minuti prima di riprovare

---

## Performance Notes

### Tempo di generazione (approssimativo)

| Tool | Durata | Tempo |
|---|---|---|
| Kling v2-6 std | 5 sec | 30–60 sec |
| Kling v2-6 pro | 10 sec | 60–120 sec |
| Kling v3 pro | 10 sec | 90–150 sec |
| Veo 3.1 (1080p) | 10 sec | 120–180 sec |
| Veo 3.1 (4k) | 10 sec | 300+ sec |

### Cost estimates (API)

- **Kling**: ~0.1–0.3 USD per video (standard mode)
- **Google Veo**: Dipende dal piano Google Cloud (free credits disponibili)

---

## Quando usare quale tool (TL;DR)

1. **Ho una bella foto e voglio mostrarla in movimento** → `kling-generate.py`
2. **Voglio precisione camera (drone, pan, tilt)** → `kling-generate.py --model kling-v3`
3. **Ho bisogno di 4K cinema-quality** → `veo-generate.py --resolution 4k`
4. **Voglio audio nativo** → `kling-generate.py --mode pro --audio`
5. **Solo testo, fast & cheap** → `kling-t2v.py --mode std`
6. **Voglio reference images per consistenza** → `veo-generate.py --ref`
