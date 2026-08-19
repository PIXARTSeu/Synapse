---
name: webgpu-tsl
description: WebGPU + Three.js TSL (Three Shading Language) knowledge base — WebGPURenderer, node-based materials, MeshBasicNodeMaterial / MeshStandardNodeMaterial, compute shaders via Fn(), node operators (mix, fract, sin, attribute/uniform helpers), WGSL bridges, feature detection and WebGL2 fallback. Use when targeting modern GPUs with compute, replacing GLSL ShaderMaterial with TSL nodes, writing first WebGPU shader, or porting effects to Three.js's WebGPU pipeline.
version: 1.0.0
---

# WebGPU + TSL (Three Shading Language)

## Overview

WebGPU is the successor to WebGL — direct access to modern GPU features (compute shaders, storage buffers, native parallelism, indirect draws). As of 2026 it's stable in Chromium-based browsers, Safari 18+, and progressing in Firefox.

Three.js exposes WebGPU through `WebGPURenderer` and a **node-based material/shader system** called TSL (Three Shading Language). TSL is JavaScript — you compose shader graphs with functions and operators. The compiler emits WGSL for WebGPU and (for compatibility) GLSL for WebGL2, so the same code runs on both backends.

This is the future of Three.js. New features (compute, ray-tracing helpers, bindless textures) ship here first; the GLSL path is in maintenance.

## When to Use

- New project where you want compute shaders (particles, fluids, GPU sort)
- Performance ceiling reached with WebGL — need compute or storage buffers
- Authoring effects without writing raw GLSL/WGSL strings
- Cross-compatibility (WGSL + GLSL fallback) without writing two paths
- Porting an experimental Three.js demo from `examples/jsm/nodes`

Don't use when:
- You need broad Safari < 18 / older Firefox / Android Browser support — fall back to WebGL `react-three-fiber`
- The project is shipping in weeks and stability matters more than novelty — WebGPU API still evolves quarterly
- All you need is a fragment shader — `glsl-shaders` is simpler

## Setup

```bash
npm install three
```

You also want the TypeScript types — they're bundled in `@types/three` but the `webgpu` / `nodes` paths are still in `three/webgpu` and `three/tsl` subpaths.

```ts
// minimal WebGPU setup
import * as THREE from 'three/webgpu';
import { color, fract, time } from 'three/tsl';

const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
await renderer.init();              // async init — required
renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
camera.position.set(2, 1.5, 3);
camera.lookAt(0, 0, 0);

const material = new THREE.MeshBasicNodeMaterial();
material.colorNode = color('#6366f1').mul(fract(time));

const cube = new THREE.Mesh(new THREE.BoxGeometry(), material);
scene.add(cube);

renderer.setAnimationLoop(() => {
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
});
```

Three things differ from the GLSL/WebGL path:
1. Import from `three/webgpu`, not `three`.
2. Renderer is `WebGPURenderer`, and you `await renderer.init()`.
3. Materials are `*NodeMaterial` variants. You assign **nodes** to slots like `colorNode`, `positionNode`, `normalNode`.

## TSL — Core Idea

A node is a JS value that represents a shader expression. You combine nodes with methods that mirror GLSL ops:

```ts
import { float, vec3, uv, time, sin, mix } from 'three/tsl';

const t = sin(time);                       // float node
const c = mix(vec3(1, 0, 0), vec3(0, 0, 1), t);   // vec3 node
const r = c.mul(uv().x);                   // multiply by uv.x
```

You assign nodes to material slots:

```ts
const mat = new THREE.MeshStandardNodeMaterial();
mat.colorNode = r;                  // overrides base color
mat.positionNode = position.add(vec3(0, sin(time), 0)); // displace vertex
mat.emissiveNode = c.mul(0.5);
```

TSL composes a shader graph; the renderer compiles it on first use into WGSL (WebGPU) or GLSL (WebGL2). You don't manage strings, uniforms, or attribute bindings.

## Common Node Imports

```ts
import {
  // values
  float, vec2, vec3, vec4, color,
  // attributes
  position, normal, uv, instanceIndex,
  // uniforms (built-ins)
  time, cameraPosition, viewportUV, screenUV,
  // math
  sin, cos, abs, fract, mix, smoothstep, length, normalize, dot, cross,
  // helpers
  attribute, uniform, varying, texture,
  // control flow
  If, Loop, Fn,
} from 'three/tsl';
```

## Pattern: Vertex Displacement

```ts
import { positionLocal, sin, time, vec3 } from 'three/tsl';

const mat = new THREE.MeshStandardNodeMaterial();
mat.positionNode = positionLocal.add(
  vec3(0, sin(time.add(positionLocal.x.mul(2))).mul(0.3), 0)
);
```

No vertex shader to write. The `positionNode` slot replaces gl_Position; the rest of the PBR shader runs unchanged.

## Pattern: Fragment Effect (Noise Gradient)

```ts
import { mx_noise_float, color, mix, vec2, uv, time } from 'three/tsl';

const mat = new THREE.MeshBasicNodeMaterial();
const n = mx_noise_float(uv().mul(5).add(time.mul(0.2)));
mat.colorNode = mix(color('#6366f1'), color('#22d3ee'), n);
```

`mx_noise_float` is one of many built-in node functions ported from MaterialX — production-grade noise without rolling your own.

## Pattern: Reusable Function with Fn()

```ts
import { Fn, vec3, mix, color, float } from 'three/tsl';

const brandGradient = Fn(([t]: [t: ReturnType<typeof float>]) => {
  return mix(color('#6366f1'), color('#22d3ee'), t);
});

const mat = new THREE.MeshBasicNodeMaterial();
mat.colorNode = brandGradient(uv().x);
```

`Fn` (TSL functions) compile into reusable shader functions. Type the parameters as TSL value types; return any TSL value.

## Pattern: Compute Shader

Compute shaders are where WebGPU pays for itself. Run thousands of parallel ops on storage buffers — particles, physics solvers, image processing.

```ts
import {
  Fn, instanceIndex, storage, vec3, uniform, time,
} from 'three/tsl';
import { StorageBufferAttribute } from 'three/webgpu';

const COUNT = 100_000;

// allocate GPU buffer
const positionsBuffer = new StorageBufferAttribute(COUNT, 3);
const positions = storage(positionsBuffer, 'vec3', COUNT);

// compute pass
const computePositions = Fn(() => {
  const i = instanceIndex;
  const t = time.mul(0.5);
  positions.element(i).assign(vec3(
    sin(i.toFloat().mul(0.1).add(t)),
    cos(i.toFloat().mul(0.07).add(t)),
    sin(i.toFloat().mul(0.13))
  ));
})().compute(COUNT);

// run every frame
await renderer.computeAsync(computePositions);
```

Then sample the buffer in a material to render those positions as instanced points / spheres.

## Pattern: WGSL Bridge (Raw String Escape Hatch)

If TSL doesn't expose a shader feature you need, drop down to raw WGSL:

```ts
import { wgslFn } from 'three/tsl';

const myEffect = wgslFn(`
  fn rand( seed: vec2<f32> ) -> f32 {
    return fract( sin( dot( seed, vec2<f32>(12.9898, 78.233) ) ) * 43758.5453 );
  }
`);

const mat = new THREE.MeshBasicNodeMaterial();
mat.colorNode = vec3(myEffect({ seed: uv() }));
```

Similar `glslFn` exists for the WebGL2 fallback path. Use bridges sparingly — they break TSL portability.

## Feature Detection & Fallback

WebGPU may be unavailable on user's browser. Fall back to `WebGLRenderer` (still TSL-compatible):

```ts
import * as THREE from 'three/webgpu';

const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

const renderer = hasWebGPU
  ? new THREE.WebGPURenderer({ canvas, antialias: true })
  : new THREE.WebGLRenderer({ canvas, antialias: true });

if ('init' in renderer) await renderer.init();
```

TSL emits GLSL when running on `WebGLRenderer`. Some advanced features (compute, storage buffers) **don't have a fallback** — gate them on `hasWebGPU` and provide a simpler path for WebGL2 users.

## R3F + WebGPU

R3F v9+ supports WebGPU via `@react-three/fiber`'s `extend` and the `<Canvas gl={renderer}>` slot. Cleaner path: use the pmndrs maintained `@react-three/webgpu` (when stable in your version) or pass an init function.

```tsx
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three/webgpu';

<Canvas
  gl={async (canvas) => {
    const renderer = new THREE.WebGPURenderer({ canvas: canvas as HTMLCanvasElement, antialias: true });
    await renderer.init();
    return renderer;
  }}
>
  {/* scene with NodeMaterial */}
</Canvas>
```

As of early 2026 this still has rough edges; check the R3F release notes for your exact version.

## Performance — What Actually Matters

- **Less driver overhead** — WebGPU batches commands; multi-thousand-mesh scenes run faster than WebGL.
- **Compute** — physics, particles, post-FX done in compute beat fragment-shader hacks by an order of magnitude.
- **Storage buffers > textures** for buffer data — no awkward float-encoded textures anymore.
- **Async pipelines** — shader compile is async; expect a frame skip on first material use. Pre-warm hero materials with `material.compileAsync(scene, camera, renderer)`.
- **First-frame cost is higher** than WebGL — TSL compile + WGSL build. Show a loader.

## Browser Support (2026 snapshot)

| Browser | Status |
|---|---|
| Chrome / Edge / Brave | Stable since 113 (2023). Default on. |
| Safari iOS / macOS | Stable in 18+ (2024). Older needs flag. |
| Firefox | Behind flag (`dom.webgpu.enabled`); progressing. |
| Android WebView | Mixed — depends on OEM. Detect at runtime. |

If you need universal support, ship a WebGL2 fallback with TSL → GLSL. If your audience is internal / desktop / modern Safari+, WebGPU is fine.

## Using with Next.js

WebGPU is browser-only — same SSR rules as plain Three.js (see `react-three-fiber` / `threejs-fundamentals`).

```tsx
import dynamic from 'next/dynamic';
const Scene = dynamic(() => import('./webgpu-scene'), { ssr: false });
```

Also: WebGPU requires a **secure context** (HTTPS or localhost). In dev that's fine; in production, ensure Coolify / Vercel terminates TLS. On the off-chance you embed inside a `<iframe>`, you may need `allow="webgpu"` on the iframe.

## Examples

### Example 1: 100k particles with compute
Compute pass updates positions; instanced mesh reads from the storage buffer for rendering. Smooth on M2/M3 / mid-range NVIDIA, slideshow on integrated GPUs.

### Example 2: Custom PBR shader via TSL
Subclass `MeshStandardNodeMaterial`, override `colorNode`, `roughnessNode`, `metalnessNode` with TSL expressions. Get full PBR lighting + your custom inputs without writing PBR math.

### Example 3: Real-time fluid sim on a plane
Compute shader maintains a velocity field in a storage buffer; rendered via a plane that samples that buffer in its `colorNode`. Heavy on mobile, gorgeous on desktop.

## Troubleshooting

### "GPUAdapter request failed" / `navigator.gpu` undefined
Cause: browser doesn't support WebGPU, or running on non-secure context.
Fix: gate with `if ('gpu' in navigator)`. Use HTTPS in production. For iframes, add `allow="webgpu"`. Provide a WebGLRenderer fallback.

### "renderer.init is not a function"
Cause: imported `Three.WebGLRenderer` instead of WebGPU one.
Fix: `import * as THREE from 'three/webgpu'` (not `'three'`). The WebGL renderer doesn't need (or have) `init()`.

### Materials look weird / pink
Cause: forgot to assign `colorNode` or assigned wrong type.
Fix: every NodeMaterial slot expects a typed node — `colorNode` wants `vec3`/`vec4`/color, not `float`. Wrap with `vec3()` if needed.

### First frame stalls for ~200ms
Cause: shader compile is async; runs on first draw.
Fix: pre-warm with `await renderer.compileAsync(scene, camera);` after scene setup, before starting the animation loop.

### Compute shader returns zeros
Causes: forgot to call `.compute(N)` on the Fn; wrong buffer size; didn't `await renderer.computeAsync(...)` before reading.
Fix: ensure the compute kernel is invoked **every frame** (or whenever input changes), with the correct invocation count. Inspect the buffer with `renderer.getArrayBufferAsync(buffer)`.

### Same TSL works in WebGPU but breaks in WebGL2 fallback
Cause: used a feature with no GLSL equivalent (compute, storage).
Fix: feature-detect and branch — compute path for WebGPU, simulated/limited fragment-shader path for WebGL2.

### TypeScript errors importing from 'three/tsl'
Cause: `@types/three` not up to date.
Fix: install latest `@types/three`. With pnpm, may need to dedupe (`pnpm dedupe`). Otherwise cast `as any` until types catch up — TSL types are evolving.
