---
name: framer-motion-advanced
description: Advanced Motion (Framer Motion) patterns — layout animations, AnimatePresence + exit, drag/hover/tap gestures, useScroll/useTransform/useMotionValue, variants orchestration, springs vs tweens, layoutId shared-element transitions, deferred values, MotionConfig, Reduced Motion, RSC integration. Use when building interactive animations, page transitions, drag-and-drop, shared-element morphs, scroll-driven UI, list reorder, or debugging unmount/exit animation issues.
version: 1.0.0
---

# Framer Motion / Motion — Advanced Patterns

## Overview

The `motion` library (formerly `framer-motion`) is React's most-used animation lib. The `animations` skill covers the basics; this skill is the **advanced playbook**: layout animations, shared-element transitions, drag, scroll, variant orchestration, performance.

The package was renamed `framer-motion` → `motion` in 2024. Import paths are now `motion/react`. Old `framer-motion` still works but is in maintenance.

## When to Use

- Layout animations (reorder, expand/collapse, FLIP)
- Shared-element transitions across routes (`layoutId`)
- Drag and drop with constraints + reorder
- Scroll-linked animation (parallax, progress, sticky scenes — see also `scroll-3d-animations`)
- Coordinated multi-step animations via variants + stagger
- Exit animations when components unmount
- Reduced motion accessibility
- Hover/tap micro-interactions with spring physics

Don't use when:
- One-off CSS transition would do (`transition: transform .2s`)
- Performance-critical 60fps in lists > 1000 items — use canvas / virtual scrolling
- 3D scenes — see `react-three-fiber` family

## Setup

```bash
npm install motion
```

Import:

```tsx
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
```

Versions (2026): `motion@^11+`. Anywhere you see `framer-motion`, you can swap to `motion`/`motion/react` without API changes.

## Pattern: Layout Animations (FLIP)

Auto-animate any layout change with `layout` prop. No keyframes needed.

```tsx
<motion.div layout className="card">
  {expanded && <p>Extra content</p>}
</motion.div>
```

Toggling `expanded` smoothly animates height + position changes. Combine with `layoutId` for cross-component morphs:

```tsx
{items.map((item) => (
  <motion.div
    key={item.id}
    layoutId={`card-${item.id}`}
    onClick={() => setSelected(item)}
    className="thumbnail"
  >
    <Image src={item.thumb} />
  </motion.div>
))}

<AnimatePresence>
  {selected && (
    <motion.div
      layoutId={`card-${selected.id}`}
      className="modal"
      onClick={() => setSelected(null)}
    >
      <Image src={selected.full} />
    </motion.div>
  )}
</AnimatePresence>
```

The thumbnail morphs into the modal. The `layoutId` is the matching key.

**Important**: layout animations measure DOM. Avoid `transform` styles outside `motion` props — they confuse the matrix. Don't animate `width`/`height` via CSS at the same time as `layout`.

## Pattern: AnimatePresence + Exit

Exit animations require `AnimatePresence` around the conditional render:

```tsx
<AnimatePresence mode="wait">
  {open && (
    <motion.div
      key="modal"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
    >
      Modal content
    </motion.div>
  )}
</AnimatePresence>
```

`mode` options:
- `'sync'` (default) — exit + enter run together
- `'wait'` — wait for exit before entering next (common for route transitions)
- `'popLayout'` — exiting element is removed from layout flow before exit (avoids gaps)

Each direct child of `AnimatePresence` must have a unique stable `key`.

## Pattern: Variants — Coordinated Multi-Element

```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300 } },
};

<motion.ul variants={container} initial="hidden" animate="show">
  {todos.map(t => (
    <motion.li key={t.id} variants={item}>{t.text}</motion.li>
  ))}
</motion.ul>
```

Children inherit parent's animation state via variants. Parent stagger orchestrates all children. Centralizes complex sequences.

Variants can be functions for dynamic states:

```tsx
const item = {
  hidden: (i: number) => ({ opacity: 0, x: i % 2 === 0 ? -50 : 50 }),
  show: { opacity: 1, x: 0 },
};

<motion.li custom={index} variants={item} />
```

## Pattern: Drag

```tsx
<motion.div
  drag                              // any axis
  drag="x"                          // only horizontal
  dragConstraints={{ left: -100, right: 100 }}
  dragElastic={0.2}                 // 0 = rigid, 1 = squishy
  dragMomentum={true}
  onDragEnd={(e, info) => {
    if (info.offset.x > 100) handleSwipeRight();
  }}
>
  Drag me
</motion.div>
```

Constrain by ref:

```tsx
const constraints = useRef(null);

<div ref={constraints} className="bounds">
  <motion.div drag dragConstraints={constraints} />
</div>
```

For reorderable lists, use `Reorder`:

```tsx
import { Reorder } from 'motion/react';

const [items, setItems] = useState([...]);

<Reorder.Group axis="y" values={items} onReorder={setItems}>
  {items.map(item => (
    <Reorder.Item key={item.id} value={item}>
      {item.text}
    </Reorder.Item>
  ))}
</Reorder.Group>
```

`Reorder` handles drag, animation, and state in one component. Drop-in drag-and-drop sortable.

## Pattern: Gestures (hover, tap, focus)

```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  whileFocus={{ outline: '2px solid #6366f1' }}
  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
>
  Click
</motion.button>
```

`whileHover`, `whileTap`, `whileFocus`, `whileInView`, `whileDrag` are state-based variants — no manual state needed.

`whileInView` for scroll-triggered:

```tsx
<motion.div
  initial={{ opacity: 0, y: 50 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-100px' }}
  transition={{ duration: 0.5 }}
>
  Animates when scrolled into view
</motion.div>
```

## Pattern: useScroll + useTransform

```tsx
import { useScroll, useTransform, motion } from 'motion/react';
import { useRef } from 'react';

function ParallaxBlock() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],  // see scroll-3d-animations
  });

  const y = useTransform(scrollYProgress, [0, 1], ['-20%', '20%']);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  return (
    <section ref={ref} className="h-screen relative">
      <motion.div style={{ y, opacity }} className="bg" />
    </section>
  );
}
```

`MotionValue` instances are read inside `style` without triggering re-renders. Far cheaper than React state.

For full scroll-driven scenes, see `scroll-3d-animations`.

## Pattern: useMotionValue + useSpring

Smooth a noisy value (mouse position, scroll velocity) with a spring:

```tsx
import { useMotionValue, useSpring, motion } from 'motion/react';

function Cursor() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 30 });
  const sy = useSpring(y, { stiffness: 200, damping: 30 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [x, y]);

  return <motion.div className="cursor" style={{ x: sx, y: sy }} />;
}
```

`useMotionValue` skips React render cycles entirely. The motion lib updates the DOM directly. Ideal for high-frequency inputs.

## Pattern: Transitions

```tsx
// tween (duration-based)
transition={{ duration: 0.3, ease: 'easeOut' }}
transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}   // cubic bezier

// spring (physics)
transition={{ type: 'spring', stiffness: 100, damping: 10 }}
transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}  // duration-spring

// per-property
transition={{
  duration: 0.3,
  opacity: { duration: 0.5 },
  scale: { type: 'spring', stiffness: 200 },
}}

// stagger
transition={{ staggerChildren: 0.1 }}
```

Default spring values: `stiffness: 100, damping: 10, mass: 1`. Higher stiffness = faster snap; higher damping = less wobble.

## Pattern: Reduced Motion

```tsx
import { MotionConfig, useReducedMotion } from 'motion/react';

// wrap your app
<MotionConfig reducedMotion="user">
  {/* respects user's OS setting */}
</MotionConfig>

// or read explicitly
const shouldReduce = useReducedMotion();
const variants = shouldReduce ? { animate: { opacity: 1 } } : fullVariants;
```

`reducedMotion="user"` automatically disables non-essential animations when the OS reports `prefers-reduced-motion: reduce`.

## Pattern: Optimized Mounting

For very large lists where motion would be heavy:

```tsx
import { LazyMotion, domAnimation } from 'motion/react';

<LazyMotion features={domAnimation}>
  <m.div animate={{ opacity: 1 }} />  {/* use lowercase 'm' instead of 'motion' */}
</LazyMotion>
```

Reduces bundle by 50%+ by lazy-loading animation features only when needed. Use `domMax` instead of `domAnimation` if you need drag/layout features.

## Pattern: MotionConfig (global defaults)

```tsx
<MotionConfig
  transition={{ duration: 0.3, ease: 'easeInOut' }}
  reducedMotion="user"
>
  <App />
</MotionConfig>
```

Set once at root; every `motion.*` element inherits unless it overrides.

## Performance Rules

- **Animate transform + opacity**, not layout properties. The compositor handles them.
- **Avoid animating heights** when possible. Use `scaleY` + `transformOrigin` for collapse, or `auto` height via `layout` prop carefully.
- **Use MotionValue** (not state) for high-frequency values.
- **Wrap in `LazyMotion`** if your bundle is tight.
- **`will-change` is set automatically by motion** during animation — don't override.
- **List rendering**: use `<AnimatePresence mode="popLayout">` to remove items without layout shift.

## Using with Next.js

Motion is client-only — every motion component lives inside a `'use client'` boundary.

```tsx
// app/components/Hero.tsx
'use client';
import { motion } from 'motion/react';

export function Hero() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      …
    </motion.div>
  );
}
```

Server components can import client components (Next.js handles the boundary). Don't try to use `motion` from a server component — it throws at render.

**Bundle**: full `motion/react` is ~50 KB gzipped. With `LazyMotion + domAnimation` it drops to ~20 KB for the same features. Use the optimized import for marketing pages where bundle matters.

**View Transitions API** (Next.js 15+): motion's `layoutId` is more capable than browser View Transitions; pair with `viewTransitionName` only if you want a hybrid approach.

## Examples

### Example 1: Sortable todo list
`<Reorder.Group>` + `<Reorder.Item>`. Sync `onReorder` to a `usePathname()`-driven URL state for shareable order.

### Example 2: Modal with shared-element morph
Card grid → click → modal expands from the card position via matching `layoutId`. Background scrim fades in via separate `AnimatePresence`.

### Example 3: Pricing tier hover
Cards lift on hover (`whileHover={{ y: -8, scale: 1.02 }}`), interior accent slides in (variant), shadow grows. Spring transition for organic feel.

## Troubleshooting

### Exit animation doesn't fire
Cause: the conditional component isn't a direct child of `AnimatePresence`, or `key` is missing/unstable.
Fix: wrap directly: `<AnimatePresence>{open && <motion.div key="x">…</motion.div>}</AnimatePresence>`. Use `key` that's stable (e.g. item.id, not array index when reordering).

### Layout animation jumps / glitches
Causes: parent has `display: contents`; multiple competing transforms; CSS height animation racing with `layout`.
Fix: only one source of truth for transform. Remove `transition` CSS on transformed elements. Use `layout="position"` or `layout="size"` to limit what's animated.

### Drag works but doesn't snap inside constraints
Cause: constraints set on incorrect ref or wrong type.
Fix: constraints must be a Ref to a DOM element OR a `{ top, left, right, bottom }` object. Verify the parent has non-zero size.

### useScroll returns 0 / never updates
Cause: target element not measurable, or hook called before mount.
Fix: ensure target has size. Wrap in a check: `if (!ref.current) return null`. For SSR, initial render returns 0 — gate animations on mount or first scroll event.

### "Hydration mismatch" on motion components
Cause: animating on first render makes server HTML differ from client.
Fix: use `initial={false}` to skip initial animation OR set `suppressHydrationWarning` if visual mismatch is acceptable.

### Reorder.Item doesn't accept children with their own onClick
Cause: drag intercepts pointer events.
Fix: use `<Reorder.Item value={item}><div onClick={...}>Click</div></Reorder.Item>`. Add `data-no-dnd` or `dragListener={false}` + custom drag handle for explicit grip-to-drag UX.

### Performance drop on long lists
Cause: too many motion elements rendering simultaneously.
Fix: use `LazyMotion`. Disable layout animations on items off-screen via `viewport={{ once: true }}` + `whileInView`. Consider virtualizing the list with TanStack Virtual.

### Spring overshoots way too much
Cause: low damping or zero mass.
Fix: bump damping (10 → 25) or use `bounce: 0` for critically damped. Combine `bounce` + `duration` for predictable feel.

### "motion is not exported from framer-motion"
Cause: mixed old/new package names.
Fix: pick one. `npm uninstall framer-motion && npm install motion` then change all imports to `motion/react`.

### Layout animation works in dev, broken in build
Causes: tree-shaking removed needed features, or React 19 Strict Mode double-rendering.
Fix: import only from `motion/react` (not deep paths). For Strict Mode, that's expected behavior in dev only — production runs once.

### Hover state doesn't return on rapid mouse-out
Cause: gesture state lost due to fast pointer.
Fix: use `transition` with shorter duration. Add explicit `whileHover={{ ... }}` + matching `initial={{ ... }}` so the from-state is defined.
