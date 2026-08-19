---
name: r3f-postprocessing
description: Post-processing in React Three Fiber via @react-three/postprocessing (pmndrs) — EffectComposer, Bloom, DepthOfField, ChromaticAberration, Vignette, Noise, SSAO, ToneMapping, custom effects. Use when adding cinematic visuals (bloom, DOF, color grading) to an R3F scene, debugging post-FX performance, or porting a Three.js EffectComposer setup to declarative R3F syntax.
version: 1.0.0
---

# R3F Post-Processing

## Overview

Post-processing = render the scene to an off-screen texture, then run one or more shader passes on it before showing the final image. Used for cinematic looks: bloom on emissive surfaces, depth-of-field on the camera focal point, color grading, vignette, film grain, chromatic aberration, SSAO.

`@react-three/postprocessing` is the pmndrs binding to `postprocessing` (the canonical post library by Vanruesc). It composes effects into **one pass** (multipass under the hood), which is dramatically faster than chaining separate Three.js `ShaderPass` instances.

## When to Use

- Adding bloom to glowing/emissive elements
- Cinematic depth of field
- Color grading and tone mapping
- Subtle vignette / chromatic aberration / noise for atmosphere
- Screen-space ambient occlusion (SSAO)
- Glitch / pixelation / outline stylized looks
- A single declarative chain instead of manual EffectComposer

Don't use when:
- The scene is performance-critical on low-end mobile — post passes are expensive
- You only need one specific effect that's cheaper as a fragment shader → `glsl-shaders`
- You're targeting WebXR — many headsets don't tolerate post FX → `webxr-spatial`

## Setup

```bash
npm install @react-three/postprocessing postprocessing
```

`postprocessing` is a peer dep. R3F v9 needs `@react-three/postprocessing@^3`.

## Pattern: Minimum Composer

```tsx
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

<Canvas>
  {/* scene */}
  <EffectComposer>
    <Bloom intensity={0.6} luminanceThreshold={0.4} luminanceSmoothing={0.2} />
    <Vignette eskil={false} offset={0.1} darkness={0.9} />
  </EffectComposer>
</Canvas>
```

`<EffectComposer>` replaces the default render — once you add it, the chain of children becomes the final image. Order matters: top-to-bottom = first-to-last pass.

## Effects — Cheat Sheet

| Effect | Purpose | Key props |
|---|---|---|
| `Bloom` | Glow on bright pixels | `intensity`, `luminanceThreshold`, `mipmapBlur` |
| `DepthOfField` | Focus blur | `focusDistance`, `focalLength`, `bokehScale` |
| `ChromaticAberration` | RGB shift at edges | `offset={[x, y]}` |
| `Noise` | Film grain | `premultiply`, `blendFunction` |
| `Vignette` | Dark corners | `offset`, `darkness` |
| `ToneMapping` | Color response curve | `mode={ACES_FILMIC}` |
| `HueSaturation` | Color grading | `hue`, `saturation` |
| `BrightnessContrast` | Levels | `brightness`, `contrast` |
| `ColorAverage` | Desaturate / mono | `blendFunction`, `opacity` |
| `Pixelation` | Pixel art look | `granularity` |
| `Glitch` | RGB tear glitch | `strength`, `delay`, `duration` |
| `Outline` | Edge outline on selected meshes | `selection`, `edgeStrength`, `visibleEdgeColor` |
| `SSAO` | Ambient occlusion | `radius`, `intensity`, `samples` |
| `SSR` | Screen-space reflections | `temporalResolve`, `roughnessFade` |
| `GodRays` | Volumetric rays | `sun`, `weight`, `decay`, `density` |
| `LUT` | 3D LUT color grading | `lut={texture}` |
| `Scanline` | CRT lines | `density` |
| `DotScreen` | Halftone | `angle`, `scale` |

## Pattern: Cinematic Look

```tsx
import {
  EffectComposer, Bloom, DepthOfField, Vignette, BrightnessContrast,
  HueSaturation, Noise, ToneMapping,
} from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction } from 'postprocessing';

<EffectComposer disableNormalPass>
  <DepthOfField focusDistance={0.02} focalLength={0.05} bokehScale={4} />
  <Bloom intensity={0.4} luminanceThreshold={0.7} mipmapBlur />
  <BrightnessContrast brightness={-0.02} contrast={0.08} />
  <HueSaturation saturation={-0.05} />
  <Vignette darkness={0.7} offset={0.15} />
  <Noise opacity={0.04} blendFunction={BlendFunction.OVERLAY} premultiply />
  <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
</EffectComposer>
```

Rules of taste:
- Bloom `luminanceThreshold` above 0.5 keeps the bloom off your UI / sky.
- `mipmapBlur` is **on by default in v3** and produces softer, more pleasant bloom than the legacy gaussian.
- DoF `bokehScale` 2-5 is cinematic; over 8 looks dreamy/broken.
- Tone mapping should run **last** — it's the final color shaping pass.

## Pattern: Selective Bloom (Only Emissive Meshes)

Selective bloom = bloom only the meshes you mark, not the rest of the scene.

```tsx
import { EffectComposer, Bloom, Selection, Select } from '@react-three/postprocessing';

<Canvas>
  <Selection>
    <EffectComposer autoClear={false}>
      <Bloom intensity={2} luminanceThreshold={0} mipmapBlur />
    </EffectComposer>

    <Select enabled>
      <mesh>
        <sphereGeometry args={[0.5]} />
        <meshBasicMaterial color="hotpink" toneMapped={false} />
      </mesh>
    </Select>

    <mesh position={[2, 0, 0]}>
      <boxGeometry />
      <meshStandardMaterial color="#222" />
    </mesh>
  </Selection>
</Canvas>
```

`toneMapped={false}` on the emissive material is the trick — it pushes color values above 1.0, which the bloom luminance threshold picks up.

## Pattern: SSAO + SSR (Realism)

```tsx
import { EffectComposer, SSAO, SSR } from '@react-three/postprocessing';

<EffectComposer disableNormalPass={false}>
  <SSAO
    samples={16}
    radius={0.1}
    intensity={20}
    luminanceInfluence={0.6}
    color="black"
  />
  <SSR
    temporalResolve
    intensity={1}
    distance={5}
    fade={5}
    roughnessFade={1}
    thickness={3}
  />
</EffectComposer>
```

SSAO + SSR require the normal pass — don't set `disableNormalPass` for these. Both are GPU-heavy; budget them only for hero scenes.

## Pattern: Outline (Hover Highlight)

```tsx
import {
  EffectComposer, Outline, Selection, Select,
} from '@react-three/postprocessing';
import { useState } from 'react';

function Mesh({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Select enabled={hovered}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        {children}
      </mesh>
    </Select>
  );
}

<Selection>
  <EffectComposer autoClear={false}>
    <Outline
      edgeStrength={20}
      visibleEdgeColor={0xffffff}
      hiddenEdgeColor={0x222222}
      blur
    />
  </EffectComposer>
  {/* meshes */}
</Selection>
```

`<Outline>` automatically picks up `<Select>` children. Toggle `enabled` per-mesh to highlight on hover.

## Pattern: Custom Effect

If a built-in doesn't exist, wrap a custom `Effect` class:

```ts
// effects/Pixelate.ts
import { Effect, BlendFunction } from 'postprocessing';

const frag = /* glsl */ `
  uniform float granularity;
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 d = 1.0 / resolution * granularity;
    vec2 q = (floor(uv / d) + 0.5) * d;
    outputColor = texture2D(inputBuffer, q);
  }
`;

export class PixelateEffect extends Effect {
  constructor(granularity = 10) {
    super('PixelateEffect', frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([['granularity', { value: granularity }]]),
    });
  }
}
```

```tsx
// usage
import { wrapEffect } from '@react-three/postprocessing';
const Pixelate = wrapEffect(PixelateEffect);

<EffectComposer>
  <Pixelate granularity={8} />
</EffectComposer>
```

`postprocessing`'s `Effect` API is the canonical extension point. Read the host repo's effect source files for templates of every variant.

## Performance — The Real Story

Each effect is roughly:

| Effect | Mobile cost | Desktop cost |
|---|---|---|
| ToneMapping, Vignette, ChromaticAberration, Brightness, HueSat | cheap | trivial |
| Bloom (mipmap) | medium | cheap |
| DepthOfField | medium-high | medium |
| Noise, Pixelation, Outline | cheap | trivial |
| SSAO | high | medium |
| SSR | very high | medium-high |
| GodRays | high | medium |

Total cost is dominated by:
1. **Render target size** — `EffectComposer` renders at canvas resolution × DPR. Use `multisampling={0}` and `<Canvas dpr={[1, 1.5]} />` for mobile.
2. **Normal/depth pass** — SSAO/SSR/DoF need additional G-buffer passes. Set `disableNormalPass` when no effect needs them.
3. **Number of passes** — chains > 6 effects usually mean you're over-engineering. Combine custom effects.

```tsx
<EffectComposer
  multisampling={0}             // off for mobile, 4 or 8 for desktop
  disableNormalPass={false}     // true if no SSAO/SSR/DoF
  enableNormalPass={true}       // alias on some versions
  frameBufferType={HalfFloatType}  // HDR — needed for bloom on highlights
>
```

Use `<PerformanceMonitor>` (drei) to disable expensive effects when FPS drops:

```tsx
import { PerformanceMonitor } from '@react-three/drei';

const [fxOn, setFxOn] = useState(true);

<Canvas>
  <PerformanceMonitor onDecline={() => setFxOn(false)} />
  {fxOn && (
    <EffectComposer>
      <SSAO ... />
      <Bloom ... />
    </EffectComposer>
  )}
</Canvas>
```

## Tone Mapping & HDR

Bloom needs HDR — pixel values above 1.0 — to glow. Make sure:

```tsx
<Canvas
  gl={{
    toneMapping: NoToneMapping,        // let post chain handle it
    outputColorSpace: SRGBColorSpace,
  }}
>
```

And set `toneMapped={false}` on materials you want to bloom past 1.0. `ToneMapping` effect at the end of the chain remaps the HDR back to displayable range.

## Using with Next.js

No extra setup beyond what you already need for R3F. Effects are part of the same client bundle.

Two things to watch:

1. **Tree-shake unused effects.** Import only what you use (`import { Bloom } from '@react-three/postprocessing'`) — the package is ESM and tree-shakeable, but Three.js shader chunks can still bloat.

2. **Split the chunk.** Post-processing pulls a few hundred KB of shader text. Make sure your `next.config.ts` splitChunks (see `react-three-fiber` skill) is grouping `@react-three/postprocessing` with the Three.js chunk.

## Examples

### Example 1: SaaS hero with neon CTA glow
Selective bloom on the CTA button (using `toneMapped={false}` + emissive color), subtle vignette, ACES tonemap. 4 effects total, mobile-friendly.

### Example 2: Photoreal product showcase
SSAO + SSR + DoF + Bloom + Tonemap. Desktop only — wrap in `<PerformanceMonitor>` and downgrade to just Bloom + Tonemap on mobile.

### Example 3: Retro arcade UI
Pixelation + Scanline + Chromatic + DotScreen. All cheap. Set `<Canvas dpr={1}>` for that "CRT pixel" feel.

## Troubleshooting

### Scene goes black when adding EffectComposer
Cause: another `<Canvas>` render path conflicts, or `autoClear` mismatch.
Fix: ensure only one EffectComposer. For selective effects (Bloom on `<Selection>`), set `autoClear={false}`. Check the Canvas isn't being unmounted/remounted.

### Bloom looks fuzzy / blocky
Cause: `mipmapBlur` off (legacy gaussian), or `intensity` too high with low `luminanceThreshold`.
Fix: explicitly set `mipmapBlur={true}` (v3 default). Raise `luminanceThreshold` to 0.4-0.7. Reduce `intensity` to 0.3-0.6.

### Bloom doesn't show on bright color
Cause: tonemapping clamps pixel values before bloom samples them.
Fix: set `toneMapped={false}` on the emissive material; let the post chain handle tonemapping. Use `<color attach="emissive" args={[r, g, b]} />` with values > 1.

### DoF blurs the whole scene
Cause: `focusDistance` and `focalLength` not tuned, or `bokehScale` enormous.
Fix: `focusDistance` is normalized 0..1 (closer to camera = 0). Tune via `useControls` (leva) during dev: `focusDistance` ~0.02, `focalLength` ~0.05, `bokehScale` 2-4.

### SSAO has visible "halos" or banding
Cause: too few `samples`, wrong `radius`.
Fix: `samples: 16-32`, `radius: scene-scale-dependent` (0.05-0.2 for human-scale scenes), `rangeThreshold` ~0.005, `rangeFalloff` ~0.001.

### Outline misses some objects
Cause: object not inside `<Select>` or `<Selection>` parent missing.
Fix: wrap entire scene in `<Selection>` and any selectable mesh in `<Select enabled={...}>`.

### Frame rate halves with one effect added
Cause: high-cost effect (SSR, SSAO, GodRays) without acknowledging budget.
Fix: profile in Chrome DevTools Performance → check GPU times. Drop multisampling, reduce normal pass usage, lower DPR. If still bad, drop the effect on mobile via `PerformanceMonitor`.
