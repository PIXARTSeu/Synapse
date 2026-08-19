---
name: video-producer
description: >
  Orchestratore pipeline video completa. Usare quando l'utente vuole creare video,
  reel, clip, showcase, intro. Guida raccolta requisiti e scelta modalità: AI puro,
  Remotion puro, o AI+Remotion hybrid. Trigger: "crea video", "fammi un reel",
  "video per", "clip", "showcase", "intro video".
version: 1.0.0
user-invocable: true
argument-hint: "descrivi il video che vuoi creare"
---

# Video Producer — Orchestratore Pipeline Video Completa

## Overview

Questo skill guida l'intero processo di creazione video, dalla raccolta requisiti alla produzione finale. Tre modalità di produzione in base alle esigenze:

| Modalità | Quando | Stack |
|---|---|---|
| **A) AI puro** | Non hai Remotion installato, vuoi video realistico | Imagen + Kling/Veo + TTS + Lyria + ffmpeg |
| **B) Remotion puro** | Vuoi animazioni precise, grafica programmatica | React/Remotion composition |
| **C) AI+Remotion hybrid** | Video realistico (AI) + testo/overlay precisi (Remotion) | AI gen + Remotion overlay |

---

## Flusso Domande (Obbligatorio — UNA alla volta)

Prima di generare qualsiasi cosa, fai SEMPRE queste domande in sequenza, attendendo risposta per ogni domanda:

### 1. Formato video?

```
→ 16:9 (YouTube / web / LinkedIn)
→ 9:16 (Instagram Reel / TikTok / Stories)
→ 1:1 (Instagram Post / quadrato)
→ Custom (specifica dimensioni)
```

### 2. Durata target?

```
→ 5-10 sec (intro / teaser / clip breve)
→ 15-30 sec (social clip / reel / promo)
→ 30-60 sec (showcase / promo lungo / tutorial breve)
→ 60+ sec (tutorial completo / brand video / spiegazione)
```

### 3. Modalità? (A / B / C)

Se l'utente non sa, consiglia basandoti su:
- Ha immagini/video di partenza? → **C) hybrid** (AI + Remotion overlay)
- Vuole animazioni precise/grafiche? → **B) Remotion** (composizione React)
- Vuole video realistico from scratch? → **A) AI puro** (Kling/Veo)

### 4. Hai materiali di partenza?

```
→ Foto del prodotto/location?
→ Video esistenti da riusare?
→ Logo / font specifici?
→ Dove sono? (path locale o URL da scaricare?)
→ Risoluzione/formato attuali?
```

### 5. Contenuto testuale?

```
→ Titolo principale (lung. max 10 parole)
→ Sottotitolo / tagline
→ Prezzi / spec (se prodotto)
→ Call-to-action finale (es: "Scopri di più", "Ordina ora")
→ Colori brand da rispettare?
```

### 6. Audio?

```
→ Voiceover: sì/no?
   Se sì: quale tono? (professionale, casual, energico, narrativo?)
   Quale lingua?
→ Musica di sottofondo: sì/no?
   Se sì: che mood? (energico, rilassante, corporate, trendy?)
   Durata musica (fade out alla fine)?
→ Suoni nativi nel video (Kling --audio)?
```

---

## Pipeline Modalità A: AI Puro

Workflow per generare video completamente da AI (Imagen + Kling/Veo + TTS + Lyria + ffmpeg).

### Step 1: Genera immagine di riferimento (se non hai foto)

```bash
cd "/Users/dan/Desktop/progetti-web/MASTER_Fullstack session/tools/video"

# Genera immagine con Imagen 4
python3 imagen-generate.py \
  --prompt "descrizione dettagliata del video" \
  --output ../context/frame.png \
  --aspect-ratio "16:9"  # o 9:16, 1:1
```

**Prompt example**:
```
"Modern product showcase: sleek phone on minimal white background, golden hour lighting, 
soft shadows, 4K product photography style"
```

### Step 2: Genera video dalla immagine

Opzione A — Con immagine di riferimento (consigliato):
```bash
python3 kling-generate.py \
  --image ../context/frame.png \
  --prompt "descrizione movimento/animazione" \
  --duration 30  # secondi
  --model "kling-v3"
  --quality "high"
```

Opzione B — Solo testo (meno controllabile):
```bash
python3 kling-t2v.py \
  --prompt "descrizione completa" \
  --duration 30 \
  --aspect-ratio "16:9"
```

Opzione C — Qualità max (4K, più lento):
```bash
python3 veo-generate.py \
  --prompt "..." \
  --resolution "4k" \
  --duration 30
```

**Prompt example per movimento**:
```
"Slow 360-degree spin of the phone, gentle camera pan down. Golden hour light creates 
warm glow. Product centered, minimal shadows. No text overlays. Clean, professional."
```

### Step 3: Genera voiceover (se richiesto)

```bash
python3 tts-generate.py \
  --text "Titolo: Scopri il nuovo iPhone 16 Pro. Sottotesto: Performance massima, 
fotocamera AI avanzata. Call-to-action: Ordina oggi." \
  --voice "Aoede"  # o Charon, Kore, Linus, Maia, Novah, Orpheus, Sky, Vale
  --speed 1.0 \
  --output ../context/voiceover.wav
```

**Voci disponibili**:
- Aoede (femminile, natural, presentatore)
- Charon (maschile, profondo, narratore)
- Kore (femminile, energico, social media)
- Novah (femminile, moderno, tech)

### Step 4: Genera musica (se richiesto)

```bash
python3 music-generate.py \
  --prompt "uplifting, modern, tech product launch vibe, 30 seconds, instrumental" \
  --duration 30 \
  --output ../context/music.wav
```

**Prompt examples**:
- "Energetic electronic music, futuristic, startup vibe"
- "Calm ambient, minimal, focus mode"
- "Cinematic orchestral, inspiring, epic"

### Step 5: Assembla con ffmpeg

**Caso 1: Solo video + musica**
```bash
ffmpeg -i output/kling-VIDEO.mp4 \
  -i context/music.wav \
  -c:v copy -c:a aac \
  -shortest \
  output/final.mp4
```

**Caso 2: Video + voiceover + musica (voiceover in foreground)**
```bash
ffmpeg -i output/kling-VIDEO.mp4 \
  -i context/voiceover.wav \
  -i context/music.wav \
  -filter_complex "[1:a]volume=1.0[v];[2:a]volume=0.3[m];[v][m]amix=inputs=2:duration=shortest[a]" \
  -map 0:v -map "[a]" \
  -c:v copy -c:a aac \
  output/final.mp4
```

**Caso 3: Video + musica + voiceover (musica in background, voiceover durante primi 10 sec)**
```bash
ffmpeg -i output/kling-VIDEO.mp4 \
  -i context/voiceover.wav \
  -i context/music.wav \
  -filter_complex "
    [1:a]adelay=0|0[v1];
    [v1]volume=1.0[v1];
    [2:a]volume=0.2[m];
    [v1][m]amix=inputs=2:duration=longest[a]
  " \
  -map 0:v -map "[a]" \
  -c:v copy -c:a aac \
  -pix_fmt yuv420p \
  output/final.mp4
```

### Output

File finale: `output/final.mp4` (pronto per upload YouTube, Instagram, etc.)

---

## Pipeline Modalità B: Remotion Puro

Workflow per animazioni precise e grafica programmatica con React + Remotion.

### Step 1: Setup Remotion (se non presente)

Se nuovo progetto:
```bash
npx create-video@latest my-video
cd my-video
npm install
```

Se Next.js esistente:
Carica skill `remotion` per integrazione dettagliata.

### Step 2: Crea composizione

Struttura directory:
```
src/remotion/
├── compositions/
│   └── [NomeVideo]/
│       ├── Main.tsx          ← composizione principale
│       ├── schema.ts          ← Zod schema per props
│       └── assets/
│           ├── logo.png
│           └── font.ttf
└── studio/
    └── index.tsx             ← configurazione
```

**Esempio Main.tsx** (titolo animato):
```tsx
import { Composition, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { z } from 'zod';

const schema = z.object({
  title: z.string().default('My Video'),
  subtitle: z.string().default(''),
  duration: z.number().default(5),
});

type Props = z.infer<typeof schema>;

export const MyVideoComposition = (props: Props) => {
  const frame = useCurrentFrame();
  const fps = 30;
  
  // Animazione titolo: fade in per 30 frame
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  
  // Animazione scale: zoom in
  const scale = interpolate(frame, [0, 30], [0.8, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <h1 style={{ fontSize: 80, opacity, transform: `scale(${scale})`, fontFamily: 'Arial' }}>
        {props.title}
      </h1>
    </div>
  );
};

export const videoConfig = {
  durationInFrames: 150,  // 5 secondi @ 30fps
  fps: 30,
  width: 1920,
  height: 1080,
  defaultProps: {
    title: 'Welcome',
    subtitle: '',
    duration: 5,
  },
} as const;

export const MyVideo: Composition<typeof schema> = {
  id: 'MyVideo',
  component: MyVideoComposition,
  durationInFrames: videoConfig.durationInFrames,
  fps: videoConfig.fps,
  width: videoConfig.width,
  height: videoConfig.height,
  defaultProps: videoConfig.defaultProps,
  schema,
};
```

### Step 3: Preview

```bash
npx remotion studio
```

Browser apre http://localhost:3000 con live preview, puoi modificare props e vedere in tempo reale.

### Step 4: Render

```bash
# Render semplice (H.264, fast)
npx remotion render MyVideo output/final.mp4 \
  --codec=h264 \
  --crf=16  # qualità (0=max, 51=min)

# Render con props custom
npx remotion render MyVideo output/final.mp4 \
  --props='{"title":"iPhone 16 Pro","subtitle":"Performance Unleashed"}'

# Render batch (varianti multiple)
npx remotion render MyVideo output/variant1.mp4 \
  --props='{"title":"iPhone Pro"}'
npx remotion render MyVideo output/variant2.mp4 \
  --props='{"title":"iPhone Standard"}'
```

Per dettagli su librerie Remotion (Sequence, Img, Video, etc.), carica skill `remotion`.

---

## Pipeline Modalità C: AI+Remotion Hybrid

Pattern ottimale per video marketing (es: automotive, product showcase, real estate).

### Workflow Concettuale

```
1. Genera video AI realistico (Kling) come sfondo/base
2. Sposta in progetto Remotion come asset
3. Aggiungi overlay React: testo animato, pricing, badge, CTA
4. (Opzionale) Aggiungi TTS + musica
5. Render finale con Remotion
```

### Step 1: Genera video AI come base

```bash
cd "/Users/dan/Desktop/progetti-web/MASTER_Fullstack session/tools/video"

# Genera immagine di riferimento
python3 imagen-generate.py \
  --prompt "luxury sports car, sunset, golden hour, cinematic" \
  --output ../context/product-ref.jpg \
  --aspect-ratio "16:9"

# Genera video AI con movimento
python3 kling-generate.py \
  --image ../context/product-ref.jpg \
  --prompt "Slow drone reveal of the car. Camera circles around, golden sunlight highlights design. 
No text, clean, professional automotive style." \
  --duration 30 \
  --quality high \
  --output ../output/ai-video.mp4
```

### Step 2: Sposta in Remotion e configura composizione

```bash
# Copia video AI come asset
cp ../output/ai-video.mp4 remotion-project/public/videos/background.mp4
```

**Main.tsx con overlay**:
```tsx
import { Composition, Sequence, OffthreadVideo, staticFile, interpolate, useCurrentFrame } from 'remotion';
import { z } from 'zod';

const schema = z.object({
  carName: z.string().default('Luxury Sports Car'),
  price: z.string().default('$249,000'),
  tagline: z.string().default('Pure Performance'),
  ctaText: z.string().default('Explore Now'),
});

type Props = z.infer<typeof schema>;

export const CarShowcaseComposition = (props: Props) => {
  const frame = useCurrentFrame();
  
  // Video AI sfondo (full screen)
  // Overlay animati (fade in / scale)
  const overlayOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const overlayScale = interpolate(frame, [0, 30], [0.9, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
      {/* Background video AI */}
      <OffthreadVideo
        src={staticFile('videos/background.mp4')}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Overlay dark gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* Testo overlay animato */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 40,
          right: 40,
          opacity: overlayOpacity,
          transform: `scale(${overlayScale})`,
          color: '#fff',
          textShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}
      >
        <h1 style={{ fontSize: 64, margin: '0 0 20px 0', fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>
          {props.carName}
        </h1>
        <p style={{ fontSize: 28, margin: '0 0 40px 0', color: '#ddd', fontFamily: 'Arial, sans-serif' }}>
          {props.tagline}
        </p>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ffd700', marginBottom: 30 }}>
          {props.price}
        </div>
        <button
          style={{
            padding: '12px 32px',
            fontSize: 18,
            background: '#ffd700',
            color: '#000',
            border: 'none',
            fontWeight: 'bold',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          {props.ctaText}
        </button>
      </div>
    </div>
  );
};

export const CarShowcase: Composition<typeof schema> = {
  id: 'CarShowcase',
  component: CarShowcaseComposition,
  durationInFrames: 900,  // 30 secondi @ 30fps
  fps: 30,
  width: 1920,
  height: 1080,
  defaultProps: {
    carName: 'Luxury Sports Car',
    price: '$249,000',
    tagline: 'Pure Performance',
    ctaText: 'Explore Now',
  },
  schema,
};
```

### Step 3: (Opzionale) Aggiungi TTS + musica

```bash
# Genera voiceover
python3 tts-generate.py \
  --text "Introducing the ultimate luxury sports car. Pure performance, breathtaking design. 
Starting at $249,000. Explore now." \
  --voice "Charon" \
  --output ../context/voiceover.wav

# Genera musica cinematica
python3 music-generate.py \
  --prompt "Cinematic orchestral, inspiring, epic automotive, luxury vibes, 30 seconds" \
  --duration 30 \
  --output ../context/music.wav
```

Aggiungi a Remotion:
```tsx
import { Audio } from 'remotion';

// Dentro CarShowcaseComposition
<>
  <OffthreadVideo ... />
  <Audio src={staticFile('audio/voiceover.wav')} volume={1} />
  <Audio src={staticFile('audio/music.wav')} volume={0.3} />
</>
```

### Step 4: Render

```bash
npx remotion render CarShowcase output/final.mp4 \
  --codec=h264 \
  --crf=16 \
  --props='{"carName":"Tesla Model S Plaid","price":"$104,990"}'
```

---

## Quick Command Reference

Posizioni script:
```
/Users/dan/Desktop/progetti-web/MASTER_Fullstack session/tools/video/
```

### Immagini
```bash
python3 imagen-generate.py --prompt "..." --aspect-ratio 16:9 --output frame.png
```

### Video AI
```bash
# Da immagine
python3 kling-generate.py --image frame.jpg --prompt "..." --duration 30

# Da testo puro
python3 kling-t2v.py --prompt "..." --aspect-ratio 16:9

# Qualità max 4K
python3 veo-generate.py --prompt "..." --resolution 4k --duration 30
```

### Audio
```bash
# Voiceover
python3 tts-generate.py --text "..." --voice Aoede

# Musica
python3 music-generate.py --prompt "..." --duration 30
```

### Assembly ffmpeg
```bash
# Video + musik
ffmpeg -i video.mp4 -i music.wav -c:v copy -c:a aac -shortest output.mp4

# Video + voiceover + musica
ffmpeg -i video.mp4 -i voice.wav -i music.wav \
  -filter_complex "[1:a]volume=1[v];[2:a]volume=0.2[m];[v][m]amix=inputs=2[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac output.mp4
```

### Remotion
```bash
npx remotion render CompositionId output/video.mp4 --codec=h264 --crf=16
npx remotion render CompositionId output/video.mp4 --props='{"title":"Custom"}'
```

---

## Skills Correlate

| Skill | Quando |
|---|---|
| `ai-video-generation` | Deep dive Kling + Veo + parametri avanzati |
| `ai-image-generation` | Deep dive Imagen 4 + prompt engineering |
| `tts-voiceover` | Deep dive TTS + Lyria + libreria voci |
| `remotion` | Deep dive Remotion + librerie + template marketing |
| `ffmpeg` | Deep dive ffmpeg + filtri audio/video avanzati |

---

## Checklist Prima di Render

- [ ] Formato corretto? (16:9, 9:16, 1:1, custom)
- [ ] Durata corretta? (coerente tra tutti i componenti)
- [ ] Audio levels? (voiceover 1.0, musica 0.3, sfondo basso)
- [ ] Colori/logo brand? (rispettati in overlay/testo)
- [ ] Call-to-action? (chiaro e visibile)
- [ ] Sottotitoli/captions? (se modalità B/C, considerare aggiungerli)
- [ ] Performance? (file size, codec, bitrate appropriati)
- [ ] Mobile-friendly? (text size, safe areas per 9:16)

---

## Troubleshooting

**Kling API timeout?**
→ Riduci durata, usa prompt più breve, retry dopo 30 sec.

**Remotion render lento?**
→ Riduci risoluzione (`--scale=0.5`), disabilita codec specifici, usa `--fast`.

**Audio non sincronizzato?**
→ Usa ffmpeg con `-c:v copy -c:a aac`, non re-encode video.

**Text overlay pixelato in 4K?**
→ Remotion: `<h1 style={{ fontSize: 80 }}>` per 1080p; scala = (font-size * 1080) / 1920 per altri ratio.

---

## Note

- Tutti gli script Python in `tools/video/` assumono credenziali API configerate in `.env.local`
- Output media: `tools/video/output/`, context: `tools/video/context/`
- Remotion render output locale; per web deployment, usa Remotion Cloud (a pagamento)
- Per batch production (100+ varianti), considera Remotion Batch API

