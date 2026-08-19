---
name: glsl-shaders
description: GLSL shader knowledge base — vertex/fragment programs, uniforms, varyings, attributes, noise functions, ShaderMaterial in Three.js, shaderMaterial helper in R3F/drei, raymarching primer, full-screen post-effects. Use when writing custom shaders, debugging shader compile errors, animating vertices/fragments, creating procedural materials, or porting Shadertoy code to Three.js.
version: 1.0.0
---

# GLSL Shaders

## Overview

A shader is a tiny program that runs on the GPU, once per vertex (vertex shader) and once per pixel (fragment shader), in parallel. Both stages communicate via:

- **attributes** — per-vertex data sent from CPU (`position`, `normal`, `uv` are auto-provided).
- **uniforms** — per-draw constants set from JS (`uTime`, `uMouse`, `uColor`).
- **varyings** — values written in the vertex shader, interpolated, read in the fragment shader.

In WebGL2 (the Three.js default) you write GLSL 3.00 ES. WebGPU uses WGSL or Three.js's TSL — that's a separate skill (`webgpu-tsl`).

## When to Use

- Procedural materials (gradients, noise, plasma, water, dissolve)
- Vertex displacement (waves, wobble, morph, weather)
- Stylized rendering (cel/toon, hatching, halftone)
- Post-processing effects you can't get from `@react-three/postprocessing`
- Porting Shadertoy work into Three.js
- Optimizing — replacing many per-pixel JS operations with one shader

Don't use when:
- A drei abstraction already does it (`MeshDistortMaterial`, `MeshTransmissionMaterial`)
- The effect is post-processing → `r3f-postprocessing`
- You don't need custom math — `MeshStandardMaterial` + textures is faster to ship

## Setup — Vanilla Three.js

```ts
import * as THREE from 'three';

const material = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#6366f1') },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      float pulse = 0.5 + 0.5 * sin(uTime + vUv.x * 6.28);
      gl_FragColor = vec4(uColor * pulse, 1.0);
    }
  `,
});

// in render loop
material.uniforms.uTime.value = clock.getElapsedTime();
```

The `/* glsl */` comment is a hint for VSCode extensions to syntax-highlight the string.

## Setup — R3F with drei's `shaderMaterial` helper

```tsx
// shaders/wave.ts
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import * as THREE from 'three';

const WaveMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color('#22d3ee') }, // uniforms
  /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      float w = sin(vUv.y * 10.0 + uTime * 2.0) * 0.5 + 0.5;
      gl_FragColor = vec4(uColor * w, 1.0);
    }
  `,
);

extend({ WaveMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    waveMaterial: any;
  }
}

export { WaveMaterial };
```

```tsx
// Plane.tsx
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import './shaders/wave';

export function WavePlane() {
  const ref = useRef<any>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.uTime += dt; });
  return (
    <mesh>
      <planeGeometry args={[2, 2, 64, 64]} />
      <waveMaterial ref={ref} />
    </mesh>
  );
}
```

`shaderMaterial` auto-generates the material class, the uniforms object, and TypeScript types via `extend`.

## Vertex Shader — built-in inputs

```glsl
// attributes (per-vertex, auto-provided by Three.js)
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

// uniforms (auto-provided)
uniform mat4 modelMatrix;       // local → world
uniform mat4 viewMatrix;        // world → camera
uniform mat4 projectionMatrix;  // camera → clip
uniform mat4 modelViewMatrix;   // modelMatrix * viewMatrix
uniform mat3 normalMatrix;      // for transforming normals
```

The minimum vertex shader:

```glsl
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

## Pattern: Vertex Displacement (Wave on a Plane)

```glsl
// vertex
uniform float uTime;
varying vec2 vUv;
varying float vElevation;

void main() {
  vUv = uv;
  vec3 pos = position;
  float elevation = sin(pos.x * 4.0 + uTime) * 0.2
                  + cos(pos.y * 3.0 + uTime * 0.5) * 0.15;
  pos.z += elevation;
  vElevation = elevation;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
```

```glsl
// fragment
uniform vec3 uColorLow;
uniform vec3 uColorHigh;
varying vec2 vUv;
varying float vElevation;

void main() {
  float t = smoothstep(-0.2, 0.2, vElevation);
  vec3 col = mix(uColorLow, uColorHigh, t);
  gl_FragColor = vec4(col, 1.0);
}
```

Plane must have **subdivisions** for vertex displacement: `<planeGeometry args={[2, 2, 128, 128]} />`. A flat plane with `args={[2, 2]}` has 4 vertices and cannot bend.

## Pattern: Noise — the everyday tool

GLSL has no built-in noise. Use Ashima's classic `cnoise`, `snoise`, or `simplex2`:

```glsl
// 2D simplex noise — credit Ashima Arts, MIT
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                  + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
```

Once defined, use anywhere:

```glsl
float n = snoise(vUv * 5.0 + uTime * 0.2);
gl_FragColor = vec4(vec3(n * 0.5 + 0.5), 1.0);
```

For 3D/4D noise, copy the Ashima `noise3D`/`noise4D` snippet from the canonical `webgl-noise` repo — same MIT license.

## Pattern: Distance-Based Effects

```glsl
varying vec2 vUv;
uniform float uTime;
void main() {
  vec2 p = vUv - 0.5;
  float d = length(p);
  float rings = sin(d * 40.0 - uTime * 4.0) * 0.5 + 0.5;
  gl_FragColor = vec4(vec3(rings), 1.0);
}
```

## Pattern: Fresnel (Edge Glow)

```glsl
// vertex — pass world-space normal & view direction
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
```

```glsl
// fragment
varying vec3 vNormal;
varying vec3 vViewDir;
uniform vec3 uRimColor;
void main() {
  float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
  gl_FragColor = vec4(uRimColor * fresnel, fresnel);
}
```

`cameraPosition` is a Three.js auto-injected uniform. Set `transparent: true` on the material to let `alpha` through.

## Pattern: Raymarching (Primer)

Raymarching renders implicit surfaces inside a fragment shader by stepping a ray from the camera and querying a Signed Distance Function (SDF). Heavy GPU but produces fluid, organic shapes.

```glsl
float sphereSDF(vec3 p, float r) { return length(p) - r; }
float sceneSDF(vec3 p) { return sphereSDF(p, 1.0); }

float raymarch(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    float d = sceneSDF(p);
    if (d < 0.001 || t > 50.0) break;
    t += d;
  }
  return t;
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  vec3 ro = vec3(0.0, 0.0, 3.0);
  vec3 rd = normalize(vec3(uv, -1.0));
  float t = raymarch(ro, rd);
  vec3 col = t > 50.0 ? vec3(0.0) : vec3(1.0 - t * 0.1);
  gl_FragColor = vec4(col, 1.0);
}
```

This is the door to Shadertoy-style work — full sceneSDF as union/intersection/difference of primitives, soft shadows, ambient occlusion, materials. Read Inigo Quilez's articles (iquilezles.org) as the canonical reference.

## Pattern: Full-Screen Effect (without R3F's postprocessing)

```ts
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const scene = new THREE.Scene();
const quad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D uScene;
      uniform float uTime;
      void main() {
        vec4 c = texture2D(uScene, vUv);
        c.rgb *= 1.0 + 0.1 * sin(uTime + vUv.y * 30.0);
        gl_FragColor = c;
      }
    `,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
    `,
    uniforms: { uScene: { value: null }, uTime: { value: 0 } },
  }),
);
scene.add(quad);
```

For real post-processing pipelines (multiple passes, depth, bloom), use `r3f-postprocessing` instead of hand-rolling.

## Common Built-ins & Conventions

| Function | Purpose |
|---|---|
| `mix(a, b, t)` | linear interpolation |
| `smoothstep(e0, e1, x)` | s-curve interpolation |
| `clamp(x, 0.0, 1.0)` | aka `saturate` |
| `step(edge, x)` | hard 0/1 threshold |
| `length(v)` | euclidean length |
| `normalize(v)` | unit vector |
| `dot(a, b)` | dot product |
| `cross(a, b)` | cross product (vec3) |
| `reflect(I, N)` | reflection vector |
| `pow(x, y)` | exponent |
| `fract(x)` | fractional part |
| `mod(x, y)` | modulo |
| `texture2D(s, uv)` / `texture(s, uv)` (GLSL 3) | sample texture |

Always operate in normalized ranges (0..1) when possible. Mix raw pixel coordinates only at the very edge of the shader.

## Performance

- Branches are cheap on modern GPUs **only when uniform across threads** — `if (uniform)` is free, `if (varying)` causes warp divergence.
- Trig (`sin`, `cos`, `pow`) is fine in moderation; avoid in tight raymarching inner loops where you can.
- `texture` calls have latency — sample once, mutate locally, vs sampling 8 times for blur.
- Keep the `for` loop bound a **constant** so the GLSL compiler can unroll. Use `break` for early-exit, but the loop count must be statically determinable.
- Prefer `precision mediump float;` for mobile fragments unless you really need `highp`. (Three.js sets `highp` by default — override for mobile-only scenes.)
- Render to a smaller render target and upscale for heavy effects — half-res blur looks identical to most users.

## Using with Next.js

Shaders are strings, so no special bundling needed. For long shaders, store them in `.glsl` files and import as text:

### Vite (CRA, Astro, plain Vite)
Use `vite-plugin-glsl` to import `.glsl` files as strings with `#include` support.

### Next.js (Webpack)
Add a raw loader:

```ts
// next.config.ts
const nextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      type: 'asset/source', // treats file as raw string
    });
    return config;
  },
};
```

```ts
// usage
import vertexShader from './shaders/wave.vert';
import fragmentShader from './shaders/wave.frag';
```

For Turbopack (Next.js 15 default in dev): use Turbopack's `loaders` config or just inline shaders as template literals — the simplest stable path.

Hot-reload of shader strings is automatic with both bundlers; the material gets re-compiled when the file changes.

## Examples

### Example 1: Animated background gradient
Single full-screen plane, fragment shader with `snoise(vUv + uTime * 0.1)`, mix between two brand colors. Saves a 1MB animated WebM video.

### Example 2: Hover ripple on a button
Plane behind the button, mouse position passed as uniform, fragment shader draws expanding ring when `uMouseDownTime` is recent. Pure shader = zero DOM nodes per ripple.

### Example 3: Procedural starfield
Fragment shader with hash-based dot pattern + parallax layers via `vUv * uLayerScale + uTime * uSpeed`. Five layers stacked in alpha. Cheaper than rendering 1000 instanced spheres.

## Troubleshooting

### "ERROR: 0:N: '...' : undeclared identifier"
Cause: typo, or using a uniform/varying you forgot to declare on that side.
Fix: every `varying` declared in both vertex and fragment. Every uniform declared in the shader **and** included in the `uniforms` object passed to `ShaderMaterial`.

### Shader compiles but renders solid black
Causes:
1. `gl_FragColor` never set (or alpha 0).
2. Returning `vec3(...)` where `vec4` is expected.
3. Material is `transparent: true` but `gl_FragColor.a = 0`.
4. `Standard`-style lighting required (use `ShaderMaterial`, not `MeshStandardMaterial`, for full control).
Fix: temporarily replace fragment with `gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);` and rebuild upward.

### Mesh is solid color, vertex displacement ignored
Cause: plane has no subdivisions, so there are no internal vertices to displace.
Fix: `<planeGeometry args={[2, 2, 128, 128]} />` (or similar). Boxes/spheres usually have enough subdivisions by default.

### Per-pixel logic is fine but lighting is wrong
Cause: `ShaderMaterial` has zero lighting — you build it yourself. Standard PBR lighting requires `MeshStandardMaterial` + `onBeforeCompile` patching, **not** a fresh `ShaderMaterial`.
Fix: either build manual Phong/PBR in your fragment shader, or use `onBeforeCompile` to inject snippets into a Standard material. Drei's `<CustomShaderMaterial>` (third-party) is a popular middle ground.

### Performance terrible on mobile
Cause: `highp` precision + heavy raymarch + 3x DPR.
Fix: render to half-res target, drop precision, cap loop counts on mobile UA detection, use `dpr={[1, 1.5]}` on the Canvas.

### "Cannot read properties of undefined (reading 'value')" when setting uniforms
Cause: uniforms object hasn't merged yet (Suspense fallback rendered first), or you've named a uniform inconsistently between JS and GLSL.
Fix: gate uniform writes with `if (ref.current?.uniforms.uTime)`. Match names byte-for-byte between JS keys and shader declarations.

### Shadertoy port doesn't look right
Cause: Shadertoy provides `iTime`, `iResolution`, `iMouse`, `fragCoord` — Three.js uses different names and inverted Y.
Fix: rename uniforms (`iTime → uTime`), pass `vec2 iResolution = vec2(width, height)`, derive `vec2 fragCoord = vUv * iResolution`. Flip Y if needed: `fragCoord.y = iResolution.y - fragCoord.y`.
