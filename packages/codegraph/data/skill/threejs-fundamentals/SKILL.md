---
name: threejs-fundamentals
description: Three.js core knowledge base — scene, camera, renderer, geometries, materials, lights, GLTF loader, OrbitControls, raycaster, render loop, resize handling. Use when starting a vanilla Three.js scene, debugging WebGL context, integrating Three.js without React, or learning the engine before moving to React Three Fiber.
version: 1.0.0
---

# Three.js Fundamentals

## Overview

Three.js is a thin abstraction over WebGL. The five pillars of every scene:

1. **Scene** — the container.
2. **Camera** — point of view.
3. **Renderer** — the WebGL/WebGPU draw call orchestrator.
4. **Mesh** = geometry + material — what you see.
5. **Render loop** — `requestAnimationFrame` that draws every frame.

Master these in vanilla Three.js first — even if you'll end up using React Three Fiber, the same primitives are exposed underneath.

## When to Use

- Setting up a scene from scratch (no R3F)
- Debugging "the scene is black / not rendering"
- Loading a GLTF/GLB model
- Adding lights, shadows, materials
- Picking objects with the mouse (raycaster)
- Implementing camera controls
- Integrating Three.js into a non-React app (Astro, Svelte, vanilla, Webflow embed)

Don't use when:
- You're already in React → `react-three-fiber`
- You only need CSS 3D transforms → `css-3d-transforms`
- You need shaders specifically → `glsl-shaders`

## Setup

```bash
npm install three
npm install -D @types/three
```

Current stable as of 2026: `three@^0.169.x`. The API has been stable since r150; named imports work everywhere.

```ts
import * as THREE from 'three';
```

## Pattern: Minimal Working Scene

```ts
import * as THREE from 'three';

const canvas = document.querySelector('canvas')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0f17');

const camera = new THREE.PerspectiveCamera(
  50,                                      // fov
  window.innerWidth / window.innerHeight,  // aspect
  0.1,                                     // near
  100                                      // far
);
camera.position.set(2, 1.5, 3);
camera.lookAt(0, 0, 0);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: '#6366f1' })
);
scene.add(cube);

scene.add(new THREE.AmbientLight('#ffffff', 0.3));
const sun = new THREE.DirectionalLight('#ffffff', 1.5);
sun.position.set(3, 4, 2);
scene.add(sun);

function tick() {
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
```

That's a complete scene. Everything else is variation.

## Cameras

| Type | Use |
|---|---|
| `PerspectiveCamera(fov, aspect, near, far)` | 3D scenes, the default 99% of the time |
| `OrthographicCamera(left, right, top, bottom, near, far)` | Isometric/UI, technical diagrams, 2D-like games |

- `fov`: 50 is cinematic. 75 is "normal". > 90 = fisheye.
- `near`/`far`: keep the ratio as small as you can — `near: 0.1, far: 100` is fine. Big ratios cause z-fighting.

Window resize handling — **always**:

```ts
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

## Geometries

Built-in: `BoxGeometry`, `SphereGeometry`, `PlaneGeometry`, `CylinderGeometry`, `TorusGeometry`, `IcosahedronGeometry`, `TextGeometry`, `TubeGeometry`, `ExtrudeGeometry`, `LatheGeometry`.

For complex shapes, load a glTF (`gltf-asset-pipeline` skill) — don't build them by hand.

For instanced geometry (1000+ identical meshes), use `InstancedMesh`:

```ts
const mesh = new THREE.InstancedMesh(geometry, material, 10_000);
const m = new THREE.Matrix4();
for (let i = 0; i < 10_000; i++) {
  m.setPosition(Math.random()*10-5, Math.random()*10-5, Math.random()*10-5);
  mesh.setMatrixAt(i, m);
}
```

## Materials

| Material | Lighting | Use |
|---|---|---|
| `MeshBasicMaterial` | none | Unlit, flat color/texture |
| `MeshStandardMaterial` | PBR | Realistic default — use this |
| `MeshPhysicalMaterial` | PBR + extras | Clearcoat, transmission, iridescence, sheen |
| `MeshLambertMaterial` | diffuse only | Cheap, soft |
| `MeshPhongMaterial` | specular | Legacy, prefer Standard |
| `MeshToonMaterial` | cel-shaded | Stylized |
| `MeshNormalMaterial` | none | Debug — shows normals as colors |
| `LineBasicMaterial` | none | Lines |
| `PointsMaterial` | none | Particles |
| `ShaderMaterial` | custom | Write your own — see `glsl-shaders` |

Standard material key props:
```ts
new THREE.MeshStandardMaterial({
  color: '#fff',
  metalness: 0.5,   // 0 = dielectric, 1 = metal
  roughness: 0.5,   // 0 = mirror, 1 = matte
  map: colorTexture,
  normalMap: normalTexture,
  emissive: '#000',
  emissiveIntensity: 0,
});
```

## Lights

| Light | Behavior | Cost |
|---|---|---|
| `AmbientLight` | flat global | cheap |
| `HemisphereLight` | sky + ground tint | cheap |
| `DirectionalLight` | parallel rays (sun) | medium, supports shadows |
| `PointLight` | omni from a point | medium |
| `SpotLight` | cone | medium, supports shadows |
| `RectAreaLight` | rectangular emitter | needs `RectAreaLightUniformsLib.init()` |

Realistic baseline: AmbientLight 0.2-0.4 + HemisphereLight 0.3 + DirectionalLight 1.0 as the sun. Use `scene.environment` (HDRI) instead of fiddling lights when you need realism — far better PBR result.

## Shadows

```ts
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 50;
sun.shadow.camera.left = -10;
sun.shadow.camera.right = 10;
sun.shadow.camera.top = 10;
sun.shadow.camera.bottom = -10;

mesh.castShadow = true;
floor.receiveShadow = true;
```

Shadows are expensive. Use them only on hero objects, keep shadow camera frustum tight, use `BasicShadowMap` for stylized scenes.

## OrbitControls

```ts
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;   // inertia
controls.dampingFactor = 0.05;
controls.minDistance = 1;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI / 2; // no flipping under floor

function tick() {
  controls.update();   // required when damping is on
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
```

Other useful controls: `MapControls`, `TransformControls`, `PointerLockControls` (FPS), `FlyControls`.

## Loading a GLTF Model

```ts
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');

const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

loader.load(
  '/models/scene.glb',
  (gltf) => {
    scene.add(gltf.scene);
  },
  (event) => console.log(`${(event.loaded / event.total) * 100}% loaded`),
  (err) => console.error(err),
);
```

Asset preparation (compression, KTX2, optimization) → `gltf-asset-pipeline` skill.

## Environment (HDRI)

```ts
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

new RGBELoader().load('/hdr/studio_1k.hdr', (hdr) => {
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr;   // lights all PBR materials
  scene.background = hdr;    // optional: visible sky
});
```

A 1K HDR (~1 MB) usually beats 6 individual lights for realism. Tight on bandwidth budget? Use a smaller HDR + tonemapping.

## Tone Mapping & Color

```ts
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace; // default since r152
```

Always set tonemapping when using PBR materials + HDRI. Without it, highlights blow out and the image looks flat.

## Raycasting (Picking)

```ts
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

window.addEventListener('click', (e) => {
  pointer.x = (e.clientX / window.innerWidth)  * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  if (hits[0]) console.log('clicked:', hits[0].object.name);
});
```

For large scenes, raycast against a curated array, not `scene.children` recursively.

## Animation Loop with Clock

```ts
const clock = new THREE.Clock();

function tick() {
  const dt = clock.getDelta();    // seconds since last frame
  const t  = clock.getElapsedTime(); // seconds total

  cube.rotation.y += dt * 0.5;    // framerate-independent
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
```

Always multiply by `dt` for motion — never assume 60fps.

## Performance Checklist

- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` — 3x DPR on phones tanks FPS.
- Set `renderer.outputColorSpace` and stop fighting the colors.
- Use `InstancedMesh` / `BatchedMesh` for repeated geometry.
- Dispose properly when unmounting: `geometry.dispose()`, `material.dispose()`, textures `.dispose()`, then `renderer.dispose()`.
- Avoid creating objects inside the render loop (`new THREE.Vector3()` per frame leaks).
- Frustum cull is automatic but useless if you have one giant geometry — split scenes into many meshes.
- `requestAnimationFrame` pauses on tab blur in browsers — good default. For background work, use `setAnimationLoop`.

## Cleanup (memory leak prevention)

```ts
function disposeScene(scene: THREE.Scene) {
  scene.traverse((obj) => {
    if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
    const m = (obj as THREE.Mesh).material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else if (m) m.dispose();
  });
  renderer.dispose();
}
```

In React/Next, call this in your effect cleanup.

## Using with Next.js

Three.js is browser-only — `window`/`document` are touched at module load. Strategies:

1. **Dynamic import the whole scene component, SSR off:**

```tsx
import dynamic from 'next/dynamic';
const Scene = dynamic(() => import('./scene'), { ssr: false });
```

2. **Lazy-import inside `useEffect`:**

```tsx
'use client';
import { useEffect, useRef } from 'react';

export function Scene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cleanup: () => void;
    (async () => {
      const THREE = await import('three');
      // ... init, return disposer
      cleanup = () => { /* dispose */ };
    })();
    return () => cleanup?.();
  }, []);
  return <canvas ref={canvasRef} />;
}
```

In real React projects, prefer **React Three Fiber** (`react-three-fiber` skill) — it handles SSR, disposal and reconciliation automatically.

## Examples

### Example 1: 3D logo on landing
Single GLTF + HDRI environment + OrbitControls with `enableZoom: false`. ~80 lines.

### Example 2: Product configurator
Load product GLB, traverse to find named meshes (`scene.getObjectByName('seat')`), swap material color from a Tailwind palette on click. Raycaster for hotspots.

### Example 3: Embedded scene in a vanilla page (Webflow/Astro)
Vanilla Three.js (no React). Use `OrbitControls` + autoRotate, pause render loop when canvas is off-screen via IntersectionObserver.

## Troubleshooting

### Black screen, no errors
Causes (in order of likelihood):
1. No light on a `Standard/Phong/Lambert` material → add an AmbientLight or use `MeshBasicMaterial` to verify.
2. Camera inside the geometry → move it further out.
3. Camera looking the wrong way → call `camera.lookAt(target)` or set `camera.position.z = N`.
4. Renderer size not set → call `renderer.setSize(...)` after creation.

### Model loads but isn't visible
Cause: GLTF scene has zero transform but model is offset far from origin.
Fix: log `gltf.scene.children[0].position` and `gltf.scene.children[0].scale`. Re-center or rescale.

### Colors look washed out
Cause: missing `outputColorSpace = SRGBColorSpace` or sRGB texture flagged as Linear.
Fix: set `renderer.outputColorSpace = THREE.SRGBColorSpace`. For color textures, set `texture.colorSpace = THREE.SRGBColorSpace`. Normal/roughness maps stay `LinearSRGBColorSpace`.

### FPS drops over time
Cause: leaked geometries/materials, or scene growing every frame.
Fix: profile with stats.js. Walk the scene graph (`scene.children.length`) over time. Dispose properly.

### "WebGL: CONTEXT_LOST_WEBGL" warning
Cause: GPU context lost (tab moved between displays, driver crash, too many contexts).
Fix: listen to `renderer.domElement.addEventListener('webglcontextlost', ...)` and re-initialize. Limit number of WebGL canvases per page (one is best, ≤4 is reasonable).

### Z-fighting (flickering on coplanar surfaces)
Cause: two faces at the same depth, or `near/far` ratio too large.
Fix: tighten the camera frustum (`near: 0.1, far: 100`). Add a tiny offset between coplanar faces. Use `polygonOffset` on the material if necessary.

### TypeScript: "Cannot find module 'three/addons/...'"
Cause: addons live in subpaths that need `@types/three` and module resolution `bundler` or `node16+`.
Fix: ensure `"moduleResolution": "bundler"` (or `node16`) in `tsconfig.json`. With Vite/Next defaults this is on by default.
