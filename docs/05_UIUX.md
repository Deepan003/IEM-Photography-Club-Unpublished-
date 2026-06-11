# UI/UX Design Document
## IEM Photography Club Web Platform

**Version:** 1.0  
**Date:** June 2026  
**Covers:** Design System, Visual Language, Interaction Patterns, Accessibility

---

## 1. Design Philosophy

The platform uses a **dark-first glassmorphic + neumorphic hybrid** visual language, inspired by photography darkrooms and digital cinema editing suites. Light mode uses a soft neumorphic palette with subtle depth, avoiding harsh whites.

**Three guiding principles:**
1. **Depth through light** — glass layers, soft shadows, and gradients create hierarchy without cluttering UI
2. **Cinematic pacing** — transitions match the rhythm of a photo reveal; nothing snaps
3. **Precision touch targets** — every interactive element ≥ 44×44px on mobile

---

## 2. Color System

### 2.1 Dark Mode Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#0a0a0f` | Page background |
| `--bg-surface` | `rgba(255,255,255,0.05)` | Card backgrounds |
| `--bg-surface-hover` | `rgba(255,255,255,0.08)` | Hovered card |
| `--border-subtle` | `rgba(255,255,255,0.08)` | Card borders |
| `--text-primary` | `#f8fafc` | Headings |
| `--text-secondary` | `#94a3b8` | Body text |
| `--text-muted` | `#64748b` | Labels, captions |
| `--accent-red` | `#dc2626` | Brand accent (CTAs, active states) |
| `--accent-red-hover` | `#b91c1c` | Pressed state |
| `--accent-red-glow` | `rgba(220,38,38,0.3)` | Box shadow glows |
| `--backdrop-blur` | `backdrop-filter: blur(20px)` | Glass surfaces |

### 2.2 Light Mode Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#f0f0f5` | Page background (warm off-white) |
| `--bg-surface` | `rgba(255,255,255,0.72)` | Card backgrounds (frosted glass) |
| `--bg-surface-hover` | `rgba(255,255,255,0.88)` | Hovered card |
| `--border-subtle` | `rgba(0,0,0,0.08)` | Card borders |
| `--text-primary` | `#0f172a` | Headings |
| `--text-secondary` | `#475569` | Body text |
| `--text-muted` | `#94a3b8` | Labels, captions |
| `--accent-red` | `#dc2626` | Brand accent |
| `--shadow-neu` | `8px 8px 20px #d4d4e0, -8px -8px 20px #ffffff` | Neumorphic lift |
| `--shadow-neu-inset` | `inset 4px 4px 10px #d4d4e0, inset -4px -4px 10px #ffffff` | Pressed state |

### 2.3 Magazine Palettes

Eight curated palettes for magazine creation:

| Name | Primary | Accent | Surface | Feeling |
|------|---------|--------|---------|---------|
| Monochrome | `#1a1a1a` | `#f5f5f5` | `#ffffff` | Classic editorial |
| Deep Crimson | `#1a0a0a` | `#dc2626` | `#fef2f2` | Drama |
| Ocean Dark | `#0a1628` | `#3b82f6` | `#eff6ff` | Corporate cool |
| Forest | `#0d1f0d` | `#16a34a` | `#f0fdf4` | Nature |
| Royal Gold | `#1a1500` | `#d97706` | `#fffbeb` | Luxury |
| Lavender | `#140a1e` | `#7c3aed` | `#f5f3ff` | Creative |
| Blush | `#1a0f0f` | `#ec4899` | `#fdf2f8` | Fashion |
| Slate | `#0f172a` | `#64748b` | `#f8fafc` | Minimal |

---

## 3. Typography

### 3.1 UI Font Stack

| Weight | Font | Usage |
|--------|------|-------|
| Display (700–900) | `Montserrat` | Hero headings, nav brand name |
| UI (400–600) | `Inter` | All UI labels, buttons, forms |
| Mono | `JetBrains Mono` | Code snippets, timestamps |

Loading strategy: `font-display: swap` — UI never blocked by font.

### 3.2 Magazine Font Pairings

| Pairing ID | Heading | Body | Aesthetic |
|-----------|---------|------|-----------|
| `classic` | Playfair Display | Crimson Text | Literary |
| `modern` | Montserrat | Open Sans | Clean tech |
| `editorial` | Cormorant Garamond | Source Serif 4 | High fashion |
| `bold` | Oswald | Roboto | Sports/news |
| `luxury` | Made Voyager | Lato | Premium |
| `minimal` | DM Sans | DM Sans | Flat design |

Loading strategy: `font-display: optional` + non-blocking `preload` — never render-blocking.

### 3.3 Type Scale

| Scale | Size | Weight | Line Height |
|-------|------|--------|-------------|
| `text-4xl` | 36px | 700 | 1.1 |
| `text-3xl` | 30px | 600 | 1.2 |
| `text-2xl` | 24px | 600 | 1.3 |
| `text-xl` | 20px | 500 | 1.4 |
| `text-lg` | 18px | 500 | 1.5 |
| `text-base` | 16px | 400 | 1.6 |
| `text-sm` | 14px | 400 | 1.5 |
| `text-xs` | 12px | 400 | 1.4 |

---

## 4. Component Patterns

### 4.1 Glass Card

Used for all content cards throughout the site.

```css
/* Dark mode */
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

/* Light mode */
.glass-card-light {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  box-shadow: 8px 8px 20px #d4d4e0, -8px -8px 20px #ffffff;
}
```

### 4.2 Floating Action Button (FAB)

Used in Admin panel tabs for create actions. Implemented via `createPortal(fab, document.body)` to escape parent `transform: scale()` stacking contexts.

```
Desktop positioning: bottom-right (bottom: 24px, right: 24px)
Mobile positioning:  bottom-right (bottom: 80px — above bottom nav)
Expanded state:      slides right → label appears
Animation:           scale + opacity in, rotate X icon on active
```

**Expand direction — Core Tab special case:** In the Core tab, FAB expands rightward when mobile (label slides left-to-right from the button) to avoid obscuring the user list.

### 4.3 Auth-Glass Form Container

```css
.auth-glass {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 24px;
}
```

### 4.4 Neumorphic Input (Light Mode)

```css
.neu-input {
  background: #f0f0f5;
  box-shadow: inset 4px 4px 10px #d4d4e0, inset -4px -4px 10px #ffffff;
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
}
.neu-input:focus {
  box-shadow: inset 4px 4px 10px #c8c8d8, inset -4px -4px 10px #ffffff,
              0 0 0 2px rgba(220, 38, 38, 0.3);
}
```

---

## 5. Layout System

### 5.1 Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 640px | Single column, bottom navigation |
| Tablet | 640–1024px | Two-column grid, collapsible sidebar |
| Desktop | 1024–1440px | Three-column, fixed sidebar |
| Wide | > 1440px | Capped container (max-width: 1400px, centered) |

### 5.2 Admin Dashboard Layout

```
Desktop:
┌──────────────────────────────────────────────────────┐
│ [SIDEBAR 240px]  │  [CONTENT AREA — flex-1]          │
│ Logo             │                                   │
│ Nav items        │  Tab content scrolls here         │
│                  │                                   │
│ ─────────────    │                                   │
│ Theme toggle     │                                   │
│ Sign out         │                                   │
└──────────────────────────────────────────────────────┘

Mobile:
┌─────────────────────────┐
│ [HEADER: Logo  ☀ ⋮]    │
├─────────────────────────┤
│                         │
│  Content area           │
│  (full width)           │
│                         │
├─────────────────────────┤
│ [BOTTOM NAV — 5 icons]  │
└─────────────────────────┘
```

### 5.3 Magazine Editor Layout

```
Desktop:
┌────────────────────────────────────────────────────────────────┐
│ [TOOLBAR: Palette | Font | Page nav | Publish/Export]          │
├──────────────────────────┬─────────────────────────────────────┤
│ [PAGE PANEL - scrollable]│ [CANVAS - centered, scaled fit]     │
│ Thumbnails               │ Template renders at 794×1123px      │
│ + Add page               │ (A4 proportion)                     │
└──────────────────────────┴─────────────────────────────────────┘
```

---

## 6. Motion & Animation

### 6.1 Principles

- **Purposeful**: motion communicates state, not decoration
- **Consistent**: same easing curve used throughout (`cubic-bezier(0.4, 0, 0.2, 1)`)
- **Performant**: only `transform` and `opacity` are animated (GPU-composited)

### 6.2 Standard Durations

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Button press | 100ms | ease-out |
| Card hover lift | 200ms | ease-out |
| FAB expand | 250ms | cubic-bezier(0.4, 0, 0.2, 1) |
| Modal open | 300ms | cubic-bezier(0.4, 0, 0.2, 1) |
| Page enter | 400ms | ease-out |
| Skeleton shimmer | 1500ms | linear (loop) |
| Upload wave | 1800ms | linear (loop) |

### 6.3 Hero Transitions

- **Classic → Video**: `opacity: 0 → 1` on `onCanPlay` event (no flash of black)
- **Scroll reveal**: `translateY(20px) opacity(0) → translateY(0) opacity(1)` via `IntersectionObserver`
- **Mobile hero**: CSS `@keyframes` text cycling; each word 2.5s display, 0.3s fade

### 6.4 LiquidLoader (Upload Progress)

A wavy progress indicator used during S3 uploads:
- SVG wave path oscillates via CSS animation
- Fill height corresponds to upload percentage
- Back wave: `rgba(185,18,18,0.82)` — slightly darker, larger amplitude
- Front wave: `rgba(248,80,80,0.97)` — brighter, offset phase
- Wave amplitude: 26px peak-to-trough (wavy, not nearly flat)

---

## 7. Navigation Patterns

### 7.1 Global Navbar

- Sticky, `backdrop-filter: blur` glass background
- Logo left, nav links center (desktop), hamburger right (mobile)
- Admin toggle button (hero mode) visible only to admin/core
- Theme toggle always visible

### 7.2 Dashboard Navigation

**Desktop sidebar:**
- Fixed left, 240px wide
- Active tab: red accent left border + background highlight
- Footer: theme toggle + sign out

**Mobile:**
- Header: logo + theme icon + overflow menu (3-dot)
- Bottom nav bar (max 5 icons)
- Overflow drawer (bottom sheet) for remaining tabs

### 7.3 Tab Persistence

Tab selection stored in `useSearchParams` — survives page refresh, browser back, and direct URL sharing.

---

## 8. Accessibility

| Criteria | Implementation |
|----------|---------------|
| Color contrast | Minimum 4.5:1 for body text (WCAG AA) |
| Focus indicators | `focus-visible: ring-2 ring-red-500` on all interactive elements |
| Touch targets | Minimum 44×44px on mobile |
| Alt text | All `<img>` tags include `alt` attribute |
| Keyboard navigation | Sidebar and modals trap/release focus correctly |
| Motion sensitivity | Animations respect `prefers-reduced-motion: reduce` |
| Screen readers | ARIA labels on icon-only buttons (theme toggle, FAB) |

---

## 9. Key UX Decisions

| Decision | Rationale |
|----------|-----------|
| FAB over inline toggle button | Reduces visual noise in content tabs; consistent with Events/Competitions/Activities |
| Glass backdrop on navbar | Maintains readability over photography content without losing transparency |
| `font-display: optional` for magazine fonts | Prevents layout shift or blank text during PDF export |
| Inline text editing (double-click) | Mimics desktop publishing tools; no separate edit mode needed |
| Crop editor drag-to-pan | Pan without needing crop handles; pinch-zoom on mobile |
| 5s hero mode poll | Fast enough to feel real-time across devices; slow enough to avoid rate limits |
| Theme toggle in dashboard AND navbar | Users spend long sessions in dashboards; toggleing shouldn't require navigating away |
| `createPortal` for FAB | Parent admin tabs use `transform: scale()` for hover animations, which creates a new stacking context that breaks `position: fixed` — portal escapes this |
