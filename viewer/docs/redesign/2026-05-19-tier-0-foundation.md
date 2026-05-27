# Tier 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold `Polymer-3/` as a Next.js 16 + React 19 + Tailwind 4 sandbox running on `:3100`, establish the D2 (IBM Carbon × Bloomberg) design token system, and ship a Tier 0 foundation: light-mode `layout.tsx`, `globals.css`, electric-blue `BrandBar`, hairline `Footer`, and a landing page that demonstrates the new aesthetic.

**Architecture:** The sandbox mirrors `viewer/`'s file structure so a future port-back is mechanical. All visual decisions flow from `src/config/theme.ts` (the D2 token system). No backend wiring; static module data on the landing. Validation is build + typecheck + eyeball — no unit tests this round (per spec §8).

**Tech Stack:** Next.js 16, React 19, Tailwind 4, TypeScript, `next/font/google` for Inter + JetBrains Mono. Manual scaffolding (no `create-next-app`) to keep control of the exact file shape.

**Spec:** `docs/specs/2026-05-19-viewer-redesign-design.md`

---

## File Map

Files to create (in order):

```
Polymer-3/
├── .gitignore                                       # Task 1
├── package.json                                     # Task 1
├── tsconfig.json                                    # Task 1
├── next.config.ts                                   # Task 1
├── postcss.config.mjs                               # Task 1
├── src/
│   ├── config/
│   │   └── theme.ts                                 # Task 2 — design tokens
│   ├── app/
│   │   ├── globals.css                              # Task 3
│   │   ├── layout.tsx                               # Task 4
│   │   └── page.tsx                                 # Task 7 — landing
│   └── components/
│       ├── BrandBar.tsx                             # Task 5
│       └── Footer.tsx                               # Task 6
├── public/                                          # Task 1 (empty)
└── README.md                                        # Task 8
```

Files modified: none (sandbox starts empty).

---

## Task 1: Scaffold the Next.js project

**Files:**
- Create: `Polymer-3/.gitignore`
- Create: `Polymer-3/package.json`
- Create: `Polymer-3/tsconfig.json`
- Create: `Polymer-3/next.config.ts`
- Create: `Polymer-3/postcss.config.mjs`
- Create: `Polymer-3/public/` (empty directory)

- [ ] **Step 1.1: Create `.gitignore`**

Write `Polymer-3/.gitignore`:

```
# dependencies
node_modules

# next.js
.next/
out/
next-env.d.ts

# build
build/

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local
.env

# typescript
*.tsbuildinfo

# editors
.vscode/
.idea/
```

- [ ] **Step 1.2: Create `package.json`**

Write `Polymer-3/package.json`. Dev port pinned to 3100 per spec §3 so we can run side-by-side with the production viewer on :3000.

```json
{
  "name": "polymer-3",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3100",
    "build": "next build",
    "start": "next start -p 3100",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "16.1.6",
    "react": "19.2.3",
    "react-dom": "19.2.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 1.3: Create `tsconfig.json`**

Write `Polymer-3/tsconfig.json`. Matches the viewer's TypeScript setup so the port-back is mechanical:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 1.4: Create `next.config.ts`**

Write `Polymer-3/next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 1.5: Create `postcss.config.mjs`**

Write `Polymer-3/postcss.config.mjs`:

```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
```

- [ ] **Step 1.6: Create empty `public/` directory**

Run:
```bash
mkdir -p /Users/zbb2/Desktop/Polymer-3/public
touch /Users/zbb2/Desktop/Polymer-3/public/.gitkeep
```

- [ ] **Step 1.7: Install dependencies**

Run:
```bash
cd /Users/zbb2/Desktop/Polymer-3 && npm install
```
Expected: `node_modules/` created, no errors. Warnings about peer-deps for React 19 are acceptable.

- [ ] **Step 1.8: Commit scaffolding**

Run:
```bash
cd /Users/zbb2/Desktop/Polymer-3 && git add .gitignore package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs public/.gitkeep && git commit -m "Scaffold Polymer-3 sandbox (Next 16 + React 19 + Tailwind 4)"
```
Expected: 1 commit, ~7 files changed plus a large `package-lock.json`.

---

## Task 2: D2 design tokens (`src/config/theme.ts`)

**Files:**
- Create: `Polymer-3/src/config/theme.ts`

The single source of truth for every D2 visual decision. Mirrors the shape of `viewer/src/config/theme.ts` (same exported names — `COLOR`, `TYPE`, `WEIGHT`, `SPACE`, `COMPONENT`, `LAYOUT`, `BREAKPOINT`, `FONT_FAMILY`, `FONT_FAMILY_SANS`, `sp()` — so port-back is a value swap).

- [ ] **Step 2.1: Create `src/config/theme.ts`**

Write `Polymer-3/src/config/theme.ts`:

```ts
/**
 * Polymer-3 (sandbox) — D2 Design Token System
 *
 * Direction: IBM Carbon × Bloomberg Reference.
 * Light-gray canvas + electric blue + hairline rules + grotesque typography.
 *
 * Single source of truth for every visual decision.
 * Mirrors viewer/src/config/theme.ts shape so port-back is mechanical.
 */

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

// Sandbox uses Inter as a Diatype fallback (spec §4.2). When Diatype is
// licensed and added, this stack updates and everything else follows.
export const FONT_FAMILY_SANS =
  "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Mono is retained verbatim from the viewer — JetBrains Mono carries data,
// coordinates, and section markers (§01 / §02).
export const FONT_FAMILY_MONO =
  "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

// Body font is the grotesque sans. Mono is opt-in via FONT_FAMILY_MONO.
export const FONT_FAMILY = FONT_FAMILY_SANS;

// Type scale, anchored 14px body, ratio ~1.25 (spec §4.2).
export const TYPE = {
  xs:   { fontSize: 11, lineHeight: 1.45, letterSpacing: '0.04em' },
  sm:   { fontSize: 12, lineHeight: 1.5,  letterSpacing: '0.02em' },
  base: { fontSize: 14, lineHeight: 1.6,  letterSpacing: '0em' },
  md:   { fontSize: 17, lineHeight: 1.5,  letterSpacing: '-0.01em' },
  lg:   { fontSize: 22, lineHeight: 1.4,  letterSpacing: '-0.02em' },
  xl:   { fontSize: 30, lineHeight: 1.25, letterSpacing: '-0.025em' },
  '2xl':{ fontSize: 44, lineHeight: 1.15, letterSpacing: '-0.03em' },
  '3xl':{ fontSize: 64, lineHeight: 1.05, letterSpacing: '-0.035em' },
} as const;

export const WEIGHT = {
  normal: 400,
  medium: 500,
  bold:   700,
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------
// 4px base unit, unchanged from viewer.

const BASE = 4;
export function sp(n: number): number { return n * BASE; }

export const SPACE = {
  0:  0,
  1:  sp(1),   //  4
  2:  sp(2),   //  8
  3:  sp(3),   // 12
  4:  sp(4),   // 16
  5:  sp(5),   // 20
  6:  sp(6),   // 24
  8:  sp(8),   // 32
  10: sp(10),  // 40
  12: sp(12),  // 48
  16: sp(16),  // 64
  24: sp(24),  // 96
} as const;

// ---------------------------------------------------------------------------
// Color — D2 palette
// ---------------------------------------------------------------------------

export const COLOR = {
  // Backgrounds — light gray field per spec §4.1
  bg: {
    primary:  '#F4F4F5',  // canvas
    elevated: '#FAFAFA',  // cards / elevated panels
    track:    '#FAFAFA',  // alias for surfaces
    surface:  '#FAFAFA',
    deep:     '#EBEBED',  // recessed sections, alternating rows
  },

  // Borders — hairline-precise
  border: {
    subtle:  '#D4D4D8',   // 1px rules — "line container work"
    default: '#E4E4E7',   // standard divider
    strong:  '#A1A1AA',   // input borders, section breaks
    input:   '#A1A1AA',
  },

  // Text — accessible on #F4F4F5
  text: {
    primary:   '#18181B',  // body
    secondary: '#3F3F46',  // subheadings
    tertiary:  '#52525B',  // labels, eyebrow
    muted:     '#71717A',  // captions
    faint:     '#A1A1AA',  // hints, disabled
  },

  // Primary — electric blue (IBM Carbon Blue 60)
  primary: {
    base:   '#0F62FE',
    hover:  '#0043CE',
    active: '#002D9C',
  },

  // Accents — retuned for light-mode legibility (spec §4.1).
  // These replace the dark-mode neon palette. Kept under the same names so
  // domain literacy carries over.
  accent: {
    teal:   '#08A097',
    amber:  '#B45309',
    violet: '#7C3AED',
    rose:   '#BE123C',
    blue:   '#0F62FE',  // alias for primary
  },

  // Layer-identity colors — kept verbatim from viewer (spec §4.1).
  // These encode biological convention (e.g. GENCODE blue, H3K4me3 red) and
  // changing them would break domain literacy.
  layer: {
    gencode_v44:      '#3b82f6',
    cpg_sites:        '#08A097',
    probe_epic_v2:    '#B45309',
    isochores:        '#7C3AED',
    methylation_atlas:'#BE123C',
    gene_costs_v1:    '#10b981',
    histone_peaks_encode_v1: '#dc2626',
    gwas_catalog_ebi_v1:    '#a21caf',
  },
} as const;

// ---------------------------------------------------------------------------
// Component primitives — D2 (spec §5)
// ---------------------------------------------------------------------------

export const COMPONENT = {
  button: {
    primary: {
      backgroundColor: COLOR.primary.base,
      color: '#FFFFFF',
      border: 'none',
      borderRadius: 2,
      padding: `${sp(2)}px ${sp(4)}px`,
      fontSize: TYPE.base.fontSize,
      fontFamily: FONT_FAMILY,
      fontWeight: WEIGHT.medium,
      cursor: 'pointer',
      transition: 'background-color 0.15s',
    } as React.CSSProperties,
    secondary: {
      backgroundColor: COLOR.bg.elevated,
      color: COLOR.primary.base,
      border: `1px solid ${COLOR.border.strong}`,
      borderRadius: 2,
      padding: `${sp(2)}px ${sp(4)}px`,
      fontSize: TYPE.base.fontSize,
      fontFamily: FONT_FAMILY,
      fontWeight: WEIGHT.medium,
      cursor: 'pointer',
      transition: 'border-color 0.15s, color 0.15s',
    } as React.CSSProperties,
    ghost: {
      backgroundColor: 'transparent',
      color: COLOR.primary.base,
      border: 'none',
      padding: `${sp(2)}px ${sp(2)}px`,
      fontSize: TYPE.base.fontSize,
      fontFamily: FONT_FAMILY,
      fontWeight: WEIGHT.medium,
      cursor: 'pointer',
      textDecoration: 'none',
    } as React.CSSProperties,
    small: {
      backgroundColor: 'transparent',
      color: COLOR.text.secondary,
      border: `1px solid ${COLOR.border.strong}`,
      borderRadius: 2,
      padding: `${sp(1) + 1}px ${sp(2) + 2}px`,
      fontSize: TYPE.sm.fontSize,
      fontFamily: FONT_FAMILY,
      cursor: 'pointer',
      textDecoration: 'none',
      transition: 'border-color 0.15s, color 0.15s',
    } as React.CSSProperties,
  },

  input: {
    default: {
      backgroundColor: '#FFFFFF',
      color: COLOR.text.primary,
      border: `1px solid ${COLOR.border.strong}`,
      borderRadius: 2,
      padding: `${sp(1) + 1}px ${sp(3)}px`,
      fontSize: TYPE.sm.fontSize,
      fontFamily: FONT_FAMILY,
      outline: 'none',
      transition: 'border-color 0.15s',
    } as React.CSSProperties,
  },

  sectionMarker: {
    color: COLOR.text.tertiary,
    fontSize: TYPE.sm.fontSize,
    fontFamily: FONT_FAMILY_MONO,
    fontWeight: WEIGHT.medium,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  panel: {
    default: {
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 4,
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Layout (spec §4.4)
// ---------------------------------------------------------------------------

export const LAYOUT = {
  headerHeight: 56,
  ideogramHeight: 32,
  sidebarWidth: 220,
  contextPanelWidth: 180,
  docsSidebarWidth: 240,
  maxContentWidth: 1440,
  gridGutter: 24,
} as const;

// ---------------------------------------------------------------------------
// Breakpoints
// ---------------------------------------------------------------------------

export const BREAKPOINT = { mobile: 640, tablet: 1024 } as const;
```

- [ ] **Step 2.2: Verify TypeScript compiles**

Run:
```bash
cd /Users/zbb2/Desktop/Polymer-3 && npx tsc --noEmit
```
Expected: no output (clean compile). If it errors on `next-env.d.ts`, that's expected — it doesn't exist yet. Add `--skipLibCheck` is already in `tsconfig.json`; the first build (Task 4) will generate `next-env.d.ts`.

If errors: read them carefully and fix. The token file is pure TypeScript — there should be no Next-specific errors.

- [ ] **Step 2.3: Commit tokens**

```bash
cd /Users/zbb2/Desktop/Polymer-3 && git add src/config/theme.ts && git commit -m "Add D2 design token system (theme.ts)"
```

---

## Task 3: Global stylesheet (`src/app/globals.css`)

**Files:**
- Create: `Polymer-3/src/app/globals.css`

Light-mode reset, Tailwind 4 import, CSS variables matching `theme.ts`, no neon, hairline scrollbars, focus-visible electric blue.

- [ ] **Step 3.1: Create `src/app/globals.css`**

Write `Polymer-3/src/app/globals.css`:

```css
@import "tailwindcss";

/* ──────────────────────────────────────────────────────────────────
   D2 design tokens as CSS variables.
   Mirror src/config/theme.ts. TypeScript imports COLOR/TYPE/SPACE
   directly; CSS uses these variables for global rules.
   ────────────────────────────────────────────────────────────────── */
:root {
  --bg-primary:    #F4F4F5;
  --bg-elevated:   #FAFAFA;
  --bg-deep:       #EBEBED;

  --border-subtle:  #D4D4D8;
  --border-default: #E4E4E7;
  --border-strong:  #A1A1AA;

  --text-primary:   #18181B;
  --text-secondary: #3F3F46;
  --text-tertiary:  #52525B;
  --text-muted:     #71717A;
  --text-faint:     #A1A1AA;

  --primary:        #0F62FE;
  --primary-hover:  #0043CE;
  --primary-active: #002D9C;

  --font-sans:
    'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text',
    'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-mono:
    'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
}

/* ──────────────────────────────────────────────────────────────────
   Base reset — light mode, grotesque sans, no neon, no hard-corner
   global override. Components opt in to specific radii via theme.ts.
   ────────────────────────────────────────────────────────────────── */
html, body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  margin: 0;
  min-height: 100vh;
}

/* Tabular numerics for any element that opts in. Used by tables, stats
   strips, and any column where digit alignment matters. */
.tabular { font-variant-numeric: tabular-nums; }

/* Mono register — opt-in class for data, coordinates, section markers. */
.mono { font-family: var(--font-mono); }

/* Section marker — used between editorial sections (§01 — INTRODUCTION) */
.section-marker {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

/* ──────────────────────────────────────────────────────────────────
   Focus — 2px solid electric blue outline, no glow.
   ────────────────────────────────────────────────────────────────── */
*:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
*:focus:not(:focus-visible) {
  outline: none;
}

/* ──────────────────────────────────────────────────────────────────
   Scrollbars — hairline, neutral, matches the light palette.
   ────────────────────────────────────────────────────────────────── */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: var(--bg-primary);
}
::-webkit-scrollbar-thumb {
  background: var(--border-default);
}
::-webkit-scrollbar-thumb:hover {
  background: var(--border-strong);
}

/* ──────────────────────────────────────────────────────────────────
   Selection — electric blue with slight transparency.
   ────────────────────────────────────────────────────────────────── */
::selection {
  background-color: rgba(15, 98, 254, 0.18);
  color: var(--text-primary);
}
```

- [ ] **Step 3.2: Commit globals**

```bash
cd /Users/zbb2/Desktop/Polymer-3 && git add src/app/globals.css && git commit -m "Add globals.css — light-mode D2 base styles"
```

---

## Task 4: Root layout (`src/app/layout.tsx`)

**Files:**
- Create: `Polymer-3/src/app/layout.tsx`

- [ ] **Step 4.1: Create `src/app/layout.tsx`**

Write `Polymer-3/src/app/layout.tsx`. Uses `next/font/google` for Inter + JetBrains Mono so they are preloaded with proper subsetting:

```tsx
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'Polymer Genomics — Genome-wide DNA biophysics',
  description:
    'The material channel of the genome — stacking energy, curvature, flexibility, groove geometry — computed at base-pair resolution across 50 genomic layers. REST API and MCP tools for AI agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4.2: Add a placeholder page so dev server boots**

Until Task 7 ships the real landing, create a one-line `page.tsx` so the route resolves. Write `Polymer-3/src/app/page.tsx`:

```tsx
export default function Home() {
  return <main style={{ padding: 32 }}>Polymer-3 sandbox · Tier 0 build in progress</main>;
}
```

This gets overwritten in Task 7.

- [ ] **Step 4.3: Run the dev server**

Run in a new terminal (or background):
```bash
cd /Users/zbb2/Desktop/Polymer-3 && npm run dev
```
Expected: server starts on `http://localhost:3100`. No build errors. Browser shows the placeholder text in plain Inter on a light-gray background. If the background isn't light-gray, the globals.css `--bg-primary` wiring is wrong — fix before continuing.

- [ ] **Step 4.4: Stop dev server. Commit.**

```bash
cd /Users/zbb2/Desktop/Polymer-3 && git add src/app/layout.tsx src/app/page.tsx && git commit -m "Add root layout (Inter + JetBrains Mono via next/font) and placeholder landing"
```

---

## Task 5: BrandBar component (`src/components/BrandBar.tsx`)

**Files:**
- Create: `Polymer-3/src/components/BrandBar.tsx`

Top navigation. Hairline `#D4D4D8` border-bottom. Electric-blue wordmark on the left. Nav links + a primary "Viewer" CTA on the right. Light-mode equivalent of `viewer/src/components/BrandBar.tsx`, but with the new design language. Mobile responsive handling is deferred — desktop-first for Tier 0.

- [ ] **Step 5.1: Create `src/components/BrandBar.tsx`**

Write `Polymer-3/src/components/BrandBar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, TYPE, WEIGHT, SPACE, LAYOUT } from '@/config/theme';

interface BrandBarProps {
  subtitle?: React.ReactNode;
  sticky?: boolean;
}

const VIEWER_HREF =
  '/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites,probe_epic_v2,isochores';

export function BrandBar({ subtitle, sticky }: BrandBarProps) {
  return (
    <div style={{
      height: LAYOUT.headerHeight,
      backgroundColor: COLOR.bg.primary,
      display: 'flex',
      alignItems: 'center',
      paddingLeft: SPACE[6],
      paddingRight: SPACE[6],
      borderBottom: `1px solid ${COLOR.border.subtle}`,
      flexShrink: 0,
      ...(sticky ? { position: 'sticky' as const, top: 0, zIndex: 100 } : {}),
    }}>
      {/* Wordmark — electric blue, mono caps, the dream-vision title */}
      <Link href="/" style={{
        color: COLOR.primary.base,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: 15,
        fontWeight: WEIGHT.bold,
        letterSpacing: '0.12em',
        textDecoration: 'none',
        flexShrink: 0,
      }}>
        POLYMER GENOMICS
      </Link>

      {subtitle && (
        <>
          <div style={{
            width: 1,
            height: 20,
            backgroundColor: COLOR.border.strong,
            flexShrink: 0,
            marginLeft: SPACE[4],
            marginRight: SPACE[4],
          }} />
          {typeof subtitle === 'string' ? (
            <span style={{
              color: COLOR.text.tertiary,
              fontSize: TYPE.base.fontSize,
              fontFamily: FONT_FAMILY,
              letterSpacing: '0.01em',
            }}>
              {subtitle}
            </span>
          ) : subtitle}
        </>
      )}

      {/* Nav cluster */}
      <nav style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[5],
      }}>
        <NavLink href="/atlas">Atlas</NavLink>
        <NavLink href="/newsroom">Newsroom</NavLink>
        <NavLink href="/docs">Docs</NavLink>
        <NavLink href="/developers">Developers</NavLink>

        <Link
          href={VIEWER_HREF}
          style={{
            backgroundColor: COLOR.primary.base,
            color: '#FFFFFF',
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.01em',
            textDecoration: 'none',
            padding: `${SPACE[2]}px ${SPACE[4]}px`,
            borderRadius: 2,
            whiteSpace: 'nowrap',
          }}
        >
          Open viewer →
        </Link>
      </nav>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        color: COLOR.text.secondary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.sm.fontSize,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.01em',
        textDecoration: 'none',
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.primary.base; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.text.secondary; }}
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 5.2: Commit BrandBar**

```bash
cd /Users/zbb2/Desktop/Polymer-3 && git add src/components/BrandBar.tsx && git commit -m "Add BrandBar — electric-blue wordmark, hairline border, light-mode nav"
```

---

## Task 6: Footer component (`src/components/Footer.tsx`)

**Files:**
- Create: `Polymer-3/src/components/Footer.tsx`

Hairline-bordered footer with link cluster on the left, RUO + copyright on the right. Light-mode version of viewer's footer.

- [ ] **Step 6.1: Create `src/components/Footer.tsx`**

Write `Polymer-3/src/components/Footer.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, TYPE, SPACE } from '@/config/theme';

const VIEWER_HREF =
  '/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites,probe_epic_v2,isochores';

const Dot = () => (
  <span aria-hidden style={{ color: COLOR.border.strong, fontSize: 12, lineHeight: 1 }}>·</span>
);

const linkStyle: React.CSSProperties = {
  color: COLOR.text.tertiary,
  fontSize: TYPE.sm.fontSize,
  fontFamily: FONT_FAMILY,
  textDecoration: 'none',
  letterSpacing: '0.01em',
  transition: 'color 0.15s',
};

function FootLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={linkStyle}
      onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.primary.base; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.text.tertiary; }}
    >
      {children}
    </Link>
  );
}

export function Footer() {
  return (
    <footer style={{
      flexShrink: 0,
      backgroundColor: COLOR.bg.primary,
      borderTop: `1px solid ${COLOR.border.subtle}`,
      padding: `${SPACE[4]}px ${SPACE[6]}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: SPACE[3],
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
        <FootLink href={VIEWER_HREF}>Viewer</FootLink>
        <Dot />
        <FootLink href="/atlas">Atlas</FootLink>
        <Dot />
        <FootLink href="/newsroom">Newsroom</FootLink>
        <Dot />
        <FootLink href="/docs">Docs</FootLink>
        <Dot />
        <FootLink href="/developers">Developers</FootLink>
        <Dot />
        <FootLink href="/data-sources">Data sources</FootLink>
        <Dot />
        <FootLink href="/terms">Terms</FootLink>
        <Dot />
        <FootLink href="/privacy">Privacy</FootLink>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
        <Link
          href="/terms"
          style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY_MONO,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            borderBottom: `1px dotted ${COLOR.text.faint}`,
          }}
          title="Not for clinical or diagnostic use. Data provided as-is without warranty. Not intended as a substitute for professional medical advice, diagnosis, or treatment."
        >
          Research use only
        </Link>
        <Dot />
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY_MONO,
          letterSpacing: '0.04em',
        }}>
          © 2026 Polymer Genomics
        </span>
      </div>
    </footer>
  );
}
```

- [ ] **Step 6.2: Commit Footer**

```bash
cd /Users/zbb2/Desktop/Polymer-3 && git add src/components/Footer.tsx && git commit -m "Add Footer — hairline border, mono RUO badge, light-mode link cluster"
```

---

## Task 7: Landing page (`src/app/page.tsx`)

**Files:**
- Create (overwrites placeholder from Task 4.2): `Polymer-3/src/app/page.tsx`

Tier 0 landing scope:
- Hero: eyebrow + electric-blue wordmark (display) + tagline + primary/secondary CTAs + quiet stats strip in mono
- Module index: three groups (Browse / Analyze / Build) as hairline-rule rows with accent dot + name + description + count
- Footer (imported)

Deferred to later tiers:
- HeroViz SVG (Tier 2 — needs `useViewportData` etc.)
- Latest Dispatches feed (Tier 1 — depends on `claims.ts`)
- Thesis section (Tier 1 — content polish)
- `usePlatformStats` live hook (Tier 1 or 2 — needs API wiring)

- [ ] **Step 7.1: Replace `src/app/page.tsx`**

Overwrite `Polymer-3/src/app/page.tsx`:

```tsx
import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import {
  COLOR, FONT_FAMILY, FONT_FAMILY_MONO, TYPE, WEIGHT, SPACE, LAYOUT,
} from '@/config/theme';

/* ────────────────────────────────────────────────────────────────────────
   Module data — static for Tier 0. Mirrors the viewer's landing IA.
   Counts are pinned to spec-stated values (50 layers, 70 MCP tools, etc.)
   ──────────────────────────────────────────────────────────────────────── */

const VIEWER_HREF =
  '/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites,probe_epic_v2,isochores';

interface Module {
  name: string;
  desc: string;
  href: string;
  accent: string;
  count?: string;
}

const MODULES_BROWSE: Module[] = [
  {
    name: 'Genome viewer',
    desc: 'Browse any locus with biophysics layers — stacking energy, curvature, CpG density, isochores. hg38 + hg37.',
    href: VIEWER_HREF,
    accent: COLOR.accent.teal,
    count: '50 layers',
  },
  {
    name: 'Atlas',
    desc: 'GENCODE v44 gene profiles with expression, pathways, constraint, biosynthetic cost.',
    href: '/atlas',
    accent: COLOR.layer.gencode_v44,
    count: '63K txs',
  },
];

const MODULES_ANALYZE: Module[] = [
  {
    name: 'Evaluate',
    desc: 'Physics linter for any DNA sequence. Thermodynamic profile, CpG islands, structural flags, batch mode.',
    href: '/evaluate',
    accent: COLOR.layer.gene_costs_v1,
    count: '13 flags',
  },
  {
    name: 'Methylation',
    desc: 'DMP volcano and Manhattan plots, TE/ERV family scoring, reactivation risk, Retro-Age clock.',
    href: '/dmp',
    accent: COLOR.accent.rose,
    count: '937K probes',
  },
  {
    name: 'Epigenetic clocks',
    desc: 'Probe anatomy, cross-clock comparison, coefficient application.',
    href: '/clocks',
    accent: COLOR.accent.amber,
    count: '6 clocks',
  },
  {
    name: 'Transposome',
    desc: 'Transposable elements with TE age, awakening potential, EPIC v2 probe overlap.',
    href: '/transposome',
    accent: COLOR.accent.violet,
    count: '5.6M TEs',
  },
  {
    name: 'HLA',
    desc: 'Allele biophysics for transplant loci. Non-coding divergence, expression mismatch scoring.',
    href: '/hla',
    accent: COLOR.layer.gencode_v44,
    count: '6 loci',
  },
];

const MODULES_BUILD: Module[] = [
  {
    name: 'API & MCP',
    desc: 'REST endpoints and Model Context Protocol for AI agents. Reference + compute tools, evidence-class metadata.',
    href: '/docs',
    accent: COLOR.primary.base,
    count: '70 tools',
  },
  {
    name: 'Developers',
    desc: 'Quickstart, code examples, try-it evaluator, data inventory. Python SDK on PyPI.',
    href: '/developers',
    accent: COLOR.primary.base,
    count: 'pip install',
  },
];

const STATS = [
  { value: '50',    label: 'layers' },
  { value: '29.4M', label: 'CpG sites' },
  { value: '937K',  label: 'probes' },
  { value: '63K',   label: 'transcripts' },
  { value: '70',    label: 'MCP tools' },
];

/* ────────────────────────────────────────────────────────────────────────
   Primitives
   ──────────────────────────────────────────────────────────────────────── */

function ModuleRow({ mod }: { mod: Module }) {
  return (
    <Link
      href={mod.href}
      className="module-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '14px 180px 1fr auto 20px',
        columnGap: SPACE[5],
        alignItems: 'baseline',
        padding: `${SPACE[4]}px ${SPACE[2]}px`,
        borderBottom: `1px solid ${COLOR.border.default}`,
        textDecoration: 'none',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          backgroundColor: mod.accent,
          borderRadius: 2,
          alignSelf: 'center',
          justifySelf: 'center',
        }}
      />
      <span style={{
        color: COLOR.text.primary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.md.fontSize,
        fontWeight: WEIGHT.medium,
        letterSpacing: TYPE.md.letterSpacing,
      }}>
        {mod.name}
      </span>
      <span style={{
        color: COLOR.text.secondary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.base.fontSize,
        lineHeight: TYPE.base.lineHeight,
      }}>
        {mod.desc}
      </span>
      <span className="tabular" style={{
        color: COLOR.text.tertiary,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: TYPE.xs.fontSize,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        justifySelf: 'end',
      }}>
        {mod.count ?? ''}
      </span>
      <span aria-hidden style={{
        color: COLOR.text.faint,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.base.fontSize,
        justifySelf: 'end',
        alignSelf: 'center',
      }}>
        →
      </span>
    </Link>
  );
}

function ModuleGroup({ index, label, modules }: { index: string; label: string; modules: Module[] }) {
  return (
    <div style={{ marginBottom: SPACE[12] }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: SPACE[4],
        paddingBottom: SPACE[3],
        marginBottom: SPACE[2],
        borderBottom: `1px solid ${COLOR.border.strong}`,
      }}>
        <span style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          letterSpacing: '0.1em',
        }}>
          §{index}
        </span>
        <span style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>
      <div>
        {modules.map((m) => <ModuleRow key={m.name} mod={m} />)}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <main style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh' }}>
      <BrandBar sticky />

      {/* HERO */}
      <section style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: `${SPACE[24]}px ${SPACE[6]}px ${SPACE[16]}px`,
      }}>
        {/* Eyebrow */}
        <div style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: SPACE[6],
        }}>
          Genome-wide DNA biophysics &nbsp;·&nbsp; hg38 + hg37
        </div>

        {/* Electric-blue display wordmark */}
        <h1 style={{
          margin: 0,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE['2xl'].fontSize,
          lineHeight: TYPE['2xl'].lineHeight,
          letterSpacing: TYPE['2xl'].letterSpacing,
          fontWeight: WEIGHT.bold,
          color: COLOR.primary.base,
          marginBottom: SPACE[5],
        }}>
          Polymer Genomics
        </h1>

        {/* Tagline */}
        <p style={{
          margin: 0,
          maxWidth: 640,
          color: COLOR.text.secondary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.md.fontSize,
          lineHeight: 1.55,
          letterSpacing: TYPE.md.letterSpacing,
          marginBottom: SPACE[10],
          fontWeight: WEIGHT.normal,
        }}>
          The material channel of the genome — stacking energy, curvature, flexibility,
          groove geometry — computed at base-pair resolution and cross-indexed with{' '}
          <span style={{ color: COLOR.text.primary, fontWeight: WEIGHT.medium }}>
            50 genomic layers
          </span>. Queryable by humans and by agents.
        </p>

        {/* CTAs */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: SPACE[3],
          alignItems: 'center',
          marginBottom: SPACE[12],
        }}>
          <Link
            href={VIEWER_HREF}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACE[2],
              backgroundColor: COLOR.primary.base,
              color: '#FFFFFF',
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.base.fontSize,
              fontWeight: WEIGHT.medium,
              textDecoration: 'none',
              padding: `${SPACE[3]}px ${SPACE[5]}px`,
              borderRadius: 2,
              letterSpacing: '0.01em',
            }}
          >
            Open the viewer <span aria-hidden>→</span>
          </Link>
          <Link
            href="/evaluate"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACE[2],
              backgroundColor: COLOR.bg.elevated,
              color: COLOR.primary.base,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.base.fontSize,
              fontWeight: WEIGHT.medium,
              textDecoration: 'none',
              padding: `${SPACE[3]}px ${SPACE[5]}px`,
              borderRadius: 2,
              border: `1px solid ${COLOR.border.strong}`,
              letterSpacing: '0.01em',
            }}
          >
            Evaluate a sequence
          </Link>
          <Link
            href="/docs"
            style={{
              color: COLOR.primary.base,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.base.fontSize,
              fontWeight: WEIGHT.medium,
              textDecoration: 'none',
              padding: `${SPACE[3]}px ${SPACE[2]}px`,
              letterSpacing: '0.01em',
            }}
          >
            API &amp; MCP for agents <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Quiet stats strip — mono, tabular, hairline-divided */}
        <div className="tabular" style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: SPACE[6],
          paddingTop: SPACE[4],
          borderTop: `1px solid ${COLOR.border.subtle}`,
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          letterSpacing: '0.02em',
        }}>
          {STATS.map((s, i) => (
            <span key={s.label} style={{ display: 'inline-flex', alignItems: 'baseline', gap: SPACE[2] }}>
              {i > 0 && <span aria-hidden style={{ color: COLOR.border.strong, marginRight: SPACE[4] }}>·</span>}
              <span style={{ color: COLOR.text.primary, fontWeight: WEIGHT.medium }}>{s.value}</span>
              <span style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: TYPE.xs.fontSize }}>
                {s.label}
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* MODULES */}
      <section style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: `${SPACE[12]}px ${SPACE[6]}px ${SPACE[16]}px`,
      }}>
        <ModuleGroup index="01" label="Browse"  modules={MODULES_BROWSE} />
        <ModuleGroup index="02" label="Analyze" modules={MODULES_ANALYZE} />
        <ModuleGroup index="03" label="Build"   modules={MODULES_BUILD} />
      </section>

      <Footer />
    </main>
  );
}
```

- [ ] **Step 7.2: Run dev server and eyeball at `localhost:3100`**

Run:
```bash
cd /Users/zbb2/Desktop/Polymer-3 && npm run dev
```

In a browser, open `http://localhost:3100`. Visual checklist (this is the Tier 0 acceptance bar):

- Background reads as soft light gray, not pure white.
- Wordmark "Polymer Genomics" renders in vivid electric blue (`#0F62FE`), large and tightly tracked.
- BrandBar wordmark at top-left is mono caps in the same electric blue.
- Hero tagline reads cleanly in Inter, secondary gray.
- Stats strip below CTAs uses mono, tabular numerals, hairline top border.
- Module rows separated by hairline rules. Each row has a small colored square (the data-accent dot), the module name in Inter, a description, a mono count on the right, and an arrow.
- Footer has a hairline top border, links in muted gray, "Research use only" in mono caps on the right.
- No black `#0A0A0A` surfaces anywhere. No neon teal/violet glow. No `border-radius: 0` hard-edge feel — corners are 2px-soft.

If any of these fail, fix before committing. Common fixes:
- Wordmark not blue → check `COLOR.primary.base` import in `page.tsx`.
- Background pure white → check `globals.css` `--bg-primary` and the `html, body { background-color: var(--bg-primary); }` rule.
- Fonts look wrong → confirm `next/font/google` Inter + JetBrains Mono are wired in `layout.tsx` and the `inter.variable`/`jetbrainsMono.variable` are applied on `<html>`.

- [ ] **Step 7.3: Stop dev server. Commit landing.**

```bash
cd /Users/zbb2/Desktop/Polymer-3 && git add src/app/page.tsx && git commit -m "Add Tier 0 landing — hero + module index in D2 design language"
```

---

## Task 8: Validation pass + README

**Files:**
- Create: `Polymer-3/README.md`

- [ ] **Step 8.1: Run `npm run typecheck`**

```bash
cd /Users/zbb2/Desktop/Polymer-3 && npm run typecheck
```
Expected: no errors. If there are errors, read and fix them. Common ones:
- Missing import → add it
- `React.CSSProperties` issue → ensure you're inside a `.tsx` file and React types are installed

- [ ] **Step 8.2: Run `npm run build`**

```bash
cd /Users/zbb2/Desktop/Polymer-3 && npm run build
```
Expected: clean production build. Output includes the `/` route as static. If errors:
- Server/client component boundary issues (`'use client'` directives) — `BrandBar` and `Footer` are correctly marked
- Font loading errors — check internet access; `next/font/google` fetches at build time

- [ ] **Step 8.3: Create `README.md`**

Write `Polymer-3/README.md`:

```markdown
# Polymer-3 — Viewer redesign sandbox

Sandbox for the investor-grade redesign of the Polymer Genomics viewer.
**Localhost only — never deployed.**

- **Spec:** `docs/specs/2026-05-19-viewer-redesign-design.md`
- **Plans:** `docs/plans/`
- **Design direction:** D2 — IBM Carbon × Bloomberg Reference (light mode, electric blue, hairline-precise grotesque)
- **Stack:** Next.js 16 + React 19 + Tailwind 4 + TypeScript (matches `PolymerGenomicsAPI/viewer/`)

## Commands

```bash
npm run dev        # http://localhost:3100  (paired with viewer on :3000 for side-by-side eyeball)
npm run build      # production build (validation only — never deployed)
npm run typecheck  # tsc --noEmit
```

## Tier status

- [x] Tier 0 — foundation (layout, globals, tokens, BrandBar, Footer, landing)
- [ ] Tier 1 — pitch surface (`/docs`, `/developers`, `/newsroom`, `/data-sources`, `/atlas`)
- [ ] Tier 2 — working tools (`/view`, `/evaluate`, `/dmp`, `/clocks`, `/hla`, `/transposome`, `/te-methylation`)
- [ ] Tier 3 — portal & dev (`/portal/*`, `/dev/claim/*`)

When a tier reads investor-grade in the sandbox and is explicitly approved, port the
modified files to `PolymerGenomicsAPI/viewer/` and update `viewer/src/config/theme.ts`
with the new token values.
```

- [ ] **Step 8.4: Final commit**

```bash
cd /Users/zbb2/Desktop/Polymer-3 && git add README.md && git commit -m "Add Polymer-3 README — sandbox usage and tier status"
```

- [ ] **Step 8.5: Show final state**

```bash
cd /Users/zbb2/Desktop/Polymer-3 && git log --oneline && echo "---" && ls -la src/
```

---

## Self-Review

**Spec coverage check** (mapping spec → tasks):

- Spec §3 (sandbox architecture) → Task 1 (scaffold + deps), Task 4.2 (port 3100 pinned)
- Spec §4.1 (color tokens) → Task 2 (theme.ts), Task 3 (globals.css variables)
- Spec §4.2 (typography) → Task 2 (TYPE scale, FONT_FAMILY_SANS, FONT_FAMILY_MONO), Task 4 (next/font/google Inter + JetBrains Mono)
- Spec §4.3 (4px spacing) → Task 2 (SPACE)
- Spec §4.4 (layout constants) → Task 2 (LAYOUT)
- Spec §5 (component primitives, kill border-radius reset, button/input/section-marker primitives) → Task 2 (COMPONENT), Task 3 (globals.css with no global radius reset), Task 5/6/7 (buttons use 2px radius via theme)
- Spec §6 Tier 0 file list → Tasks 3/4/5/6/7 (all six files created)
- Spec §7 (no deploy, no Vercel) → Task 1 omits Vercel config; Task 8 builds locally only
- Spec §8 (visual eyeball testing, no unit tests) → Task 7.2 eyeball checklist; Task 8.1/8.2 typecheck + build as validation

All Tier 0 spec requirements have at least one task implementing them.

**Placeholder scan:** None. Every step shows the actual code or command an engineer needs.

**Type consistency:** `COLOR`, `FONT_FAMILY`, `FONT_FAMILY_MONO`, `TYPE`, `WEIGHT`, `SPACE`, `LAYOUT` exported from `theme.ts` in Task 2 are imported by exactly those names in `BrandBar` (Task 5), `Footer` (Task 6), and `page.tsx` (Task 7). `VIEWER_HREF` defined locally in `BrandBar`, `Footer`, and `page.tsx` is the same literal in all three — acceptable duplication for Tier 0; can be hoisted to a `src/config/routes.ts` in Tier 1 if it grows.

**Out-of-scope** (deferred to later tiers, intentionally):
- `HeroViz` SVG (Tier 2)
- `LatestDispatches` claim feed (Tier 1)
- Thesis section (Tier 1)
- `usePlatformStats` live hook — Tier 0 uses static numbers per spec §8 testing approach (no backend wiring)
- Mobile-specific tuning — Tier 0 is desktop-first (1440-wide viewport assumed); responsive tuning happens per-tier during port-back per spec §10
