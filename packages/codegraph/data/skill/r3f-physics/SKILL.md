---
name: r3f-physics
description: 3D physics in React Three Fiber with @react-three/rapier — RigidBody, colliders (cuboid, ball, hull, trimesh), joints (revolute, fixed, spherical), kinematic vs dynamic vs fixed, raycast/character controller, drag with springs, gestures, debug visualizer. Use when adding rigid body physics, gravity, collisions, ragdolls, or interactive draggable 3D objects to an R3F scene.
version: 1.0.0
---

# R3F Physics with Rapier

## Overview

`@react-three/rapier` is the pmndrs binding for Rapier, a Rust-based physics engine compiled to WebAssembly. It's the recommended physics layer for R3F as of 2024+: faster than Cannon.js, deterministic, and well-maintained.

The API mirrors R3F: wrap colliders/bodies in JSX, let the hook system glue physics to render. Two main concepts:

- **RigidBody** — a Three.js object that participates in physics. Three types:
  - `dynamic` — gravity/forces affect it (default)
  - `kinematic` — user-positioned, can move other bodies but isn't affected itself
  - `fixed` — static, never moves (the world geometry)
- **Collider** — the shape used for collision detection. Often auto-generated from the mesh.

## When to Use

- Falling/stacking/colliding 3D objects
- Drag-and-drop in 3D with physical reaction
- Character controllers (first/third person)
- Ragdolls, joints, vehicle simulation
- Door/lever interactions (revolute joints)
- "Toys" or playful interactions in marketing pages

Don't use when:
- The motion is purely cosmetic — Framer Motion / damped tweens are lighter
- You're targeting low-end mobile heavily — Rapier WASM adds ~200 KB
- All physics happens on flat 2D — use Matter.js or Rapier 2D instead

## Setup

```bash
npm install @react-three/rapier
```

```tsx
import { Physics, RigidBody } from '@react-three/rapier';

<Canvas>
  <Physics gravity={[0, -9.81, 0]}>
    {/* world */}
  </Physics>
</Canvas>
```

`<Physics>` initializes Rapier (async WASM load) and creates the world. Everything physical lives inside it.

## Pattern: Falling Boxes on a Floor

```tsx
import { Physics, RigidBody } from '@react-three/rapier';

<Canvas>
  <ambientLight intensity={0.4} />
  <directionalLight position={[5, 10, 5]} />
  <Physics debug>
    {/* floor */}
    <RigidBody type="fixed" colliders="cuboid">
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
    </RigidBody>

    {/* falling boxes */}
    {Array.from({ length: 20 }).map((_, i) => (
      <RigidBody key={i} colliders="cuboid" restitution={0.5}>
        <mesh position={[Math.random() - 0.5, 5 + i * 1.2, Math.random() - 0.5]} castShadow>
          <boxGeometry />
          <meshStandardMaterial color="hotpink" />
        </mesh>
      </RigidBody>
    ))}
  </Physics>
</Canvas>
```

`debug` prop on `<Physics>` overlays collider wireframes — leave it on while developing, turn it off in production.

## Colliders — Picking the Right Shape

| Collider | Use |
|---|---|
| `cuboid` | Boxes, walls, planes (with thickness). Cheapest. |
| `ball` | Spheres. Cheap. |
| `capsule` | Characters, pills. Cheap. |
| `cylinder` | Cylinders, drums. Medium. |
| `hull` (convex hull) | Arbitrary convex shape, automatic from mesh. Medium. |
| `trimesh` | Concave detailed mesh. **Expensive** — use only for fixed/static geometry. |

Set per-body:

```tsx
<RigidBody colliders="hull"> {/* auto convex hull */}
  <mesh>
    <torusGeometry args={[1, 0.4, 16, 64]} />
    <meshStandardMaterial />
  </mesh>
</RigidBody>
```

Or set explicit colliders (more control):

```tsx
import { CuboidCollider } from '@react-three/rapier';

<RigidBody colliders={false}>
  <mesh>{/* visual */}</mesh>
  <CuboidCollider args={[1, 0.5, 1]} /> {/* half-extents */}
</RigidBody>
```

Multi-collider bodies use this pattern — set `colliders={false}` on the RigidBody, then add explicit collider children.

## RigidBody Types

```tsx
<RigidBody type="dynamic">…</RigidBody>     // default — gravity affects it
<RigidBody type="kinematicPosition">…</RigidBody>  // moves via setNextKinematicTranslation
<RigidBody type="kinematicVelocity">…</RigidBody>  // moves via setNextKinematicTranslation w/ velocity
<RigidBody type="fixed">…</RigidBody>       // never moves
```

Kinematic bodies are great for **user-controlled** characters and **draggable** objects (you don't want gravity yanking them).

## Useful Props on RigidBody

```tsx
<RigidBody
  mass={1}                    // alternative: use density on colliders
  restitution={0.5}           // 0 = no bounce, 1 = perfect bounce
  friction={1}                // 0 = slippery, 2+ = sticky
  linearDamping={0.1}         // air drag — slows linear velocity
  angularDamping={0.5}        // slows spinning
  gravityScale={1}            // per-body gravity multiplier
  enabledRotations={[false, true, false]}  // lock X & Z rotation (Y free)
  enabledTranslations={[true, true, false]} // lock Z translation
  canSleep={true}             // disable sim when at rest (perf)
  onCollisionEnter={(e) => console.log('hit', e.other.rigidBody)}
  onCollisionExit={(e) => console.log('parted', e.other.rigidBody)}
/>
```

## Pattern: Apply Force / Impulse

Grab the rigid body via ref:

```tsx
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { useRef } from 'react';

function JumpBall() {
  const ref = useRef<RapierRigidBody>(null);
  return (
    <RigidBody ref={ref} colliders="ball" position={[0, 2, 0]}>
      <mesh onClick={() => ref.current?.applyImpulse({ x: 0, y: 5, z: 0 }, true)}>
        <sphereGeometry />
        <meshStandardMaterial color="orange" />
      </mesh>
    </RigidBody>
  );
}
```

- `applyImpulse(vec, wake)` — instant velocity kick.
- `applyTorqueImpulse(vec, wake)` — instant spin.
- `setLinvel(vec, wake)` — set velocity directly.
- `addForce(vec, wake)` — continuous force (use in `useFrame`).

`wake` should be `true` so a sleeping body gets re-activated.

## Pattern: Drag-and-Drop with Physics

```tsx
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { useRef, useState } from 'react';

function DraggableBox() {
  const ref = useRef<RapierRigidBody>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <RigidBody
      ref={ref}
      colliders="cuboid"
      type={dragging ? 'kinematicPosition' : 'dynamic'}
    >
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          setDragging(true);
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerMove={(e) => {
          if (!dragging || !ref.current) return;
          ref.current.setNextKinematicTranslation({ x: e.point.x, y: e.point.y, z: e.point.z });
        }}
      >
        <boxGeometry />
        <meshStandardMaterial color="skyblue" />
      </mesh>
    </RigidBody>
  );
}
```

Switching to `kinematicPosition` while dragging means the body follows your cursor but still pushes other bodies. On release, switching back to `dynamic` resumes physics.

## Pattern: Joints

Connect two RigidBodies with a constraint:

```tsx
import { useRevoluteJoint, RigidBody } from '@react-three/rapier';
import { useRef } from 'react';

function Door() {
  const frame = useRef(null);
  const door  = useRef(null);

  // axis at frame edge, world up
  useRevoluteJoint(frame, door, [
    [-0.5, 0, 0],  // anchor on frame (local)
    [-0.5, 0, 0],  // anchor on door (local)
    [0, 1, 0],     // rotation axis
  ]);

  return (
    <>
      <RigidBody ref={frame} type="fixed">
        <mesh position={[-1, 0, 0]}><boxGeometry args={[0.2, 2, 0.2]} /></mesh>
      </RigidBody>
      <RigidBody ref={door} colliders="cuboid">
        <mesh position={[0, 0, 0]}><boxGeometry args={[1.5, 2, 0.1]} /></mesh>
      </RigidBody>
    </>
  );
}
```

Other joint hooks: `useFixedJoint`, `useSphericalJoint`, `usePrismaticJoint`. All take `(refA, refB, params)`.

## Pattern: Character Controller

For first-person / third-person characters, use the dedicated `CharacterController`:

```tsx
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

function Player() {
  const body = useRef<RapierRigidBody>(null);
  const { world } = useRapier();
  // ... keyboard input wiring

  useFrame(() => {
    // example: apply movement velocity each frame
    const dir = getInputDirection();
    body.current?.setLinvel({ x: dir.x * 4, y: body.current.linvel().y, z: dir.z * 4 }, true);
  });

  return (
    <RigidBody ref={body} type="dynamic" enabledRotations={[false, false, false]}>
      <CapsuleCollider args={[0.5, 0.5]} />
      <mesh><capsuleGeometry args={[0.5, 1]} /><meshStandardMaterial /></mesh>
    </RigidBody>
  );
}
```

For complex movement (slopes, snapping, stair-step), use Rapier's `KinematicCharacterController` directly via `world.createCharacterController(...)`.

## Pattern: Raycast for Ground Detection

```tsx
import { useRapier, RigidBody, RapierRigidBody } from '@react-three/rapier';
import * as RAPIER from '@dimforge/rapier3d-compat';

function isGrounded(body: RapierRigidBody, world: RAPIER.World) {
  const origin = body.translation();
  const ray = new RAPIER.Ray(origin, { x: 0, y: -1, z: 0 });
  const hit = world.castRay(ray, 1.1, true);
  return hit !== null;
}
```

Useful for jump-only-on-ground checks. The same pattern handles aim/shoot rays.

## Performance

- **Trimesh** is the slow path. Replace with hull/cuboid for anything that doesn't need exact concave collision.
- Set `canSleep={true}` (default) — stacked stable bodies sleep and don't burn CPU.
- Use `restitution` < 0.5 for stable stacks. Bouncy stacks fight gravity each frame.
- Don't recreate `<RigidBody>` keys per frame. React unmount/mount inside Physics is expensive.
- For >500 dynamic bodies, run physics on a worker or accept lower step rate (`timeStep={1/30}`).
- Profile: `<Physics debug>` shows collider count; `world.bodies.len()` shows live bodies.

## Debug & Tuning

```tsx
<Physics
  debug                       // wireframe colliders
  gravity={[0, -9.81, 0]}      // change for moon, water, etc.
  timeStep={1/60}              // physics tick — match render rate
  paused={false}
>
```

Debug visualizer renders **inside** the canvas — toggle off in production. For step-by-step debugging, set `paused={true}` then advance manually via the world `step()` API.

## Using with Next.js

Standard R3F SSR rules — the Physics provider mounts in a client component. Rapier loads WASM at runtime:

```tsx
'use client';
import { Physics } from '@react-three/rapier';
```

Bundle considerations:
- Rapier WASM is ~200 KB. Lazy-load scenes that need it.
- The package supports `dynamic` imports.
- HTTP cache the WASM file (`@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm`) — your Next.js asset pipeline does this by default for `public/_next/static/...` chunks.

For Coolify deploys, no special config — the WASM is bundled as a static asset.

## Examples

### Example 1: Physics-based onboarding cards
Stack of 5 RigidBody planes that the user can knock over with a draggable cursor. Resets after 5s of stillness.

### Example 2: 3D landing toy
"Cannon" mesh that fires balls into a target. `applyImpulse` on click. ~50 lines.

### Example 3: Vehicle simulator
Chassis as RigidBody, 4 wheels as RigidBody connected via `useRevoluteJoint` (motor enabled). Apply torque to wheels for movement.

## Troubleshooting

### Bodies fall through floor on first frame
Cause: floor RigidBody is `dynamic` (default) and falls with everything; or collider is missing.
Fix: floor must be `type="fixed"`. Verify with `<Physics debug>`. Make sure `colliders="cuboid"` is set, or pass an explicit `<CuboidCollider>`.

### Bodies jitter / vibrate when stacked
Cause: high restitution + low solver iterations + low timeStep precision.
Fix: drop restitution to 0.1-0.3. Increase `linearDamping` to 0.5. As a last resort, raise `timeStep={1/120}` (doubles CPU cost).

### Trimesh collider is ignored / passes through
Cause: trimesh on a dynamic body. Rapier disallows that — trimesh is for static only.
Fix: use `colliders="hull"` (convex approximation) for dynamic bodies. Trimesh stays on `type="fixed"` only.

### "Physics is not a function" / "world undefined"
Cause: hook called outside `<Physics>` context.
Fix: use `useRapier` only in components inside the `<Physics>` JSX tree.

### Drag stutters at high speeds
Cause: physics steps lag behind pointer move events.
Fix: switch to `kinematicPosition` for drag (as in the Drag pattern). Use `setNextKinematicTranslation` (interpolated between steps) rather than `setTranslation`.

### Performance tanks with many bodies
Cause: many trimesh colliders, or many woken-up dynamic bodies.
Fix: profile `<Physics debug>` to see what's awake. Use hull instead of trimesh. Group static geometry under one fixed RigidBody with multiple colliders.

### Rapier WASM 404 in production
Cause: bundler didn't emit the WASM as a static asset, or CDN doesn't serve `application/wasm` MIME.
Fix: confirm `.wasm` chunk in `.next/static/...`. Set MIME on your reverse proxy (Coolify, nginx). For module-format WASM, `application/wasm; charset=utf-8`.
