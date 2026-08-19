---
name: gltf-asset-pipeline
description: glTF/GLB asset preparation pipeline — Blender export, gltfpack (Meshopt) and gltf-transform optimization, Draco geometry compression, KTX2 + Basis Universal textures, gltfjsx code generation, hosting & cache headers. Use when a 3D model is too heavy, you need to bake/export from Blender, optimize for production, generate React Three Fiber components from a model, or set up CDN headers for .glb files.
version: 1.0.0
---

# glTF Asset Pipeline

## Overview

glTF 2.0 (extension `.gltf` for JSON+bins, `.glb` for binary packed) is the de-facto standard for 3D on the web. A shippable model needs four things:

1. **Clean geometry** — no overlapping verts, sane scale (meters), proper origin.
2. **Compressed mesh data** — Draco or, preferably, **Meshopt**.
3. **Compressed textures** — KTX2/Basis (`.ktx2`), not JPG/PNG.
4. **Right loader on the client** — DRACOLoader / MeshoptDecoder / KTX2Loader wired up.

A typical "5MB raw glTF" can ship at 400-700 KB after this pipeline with no visible quality loss.

## When to Use

- A `.glb` is over ~1 MB and you ship it on a critical page
- Mobile users see slow loads or thermal throttling
- Designer hands you Blender file, FBX, OBJ, USD, or sketchfab download
- You need TypeScript-typed mesh access (gltfjsx)
- Setting up CDN/cache for 3D assets on Next.js / Vercel / Coolify
- Texture memory bloating GPU on mid-tier mobile

Don't use when:
- The model is < 100 KB raw — optimization save is not worth pipeline overhead
- You're prototyping with placeholder primitives — skip until production

## Tools — Cheat Sheet

| Tool | What it does | Install |
|---|---|---|
| **Blender** | Authoring, export glTF | desktop |
| **gltf-transform** | CLI: validate, inspect, optimize, prune, weld, dedup, draco, meshopt, ktx2 | `npm i -g @gltf-transform/cli` |
| **gltfpack** | Single-shot Meshopt-optimized export | `npm i -g gltfpack` |
| **toktx / basisu** | Encode KTX2 textures directly | bundled with @gltf-transform |
| **gltfjsx** | Generate typed R3F component from .glb | `npx gltfjsx <file>` |
| **glTF Viewer** (Don McCurdy) | Web-based inspector | gltf.report or app.gltf.report |

## Blender Export Settings

File → Export → glTF 2.0:

| Setting | Value | Notes |
|---|---|---|
| Format | glTF Binary (.glb) | Single file, smaller |
| Include → Selected Objects | on (if needed) | Don't export the whole scene by accident |
| Transform → +Y Up | on | glTF convention |
| Geometry → Apply Modifiers | on | Otherwise the export is the cage, not the result |
| Geometry → UVs | on | Required for textured materials |
| Geometry → Normals | on | Otherwise lighting breaks |
| Geometry → Tangents | on | Needed for normal maps |
| Geometry → Compression | off | Do it via gltf-transform, not Blender's Draco — better control |
| Materials → Materials | Export | |
| Materials → Image Format | Auto | Keep PNG/JPG, convert to KTX2 later |
| Animation | as needed | If model is rigged |

**Before export**: in Blender, apply scale (Ctrl+A → All Transforms), set origin to center of mass or base (Object → Set Origin), use **meters** as scene unit (Scene properties → Units → Length: Meters).

## Pattern: One-Shot Optimization (gltfpack)

```bash
gltfpack -i model.glb -o model.opt.glb -cc -tc
```

Flags:
- `-cc` = compress meshes with Meshopt (default level, recommended)
- `-tc` = compress textures to KTX2 with BasisU UASTC for normal maps and ETC1S for color
- `-tu` = use UASTC for everything (higher quality, bigger)
- `-tb` = use BasisU ETC1S only (smallest, lossy)
- `-si N` = simplify mesh to N % triangles (e.g. `-si 0.5`)

This single command typically reduces a 5 MB raw glTF to 500-900 KB.

## Pattern: Pipeline (gltf-transform — fine control)

```bash
# Inspect first
gltf-transform inspect model.glb

# Standard production pipeline
gltf-transform optimize model.glb model.opt.glb \
  --texture-compress webp \
  --simplify false

# Or full pipeline manually
gltf-transform dedup model.glb model.dedup.glb
gltf-transform prune model.dedup.glb model.pruned.glb
gltf-transform weld model.pruned.glb model.welded.glb
gltf-transform meshopt model.welded.glb model.meshopt.glb
gltf-transform uastc model.meshopt.glb model.final.glb \
  --slots {basecolor,emissive} --filter ETC1S
gltf-transform uastc model.final.glb model.final.glb \
  --slots {normal,occlusion,metallicroughness} --filter UASTC
```

`dedup` removes duplicate accessors/textures/materials; `prune` removes unused; `weld` merges co-incident verts; `meshopt` compresses geometry; `uastc` encodes KTX2 textures.

## Draco vs Meshopt — Pick One

| | Draco | Meshopt |
|---|---|---|
| Ratio | very high (60-90% reduction) | high (40-70%) |
| Decode speed | slow on mobile CPU | fast everywhere (SIMD) |
| Loader bundle | 300+ KB (WASM decoder) | 8 KB (JS decoder) |
| Recommendation | use when bandwidth is the bottleneck | **default choice** |

For most projects Meshopt wins on total time-to-render. Use Draco only if your CDN charges per GB and the bundle size of the decoder is acceptable.

## Pattern: KTX2 Texture Encoding

```bash
# Encode existing PNG/JPG textures into a KTX2 inside the glb
gltf-transform uastc model.glb model.ktx.glb \
  --slots "baseColorTexture,emissiveTexture" --filter ETC1S
gltf-transform uastc model.ktx.glb model.ktx.glb \
  --slots "normalTexture" --filter UASTC
```

Guidelines:
- **Color / albedo / emissive** → ETC1S (smaller, lossy)
- **Normal / roughness / metallic / AO** → UASTC (preserves precision)
- Resolution: 2K is plenty for hero models, 1K or 512 for background props

KTX2 + Basis Universal is GPU-native — textures are uploaded compressed and stay compressed in VRAM. **Massive** GPU memory savings.

## Pattern: Loader Setup (Three.js + R3F)

```ts
// vanilla Three.js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();

// Draco (if you used it)
const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(draco);

// KTX2 — needs the renderer for support detection
const ktx2 = new KTX2Loader()
  .setTranscoderPath('https://www.gstatic.com/basis-universal/versioned/2021-04-15-ba1c3e4/')
  .detectSupport(renderer);
loader.setKTX2Loader(ktx2);

// Meshopt
loader.setMeshoptDecoder(MeshoptDecoder);

loader.load('/models/scene.glb', (gltf) => scene.add(gltf.scene));
```

In R3F:

```tsx
import { useGLTF } from '@react-three/drei';

useGLTF.preload('/models/scene.glb');

function Model() {
  const { scene } = useGLTF(
    '/models/scene.glb',
    'https://www.gstatic.com/draco/v1/decoders/', // optional DRACO path
    (loader) => {
      // Optionally wire MeshoptDecoder manually:
      loader.setMeshoptDecoder(MeshoptDecoder);
    },
  );
  return <primitive object={scene} />;
}
```

drei detects Meshopt and KTX2 by default; only DRACO needs an explicit path.

## Pattern: gltfjsx — typed R3F component

```bash
npx gltfjsx public/models/scene.glb --types --transform
```

Generates `Scene.tsx`:

```tsx
import { useGLTF } from '@react-three/drei';
import { GLTF } from 'three-stdlib';

type GLTFResult = GLTF & {
  nodes: {
    Body: THREE.Mesh;
    Cap: THREE.Mesh;
  };
  materials: {
    PaintedSteel: THREE.MeshStandardMaterial;
  };
};

export function Model(props: JSX.IntrinsicElements['group']) {
  const { nodes, materials } = useGLTF('/models/scene-transformed.glb') as GLTFResult;
  return (
    <group {...props}>
      <mesh geometry={nodes.Body.geometry} material={materials.PaintedSteel} />
      <mesh geometry={nodes.Cap.geometry} material={materials.PaintedSteel} />
    </group>
  );
}
useGLTF.preload('/models/scene-transformed.glb');
```

`--transform` runs gltf-transform optimize first, outputting `scene-transformed.glb` next to the original.

Best workflow: hand model to gltfjsx, get typed component + optimized file, commit the result. Re-run only when designer ships a new asset.

## Hosting & Cache (Next.js / Vercel / Coolify)

### Static under `public/`

Drop `.glb` in `public/models/`. Next.js serves them with sane defaults but no immutable cache. Override headers:

```ts
// next.config.ts
const nextConfig = {
  async headers() {
    return [
      {
        source: '/models/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};
```

Hash filenames per release (`scene.abc123.glb`) so the immutable cache safely invalidates on update.

### CDN

For large libraries of models, host on Cloudflare R2 / S3 / Bunny CDN. Set `Cache-Control: public, max-age=31536000, immutable` + `Access-Control-Allow-Origin: *` (or your domain). Add brotli/gzip — `.glb` (binary) compresses ~5-15%, **but** if you used Meshopt or Draco, content is already compressed and gzip will be a no-op.

### Streaming

For multi-MB scenes, ship the structure first and stream parts via the `KHR_draco_mesh_compression` chunked extension, or split into multiple glb's loaded lazily by camera distance. Tools: `gltf-transform partition`.

### Range requests

Most CDNs serve `.glb` with byte-range support. Three.js doesn't stream by default, but you can manually `fetch` with `Range:` headers for very large models. Rare; only do this above ~50 MB.

## Performance Budget

Rough budgets for a public-facing hero scene (mid-tier mobile, 4G):

| Asset | Target | Hard ceiling |
|---|---|---|
| Initial glb | < 500 KB | 1.5 MB |
| Total scene (all glbs) | < 2 MB | 5 MB |
| Triangle count | < 200 k | 1 M |
| Draw calls | < 50 | 200 |
| Texture VRAM (KTX2 BasisU) | < 30 MB | 100 MB |

Use Three.js `renderer.info` and DevTools Network panel to verify before shipping.

## Using with Next.js

Beyond the cache headers above, two more things:

- **Don't `import` a .glb as a module** — Next.js will base64-inline it into the JS bundle. Always reference via URL string (`/models/scene.glb`).
- **Prefetch hero models** with `<link rel="preload" as="fetch" crossorigin>` in `app/layout.tsx` head:

```tsx
import Head from 'next/head';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <link
          rel="preload"
          as="fetch"
          href="/models/hero.glb"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

Combined with `useGLTF.preload('/models/hero.glb')` at module top, the model is decoded before the Canvas mounts.

## Examples

### Example 1: Compress a designer hand-off
Designer sends `chair.blend`. Export from Blender as `.glb` (8 MB). Run `gltfpack -i chair.glb -o chair.opt.glb -cc -tc` → 650 KB. Generate component: `npx gltfjsx public/models/chair.opt.glb --types`. Commit both.

### Example 2: Library of 50 product models
Pipeline: each model through `gltf-transform optimize`, hosted on R2 with immutable cache, lazy-loaded via `useGLTF` inside `<Suspense>` blocks. Add `<PerformanceMonitor>` to drop DPR when GPU strains under heavy scene swaps.

### Example 3: Streaming a large architectural scene
20 MB original — partition with `gltf-transform partition` into `room1.glb`, `room2.glb`, etc. Load nearest two by camera position via R3F effect.

## Troubleshooting

### Model loads as a tiny dot or a huge wall
Cause: scale in Blender wasn't applied or scene units weren't meters.
Fix: Blender → Object → Apply → All Transforms. Set Scene units to Meters. Re-export.

### Model is dark / flat-shaded despite lights in scene
Cause: missing or zero-length normals, or Blender exported with "Auto Smooth" but no normals.
Fix: Blender → Object Data Properties → Normals → enable. Or in gltf-transform: `gltf-transform optimize` recomputes when needed.

### Textures are pink / missing
Cause: texture path absolute on designer's machine, or KTX2 used without the loader.
Fix: convert to `.glb` (embeds textures). Wire `KTX2Loader` when using `.ktx2`. Check with `gltf-transform inspect`.

### Bundle includes the .glb as base64
Cause: you imported the file: `import scene from './scene.glb'`.
Fix: don't import — reference as string URL: `useGLTF('/models/scene.glb')`. Move to `public/` if needed.

### "DRACOLoader: Unable to load draco_decoder.wasm"
Cause: bad decoder path, or your CSP blocks `https://www.gstatic.com`.
Fix: download decoders to `public/draco/` and `loader.setDecoderPath('/draco/')`. Same for Basis Universal (`public/basis/`).

### Animation doesn't play
Cause: missing `useAnimations` hook or `gltf.animations` array is empty.
Fix: in R3F: `const { animations } = useGLTF(...); const { actions } = useAnimations(animations, scene); useEffect(() => actions['ActionName']?.play(), []);`. Verify with `gltf-transform inspect` that animations exist.

### File loads but is opaque where it should be transparent
Cause: glTF `KHR_materials_transmission` extension stripped, or `transparent: false` on material override.
Fix: gltf-transform preserves extensions; check with `inspect`. In R3F, if you're overriding the material, copy `transparent`/`transmission`/`thickness` props.

### Tangent space looks wrong on normal maps
Cause: tangents not exported from Blender, or normal map flipped Y.
Fix: enable "Tangents" on export. Some pipelines use OpenGL normal maps (Y up), others DirectX (Y down) — flip the green channel in the source if shading looks inverted.
