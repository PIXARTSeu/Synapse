---
name: react-three-fiber
description: React Three Fiber (R3F) knowledge base — Canvas, JSX scene graph, useFrame, useThree, useLoader, Suspense, @react-three/drei helpers, event system, SSR-safe Next.js integration. Use when building 3D scenes in React/Next.js, integrating drei components (OrbitControls, Environment, useGLTF), or debugging R3F lifecycle issues.
version: 1.0.0
---

# React Three Fiber

## Overview

R3F is a React renderer for Three.js. Instead of imperatively calling `scene.add(mesh)`, you declare meshes as JSX and React reconciles the scene graph. Everything from `threejs-fundamentals` still applies — R3F just changes the orchestration layer.

Three core pieces:
- **`<Canvas>`** — root component, creates renderer/scene/camera and the render loop.
- **JSX primitives** — every Three.js class becomes a lowercase JSX element (`<mesh>`, `<boxGeometry>`, `<meshStandardMaterial>`, `<directionalLight>`).
- **`@react-three/drei`** — companion library of pre-baked helpers (OrbitControls, Environment, useGLTF, Float, Text, Html, MeshTransmissionMaterial...). You almost always want it.

## When to Use

- 3D scenes in any React or Next.js app
- Declarative composition of meshes, lights, controls
- Hooking 3D state to React state, context, or Zustand
- Combining 3D with HTML overlays via `<Html>`
- Using drei abstractions instead of writing Three.js plumbing

Don't use when:
- The page is non-React → `threejs-fundamentals`
- You only need CSS 3D → `css-3d-transforms`
- You're shipping a Spline / Rive export → `spline-rive-web`

## Setup

```bash
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

Current versions (2026): `three@^0.169`, `@react-three/fiber@^9`, `@react-three/drei@^10`. R3F v9 requires React 19 (or 18.3+ with the new JSX transform).

## Pattern: Minimum Viable Scene

```tsx
'use client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

export function Scene() {
  return (
    <Canvas camera={{ position: [3, 2, 3], fov: 50 }} shadows>
      <color attach="background" args={['#0b0f17']} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 4, 2]} intensity={1.5} castShadow />
      <mesh castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#6366f1" />
      </mesh>
      <mesh receiveShadow position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <OrbitControls enableDamping />
    </Canvas>
  );
}
```

That's a complete scene with shadows, lights, ground, and camera controls.

## JSX Primitives — Rules

- Every Three.js class is a lowercase tag with `args` for the constructor: `<boxGeometry args={[1, 2, 3]} />`.
- Properties map directly: `position={[x, y, z]}`, `rotation={[x, y, z]}`, `scale={[x, y, z]}`. Tuples or `Vector3` instances both work.
- Set sub-properties with dot syntax: `<mesh position-y={1.5}>` is shorthand for `<mesh position={[0, 1.5, 0]}>`.
- Materials and geometries attach to their parent mesh automatically. You can also explicitly attach: `<primitive object={existingThree} />` for already-built objects (e.g. loaded glTF).

```tsx
<mesh position={[0, 1, 0]} rotation-y={Math.PI / 4}>
  <sphereGeometry args={[1, 32, 32]} />
  <meshStandardMaterial color="#fff" roughness={0.2} metalness={0.9} />
</mesh>
```

## Hook: useFrame — the render loop

```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';

function Spinner() {
  const ref = useRef<Mesh>(null!);
  useFrame((state, delta) => {
    ref.current.rotation.y += delta * 0.5;
    ref.current.position.y = Math.sin(state.clock.elapsedTime) * 0.5;
  });
  return (
    <mesh ref={ref}>
      <torusKnotGeometry args={[0.7, 0.2, 128, 32]} />
      <meshStandardMaterial color="#22d3ee" />
    </mesh>
  );
}
```

- Always multiply by `delta` for frame-rate-independent motion.
- `useFrame` callbacks **must not** set React state every frame — that causes re-renders. Mutate `ref.current.*` directly or use `useRef` for state.
- `state` gives access to `scene`, `camera`, `gl` (renderer), `clock`, `pointer`, etc.

## Hook: useThree — read R3F context

```tsx
const { camera, gl, scene, size, viewport } = useThree();
```

For one-shot reads (mount / resize). Don't subscribe to `useThree` inside `useFrame` — that would cause re-renders. If you need the camera every frame, read it from `useFrame((state) => state.camera)`.

Selectors (no re-render on irrelevant changes):

```tsx
const camera = useThree((s) => s.camera);
const viewport = useThree((s) => s.viewport);
```

## Hook: useLoader / useGLTF

```tsx
import { useGLTF } from '@react-three/drei';

function Model() {
  const { scene } = useGLTF('/models/lantern.glb');
  return <primitive object={scene} />;
}

useGLTF.preload('/models/lantern.glb'); // optional, warms cache
```

Wrap in `<Suspense>` at parent so the canvas can fall back while loading:

```tsx
<Canvas>
  <Suspense fallback={null}>
    <Model />
    <Environment preset="studio" />
  </Suspense>
</Canvas>
```

For DRACO/Meshopt compression handling → `gltf-asset-pipeline` skill.

## drei — Helpers You'll Use Constantly

| Component | Purpose |
|---|---|
| `OrbitControls` | Mouse orbit/pan/zoom |
| `Environment` | HDRI background + IBL (`preset="city"`, `"studio"`, `"sunset"`, ...) |
| `useGLTF`, `useFBX`, `useAnimations` | Model loading + animation mixer |
| `Float` | Idle floating animation |
| `Text`, `Text3D` | SDF text rendering |
| `Html` | Inline HTML positioned in 3D space |
| `useCursor` | Auto cursor change on hover |
| `Center` | Auto-center children at origin |
| `Bounds` | Auto-fit camera to children |
| `PerformanceMonitor` | Adaptive quality based on FPS |
| `MeshTransmissionMaterial` | Glass / refraction |
| `MeshDistortMaterial`, `MeshWobbleMaterial` | Stylized shader materials |
| `Sparkles`, `Stars`, `Cloud` | Decorative particles |
| `Stage` | One-line studio setup (lights + env + shadows) |
| `useTexture` | Texture loader with array support |

## Pattern: Events / Picking — built-in

R3F includes a raycaster-based event system out of the box:

```tsx
<mesh
  onClick={(e) => { e.stopPropagation(); console.log('clicked'); }}
  onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
  onPointerOut={() => setHovered(false)}
>
  {/* ... */}
</mesh>
```

Events bubble. `e.stopPropagation()` blocks meshes behind. `useCursor` from drei auto-handles the CSS cursor.

## Pattern: Camera Animation

```tsx
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath'; // drei dep, math helpers

function CameraRig({ target }: { target: [number, number, number] }) {
  useFrame((state, delta) => {
    easing.damp3(state.camera.position, target, 0.4, delta);
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}
```

`maath` ships with drei. `easing.damp3` is a smooth critically-damped spring — perfect for camera moves without setting up Framer or GSAP.

## Pattern: HTML Overlay Anchored to 3D Object

```tsx
import { Html } from '@react-three/drei';

<mesh position={[1, 1, 0]}>
  <sphereGeometry args={[0.3]} />
  <meshStandardMaterial color="hotpink" />
  <Html distanceFactor={10} occlude>
    <div className="px-2 py-1 bg-white/90 rounded text-xs">Hotspot</div>
  </Html>
</mesh>
```

`distanceFactor` scales the HTML with depth. `occlude` hides it when something is in front.

## Pattern: Performance — adaptive DPR

```tsx
import { PerformanceMonitor } from '@react-three/drei';
import { useState } from 'react';

export function Scene() {
  const [dpr, setDpr] = useState(1.5);
  return (
    <Canvas dpr={dpr}>
      <PerformanceMonitor
        onIncline={() => setDpr(2)}
        onDecline={() => setDpr(1)}
      />
      {/* ... */}
    </Canvas>
  );
}
```

R3F automatically suspends rendering when the canvas is off-screen. To force-pause animation but keep last frame visible:

```tsx
<Canvas frameloop="demand">
  {/* useFrame won't run unless you call invalidate() */}
</Canvas>
```

`frameloop="demand"` + manual `invalidate()` = render only when state changes. Massive battery savings for static scenes with occasional interaction.

## Pattern: State Outside R3F (Zustand)

```tsx
import { create } from 'zustand';

const useStore = create<{ rotation: number; spin: () => void }>((set) => ({
  rotation: 0,
  spin: () => set((s) => ({ rotation: s.rotation + Math.PI / 4 })),
}));

function Cube() {
  const rotation = useStore((s) => s.rotation);
  return (
    <mesh rotation-y={rotation}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}
```

R3F shares React's context — Zustand stores, context providers and signals work as expected. Just be careful: re-rendering a parent of `<Canvas>` re-renders the entire scene. Put 3D state **inside** the Canvas tree.

## Pattern: Multiple Cameras / View

drei's `View` lets you render multiple viewpoints into different DOM elements with a single scene:

```tsx
import { View, OrbitControls, PerspectiveCamera } from '@react-three/drei';

<>
  <div className="grid grid-cols-2 gap-2">
    <View id="view1" className="aspect-square">
      <PerspectiveCamera makeDefault position={[3, 2, 3]} />
      <Model />
      <OrbitControls />
    </View>
    <View id="view2" className="aspect-square">
      <PerspectiveCamera makeDefault position={[-3, 2, -3]} />
      <Model />
      <OrbitControls />
    </View>
  </div>
  <Canvas eventSource={document.getElementById('root')!}>
    <View.Port />
  </Canvas>
</>
```

One WebGL context, many viewports. Great for product configurators with thumbnails.

## SSR-Safe Next.js Integration

R3F touches `window` and `WebGLRenderer` — both browser-only. Two safe patterns.

### Option A: Dynamic import with ssr: false

```tsx
// app/components/SceneClient.tsx
'use client';
export { Scene as default } from './scene';
```

```tsx
// app/page.tsx (server component is fine)
import dynamic from 'next/dynamic';
const Scene = dynamic(() => import('./components/SceneClient'), {
  ssr: false,
  loading: () => <div className="h-screen animate-pulse bg-neutral-900" />,
});

export default function Page() {
  return <Scene />;
}
```

### Option B: 'use client' + lazy children

```tsx
// app/scene/Canvas.tsx
'use client';
import { Canvas as R3FCanvas } from '@react-three/fiber';
import { Suspense } from 'react';

export function Canvas({ children }: { children: React.ReactNode }) {
  return (
    <R3FCanvas dpr={[1, 2]} camera={{ position: [3, 2, 3], fov: 50 }}>
      <Suspense fallback={null}>{children}</Suspense>
    </R3FCanvas>
  );
}
```

Then import this `Canvas` from any client component. The bundle still includes Three.js client-side, but rendering doesn't crash during SSR.

### Bundle size: don't ship Three.js on every page

```ts
// next.config.ts — split Three into its own chunk
export default {
  webpack: (config) => {
    config.optimization.splitChunks.cacheGroups = {
      ...(config.optimization.splitChunks.cacheGroups ?? {}),
      three: {
        test: /[\\/]node_modules[\\/](three|@react-three)[\\/]/,
        name: 'three',
        chunks: 'all',
        priority: 20,
      },
    };
    return config;
  },
};
```

Or simply lazy-load any scene-bearing page with `dynamic(... , { ssr: false })` and the chunk auto-splits.

## Strict Mode & Cleanup

R3F handles WebGL context lifecycle, but in React Strict Mode (default in Next.js dev), effects run twice. R3F is Strict-Mode-safe **except** when you:
- Create Three.js objects outside the JSX tree (e.g. in a `useMemo` without disposal).
- Spawn workers/raf inside `useFrame` callbacks.

Use `useEffect` cleanup for anything you create manually:

```tsx
useEffect(() => {
  const audio = new Audio();
  return () => { audio.pause(); };
}, []);
```

## Examples

### Example 1: Hero product viewer
`<Canvas>` + `<Stage>` (drei) + `<Model>` (useGLTF) + `<OrbitControls enableZoom={false} autoRotate />`. 30 lines.

### Example 2: Interactive map of nodes
Tons of `<InstancedMesh>` via drei's `<Instances>`/`<Instance>`. Each `<Instance>` has its own onClick. Click triggers a Zustand action that opens a side panel.

### Example 3: Scroll-driven scene
Wrap scene in a sticky container, use `useScroll` (Framer) → pass `scrollYProgress` into `useFrame` to animate camera. See `scroll-3d-animations` for the scroll plumbing.

## Troubleshooting

### "ReferenceError: window is not defined" during build
Cause: scene module loaded during SSR.
Fix: dynamic import with `{ ssr: false }`, or move the import into a `'use client'` child component.

### Canvas blank, no errors, but DOM has `<canvas>` element
Cause: usually missing camera position (camera at `[0,0,0]` inside the mesh) or no lights with a Standard material.
Fix: set `camera={{ position: [3, 2, 3] }}` on Canvas, add lights, or temporarily swap to `meshBasicMaterial` to isolate.

### onClick / onPointerOver fires only on small portion of mesh
Cause: another mesh in front intercepts the raycaster.
Fix: use `e.stopPropagation()` on the wanted mesh, or set `raycast={null}` on the occluding mesh, or use drei `<Mask>`/`useCursor`.

### useFrame runs but mesh doesn't update visually
Cause: state mutation without telling React… that's actually fine in `useFrame` — but if you're trying to drive a *material color*, set `material.color.set('#xyz')` directly, not `<meshStandardMaterial color={state}>` per-frame.
Fix: mutate Three objects via refs inside `useFrame`. Reserve JSX props for static or low-frequency changes.

### Strict Mode double-invokes effects → WebGL warnings
Cause: manual object creation in a non-cleaned-up effect.
Fix: return a cleanup function. Or move resource allocation into JSX so R3F manages lifecycle.

### `useGLTF` cache stale after deploy
Cause: drei caches by URL string; if the GLB is at the same path but changed, the cached parse wins.
Fix: hash filenames at build (Next.js `public/` doesn't do this — host assets via the `app/api` route or put them in `app/` and import as a static asset, or change filename per release).

### Performance terrible on mobile / Android Chrome
Cause: high DPR + post-processing + many shadows.
Fix: `dpr={[1, 1.5]}`, disable shadows or use `shadows="basic"`, use `<PerformanceMonitor>` to drop quality dynamically, defer `<Environment>` HDRI to a smaller resolution.

### "Three.r152 multiple instances" warning
Cause: bundler resolved two copies of `three`.
Fix: ensure `three` is in your dependencies (not just transitive). Check `npm ls three`; pin a single version. With pnpm, add `three` to `dependenciesMeta` for `injected` if needed.
