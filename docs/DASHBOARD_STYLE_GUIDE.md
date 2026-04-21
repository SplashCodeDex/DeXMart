# DeXMart Dashboard Style Guide

> **Source of truth for visual language.** All new dashboard components MUST follow this guide.
> Generated from `frontend/src/app/globals.css` + imported CSS layers.
> Update this file when tokens change — never add tokens without updating here first.

---

## 1. Color Tokens (OKLCH)

All colors use the OKLCH color space for perceptual uniformity and wide-gamut support. **Never use hex or RGB values directly in components** — always reference CSS custom properties via Tailwind utilities.

### 1.1 Primary Scale — Green (hue 155)

| Token                 | Value                 | Tailwind                             |
| --------------------- | --------------------- | ------------------------------------ |
| `--color-primary-50`  | `oklch(97% 0.02 155)` | `bg-primary-50`                      |
| `--color-primary-100` | `oklch(94% 0.04 155)` | `bg-primary-100`                     |
| `--color-primary-200` | `oklch(88% 0.08 155)` | `bg-primary-200`                     |
| `--color-primary-300` | `oklch(78% 0.12 155)` | `bg-primary-300`                     |
| `--color-primary-400` | `oklch(68% 0.14 155)` | `bg-primary-400`                     |
| `--color-primary-500` | `oklch(58% 0.14 155)` | `bg-primary-500`                     |
| `--color-primary-600` | `oklch(50% 0.12 155)` | `bg-primary-600` ← **default light** |
| `--color-primary-700` | `oklch(42% 0.10 155)` | `bg-primary-700`                     |
| `--color-primary-800` | `oklch(34% 0.08 155)` | `bg-primary-800`                     |
| `--color-primary-900` | `oklch(26% 0.06 155)` | `bg-primary-900`                     |
| `--color-primary-950` | `oklch(16% 0.04 155)` | `bg-primary-950`                     |

Dark mode uses `--color-primary-500` as `--primary`.

### 1.2 Accent Scale — Mastermind Violet (hue 285)

| Token                | Value                 | Tailwind                            |
| -------------------- | --------------------- | ----------------------------------- |
| `--color-accent-50`  | `oklch(96% 0.03 285)` | `bg-accent-50`                      |
| `--color-accent-100` | `oklch(92% 0.06 285)` | `bg-accent-100`                     |
| `--color-accent-200` | `oklch(84% 0.12 285)` | `bg-accent-200`                     |
| `--color-accent-300` | `oklch(74% 0.18 285)` | `bg-accent-300`                     |
| `--color-accent-400` | `oklch(64% 0.22 285)` | `bg-accent-400`                     |
| `--color-accent-500` | `oklch(56% 0.23 285)` | `bg-accent-500` ← **default dark**  |
| `--color-accent-600` | `oklch(48% 0.21 285)` | `bg-accent-600` ← **default light** |
| `--color-accent-700` | `oklch(40% 0.18 285)` | `bg-accent-700`                     |
| `--color-accent-800` | `oklch(32% 0.14 285)` | `bg-accent-800`                     |
| `--color-accent-900` | `oklch(24% 0.10 285)` | `bg-accent-900`                     |
| `--color-accent-950` | `oklch(14% 0.06 285)` | `bg-accent-950`                     |

### 1.3 Semantic Colors

| Token                        | Value                 | Use                            |
| ---------------------------- | --------------------- | ------------------------------ |
| `--color-success`            | `oklch(72% 0.19 145)` | Positive states, online status |
| `--color-success-foreground` | `oklch(98% 0.02 145)` | Text on success bg             |
| `--color-warning`            | `oklch(80% 0.16 85)`  | Degraded states, caution       |
| `--color-warning-foreground` | `oklch(25% 0.04 85)`  | Text on warning bg             |
| `--color-error`              | `oklch(63% 0.24 27)`  | Errors, destructive actions    |
| `--color-error-foreground`   | `oklch(98% 0.01 27)`  | Text on error bg               |
| `--color-info`               | `oklch(70% 0.14 240)` | Informational callouts         |
| `--color-info-foreground`    | `oklch(98% 0.01 240)` | Text on info bg                |

### 1.4 Light Theme Semantic Tokens (`:root`)

| Token                  | Value                  |
| ---------------------- | ---------------------- |
| `--background`         | `oklch(99% 0 0)`       |
| `--foreground`         | `oklch(15% 0.01 280)`  |
| `--card`               | `oklch(100% 0 0)`      |
| `--card-foreground`    | `oklch(15% 0.01 280)`  |
| `--popover`            | `oklch(100% 0 0)`      |
| `--popover-foreground` | `oklch(15% 0.01 280)`  |
| `--muted`              | `oklch(97% 0.002 280)` |
| `--muted-foreground`   | `oklch(45% 0.02 280)`  |
| `--border`             | `oklch(92% 0.004 280)` |
| `--input`              | `oklch(92% 0.004 280)` |
| `--radius`             | `0.75rem`              |

### 1.5 Dark Theme Semantic Tokens (`.dark`)

| Token                  | Value                 |
| ---------------------- | --------------------- |
| `--background`         | `oklch(11% 0.01 280)` |
| `--foreground`         | `oklch(96% 0.01 280)` |
| `--card`               | `oklch(14% 0.01 280)` |
| `--card-foreground`    | `oklch(96% 0.01 280)` |
| `--popover`            | `oklch(12% 0.01 280)` |
| `--popover-foreground` | `oklch(96% 0.01 280)` |
| `--muted`              | `oklch(18% 0.01 280)` |
| `--muted-foreground`   | `oklch(65% 0.02 280)` |
| `--border`             | `oklch(24% 0.01 280)` |
| `--input`              | `oklch(24% 0.01 280)` |
| `--secondary`          | `oklch(18% 0.01 280)` |

### 1.6 Background Mesh Tokens

| Token             | Light                         | Dark                          |
| ----------------- | ----------------------------- | ----------------------------- |
| `--bg-mesh-1`     | `oklch(83% 0.024 166 / 0.47)` | `oklch(40% 0.12 155 / 0.2)`   |
| `--bg-mesh-2`     | `oklch(79% 0.020 292 / 0.28)` | `oklch(39% 0.208 280 / 0.15)` |
| `--bg-mesh-3`     | `oklch(50% 0.134 147 / 0.34)` | `oklch(47% 0.200 335 / 0.15)` |
| `--bg-mesh-green` | `oklch(56% 0.113 153 / 0.44)` | `oklch(66% 0.152 158 / 0.2)`  |

---

## 2. Glassmorphism Recipe

### 2.1 Standard Data Cards

```tsx
<div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl p-4">
  {/* card content */}
</div>
```

### 2.2 Glass Surface Utilities (from backgrounds.css)

| Class                   | Recipe                                                       |
| ----------------------- | ------------------------------------------------------------ |
| `.glass-surface`        | `backdrop-blur-xl bg-background/60 border border-border/50`  |
| `.glass-surface-strong` | `backdrop-blur-2xl bg-background/80 border border-border/70` |

### 2.3 Liquid Glass Components (from liquid-glass.css)

For interactive glass elements (sidebar, FABs, pill badges), use the `.liquidGlass-*` class family:

| Variant      | Class                                      | Use                       |
| ------------ | ------------------------------------------ | ------------------------- |
| Sidebar/dock | `.liquidGlass-wrapper.sidebar-liquid`      | Navigation sidebar        |
| Control      | `.liquidGlass-wrapper.liquidGlass-control` | Header buttons, toggles   |
| Pill         | `.liquidGlass-wrapper.liquidGlass-pill`    | User profile, identifiers |
| FAB          | `.liquidGlass-wrapper.liquidGlass-fab`     | Floating action buttons   |

Structure every liquid glass element with four mandatory child layers:

```html
<div class="liquidGlass-wrapper [variant]">
  <div class="liquidGlass-effect"></div>
  <!-- backdrop blur + distortion -->
  <div class="liquidGlass-tint"></div>
  <!-- color tint -->
  <div class="liquidGlass-shine"></div>
  <!-- specular highlight -->
  <div class="liquidGlass-content">
    <!-- actual content -->
    ...
  </div>
</div>
```

**Critical:** `border-radius` MUST be set on both the wrapper and all four child `> div` layers for the effect to render correctly. Use the variant classes — they handle this automatically.

### 2.4 Glassmorphism Token Reference

| Token            | Light                            | Dark                        |
| ---------------- | -------------------------------- | --------------------------- |
| `--glass-bg`     | `oklch(100% 0 0)`                | `oklch(14% 0.01 280)`       |
| `--glass-border` | `oklch(0% 0 0 / 0.1)`            | `oklch(100% 0 0 / 0.05)`    |
| `--glass-blur`   | `0px` (CSS handles via Tailwind) | `0px`                       |
| `--glass-tint`   | `rgba(255, 255, 255, 0.489)`     | `rgba(217, 78, 255, 0.033)` |

---

## 3. Typography

### 3.1 Font Families

| Token         | Stack                                                        | Use                                |
| ------------- | ------------------------------------------------------------ | ---------------------------------- |
| `--font-sans` | `'Inter Variable', Inter, ui-sans-serif, …`                  | All UI text                        |
| `--font-mono` | `'JetBrains Mono Variable', JetBrains Mono, ui-monospace, …` | Code, RPC playgrounds, log viewers |

### 3.2 Font Size Scale

| Token         | Value      | Tailwind    |
| ------------- | ---------- | ----------- |
| `--text-xs`   | `0.75rem`  | `text-xs`   |
| `--text-sm`   | `0.875rem` | `text-sm`   |
| `--text-base` | `1rem`     | `text-base` |
| `--text-lg`   | `1.125rem` | `text-lg`   |
| `--text-xl`   | `1.25rem`  | `text-xl`   |
| `--text-2xl`  | `1.5rem`   | `text-2xl`  |
| `--text-3xl`  | `1.875rem` | `text-3xl`  |
| `--text-4xl`  | `2.25rem`  | `text-4xl`  |
| `--text-5xl`  | `3rem`     | `text-5xl`  |

---

## 4. Spacing & Border Radius

### 4.1 Radius Scale

| Token           | Value      | Tailwind       | Use             |
| --------------- | ---------- | -------------- | --------------- |
| `--radius-sm`   | `0.375rem` | `rounded-sm`   | Badges, chips   |
| `--radius-md`   | `0.5rem`   | `rounded-md`   | Buttons, inputs |
| `--radius-lg`   | `0.75rem`  | `rounded-lg`   | Cards (default) |
| `--radius-xl`   | `1rem`     | `rounded-xl`   | Panels          |
| `--radius-2xl`  | `1.5rem`   | `rounded-2xl`  | Sidebar, modals |
| `--radius-full` | `9999px`   | `rounded-full` | Avatars, pills  |

`--sidebar-dock-radius: 1.5rem` — matches `rounded-2xl`.

---

## 5. Shadow Scale

| Token            | Value                                 | Use               |
| ---------------- | ------------------------------------- | ----------------- |
| `--shadow-xs`    | `0 1px 2px 0 rgb(0 0 0 / 0.03)`       | Subtle lift       |
| `--shadow-sm`    | `0 1px 3px 0 rgb(0 0 0 / 0.05)`       | Default card      |
| `--shadow-md`    | `0 4px 6px -1px rgb(0 0 0 / 0.08)`    | Dropdowns         |
| `--shadow-lg`    | `0 10px 15px -3px rgb(0 0 0 / 0.08)`  | Modals            |
| `--shadow-xl`    | `0 20px 25px -5px rgb(0 0 0 / 0.08)`  | Sheets            |
| `--shadow-2xl`   | `0 25px 50px -12px rgb(0 0 0 / 0.1)`  | Dialogs           |
| `--shadow-inner` | `inset 0 2px 4px 0 rgb(0 0 0 / 0.05)` | Input focus rings |

---

## 6. Motion & Animation

### 6.1 Duration Tokens

| Token                        | Value   | Use                            |
| ---------------------------- | ------- | ------------------------------ |
| `--animate-duration-instant` | `50ms`  | State toggles (bg-color, text) |
| `--animate-duration-fast`    | `150ms` | Hover effects, fade-out        |
| `--animate-duration-normal`  | `250ms` | Enter transitions, slide-in    |
| `--animate-duration-slow`    | `400ms` | Page-level transitions         |
| `--animate-duration-slower`  | `600ms` | Onboarding, hero reveals       |

### 6.2 Easing Curves

| Token                   | Value                               | Use                   |
| ----------------------- | ----------------------------------- | --------------------- |
| `--animate-ease-linear` | `linear`                            | Spinners              |
| `--animate-ease-in`     | `cubic-bezier(0.4, 0, 1, 1)`        | Exit animations       |
| `--animate-ease-out`    | `cubic-bezier(0, 0, 0.2, 1)`        | Enter animations      |
| `--animate-ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)`      | Toggles               |
| `--animate-ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Scale-in, pop effects |

### 6.3 Named Animations

| Token                     | Composition                         | Use                   |
| ------------------------- | ----------------------------------- | --------------------- |
| `--animate-fade-in`       | `fade-in 250ms ease-out`            | Modals, toasts        |
| `--animate-fade-out`      | `fade-out 150ms ease-in`            | Dismissals            |
| `--animate-slide-in-up`   | `slide-in-up 250ms ease-out`        | Bottom sheets         |
| `--animate-slide-in-down` | `slide-in-down 250ms ease-out`      | Dropdowns             |
| `--animate-scale-in`      | `scale-in 250ms spring`             | Dialogs, FABs         |
| `--animate-spin`          | `spin 1s linear infinite`           | Loaders               |
| `--animate-pulse`         | `pulse 2s cubic-bezier(…) infinite` | Skeleton, status dots |

### 6.4 Framer Motion

Use `frontend/src/components/ui/motion.tsx` for all animated React components. Do not import from `framer-motion` directly in feature components — compose via the `motion.tsx` abstractions.

---

## 7. Component Primitives

All UI primitives come from `frontend/src/components/ui/` (shadcn/ui). Never create local copies.

### 7.1 Icons

Use `lucide-react` or `frontend/src/components/ui/icons.tsx`. No emojis as icons (PROJECT_RULES §8.7).

### 7.2 Shared Feature Primitives (Phase 2 — built once, used everywhere)

| Component            | Path                                               | Used By                                        |
| -------------------- | -------------------------------------------------- | ---------------------------------------------- |
| `ModelSelector`      | `components/shared/ModelSelector.tsx`              | chat, sessions, agents, cron, setup-wizard     |
| `QRLoginModal`       | `features/omnichannel/components/QRLoginModal.tsx` | channels, setup-wizard                         |
| `SchemaFormRenderer` | `components/schema-form/SchemaFormRenderer.tsx`    | config, cron, skills, setup-wizard             |
| `ConnectionStatus`   | `components/shared/ConnectionStatus.tsx`           | dashboard header                               |
| `AbortButton`        | `components/shared/AbortButton.tsx`                | chat, sessions                                 |
| `StatusBadge`        | `components/shared/StatusBadge.tsx`                | channels, cron, nodes, sessions                |
| `VirtualLogList`     | `components/shared/VirtualLogList.tsx`             | logs, chat transcript, sessions, update-runner |
| `ToolCallCard`       | `components/shared/ToolCallCard.tsx`               | chat, debug RPC playground                     |
| `ThinkingCard`       | `components/shared/ThinkingCard.tsx`               | chat, sessions detail                          |

Any sub-track that hand-rolls one of these instead of composing the shared version **fails code review**.

---

## 8. Page Architecture

- **Default:** Server Components. Client Components only when interactivity is required.
- **Pattern:** Thin page (`page.tsx` ≤ 20 lines) → feature component → hooks.
- **No `useEffect` for data fetching** — use Server Components, SWR, or Gateway RPC hooks.
- **State:** Zustand stores per feature (`features/*/store.ts`). No prop drilling past 2 levels.

---

## 9. Don't-Use List

| Rule                                             | Reason                                                          |
| ------------------------------------------------ | --------------------------------------------------------------- |
| No emoji in UI (PROJECT_RULES §8.7)              | Not in icon font, breaks accessibility, renders inconsistently  |
| No custom hex / RGB colors                       | Breaks wide-gamut support; all color via OKLCH tokens           |
| No new OKLCH tokens without RFC                  | Token sprawl degrades system coherence                          |
| No inline `style={{ color: ..., padding: ... }}` | Bypasses token system; not purgeable                            |
| No `useEffect` for data fetching                 | Race conditions, double-fetches; use RSC or hooks               |
| No duplicate Zod schemas                         | Import from `src/gateway/server-methods/*` (PROJECT_RULES §0.1) |
| No parallel RPC clients                          | Use `frontend/src/lib/gateway/gateway-client.ts` singleton      |
| No `framer-motion` direct import in features     | Use `components/ui/motion.tsx` abstractions                     |
| No emojis in commit messages                     | Project convention                                              |

---

## 10. Background Utilities

| Class                        | Use                                                          |
| ---------------------------- | ------------------------------------------------------------ |
| `.bg-mesh-premium`           | Full-page authenticated layout background (fixed attachment) |
| `.glass-surface`             | Panel, card overlay on mesh                                  |
| `.glass-surface-strong`      | Modal backdrop, drawer                                       |
| `.bg-dots`                   | Empty state backgrounds                                      |
| `.glow-orb.glow-orb-primary` | Decorative 500×500px blur orb (primary color)                |
| `.glow-orb.glow-orb-accent`  | Decorative 400×400px blur orb (accent color)                 |
| `.custom-scrollbar`          | Scrollable areas — thin accent scrollbar on hover            |
| `.no-scrollbar`              | Hidden scrollbar with scroll retained                        |
