---
name: scroll-3d-animations
description: Scroll-driven and parallax 3D animations — native CSS Scroll-Driven Animations (animation-timeline: scroll/view), GSAP ScrollTrigger, Framer Motion useScroll/useTransform, Lenis smooth scroll. Use when building scroll-linked motion, parallax layers, sticky storytelling, reveal-on-scroll, scroll progress UIs, or pinned 3D scenes.
version: 1.0.0
---

# Scroll-Driven & Parallax 3D Animations

## Overview

Scroll position is the cleanest input device for narrative motion. Three layers, from cheapest to most capable:

1. **Native CSS** — `animation-timeline: scroll() | view()`. Zero JS, zero deps, ~95% modern browser support (Chrome/Edge/Opera/Samsung; Firefox flag; Safari 17.4+ partial).
2. **Framer Motion** — `useScroll` + `useTransform`. Idiomatic in React, great for component-scoped scroll links.
3. **GSAP ScrollTrigger** — heaviest, most powerful. Required for pinning, scrubbing complex timelines, horizontal-on-vertical, snap, and cross-section choreography.

Add **Lenis** on top of any of the above for smooth/inertia scroll. Don't combine Lenis with `scroll-snap-type` (they fight).

## When to Use

- Reveal-on-scroll (fade/translate as element enters viewport)
- Parallax layers (background, mid, foreground at different speeds)
- Scroll progress indicator (header bar, side rail, ring)
- Sticky storytelling (text pinned while images cycle)
- Horizontal-on-vertical scroll (panels slide sideways as page scrolls down)
- Scroll-linked 3D scene (R3F camera moves as user scrolls — pair with `react-three-fiber`)
- Scroll-driven SVG path drawing / morphing

Don't use when:
- Hover/click triggers a one-shot animation → plain CSS transitions or `animations` skill
- You need full timeline control unrelated to scroll → Framer Motion variants directly
- You need physics-based motion → `r3f-physics` or Framer Motion `spring`

## Setup

### Native CSS — no install
Just CSS. Feature-detect:

```css
@supports (animation-timeline: scroll()) {
  /* progressive enhancement */
}
```

### GSAP + ScrollTrigger

```bash
npm install gsap
```

```ts
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
```

### Framer Motion (`motion` package, v11+)

```bash
npm install motion
```

### Lenis smooth scroll

```bash
npm install lenis
```

## Pattern: Native CSS Scroll-Linked Progress Bar

```css
@keyframes progress {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: hotpink;
  transform-origin: left;
  animation: progress linear;
  animation-timeline: scroll(root block);
}
```

`scroll(root block)` = the document's block-direction scroll (vertical in LTR). No JS, no rAF, browser-native — runs on the compositor.

## Pattern: Native CSS View-Driven Reveal

`view()` timeline = the element's own visibility within the viewport.

```css
@keyframes reveal {
  from { opacity: 0; transform: translateY(40px); }
  to   { opacity: 1; transform: translateY(0); }
}

.reveal {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 30%;
}
```

`animation-range`:
- `entry` = element entering viewport (0% = first pixel visible)
- `cover` = element fully inside viewport
- `exit` = element leaving viewport

`entry 0% cover 30%` = animate from "first pixel visible" to "30% of element height past entry".

## Pattern: GSAP ScrollTrigger — Pinned Scrub

The bread-and-butter scroll choreography:

```ts
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const tl = gsap.timeline({
  scrollTrigger: {
    trigger: '.story',
    start: 'top top',
    end: '+=2000',       // pin for 2000px of scroll
    pin: true,
    scrub: 1,            // 1s lag = buttery feel
    anticipatePin: 1,
  },
});

tl.to('.bg', { scale: 1.4, ease: 'none' })
  .to('.headline', { yPercent: -100, opacity: 0 }, 0.2)
  .from('.next-headline', { yPercent: 100, opacity: 0 }, 0.4);
```

Key knobs:
- `scrub: true` = 1:1 with scroll. `scrub: 0.5` = 0.5s catch-up. `scrub: 1` feels best for most narrative.
- `pin: true` = sticky during the range. `anticipatePin: 1` prevents flash on fast scrolls.
- `markers: true` (dev only) = visual debug.

Always clean up in React:

```tsx
useEffect(() => {
  const ctx = gsap.context(() => { /* timeline */ }, scopeRef);
  return () => ctx.revert();
}, []);
```

## Pattern: GSAP Horizontal-on-Vertical

```ts
gsap.to('.panels-wrapper', {
  xPercent: -100 * (panels.length - 1),
  ease: 'none',
  scrollTrigger: {
    trigger: '.panels-container',
    pin: true,
    scrub: 1,
    end: () => `+=${document.querySelector('.panels-wrapper')!.scrollWidth}`,
  },
});
```

Container is full viewport, wrapper is `display: flex; width: max-content;`, each panel is `100vw`.

## Pattern: Framer Motion useScroll Parallax

```tsx
'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

export function ParallaxBlock() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'], // section enters bottom → leaves top
  });
  const y = useTransform(scrollYProgress, [0, 1], ['-20%', '20%']);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  return (
    <section ref={ref} className="relative h-screen overflow-hidden">
      <motion.div style={{ y, opacity }} className="absolute inset-0 bg-cover" />
    </section>
  );
}
```

`offset` notation: `[startThreshold, endThreshold]` where each is `[elementEdge] [viewportEdge]`.

Common offsets:
- `['start end', 'end start']` = full pass-through (most common)
- `['start start', 'end end']` = pinned-like progress
- `['start end', 'start start']` = entry only
- `['end start', 'end end']` = exit only

## Pattern: Framer Motion + R3F Camera Scroll

```tsx
'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useScroll } from 'motion/react';
import { useRef } from 'react';

function ScrollCamera({ progress }: { progress: MotionValue<number> }) {
  const { camera } = useThree();
  useFrame(() => {
    camera.position.z = 5 - progress.get() * 4;
    camera.position.y = progress.get() * 2;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export function ScrollScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref });

  return (
    <div ref={ref} className="h-[400vh]">
      <div className="sticky top-0 h-screen">
        <Canvas>
          <ScrollCamera progress={scrollYProgress} />
          {/* scene contents */}
        </Canvas>
      </div>
    </div>
  );
}
```

Outer wrapper provides scroll distance; inner `sticky` keeps the Canvas pinned. The `MotionValue` is read inside `useFrame` so it never triggers re-renders.

## Pattern: Lenis Smooth Scroll

```tsx
'use client';
import { useEffect } from 'react';
import Lenis from 'lenis';

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);
  return <>{children}</>;
}
```

To make ScrollTrigger play nice with Lenis:

```ts
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

Don't use Lenis with `scroll-snap-type` or `overflow: hidden` on `html/body`.

## Performance

- Prefer **transform + opacity** for scroll-linked properties. They composite on the GPU; layout-affecting properties (top, width, margin) force layout/paint at every scroll tick.
- Native `animation-timeline` runs on the compositor — measurably cheaper than rAF-based libs.
- For long pages with many `useScroll` instances, prefer **one global** `useScroll` and derive sections via `useTransform` ranges — fewer scroll listeners.
- ScrollTrigger: prefer `scrub: 0.5–1` over `scrub: true` for smoother feel on low-end devices.
- Set `will-change: transform` on the animated element, then remove it after the section is no longer in view.
- Avoid stacking 3+ heavy scroll libraries (GSAP + Framer + Lenis + Locomotive). Pick one orchestrator + Lenis at most.

## Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-timeline: none !important;
  }
}
```

GSAP / Framer:

```ts
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduce) { /* register scroll triggers */ }
```

Always provide a static fallback layout. Reduced-motion users should still be able to read everything.

## Using with Next.js

All scroll libraries are client-only. Use the `'use client'` directive on the component that owns the hook.

```tsx
// app/components/Reveal.tsx
'use client';
import { motion, useScroll, useTransform } from 'motion/react';
```

For GSAP, dynamic-import ScrollTrigger to keep the initial bundle small:

```tsx
'use client';
import { useEffect, useRef } from 'react';

export function ScrollScene() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let ctx: gsap.Context;
    (async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => {
        gsap.to('.target', { /* ... */ });
      }, ref);
    })();
    return () => ctx?.revert();
  }, []);
  return <section ref={ref}>…</section>;
}
```

Also: GSAP's free plugins are MIT, but **ScrollSmoother / SplitText / MorphSVG** require Club GSAP membership. Use Lenis + manual splitting as a free alternative.

## Examples

### Example 1: Sticky chapter storytelling
Long-form article with a sticky 60vh image on the right that changes per chapter. Use ScrollTrigger `pin: true` on the image column, and `onToggle` per chapter `trigger` to swap the image source.

### Example 2: Hero text emerging from background
Native CSS `view()` on the headline: `entry 0% entry 100%`, animating `transform: scale(0.5) translateZ(-200px) → scale(1) translateZ(0)` with a parent `perspective: 1500px`. Combines with `css-3d-transforms`.

### Example 3: Scroll progress dial in header
Native CSS only — a circular SVG with `stroke-dasharray` animated via `animation-timeline: scroll(root)`. Zero JS.

## Troubleshooting

### Animations stutter / drop frames
Cause: animating layout properties or running many scroll listeners.
Fix: switch to `transform` + `opacity`. Consolidate `useScroll` instances. Profile with DevTools Performance panel — scroll-driven anims should sit on the Compositor row, not Main.

### ScrollTrigger pins wrong section
Cause: `trigger` is inside a wrapper that itself scrolls or has `overflow: hidden`.
Fix: ScrollTrigger needs the trigger to live in the actual scrolling container. Use `scroller: '.my-scroller'` if you scroll a non-root element.

### Lenis + ScrollTrigger feel disconnected
Cause: ScrollTrigger doesn't know about Lenis's lerp.
Fix: wire `lenis.on('scroll', ScrollTrigger.update)` and feed Lenis from `gsap.ticker` (see Lenis pattern above).

### `useScroll` returns 0 / never updates
Cause: target element has zero height or isn't mounted at hook init.
Fix: ensure the ref is attached to a stable element with measurable height. For SSR, the first frame may show 0 — gate animations on `mounted` state if needed.

### Native `animation-timeline` ignored on Safari
Cause: Safari < 17.4 doesn't support it; older versions ignore the property silently.
Fix: gate with `@supports (animation-timeline: scroll())` and provide a Framer Motion / IntersectionObserver fallback for older Safari.

### "ScrollTrigger update before kill" warnings in React
Cause: not cleaning up on unmount, especially in StrictMode (double-effect).
Fix: always use `gsap.context()` + `ctx.revert()` in cleanup. Never call `ScrollTrigger.killAll()` from inside a component — it nukes siblings.
