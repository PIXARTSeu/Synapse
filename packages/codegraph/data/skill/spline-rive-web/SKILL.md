---
name: spline-rive-web
description: No-code / low-code 3D & motion graphics for the web — Spline (3D scenes with @splinetool/react-spline), Rive (interactive 2D and 3D state machines via @rive-app/canvas, @rive-app/react-canvas, @rive-app/webgl2). Use when a designer ships a .spline scene or .riv file, you need an interactive hero/illustration without writing Three.js, or for runtime-controlled state-machine animations.
version: 1.0.0
---

# Spline & Rive on the Web

## Overview

Two tools for designer-driven motion that skip writing Three.js by hand:

- **Spline** — visual 3D scene editor (like Figma for 3D). Exports a `.splinecode` URL that the runtime loads. Best for hero scenes, product showcases, marketing landings.
- **Rive** — interactive animations with state machines. Exports a `.riv` file. Best for icons, illustrations, micro-interactions, character animation. 2D-first, with newer 3D support.

Both let non-developers iterate motion without touching the codebase. Both have web runtimes you can drop into React, Vue, vanilla. Cost: bundle weight (~150-300 KB each), runtime-only (no SSR), and limited control compared to writing R3F/Three.js directly.

## When to Use

- Designer hands you a `.splinecode` URL or `.riv` file
- Hero/landing 3D scene where art direction matters more than engine control
- Interactive button states, mascot reactions, onboarding micro-interactions (Rive)
- Need designers to iterate without round-trips through code
- Quick demo / prototype where R3F overhead isn't justified

Don't use when:
- You need pixel-perfect engine control → `react-three-fiber` + `threejs-fundamentals`
- Performance-critical mobile → both tools add fixed overhead; native R3F can be leaner
- The animation is purely sequential / one-shot → CSS or `animations` is enough
- You need GLB/GLTF interop with the broader Three.js ecosystem → use Spline only as a Figma-to-glTF exporter, then load with R3F

## Spline

### Setup (React / Next.js)

```bash
npm install @splinetool/react-spline @splinetool/runtime
```

```tsx
'use client';
import Spline from '@splinetool/react-spline';

export function Hero() {
  return (
    <Spline
      scene="https://prod.spline.design/<hash>/scene.splinecode"
      onLoad={(app) => console.log('Spline loaded', app)}
    />
  );
}
```

`scene` accepts a Spline-hosted URL or a self-hosted `.splinecode`. The component renders a full-bleed canvas — wrap in a sized parent.

### Runtime API — Control Spline from React

```tsx
'use client';
import Spline from '@splinetool/react-spline';
import { useRef } from 'react';

export function Configurator() {
  const splineRef = useRef<any>(null);

  function onLoad(app: any) {
    splineRef.current = app;
  }

  function setVariant(name: string) {
    const obj = splineRef.current?.findObjectByName('Product');
    if (obj) obj.emitEvent('mouseDown'); // trigger Spline interaction
    // Or set properties:
    if (obj) obj.material.color.r = 1.0;
  }

  return (
    <>
      <Spline scene="https://prod.spline.design/<hash>/scene.splinecode" onLoad={onLoad} />
      <button onClick={() => setVariant('red')}>Red</button>
    </>
  );
}
```

Useful runtime methods:
- `findObjectByName(name)` / `findObjectById(id)`
- `setVariable(name, value)` — read/write Spline variables
- `emitEvent(name, objectName?)` — trigger Spline events
- `setBackgroundColor('#fff')` — change scene background

In Spline, name objects clearly and expose **variables** + **events** in the right panel so they're addressable from code.

### Performance

A typical Spline hero is 2-5 MB on first load (scene + textures + runtime). Tips:

- **Optimize in Spline first** — remove unused objects, reduce subdivisions, downscale textures, use the export optimizer.
- **Lazy-load** — render Spline only when in viewport via IntersectionObserver, or use Next.js `dynamic({ ssr: false })`.
- **Static fallback** — render an exported PNG until Spline is ready (use `onLoad` to swap).
- **Compress with Brotli** at the CDN level for `.splinecode`.

```tsx
import dynamic from 'next/dynamic';

const Spline = dynamic(
  () => import('@splinetool/react-spline'),
  { ssr: false, loading: () => <div className="aspect-video animate-pulse bg-neutral-900" /> }
);
```

### Exporting Spline → glTF for R3F

When you outgrow Spline (need physics, post-FX, programmatic control):
1. In Spline: File → Export → glTF.
2. Optimize via `gltf-asset-pipeline` skill.
3. Load with `useGLTF` in R3F.

You lose the Spline state machine but gain full engine control.

## Rive

### Setup (React)

```bash
npm install @rive-app/react-canvas
```

```tsx
'use client';
import { useRive } from '@rive-app/react-canvas';

export function Mascot() {
  const { RiveComponent } = useRive({
    src: '/animations/mascot.riv',
    autoplay: true,
    stateMachines: 'State Machine 1',
  });
  return <RiveComponent style={{ width: 200, height: 200 }} />;
}
```

Variants:
- `@rive-app/canvas` — vanilla JS, no framework.
- `@rive-app/react-canvas` — React wrapper, Canvas 2D renderer.
- `@rive-app/webgl2` / `@rive-app/react-webgl2` — WebGL2 renderer (better perf, larger bundle, required for 3D Rive).

### State Machines

Rive's killer feature. Designers expose **inputs** (boolean, number, trigger) that drive a state graph. Wire React state to those inputs:

```tsx
'use client';
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';

export function HoverButton() {
  const { rive, RiveComponent } = useRive({
    src: '/animations/button.riv',
    stateMachines: 'Interactions',
    autoplay: true,
  });

  const hover = useStateMachineInput(rive, 'Interactions', 'hover');
  const click = useStateMachineInput(rive, 'Interactions', 'click');

  return (
    <button
      onMouseEnter={() => hover && (hover.value = true)}
      onMouseLeave={() => hover && (hover.value = false)}
      onClick={() => click?.fire()}
    >
      <RiveComponent style={{ width: 80, height: 40 }} />
    </button>
  );
}
```

Three input types:
- **Boolean** — assign `.value = true/false`
- **Number** — assign `.value = N`
- **Trigger** — call `.fire()` (one-shot)

### Events from Rive → React

```tsx
import { Event, EventType, RiveEventType } from '@rive-app/react-canvas';

useEffect(() => {
  if (!rive) return;
  const handler = (event: Event) => {
    if (event.type === EventType.RiveEvent) {
      const data = event.data as RiveEventType;
      console.log('rive event:', data.name, data.properties);
    }
  };
  rive.on(EventType.RiveEvent, handler);
  return () => { rive.off(EventType.RiveEvent, handler); };
}, [rive]);
```

Designers fire named events from inside state machines; you handle them in React. Great for "animation finished, show next screen" handoffs.

### Performance

- **2D Canvas runtime** is ~100 KB. The 2D bin file is usually a few KB to <100 KB — feather-light.
- **WebGL2 runtime** is ~200 KB. Use when you need 3D Rive or many simultaneous animations.
- Set explicit `<canvas>` resolution (`useDevicePixelRatio` option) to avoid blurry 4K rendering.
- Pause when off-screen: `rive.pause()` in an IntersectionObserver.
- Many small Rive files → bundle them with a manifest and pre-fetch.

### Where Rive Shines

- Animated logos, icons, button states
- Onboarding mascots that react to user progress
- Empty states with personality
- Animated cursors / hover effects on cards
- Loading spinners with branded character

### Where Rive Struggles

- Heavy 3D scenes — use Spline or R3F
- Procedural generation — Rive is timeline + state, not code
- Generative motion — needs author work in the editor

## Comparing Spline vs Rive

| | Spline | Rive |
|---|---|---|
| Primary use | 3D scenes | 2D (and growing 3D) interactive |
| Editor | Visual 3D | Visual 2D timeline + state machines |
| Runtime cost | 300+ KB | 100-200 KB |
| File size | 2-5 MB scenes | KB to small MB |
| Designer learning curve | Like Cinema 4D-lite | Like After Effects + state diagrams |
| Best for | Hero pages, product viewers | Buttons, icons, mascots, onboarding |
| Custom code interop | Variables + events | State machine inputs + events |
| SSR | client only | client only |

Often you ship both: Spline for a hero, Rive for interactive elements throughout the page.

## Using with Next.js

Both runtimes are browser-only. Three patterns:

### A. Dynamic import with ssr off

```tsx
import dynamic from 'next/dynamic';
const Spline = dynamic(() => import('@splinetool/react-spline'), { ssr: false });
const Rive   = dynamic(() => import('./MyRiveComponent'),         { ssr: false });
```

### B. 'use client' wrapper

```tsx
'use client';
export { default } from '@splinetool/react-spline';
```

Re-export so the parent server component can do a static analysis-safe import.

### C. Asset hosting

- **Spline** `.splinecode`: usually hosted by Spline's CDN — no work. Self-host if you need offline / privacy. Add cache headers if so (`Cache-Control: public, max-age=31536000, immutable`).
- **Rive** `.riv`: drop in `public/animations/`. Add immutable cache (`next.config.ts`, same pattern as `gltf-asset-pipeline`).

### D. Bundle separation

If your landing page only has a hero scene, lazy-load Spline so it doesn't bloat /about or /contact bundles. Use route-segment dynamic imports.

### E. Preload hero file

```html
<link rel="preload" as="fetch" crossorigin href="/animations/hero.riv" />
```

## Examples

### Example 1: Spline hero with React-controlled palette
Designer makes a scene with 3 color variables exposed. React reads the user's theme and calls `app.setVariable('accent', '#22d3ee')` on load.

### Example 2: Rive onboarding mascot
4-step tour. Each step fires a Rive trigger; the mascot animates a reaction. State machine handles "happy", "thinking", "celebrate" transitions internally.

### Example 3: Pricing card with Rive hover
Card has a Rive icon at the top. `useStateMachineInput` syncs `hover` boolean to the mouse. Icon morphs between "idle" and "active" smoothly via the designer's state machine.

## Troubleshooting

### Spline scene loads but is invisible / camera wrong
Cause: parent container has zero height (Spline canvas is `width: 100%; height: 100%`).
Fix: wrap in `<div className="h-[600px] w-full">` or similar with explicit dimensions.

### Spline scene loads slowly / blocks first paint
Cause: large `.splinecode`, runtime parsing, no lazy load.
Fix: dynamic import with `ssr: false`, show a static fallback (`onLoad` swap), reduce scene in Spline (fewer objects/lights/textures), use CDN with Brotli.

### Spline events from React don't trigger
Cause: object name typo, or `splineRef.current` accessed before `onLoad`.
Fix: log `app.findObjectByName(name)` to verify exists. Guard interactions with `if (splineRef.current)`.

### Rive animation looks blurry on retina
Cause: Rive renders at logical pixel size, not device pixel ratio.
Fix: `useRive({ ..., useDevicePixelRatio: true })` (newer versions) or set explicit canvas size in CSS + `<canvas width={size * dpr} height={size * dpr}>` in vanilla.

### Rive state machine input is undefined
Cause: state machine name or input name doesn't match `.riv` file.
Fix: open the `.riv` in the Rive editor and copy the exact names. They're case-sensitive. Verify `rive` ref is non-null before reading inputs.

### Rive WebGL2 runtime crashes on Safari iOS
Cause: WebGL2 context limit on iOS, or simultaneous canvases.
Fix: use the Canvas 2D runtime (`@rive-app/react-canvas`) for 2D-only files. Limit concurrent WebGL2 canvases to one.

### Both runtimes bundled into one page
Cause: both eagerly imported from a shared layout.
Fix: route-segment dynamic imports. Use `dynamic(() => import(...), { ssr: false })` in the leaf component that needs each runtime.

### "Failed to fetch" on `.riv` / `.splinecode` in production
Cause: CDN MIME / CORS not set, or wrong path after deploy.
Fix: ensure `.riv` is served with `application/octet-stream` (browser doesn't care, but some proxies require it). Add `Access-Control-Allow-Origin: *` if loading cross-origin. Verify `public/` survived the build.
