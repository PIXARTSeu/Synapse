---
name: frontend-design
description: "Component-level frontend craft toolkit with 20 iterative design commands (/critique, /audit, /normalize, /polish, /harden, /animate, /colorize, /distill, /typeset, /arrange, /delight, /clarify, /optimize). Use to refine, critique, or polish EXISTING UI components and pages — spacing, typography, motion, states, micro-interactions — or to run a specific refinement command. For generating a whole new page from a brief use hallmark; for a data-backed design system use ui-ux-pro-max."
version: 2.0.0
user-invocable: true
argument-hint: "nome componente e tipo di interfaccia"
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic
"AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic detail
and creative choices.

---

## Context Protocol

Before any design work, establish project context in this order:

1. **Check `.impeccable.md`** at project root → if exists, read it and proceed
2. **Check current instructions** → if a Design Context section is present, proceed
3. **No context found?** → Ask max 3 questions:
   - Who uses this? (audience, device context, technical level)
   - Brand personality? (formal/playful, minimal/rich, technical/consumer)
   - Existing colors or design system?

Save answers to `.impeccable.md` at project root for future sessions.

---

## Design Direction

Commit to a BOLD aesthetic direction BEFORE writing code:

- **Purpose**: What problem does this solve? Who uses it?
- **Tone**: Pick an extreme — brutally minimal, maximalist chaos, retro-futuristic, organic/natural,
  luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric,
  soft/pastel, industrial/utilitarian
- **Constraints**: Framework, performance budget, accessibility tier, i18n languages
- **Differentiation**: What makes this UNFORGETTABLE? The one thing someone will remember

**CRITICAL**: Choose a direction and execute with precision. Bold maximalism and refined minimalism
both work — the key is intentionality, not intensity.

---

## Design Guidelines (DO / DON'T)

### Typography
→ *Deep reference: [reference/typography.md](reference/typography.md)*

**DO**:
- Pair a distinctive display font with a refined body font
- Use modular type scale with fluid sizing via `clamp(min, preferred, max)`
- Vary font weights AND sizes for clear visual hierarchy
- Name tokens semantically: `--text-body`, `--text-heading` (not `--font-size-16`)

**DON'T**:
- Inter, Roboto, Arial, Open Sans, Lato, Montserrat, Space Grotesk, or any system default
- Monospace fonts as lazy "developer/technical" shorthand
- Large icons with rounded corners above every heading (templated look)
- More than 2-3 font families per project

---

### Color & Theme
→ *Deep reference: [reference/color-and-contrast.md](reference/color-and-contrast.md)*

**DO**:
- Use OKLCH for perceptually uniform, maintainable palettes
- Tint neutrals toward brand hue (even chroma 0.01 creates cohesion)
- Dominant colors with sharp accents — the 60-30-10 rule
- Use `color-mix()` and `light-dark()` for maintainable theming

**DON'T**:
- Gray text on colored backgrounds — use a shade of the background color instead
- Pure black (#000) or pure white (#fff) — always tint
- The AI palette: cyan-on-dark, purple-to-blue gradients, neon accents on dark
- Gradient text for "impact" (especially on metrics or headings)
- Default to dark mode with glowing accents

---

### Layout & Space
→ *Deep reference: [reference/spatial-design.md](reference/spatial-design.md)*

**DO**:
- Create rhythm through varied spacing — tight groupings, generous separations
- Asymmetry and unexpected compositions — break the grid intentionally for emphasis
- Fluid spacing with `clamp()` that breathes on larger screens
- Container queries (`@container`) for component-level responsiveness

**DON'T**:
- Wrap everything in cards — not everything needs a container
- Nest cards inside cards — visual noise, flatten the hierarchy
- Identical card grids (icon + heading + text, repeated endlessly)
- Center everything — left-aligned text with asymmetric layouts feels more designed
- The hero metric layout: big number + small label + supporting stats + gradient accent
- Same spacing everywhere — without rhythm, layouts feel monotonous

---

### Visual Details

**DO**:
- Intentional, purposeful decorative elements that reinforce brand identity
- Backgrounds that create atmosphere: gradient meshes, noise textures, geometric patterns

**DON'T**:
- Glassmorphism everywhere — blur effects, glass cards, glow borders as default
- Rounded rectangles with thick colored border on one side (lazy accent)
- Sparklines as decoration (tiny charts that convey nothing meaningful)
- Rounded rects with generic drop shadows — safe, forgettable, immediately recognizable as AI
- Modals unless truly no better alternative — modals are lazy

---

### Motion
→ *Deep reference: [reference/motion-design.md](reference/motion-design.md)*

**DO**:
- Animate `transform` and `opacity` ONLY — everything else causes layout recalculation
- Use exponential easing: `ease-out-quart`, `ease-out-quint`, `ease-out-expo`
- For height animations: `grid-template-rows: 0fr → 1fr` (not `height` directly)
- Always include `@media (prefers-reduced-motion: reduce)` fallback
- Stagger reveals for page loads: one orchestrated entrance > scattered micro-interactions

**DON'T**:
- Bounce or elastic easing — dated, tacky, real objects decelerate smoothly
- Animate layout properties (width, height, padding, margin)
- Transform animations on hover (translateX on nav links)
- Shadows over 8px blur as dynamic effects

---

### Interaction
→ *Deep reference: [reference/interaction-design.md](reference/interaction-design.md)*

**DO**:
- Design all 8 states: default, hover, focus, active, disabled, loading, error, success
- Use `:focus-visible` for keyboard focus rings (never remove outline without replacement)
- Optimistic UI — update immediately, sync later (for low-stakes actions)
- Empty states that teach the interface

**DON'T**:
- Remove focus indicators
- Use placeholder text as labels (they disappear on input)
- Repeat the same information — redundant headers, intros that restate the heading
- Make every button primary — use ghost/secondary/text links for hierarchy

---

### Responsive
→ *Deep reference: [reference/responsive-design.md](reference/responsive-design.md)*

**DO**:
- Mobile-first: base styles for mobile, `min-width` queries to layer complexity
- Detect input method (`pointer: fine/coarse`, `hover: hover/none`), not just screen size
- Use `env(safe-area-inset-*)` for notch/home indicator handling

**DON'T**:
- Hide critical functionality on mobile — adapt the interface, don't amputate it
- Desktop-first approach (`max-width` queries)
- Rely on hover for functionality — touch users can't hover

---

### UX Writing
→ *Deep reference: [reference/ux-writing.md](reference/ux-writing.md)*

**DO**:
- Specific verb + object button labels: "Save changes", "Delete project", "Create account"
- Error messages: what happened + why + how to fix
- Empty states: acknowledge briefly + explain value + provide action

**DON'T**:
- "OK", "Submit", "Yes/No", "Click here"
- Blame the user in error messages
- Vary terminology for variety ("delete" / "remove" / "trash" for same action)
- Humor for errors — users are frustrated, be helpful not cute

---

## HARD NO: Banned Patterns

→ *Full reference: [reference/anti-patterns.md](reference/anti-patterns.md)*

These are the fingerprints of AI-generated work from 2024-2025.
Seeing any of these = redesign that element.

**Components:**
- Oversized rounded corners (>12px on cards, >8px on buttons)
- Pill shapes on everything (buttons, badges, inputs, forms)
- Floating glassmorphism panels as default visual language
- Soft corporate gradients to fake taste
- Sidebar ~280px with brand block on top + nav links below as floating detached shell

**Patterns:**
- Generic dark SaaS: blue-black gradients + cyan accents
- Eyebrow labels (UPPERCASE WITH LETTER-SPACING above headings)
- Hero sections inside dashboards or internal UI
- Decorative copy ("Operational clarity without the clutter") as page headers
- KPI card grid as first dashboard instinct
- Donut charts with hand-wavy percentages
- Canvas charts in glass cards with no product reason

**Typography:**
- `<small>` uppercase headers above headings
- Rounded `<span>` labels with gradient backgrounds
- Mixed alignment (some left, some center-floating)
- Muted gray-blue text that kills contrast

**Decoration:**
- Status dots via `::before` pseudo-elements
- Transform hover animations (translateX on nav links)
- Dramatic box shadows (0 24px 60px rgba(0,0,0,0.35))
- Trend indicators with colored text classes
- Nav badges or "Live" status indicators (decorative)
- Random glows, blur haze, conic-gradient donuts

**Headlines:**
```html
<!-- BANNED -->
<div class="headline">
  <small>Team Command</small>
  <h2>One place to track what matters today.</h2>
</div>

<!-- BANNED -->
<div class="team-note">
  <small>Focus</small>
  <strong>Keep updates brief.</strong>
</div>
```

---

## The AI Slop Test

Before shipping, ask: *"If someone saw this and said 'an AI made this' — would they be right?"*

A distinctive interface makes people ask "how was this made?" — not "which AI made this?".

Review the HARD NO list above. Those are the fingerprints.

---

## The 20 Design Commands

These commands are automatically invoked by the `/frontend` workflow at quality gates.
They can also be run manually at any time: `/critique`, `/polish`, etc.

### Analysis (no edits — report only)
| Command | What it does |
|---------|--------------|
| `/critique [area]` | UX review: hierarchy, clarity, emotional resonance, AI slop test |
| `/audit [area]` | Technical quality: a11y, responsive, performance, all 8 interaction states |

### Fixing
| Command | What it does |
|---------|--------------|
| `/normalize [area]` | Align with design system: fix spacing drift, token violations, typography inconsistency |
| `/clarify [area]` | Fix unclear UX copy, button labels, error messages, empty states |
| `/optimize [area]` | Performance: lazy loading, GPU-promoted animations, CSS specificity cleanup |
| `/harden [area]` | Error handling, i18n edge cases, empty states, loading states, all 8 interaction states |

### Styling
| Command | What it does |
|---------|--------------|
| `/typeset [area]` | Fix font choices, hierarchy, fluid sizing, type scale |
| `/arrange [area]` | Fix layout, spacing rhythm, visual hierarchy |
| `/colorize [area]` | Introduce strategic color, fix OKLCH violations, palette consistency |
| `/bolder [area]` | Amplify timid/generic designs toward distinctive |
| `/quieter [area]` | Tone down visually overwhelming or cluttered designs |

### Output
| Command | What it does |
|---------|--------------|
| `/polish [area]` | Final pass before shipping — fix every rough edge |
| `/distill [area]` | Strip to essence, remove decorative noise, simplify |
| `/extract [area]` | Pull repeated patterns into reusable components |

### Enhancement
| Command | What it does |
|---------|--------------|
| `/animate [area]` | Add purposeful motion: entrances, state changes, micro-interactions |
| `/delight [area]` | Add moments of joy: Easter eggs, micro-animations, personality touches |
| `/adapt [area]` | Adapt for mobile, tablet, landscape — don't just shrink |
| `/onboard [area]` | Design onboarding flow, coach marks, empty states that teach |
| `/overdrive [area]` | Technically extraordinary effects for showcase/hero moments |

### Setup
| Command | What it does |
|---------|--------------|
| `/teach-impeccable` | Gather project context and write `.impeccable.md` at project root |

---

## Color Selection

**Priority order:**
1. Read existing CSS variables, Tailwind config, or design tokens from the project
2. Pick from curated palettes below (choose randomly — don't always pick the first)
3. Never invent random combinations

### Dark Palettes

| Palette | Background | Surface | Primary | Text |
|---------|-----------|---------|---------|------|
| Void Space | `#0d1117` | `#161b22` | `#58a6ff` | `#c9d1d9` |
| Slate Noir | `#0f172a` | `#1e293b` | `#38bdf8` | `#f1f5f9` |
| Charcoal Studio | `#1c1c1e` | `#2c2c2e` | `#0a84ff` | `#f2f2f7` |
| Graphite Pro | `#18181b` | `#27272a` | `#a855f7` | `#fafafa` |
| Obsidian Depth | `#0f0f0f` | `#1a1a1a` | `#00d4aa` | `#f5f5f5` |
| Deep Ocean | `#001e3c` | `#0a2744` | `#4fc3f7` | `#eceff1` |
| Carbon Elegance | `#121212` | `#1e1e1e` | `#bb86fc` | `#e1e1e1` |
| Twilight Mist | `#1a1625` | `#2d2438` | `#9d7cd8` | `#dcd7e8` |
| Midnight Canvas | `#0a0e27` | `#151b3d` | `#6c8eff` | `#e2e8f0` |
| Onyx Matrix | `#0e0e10` | `#1c1c21` | `#00ff9f` | `#f0f0f0` |

### Light Palettes

| Palette | Background | Surface | Primary | Text |
|---------|-----------|---------|---------|------|
| Cloud Canvas | `#fafafa` | `#ffffff` | `#2563eb` | `#0f172a` |
| Pearl Minimal | `#f8f9fa` | `#ffffff` | `#0066cc` | `#212529` |
| Ivory Studio | `#f5f5f4` | `#fafaf9` | `#0891b2` | `#1c1917` |
| Porcelain Clean | `#f9fafb` | `#ffffff` | `#4f46e5` | `#111827` |
| Alabaster Pure | `#fcfcfc` | `#ffffff` | `#1d4ed8` | `#1e293b` |
| Arctic Breeze | `#f0f9ff` | `#f8fafc` | `#0284c7` | `#0c4a6e` |
| Sand Warm | `#faf8f5` | `#ffffff` | `#b45309` | `#451a03` |
| Frost Bright | `#f1f5f9` | `#f8fafc` | `#0f766e` | `#0f172a` |
| Linen Soft | `#fef7f0` | `#fffbf5` | `#d97706` | `#292524` |
| Cream Elegance | `#fefce8` | `#fefce8` | `#65a30d` | `#365314` |

---

## Implementation Principles

Match implementation complexity to the aesthetic vision:
- **Maximalist** → elaborate code, extensive animations, dense effects
- **Minimalist** → restraint, precision, careful spacing and typography
- **Editorial** → strong typographic hierarchy, generous whitespace, confident layout

No two designs should be the same. Vary themes, fonts, aesthetics. NEVER converge on the same
safe choices across generations.

Remember: extraordinary creative work is possible. Don't hold back.
