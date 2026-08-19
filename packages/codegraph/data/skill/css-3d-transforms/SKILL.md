---
name: css-3d-transforms
description: CSS 3D transforms knowledge base — perspective, transform-style: preserve-3d, rotateX/Y/Z, translateZ, backface-visibility. Use when building card flips, cubes, coverflow carousels, 3D book/menu, CSS parallax, or any pure-CSS 3D effect without WebGL.
version: 1.0.0
---

# CSS 3D Transforms

## Overview

Pure CSS 3D — no JavaScript engine, no WebGL. Uses the GPU through `transform` and `perspective` to position elements in a 3D space. Best for UI ornaments (card flips, cubes, layered hover effects, subtle parallax) where you don't need lighting, materials or model loading.

Core mental model:
- `perspective` on the **parent** = viewer distance from the scene.
- `transform-style: preserve-3d` on the **container** = children live in 3D.
- `transform: rotateX/Y/Z translateZ` on the **children** = position them.
- `backface-visibility: hidden` = hide the back of a face when flipped.

## When to Use

- Card flip / reveal interactions
- 3D cube, dodecahedron, coverflow, carousel
- Hover lift with depth (translateZ + shadow)
- Layered parallax inside a single component (without scroll libraries)
- 3D menu, book opening, page turn
- Subtle product showcase tilt (with `mouseMove` → rotateX/Y)

Don't use when:
- You need real lights, shadows, materials, GLTF models → `threejs-fundamentals`
- You need scroll-driven 3D scene changes → `scroll-3d-animations`
- You need post-processing or shaders → `react-three-fiber` + `glsl-shaders`

## Setup

Zero dependencies. Just CSS. Browser support is universal (CSS 3D Transforms since 2013, current spec stable).

Optional helpers:
- Tailwind v4 has `transform-3d`, `rotate-x-*`, `perspective-*` utilities natively.
- For older Tailwind (v3), install [`tailwindcss-3d`](https://www.npmjs.com/package/tailwindcss-3d) or write a small plugin.

## Core Concepts

### Perspective — viewer distance

`perspective` defines how strong the 3D foreshortening looks. Lower = more dramatic, higher = flatter.

```css
.scene {
  perspective: 800px;          /* viewer 800px in front of the scene */
  perspective-origin: 50% 50%; /* vanishing point at center */
}
```

Rule of thumb:
| Element size | Perspective value |
|---|---|
| Small card (~200px) | 400-800px |
| Medium hero | 1000-1500px |
| Full-page scene | 2000px+ |

If perspective is too small for the element size, you get fisheye distortion.

### preserve-3d — keep children in 3D space

By default, transformed children are flattened back to 2D. `transform-style: preserve-3d` keeps them in the parent's 3D coordinate system.

```css
.card {
  transform-style: preserve-3d;
  transition: transform 0.6s;
}
.card:hover {
  transform: rotateY(180deg);
}
```

Without `preserve-3d`, nested `rotateX` on children inside a `rotateY` parent will not compose correctly.

### backface-visibility — hide the reverse side

```css
.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
}
.face--back {
  transform: rotateY(180deg);
}
```

When the parent rotates 180°, the front face's back is now showing — hide it so the back face takes over visually.

## Pattern: Card Flip (front/back)

```html
<div class="scene">
  <div class="card">
    <div class="face face--front">Front</div>
    <div class="face face--back">Back</div>
  </div>
</div>
```

```css
.scene {
  width: 240px;
  height: 320px;
  perspective: 1000px;
}
.card {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
.scene:hover .card {
  transform: rotateY(180deg);
}
.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  display: grid;
  place-items: center;
}
.face--back {
  transform: rotateY(180deg);
}
```

## Pattern: 3D Cube

```html
<div class="cube-scene">
  <div class="cube">
    <div class="cube-face cube-face--front">1</div>
    <div class="cube-face cube-face--back">2</div>
    <div class="cube-face cube-face--right">3</div>
    <div class="cube-face cube-face--left">4</div>
    <div class="cube-face cube-face--top">5</div>
    <div class="cube-face cube-face--bottom">6</div>
  </div>
</div>
```

```css
.cube-scene { perspective: 1200px; width: 200px; height: 200px; }
.cube {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  animation: spin 20s linear infinite;
}
.cube-face {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(99, 102, 241, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.cube-face--front  { transform: translateZ(100px); }
.cube-face--back   { transform: rotateY(180deg) translateZ(100px); }
.cube-face--right  { transform: rotateY(90deg)  translateZ(100px); }
.cube-face--left   { transform: rotateY(-90deg) translateZ(100px); }
.cube-face--top    { transform: rotateX(90deg)  translateZ(100px); }
.cube-face--bottom { transform: rotateX(-90deg) translateZ(100px); }

@keyframes spin {
  to { transform: rotateY(360deg) rotateX(360deg); }
}
```

Half the cube edge (here 100px) is the `translateZ` value for each face.

## Pattern: Coverflow Carousel

```css
.coverflow { perspective: 1500px; }
.coverflow-item {
  transition: transform 0.4s;
}
.coverflow-item--prev { transform: translateX(-60%) rotateY(45deg) scale(0.85); }
.coverflow-item--active { transform: translateX(0) rotateY(0) scale(1); z-index: 2; }
.coverflow-item--next { transform: translateX(60%) rotateY(-45deg) scale(0.85); }
```

Toggle the class with a JS state machine (left/right keys, swipe, click).

## Pattern: Mouse-tracked Tilt

```js
const card = document.querySelector('.tilt-card');
card.addEventListener('mousemove', (e) => {
  const r = card.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width  - 0.5; // -0.5 .. 0.5
  const y = (e.clientY - r.top)  / r.height - 0.5;
  card.style.transform = `rotateY(${x * 20}deg) rotateX(${-y * 20}deg) translateZ(20px)`;
});
card.addEventListener('mouseleave', () => {
  card.style.transform = '';
});
```

Wrap the card in a `.tilt-scene { perspective: 800px }`. Cap the rotation to ±15-20° — beyond that, the trick looks broken.

## Pattern: Layered CSS Parallax (depth without scroll libs)

```css
.parallax-scene {
  height: 100vh;
  overflow-y: scroll;
  perspective: 1px;
  perspective-origin: 0 0;
}
.parallax-layer {
  position: absolute;
  inset: 0;
}
.parallax-layer--back  { transform: translateZ(-2px) scale(3); }
.parallax-layer--mid   { transform: translateZ(-1px) scale(2); }
.parallax-layer--front { transform: translateZ(0); }
```

Each layer further back appears to move slower as the container scrolls. The `scale` compensates for the perspective shrink. Pure CSS, no JS.

## Performance

- `transform` and `opacity` are GPU-compositor properties — animate those, not `top`/`left`/`width`/`height`.
- Add `will-change: transform` only when the element is about to animate, then remove it. Leaving it permanently allocates a layer for nothing.
- Avoid animating a parent with `transform-style: preserve-3d` that has hundreds of children — each child gets its own composited layer.
- `filter: blur()` + 3D transforms = expensive. Test on mid-tier Android.
- `backface-visibility: hidden` forces a layer; that's the point, but means even idle flipped cards keep a layer alive.

## Reduced Motion

Respect users who opted out of motion:

```css
@media (prefers-reduced-motion: reduce) {
  .card { transition: none; }
  .scene:hover .card { transform: none; }
}
```

For decorative spinning cubes / autoplay carousels, pause them entirely under reduced motion.

## Using with Next.js

CSS 3D is SSR-safe — it's just CSS classes, the markup renders identically on server and client. No `'use client'` needed unless you add interactivity (mousemove, drag).

For Tailwind v4 in Next.js 15:

```tsx
// app/components/FlipCard.tsx
export function FlipCard({ front, back }: { front: ReactNode; back: ReactNode }) {
  return (
    <div className="[perspective:1000px] w-60 h-80 group">
      <div className="relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
        <div className="absolute inset-0 [backface-visibility:hidden]">{front}</div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">{back}</div>
      </div>
    </div>
  );
}
```

Arbitrary value syntax `[property:value]` is the fastest way to use CSS 3D in Tailwind without writing a plugin.

For mousemove tilt cards, wrap in `'use client'` and use `useRef` + `useEffect` to attach listeners.

## Examples

### Example 1: Flip card on click instead of hover
Add `data-flipped` toggle in state, then key the transform off the attribute:

```css
.card[data-flipped="true"] { transform: rotateY(180deg); }
```

Works well on touch devices where `:hover` is unreliable.

### Example 2: Cube as theme switcher
Each cube face is a different theme preview. Rotate `rotateY` in 90° steps with arrow keys, snap to the selected face, apply that theme on snap-end.

### Example 3: Stacked depth menu
Sidebar menu items get `translateZ(N)` based on hierarchy depth. Combined with `perspective` on the sidebar, deeper items appear receded. Subtle but effective for IA visualization.

## Troubleshooting

### Child elements look flat / rotation is wrong
Cause: parent missing `transform-style: preserve-3d`.
Fix: Add it on every ancestor that contains 3D-transformed children. Default `flat` collapses children back to 2D.

### Back face shows through the front
Cause: missing `backface-visibility: hidden` on the front face, or both faces are in the same plane (no offset).
Fix: Add `backface-visibility: hidden` on both faces, and ensure `.face--back` is rotated 180° on the same axis as the parent flip.

### Card flickers or anti-aliasing breaks during animation
Cause: GPU layer promotion mid-animation.
Fix: Add `transform: translateZ(0)` to the animated parent to force a stable composited layer. As a last resort, `-webkit-font-smoothing: subpixel-antialiased` on text inside 3D elements.

### Fisheye / extreme distortion
Cause: `perspective` value too small relative to element size.
Fix: Increase perspective (try 2× the element's largest dimension as a starting point).

### Z-fighting (two faces flickering when overlapping)
Cause: two faces at the exact same Z position.
Fix: Add a tiny offset, e.g. `translateZ(0.1px)`, to one of them.

### Animation jitter on Safari/iOS
Cause: Safari sometimes promotes too many layers at once.
Fix: Use `transform3d(...)` shorthand or add `transform: translate3d(0,0,0)` to the scene root to force consistent layer promotion. Test in real Safari, not just DevTools emulation.
