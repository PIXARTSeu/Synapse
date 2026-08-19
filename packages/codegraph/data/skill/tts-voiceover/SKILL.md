---
name: tts-voiceover
description: >
  AI audio generation — Google TTS voiceover e Lyria 3 music. Usare quando si devono
  generare voiceover o musica di sottofondo per video. Trigger: "voiceover", "musica AI",
  "tts", "lyria", "audio per video", "narrazione AI".
version: 1.0.0
---

# TTS Voiceover + Music Generation

Skill per generare audio AI usando Google Gemini 2.5 Flash TTS e Lyria 3 music generation. Perfetto per video Remotion, spot pubblicitari, e produzioni multimediali.

## Setup

### 1. Installa dipendenze

```bash
cd tools/video
pip3 install -r requirements.txt
```

### 2. Configura API key

Aggiungi in `tools/video/.env`:
```env
GOOGLE_AI_STUDIO_API_KEY=your_key_here
```

Ottieni la key: https://aistudio.google.com/apikey

Verificare setup:
```bash
python3 tools/video/tts-generate.py --help
python3 tools/video/music-generate.py --help
```

---

## TTS Voiceover Generation

### CLI di base

```bash
python3 tools/video/tts-generate.py --text "..." [opzioni]
```

### Parametri

| Parametro | Default | Descrizione |
|-----------|---------|-------------|
| `--text` | **required** | Testo da sintetizzare |
| `--voice` | `Aoede` | Voce (vedi tabella sotto) |
| `--output` | auto (timestamp) | Percorso WAV output |

### Voci disponibili

| Nome | Genere | Carattere | Uso ideale |
|------|--------|-----------|-----------|
| `Aoede` | F | Neutra, chiara, professionale | Default, brand istituzionale, corporate |
| `Charon` | M | Profonda, autorevole | Luxury brand, automotive, finance, prestige |
| `Fenrir` | M | Forte, energica | Sport, fitness, call to action, motivazionale |
| `Kore` | F | Morbida, calda, accogliente | Wellness, food, turismo, ospitalità |
| `Puck` | N | Vivace, dinamica, divertente | Tech, startup, giovane, playful |

**Modello fisso**: `gemini-2.5-flash-preview-tts`

### Esempi di utilizzo

#### Voiceover neutro per sito istituzionale
```bash
python3 tools/video/tts-generate.py \
  --text "Benvenuti da Terra e Mare. Cucina di mare, vista sul Garda." \
  --voice Aoede \
  --output voiceover-intro.wav
```

#### Spot automotive (tono autorevole)
```bash
python3 tools/video/tts-generate.py \
  --text "Noleggio a lungo termine. Zero anticipo. Solo libertà." \
  --voice Charon \
  --output voiceover-auto.wav
```

#### Food & Hospitality (caldo e accogliente)
```bash
python3 tools/video/tts-generate.py \
  --text "Ogni piatto racconta una storia. Vieni a scoprirla." \
  --voice Kore \
  --output voiceover-food.wav
```

#### Tech startup (energica e dinamica)
```bash
python3 tools/video/tts-generate.py \
  --text "Trasforma il tuo team in una forza digitale." \
  --voice Puck \
  --output voiceover-tech.wav
```

#### Fitness / Sports (forte e motivazionale)
```bash
python3 tools/video/tts-generate.py \
  --text "Il tuo corpo è capace di cose incredibili. Scopri quanto lontano puoi arrivare." \
  --voice Fenrir \
  --output voiceover-fitness.wav
```

### Script writing best practices per TTS

Le voci AI rendono meglio se il testo è scritto pensando alla **prosodia naturale**.

#### 1. Frasi brevi
```
❌ MALE (troppo lungo):
"Siamo leader globali nel fornire soluzioni innovative che trasformano il modo in cui le aziende operano nel mercato contemporaneo."

✅ BUONO (brevi, scandite):
"Siamo leader globali.
Forniamo soluzioni innovative.
Trasformiamo il modo di operare delle aziende."
```

Regola: **max 15 parole per frase**.

#### 2. Punteggiatura per le pause
```
✅ BUONO:
"Ogni piatto racconta una storia. [pausa lunga]
Vieni a scoprirla. [pausa breve, aspetta risposta visiva]
Da Terra e Mare."
```

- **Virgola** (,) = pausa breve (200ms)
- **Punto** (.) = pausa lunga (400ms)
- **Ellissi** (...) = pausa drammatica (600ms)

#### 3. Scrivi per l'orecchio, non per l'occhio

```
❌ FORMALE:
"L'azienda fornisce servizi di consulenza IT per PMI con fatturato > 5M€."

✅ NATURALE:
"Aiutiamo le piccole e medie aziende a crescere con la tecnologia."
```

Evita:
- Abbreviazioni (`IT`, `PMI`, `CEO`) → scrivi per esteso
- Acronimi → pronuncia lettere per lettere = distrazione
- Numeri in cifre → scrivi in lettere ("ventimila euro" non "20.000€")
- Troppa punteggiatura tecnica → usa punti e virgole solo dove serve

#### 4. Ritmo e velocità

Circa **3 parole al secondo** per la voce naturale:
- 30 parole ≈ 10 secondi
- 60 parole ≈ 20 secondi
- 90 parole ≈ 30 secondi

Per calcolare: word count / 3 = secondi approssimativi.

#### 5. Tono per brand

```
Charon (luxury/finance):
"Gestisci il tuo patrimonio con discrezione e competenza."

Kore (food/wellness):
"Ogni ingrediente, scelto con amore per te."

Fenrir (sport/energy):
"Niente è impossibile. Inizia oggi."

Puck (tech/startup):
"Code faster. Ship smarter. Scale better."
```

---

## Music Generation (Lyria 3)

### CLI di base

```bash
python3 tools/video/music-generate.py --prompt "..." [opzioni]
```

### Parametri

| Parametro | Default | Descrizione |
|-----------|---------|-------------|
| `--prompt` | **required** | Descrizione stile musicale (vedi formula sotto) |
| `--model` | `lyria-3-pro-preview` | Modello (pro o clip) |
| `--duration` | 30 (sec) | Durata output (1-120 sec) |
| `--output` | auto (timestamp) | Percorso WAV output |

### Modelli

| Modello | Qualità | Tempo | Uso |
|---------|---------|-------|-----|
| `lyria-3-pro-preview` | Massima | ~30-60s | Output finale, brani lunghi |
| `lyria-3-clip-preview` | Alta | ~10-20s | Clip brevi (<15s), test rapido |

### Formula prompt musicale

Struttura vincente: `[strumento], [mood/atmosfera], [contesto], [ritmo/tempo]`

Esempi compilati:

#### Ristorante / Dinner ambience
```bash
python3 tools/video/music-generate.py \
  --prompt "acoustic guitar, warm and relaxed, dinner atmosphere, slow tempo" \
  --duration 30 \
  --output bg-restaurant.wav
```

#### Intro energica per video
```bash
python3 tools/video/music-generate.py \
  --prompt "electronic synth, energetic intro, tech startup, punchy beats, 10 seconds" \
  --model lyria-3-clip-preview \
  --duration 10 \
  --output intro-energetic.wav
```

#### Luxury / Automotive cinematic
```bash
python3 tools/video/music-generate.py \
  --prompt "orchestral strings, cinematic, luxury brand, elegant and powerful, dramatic" \
  --duration 20 \
  --output bg-luxury.wav
```

#### Wellness / Spa
```bash
python3 tools/video/music-generate.py \
  --prompt "ambient piano, calm and soothing, spa atmosphere, minimal beats" \
  --duration 45 \
  --output bg-spa.wav
```

#### Corporate / B2B background
```bash
python3 tools/video/music-generate.py \
  --prompt "light electronic, professional, business presentation, steady rhythm" \
  --duration 60 \
  --output bg-corporate.wav
```

#### Fitness / Motivational
```bash
python3 tools/video/music-generate.py \
  --prompt "hip-hop beat, energetic and powerful, gym workout, strong bass, motivational" \
  --duration 30 \
  --output bg-fitness.wav
```

### Prompt engineering tips

1. **Sii specifico**: non "musica bella", ma "piano lento con violini ambient"
2. **Contesto aiuta**: "spotify playlist per cena" vs "dinner background"
3. **Mood + Strumento**: "sad electronic" vs "upbeat acoustic"
4. **Durata nel prompt**: "10 seconds intro" produce output migliore che non specificarla
5. **Test clip prima**: usa `lyria-3-clip-preview` + 10-15s per testare veloce, poi genera full con `pro`

---

## Integrazione con Remotion

### Aggiungere audio a Remotion composition

```typescript
import { Audio, staticFile } from "remotion";

export const MyComposition = () => {
  return (
    <div>
      {/* Solo musica di sottofondo (volume basso) */}
      <Audio 
        src={staticFile("audio/background-music.wav")} 
        startFrom={0} 
        volume={0.2} 
      />
      
      {/* Voiceover (volume alto) */}
      <Audio 
        src={staticFile("audio/voiceover.wav")} 
        startFrom={0} 
        volume={1} 
      />
    </div>
  );
};
```

### Entrambi insieme (mixing)

```typescript
<>
  {/* Background music sotto */}
  <Audio 
    src={staticFile("audio/background.wav")} 
    volume={0.25}      // 25% volume per la musica
    startFrom={0} 
  />
  
  {/* Voiceover sopra */}
  <Audio 
    src={staticFile("audio/voice.wav")} 
    volume={0.95}      // 95% volume per la voce
    startFrom={2}      // Inizia a 2 secondi
  />
</>
```

### Sincronizzazione timing

Se voiceover dura 20s e musica 30s:
```typescript
// Voiceover: 0-20s
// Musica: 0-30s (continua sotto)
// Silenzio: 20-30s (solo musica)

<Audio src={staticFile("music.wav")} volume={0.3} startFrom={0} />
<Audio src={staticFile("voice.wav")} volume={1} startFrom={0} />
```

---

## Output conventions

### File structure

```
tools/video/
├── output/
│   ├── voiceover_20250417_143022.wav      (TTS output con timestamp)
│   ├── voiceover_20250417_143022.json     (metadata TTS)
│   ├── music_20250417_143456.wav          (Lyria output)
│   ├── music_20250417_143456.json         (metadata Lyria)
│   └── ...
```

### Metadata JSON (auto-generato)

Ogni output genera un JSON con:
```json
{
  "type": "tts" | "music",
  "timestamp": "2025-04-17T14:30:22Z",
  "prompt": "full text/prompt usato",
  "model": "gemini-2.5-flash-preview-tts" | "lyria-3-pro-preview",
  "voice": "Aoede" | null,
  "duration_seconds": 10,
  "parameters": {
    "text": "...",
    "voice": "Aoede",
    "output": "voiceover.wav"
  }
}
```

### Conversione WAV → MP3

Se serve MP3 per distribuzione web:
```bash
ffmpeg -i output/voiceover.wav -q:a 2 output/voiceover.mp3
```

---

## Integrazione con Kling (alternative)

Per **audio ambientale sincronizzato** direttamente su video breve:

```bash
python3 tools/video/kling-generate.py \
  --image foto.jpg \
  --prompt "restaurant ambience, people chatting softly, clinking glasses" \
  --audio
```

**Quando usare**:
- ✅ Video breve (≤10s) con audio ambientale naturale
- ✅ Vuoi sincronizzazione perfetta audio-video
- ❌ Voiceover narrativo (usa TTS)
- ❌ Musica di sottofondo lunga (usa Lyria)

---

## Workflow esempio completo

### Scenario: Video promo ristorante (30 secondi)

**1. Genera voiceover narrativo**
```bash
python3 tools/video/tts-generate.py \
  --text "Terra e Mare. Dove il mare incontra la tradizione. Cucina fresca, vista sul Garda, atmosfera unica." \
  --voice Kore \
  --output voiceover-promo.wav
```
Output: ~15 secondi

**2. Genera musica di sottofondo (Lyria)**
```bash
python3 tools/video/music-generate.py \
  --prompt "acoustic guitar with Italian mandolin, warm and inviting, dinner atmosphere, slow tempo, 30 seconds" \
  --duration 30 \
  --output bg-music-promo.wav
```

**3. Mixare in Remotion**
```typescript
export const RestaurantPromo = () => {
  return (
    <div style={{ width: "100%", height: "100%" }}>
      {/* Background music */}
      <Audio 
        src={staticFile("bg-music-promo.wav")} 
        volume={0.25} 
        startFrom={0} 
      />
      
      {/* Voiceover starts at 3 seconds for visual build-up */}
      <Audio 
        src={staticFile("voiceover-promo.wav")} 
        volume={1} 
        startFrom={3} 
      />
      
      {/* Rest of video composition... */}
    </div>
  );
};
```

**4. Esporta video finale**
```bash
npx remotion render RestaurantPromo output/promo.mp4
```

---

## Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| "API key not found" | Verifica `tools/video/.env` e GOOGLE_AI_STUDIO_API_KEY |
| TTS suona innaturale | Riscrivi il testo: frasi più brevi, usa punteggiatura per pause |
| Musica Lyria generica | Prompt più specifico: "acoustic vs electronic", "slow vs energetic", contesto (dinner, gym, office) |
| Audio troppo silenzioso | Aumenta volume in Remotion: `volume={0.8}` o `volume={1}` |
| Sincronizzazione voice-music | Usa `startFrom={seconds}` per spostare timeline voiceover |
| WAV file corrotto | Prova output WAV diverso, verifica spazio disco in `tools/video/output/` |

---

## Risorse

- [Google AI Studio API docs](https://ai.google.dev/documentation)
- [Lyria Music Generation guide](https://ai.google.dev/docs/music_gen)
- [Remotion Audio docs](https://www.remotion.dev/docs/audio)
- [TTS Best Practices](https://cloud.google.com/text-to-speech/docs/voices)
