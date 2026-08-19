---
name: webxr-spatial
description: WebXR knowledge base — immersive VR/AR sessions on Quest, Vision Pro, Android (ARCore), iOS (via WebXR Viewer), spatial UI patterns, hand tracking, anchors, hit testing, controllers, `@react-three/xr`, Three.js WebXRManager. Use when targeting Quest/Vision Pro/Android AR with a web app, building spatial UIs, integrating hand input, debugging session start/stop, or porting an R3F scene to immersive mode.
version: 1.0.0
---

# WebXR (VR + AR on the Web)

## Overview

WebXR is the browser API for immersive sessions — VR headsets (Quest 2/3, Vision Pro via Safari), AR on Android (ARCore Chrome), and mixed reality. It runs on top of WebGL/WebGPU; your existing Three.js / R3F scene becomes the world the user steps into.

Two session types:
- **`immersive-vr`** — fully replaces the user's view. No real-world camera.
- **`immersive-ar`** — see-through (passthrough on Quest 3 / Vision Pro, camera composite on Android).

`@react-three/xr` (pmndrs) is the recommended way to add WebXR to an R3F project — declarative wrappers for controllers, hand tracking, teleport, anchors, hit testing.

## When to Use

- Building a Quest or Vision Pro experience deliverable via URL (no app store)
- AR product preview ("see this chair in your room") on Android
- Spatial portfolio / showroom for headset visitors
- Internal training, walk-throughs, interactive 3D documentation
- WebXR research, hackathons, immersive prototypes

Don't use when:
- Universal mobile audience — WebXR is supported on a small subset
- The 3D scene works fine on a flat screen — adding XR adds complexity
- You need persistent multiplayer spatial — WebXR is rendering only; networking is on you

## Browser & Headset Matrix (2026)

| Device | Browser | VR | AR / Passthrough |
|---|---|---|---|
| Quest 3 / 3S | Meta Browser, Wolvic | ✅ | ✅ (color passthrough) |
| Quest 2 | Meta Browser | ✅ | ❌ (BW passthrough only via API) |
| Vision Pro | Safari 17.4+ | ✅ | ✅ |
| Android (Pixel, Galaxy) | Chrome 79+ | — | ✅ ARCore |
| iPhone / iPad | Mozilla WebXR Viewer (3rd party) | — | limited |
| PCVR (Index, Pico) | Chrome / Edge w/ SteamVR or OpenXR | ✅ | ❌ |

If your target is Quest 3 + Vision Pro, you're in great shape. Beyond that, AR on Android, but iOS Safari standard doesn't ship WebXR yet.

## Setup — @react-three/xr (R3F)

```bash
npm install @react-three/xr
```

```tsx
'use client';
import { Canvas } from '@react-three/fiber';
import { XR, createXRStore, XROrigin } from '@react-three/xr';

const store = createXRStore();

export function App() {
  return (
    <>
      <button onClick={() => store.enterVR()}>Enter VR</button>
      <button onClick={() => store.enterAR()}>Enter AR</button>
      <Canvas>
        <XR store={store}>
          <ambientLight />
          <directionalLight position={[5, 5, 5]} />
          <XROrigin />
          <mesh position={[0, 1.5, -1]}>
            <boxGeometry />
            <meshStandardMaterial color="hotpink" />
          </mesh>
        </XR>
      </Canvas>
    </>
  );
}
```

`createXRStore()` is the central session manager. `store.enterVR()` / `store.enterAR()` request the session — must be called from a user gesture (button click).

## Pattern: Controllers + Hand Tracking

```tsx
import {
  XR, XROrigin, XRDomOverlay, useXRInputSourceState,
  PointerEvents,
} from '@react-three/xr';

function Scene() {
  return (
    <>
      <XROrigin />
      <PointerEvents />            {/* enables pointer events from controllers/hands */}

      <mesh
        position={[0, 1.5, -1]}
        onClick={() => console.log('clicked in XR')}
        onPointerOver={(e) => e.object.scale.setScalar(1.1)}
        onPointerOut={(e) => e.object.scale.setScalar(1)}
      >
        <boxGeometry />
        <meshStandardMaterial />
      </mesh>
    </>
  );
}
```

`<PointerEvents />` from `@react-three/xr` extends the standard R3F event system to controller rays and hand pinch. Same `onClick` / `onPointerOver` you already use.

For raw input source state:

```tsx
const left  = useXRInputSourceState('controller', 'left');
const right = useXRInputSourceState('hand', 'right');

useFrame(() => {
  if (right?.inputSource?.hand) {
    const indexTip = right.inputSource.hand.get('index-finger-tip');
    // indexTip is an XRJointSpace — get pose from session reference space
  }
});
```

## Pattern: AR Hit Testing

User taps the floor → place an object. Core AR loop:

```tsx
import {
  XR, createXRStore, XROrigin, XRHitTest, useXR,
} from '@react-three/xr';
import { Matrix4 } from 'three';
import { useState, useRef } from 'react';

const store = createXRStore({ hitTest: true });

function PlacedObjects() {
  const [items, setItems] = useState<Matrix4[]>([]);
  const matrixHelper = useRef(new Matrix4());

  return (
    <>
      <XRHitTest
        onResults={(results, getWorldMatrix) => {
          if (results.length === 0) return;
          getWorldMatrix(matrixHelper.current, results[0]);
        }}
      />

      <mesh
        onClick={() => {
          setItems((prev) => [...prev, matrixHelper.current.clone()]);
        }}
        // visualize the reticle at the latest hit position
      >
        <ringGeometry args={[0.08, 0.1, 32]} />
        <meshBasicMaterial color="white" />
      </mesh>

      {items.map((m, i) => (
        <mesh key={i} matrix={m} matrixAutoUpdate={false}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color="orange" />
        </mesh>
      ))}
    </>
  );
}
```

Quest 3 passthrough handles AR identically — same hit-test API.

## Pattern: Spatial UI (HTML in 3D)

```tsx
import { Html } from '@react-three/drei';

<mesh position={[0, 1.4, -1]}>
  <planeGeometry args={[0.6, 0.4]} />
  <meshBasicMaterial color="#fff" />
  <Html transform position={[0, 0, 0.01]} distanceFactor={1}>
    <div className="w-[400px] p-4 bg-white rounded-2xl shadow-2xl">
      <h3 className="font-bold">Hello in VR</h3>
      <button>Click me</button>
    </div>
  </Html>
</mesh>
```

`<Html transform>` (drei) renders an HTML overlay attached to the 3D plane. Works in both flat-screen R3F and inside an XR session. Pointer events flow through.

**Caveats**:
- Some headsets don't render HTML overlays at native res — keep `distanceFactor` tuned.
- Apple Vision Pro currently has issues with `<Html>` — prefer `<Text>` / `<RoundedBox>` for native primitives.

## Pattern: Teleport Locomotion

```tsx
import { TeleportTarget, useXRControllerLocomotion } from '@react-three/xr';

function Floor() {
  return (
    <TeleportTarget>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </TeleportTarget>
  );
}
```

Wrap any mesh in `<TeleportTarget>` — pointing the controller at it and pulling the trigger teleports the user there. Comfort-focused; smooth locomotion induces motion sickness for many users.

For continuous (joystick) locomotion: `useXRControllerLocomotion` exposes thumbstick state for custom movement code.

## Pattern: Anchors (AR World Persistence)

Anchors keep an object glued to a real-world spot even as tracking adjusts:

```tsx
import { XRAnchor, useXRAnchor } from '@react-three/xr';

function AnchoredCube({ pose }: { pose: XRRigidTransform }) {
  const [matrix, anchor] = useXRAnchor(pose);
  if (!matrix) return null;
  return (
    <mesh matrix={matrix} matrixAutoUpdate={false}>
      <boxGeometry args={[0.1, 0.1, 0.1]} />
      <meshStandardMaterial color="lime" />
    </mesh>
  );
}
```

Combine with hit testing — hit-test to get an `XRHitTestResult`, create an anchor from it.

## Reference Spaces

WebXR positions everything relative to a **reference space**. Common types:

- `local` — origin where session started, fixed.
- `local-floor` — like local but Y=0 is the floor. Best default for room-scale.
- `bounded-floor` — local-floor + safe zone boundary. Quest guardian.
- `unbounded` — for AR, allows world-scale movement (Hololens-style).
- `viewer` — head-attached. For HUDs / locked overlays.

`@react-three/xr` handles selection sensibly by default. You can override via `createXRStore({ referenceSpaceType: 'local-floor' })`.

## Performance — Critical for Comfort

Dropped frames in XR cause motion sickness. Hard rules:

- **Target 72 Hz minimum** (Quest), 90 Hz (Vision Pro / PCVR). Hard cap, not optional.
- **Render eyes once-per-frame** — Three.js multiviews are auto-handled, but heavy post-FX can double cost.
- **Avoid R3F post-processing** in XR — most headsets reject the multi-pass setup. If you need bloom, accept the visual cost.
- **Foveated rendering** — opt-in on Quest via `xr.setFoveation(0..1)`. Saves GPU. Use 0.5-0.7.
- **Fixed framerate** — don't try to push 120 Hz on Quest 3 unless your scene is trivial; aim for 90 Hz stable.

## DOM Overlay (AR HUD on phone)

For AR on a phone, sometimes you want a 2D HUD button visible during the session:

```tsx
import { XRDomOverlay } from '@react-three/xr';

<XR store={store}>
  <XRDomOverlay>
    <div className="absolute bottom-4 left-4 px-4 py-2 bg-black/70 text-white rounded">
      Tap to place
    </div>
  </XRDomOverlay>
</XR>
```

Renders as the WebXR DOM overlay layer — visible above the camera feed during the AR session. Vital UX for tap-to-place flows.

## Using with Next.js

WebXR is browser-only and **requires HTTPS** (or localhost). Coolify / Vercel handle TLS automatically, so production is fine. Local dev:

```bash
# expose localhost over HTTPS using a tunnel
npx ngrok http 3000
# or use Next.js HTTPS dev: next dev --experimental-https
```

Quest's browser will refuse `enterVR` over plain HTTP.

Bundle:
- `@react-three/xr` adds ~50-100 KB. Tree-shakeable; only import what you use.
- Combine with the `react-three-fiber` Next.js patterns (dynamic import, ssr off).

```tsx
'use client';
import dynamic from 'next/dynamic';
const Scene = dynamic(() => import('./Scene'), { ssr: false });
```

## Examples

### Example 1: Furniture placement AR demo
Android Chrome / Quest 3 AR. Hit-test for floor, place a chair model on tap, drag with pointer to rotate. ~150 lines including model load.

### Example 2: VR portfolio walkthrough
Room with mounted "frames" (planes with project thumbnails). `<TeleportTarget>` floor. Hover frame → play short video texture; pinch → open project URL via `<XRDomOverlay>`.

### Example 3: Spatial whiteboard
Multiplayer optional. Three planes arranged in a V. `<Html transform>` cards on each that the user can move with controller grip. Persist anchors so cards stay in the same real-world spot session to session.

## Troubleshooting

### `enterVR()` does nothing / silently fails
Cause: not in a user gesture, missing HTTPS, or session type not supported.
Fix: ensure the call is inside `onClick` of a real button. Serve over HTTPS in production, use `next dev --experimental-https` or ngrok in dev. Check support: `await navigator.xr?.isSessionSupported('immersive-vr')`.

### Black/blue screen on session start
Cause: scene background not set, or lights misplaced — works on flat screen because of orbit camera, but XR camera starts at origin with nothing nearby.
Fix: place geometry around `[0, 1.5, -1]` (head height, in front). Set `scene.background` or have skybox / `<Environment>`.

### Quest controllers don't respond / no rays visible
Cause: `<PointerEvents />` not added, or wrong store config.
Fix: include `<PointerEvents />` from `@react-three/xr`. Verify in MetaQuest browser dev tools — controllers show as pointers when correctly configured.

### Vision Pro shows the scene but no AR passthrough
Cause: requested `immersive-vr` instead of `immersive-ar`, or required feature missing.
Fix: `store.enterAR()` (not `enterVR`). For Vision Pro, also request features: `createXRStore({ requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking', 'hit-test', 'anchors'] })`.

### Hit test reports no results in AR
Cause: ARCore needs a few seconds of camera movement to map the floor; or pointing at a textureless surface.
Fix: instruct user to look around. Try better-lit / textured surface. Verify session has `hit-test` feature.

### Frame rate drops, user feels sick
Cause: scene too heavy, post-FX enabled, shadow maps oversized.
Fix: profile with `renderer.info.render`. Disable post-FX in XR (check `gl.xr.isPresenting` before mounting effects). Enable foveation. Reduce shadow map size. Simplify GLTF models.

### Hand tracking unavailable on Quest
Cause: user has hands disabled in the Quest system settings, or feature not requested.
Fix: request `optionalFeatures: ['hand-tracking']` in store creation. Detect at runtime: `useXRInputSourceState('hand', 'left')`.

### HTTPS warning when opening from Quest browser
Cause: self-signed cert in dev.
Fix: use ngrok / Cloudflare Tunnel for an externally trusted cert. Or accept Quest browser's prompt (not always available).
