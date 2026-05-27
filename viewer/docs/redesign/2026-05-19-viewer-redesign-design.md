# Polymer Viewer Redesign — Design Spec

**Date:** 2026-05-19
**Sandbox:** `~/Desktop/Polymer-3/`
**Production:** `~/Desktop/PolymerGenomicsAPI/viewer/` (live at polymerbio.org)
**Status:** Approved direction, pre-implementation

---

## 1. Brief

The current viewer is functionally excellent (50 data layers, 26 routes, real product depth) but its aesthetic — pure-black `#0A0A0A` background, JetBrains Mono globally, `border-radius: 0 !important`, four neon accents — reads as cyberpunk-dashboard. External viewers describe a "lingering toy" quality. For the next tier of professional standing (investor due-diligence, BD conversations, pharma partnerships, NAR submission), we need to evolve the visual language to **investor-grade, publication-grade, instrument-grade**.

Substance is kept entirely: all 50 data layers, all 26 routes, all features, all data wiring. This is an aesthetic redesign, not a product redesign.

The redesign is built and iterated in `Polymer-3/` as a sandbox. When a tier reads "investor-grade" it ports back to `viewer/`. The sandbox is localhost-only — no Vercel, no deploy, no public URL.

---

## 2. Direction: D2 — "IBM Carbon × Bloomberg Reference"

Light mode. Light-gray canvas. Electric blue as the singular accent. Hairline-precise editorial structure. Single grotesque typography family across display and body. JetBrains Mono retained as the *interesting* typographic register for data and coordinates. No serifs. No neon. No glow. Color is information density, not decoration.

The mood reference points are IBM Carbon design system, Bloomberg Terminal reference materials, Linear's light-mode marketing, Anthropic's documentation, Stripe Docs.

The design language was chosen because the dream-vision the user described — "electric bright blue title lettering, very tasteful very light gray background, ultra exact line container work, publication-grade font and formatting" — maps almost note-for-note to IBM Carbon's enterprise design language. Carbon was literally designed around `#0F62FE` (its "Blue 60") on a near-white grid for serious software.

Three directions were considered:

1. **Editorial Serif × Swiss Precision** (Nature × Stripe Docs) — Tiempos/GT Sectra display + grotesque body. Strongest publication gravitas but serif-display-on-software-product risks drifting into consulting-deck territory.
2. **IBM Carbon × Bloomberg Reference** — Pure grotesque, no serifs. Publication weight comes from grid + hairline rules + typographic discipline. **Chosen.**
3. **Modern Editorial Hybrid** (Apple Newsroom × FT Alphaville) — Selective serif moments. Most flexible but hardest to keep coherent across 26 routes.

D2 was chosen because:
- Maps directly onto the user's vision.
- Grotesque-only avoids serif-pivot risk for what remains a software product.
- Pairs naturally with JetBrains Mono retained for data, making the mono the typographic interest against a neutral grotesque rather than a fight between two body fonts.
- Carbon-derived discipline scales coherently across the data-heavy tool routes (`/view`, `/dmp`, `/portal/latent3d`).

---

## 3. Sandbox Architecture

`~/Desktop/Polymer-3/` is a fresh scaffold:

- Next.js 16, React 19, Tailwind 4, TypeScript — stack matches `viewer/` exactly so port-back is mechanical, not a framework migration.
- No backend wiring this round. Page-shape and component-shape only. Static fixtures where data is needed.
- Initial dep set excludes `@react-three/*`, `three`, `@xyflow/react`, `dagre`. Add only when redesigning routes that use them (Tier 2/3).
- Design token system mirrors the shape of `viewer/src/config/theme.ts` (`COLOR`, `TYPE`, `WEIGHT`, `SPACE`, `COMPONENT`, `LAYOUT`). Port-back is value swap + small component delta, not a rewrite.
- Routes mirror the viewer's route names so side-by-side comparison is direct.
- Sandbox dev server runs on `:3100`; production viewer dev server runs on `:3000`. The investor-grade eyeball check is `localhost:3100` vs `localhost:3000` in adjacent browser tabs.

---

## 4. Design Tokens

### 4.1 Color

```
Canvas         #F4F4F5     primary background
Surface        #FAFAFA     cards, elevated panels
Surface deep   #EBEBED     recessed sections, alternating rows

Hairline       #D4D4D8     1px rules — the "line container work"
Border default #E4E4E7     standard divider
Border strong  #A1A1AA     input borders, section breaks

Text primary   #18181B     body
Text secondary #3F3F46     subheadings
Text tertiary  #52525B     labels, eyebrow text
Text faint     #A1A1AA     hints, captions, disabled

Primary        #0F62FE     titles, primary CTA, links, focus, key data
Primary hover  #0043CE
Primary active #002D9C

Data accents (retuned for light-mode legibility — kept from current palette):
  Teal         #08A097
  Amber        #B45309
  Violet       #7C3AED
  Rose         #BE123C
```

Layer-identity colors from the existing `COLOR.layer` and `COLOR.histone` dictionaries are retained verbatim — they encode biological convention (e.g., H3K4me3 = red, GENCODE blue), and changing them would break domain literacy. The retuning above applies only to the four signature *accent* colors, which served decoration in the dark theme and now serve data identity in light mode.

### 4.2 Typography

**Stack:**
- Display + Body: **ABC Diatype** (Dinamo, paid). For sandbox dev: **Inter** as fallback. Diatype licensing is a decision flagged for port-back, not a blocker for sandbox work.
- Mono: **JetBrains Mono** (kept from current stack).
- **No serif anywhere in D2.**

**Scale** (anchored 14px body, ratio ~1.25):

```
xs    11px / 1.45  +0.04em      sm    12px / 1.5   +0.02em
base  14px / 1.6    0           md    17px / 1.5   -0.01em
lg    22px / 1.4   -0.02em      xl    30px / 1.25  -0.025em
2xl   44px / 1.15  -0.03em      3xl   64px / 1.05  -0.035em   (hero only)
```

**Weights:** 400 / 500 / 700.

**Tracking discipline:** display sizes track negative; UI sizes track 0; eyebrow / section-marker mono tracks +0.08em uppercase.

### 4.3 Spacing

4px base unit, retained from `viewer/src/config/theme.ts`:

```
SPACE.0  = 0      SPACE.1  = 4    SPACE.2  = 8    SPACE.3  = 12
SPACE.4  = 16     SPACE.5  = 20   SPACE.6  = 24   SPACE.8  = 32
SPACE.10 = 40     SPACE.12 = 48   SPACE.16 = 64   SPACE.24 = 96
```

### 4.4 Layout constants

```
headerHeight       56px   (up from 48 — more presence)
ideogramHeight     32px   (unchanged)
sidebarWidth      220px   (up from 200 — accommodates new label hierarchy)
contextPanelWidth 180px   (up from 160)
docsSidebarWidth  240px   (up from 200)

maxContentWidth  1440px   (landing and editorial pages constrain to this)
gridGutter         24px
```

---

## 5. Component Primitives — The Shift

The single most consequential rule change:

```
DELETE:  * { border-radius: 0 !important; box-shadow: none !important; }
REPLACE: default 2px radius, 4px for cards, 0px for hairlines and table cells
```

The terminal-cyberpunk hard-edge signal is the primary "toy" cue. Removing the global radius reset is the single largest aesthetic move in the redesign.

**Buttons:**
- Primary: solid `#0F62FE` background, white text, no border, 2px radius.
- Secondary: white surface, 1px `#A1A1AA` border, blue text, 2px radius.
- Ghost: transparent, no border, blue text, underline on hover.
- All buttons: `padding: 8px 16px`, `font-size: 14px`, `font-weight: 500`, `font-family: Diatype/Inter`.

**Inputs:**
- White surface, 1px `#A1A1AA` border, 2px radius.
- Focus state: 2px solid `#0F62FE` outline with 2px offset (no glow, no inset shadow).
- Disabled: `#EBEBED` background, `#A1A1AA` text.

**Section markers:**
- Mono caps, +0.08em tracking, `#52525B`.
- Numbered: `§01 — INTRODUCTION`, `§02 — DATA LAYERS`.
- Used as the editorial anchor between page sections.

**Tables / data rows:**
- Hairline `#D4D4D8` dividers between rows.
- `font-variant-numeric: tabular-nums` for all numeric columns — non-negotiable for the data-heavy tools.
- Sticky headers with `#FAFAFA` background and `#D4D4D8` bottom border.
- Alternating rows use `#EBEBED` only on tables with >20 rows.

**Panels and cards:**
- 4px radius, 1px `#E4E4E7` border, `#FAFAFA` background.
- No box shadow. Elevation is communicated by border weight and background tone, not depth.

**Hairline rules:**
- 1px `#D4D4D8` for section dividers.
- 1px `#E4E4E7` for in-card dividers.
- 2px `#A1A1AA` for major section breaks (e.g., between hero and first content section).

**Removed entirely:**
- All neon (`#4ECDC4` teal, `#F0A500` amber, `#8B5CF6` violet, `#F43F5E` rose) as *decorative* accents. They remain only as *data identity* colors in the retuned form above.
- All glow effects.
- All chromatic borders/hover states with `rgba(..., 0.025)` washes.
- Box shadows of all kinds.

---

## 6. Page Scope & Sequencing

Tiered. Sandbox iteration does not redesign all 26 routes simultaneously. Each tier is "ported back to `viewer/` when it reads investor-grade in isolation" — the migration is incremental.

### Tier 0 — Foundation
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/config/theme.ts` (new token file)
- `src/components/BrandBar.tsx`
- `src/components/Footer.tsx`
- `src/app/page.tsx` (landing)

This tier exists because every other page consumes layout, globals, brand bar, footer. The landing is included because it is the highest-stakes first impression.

### Tier 1 — Pitch surface
- `/docs`
- `/docs/methodology`
- `/developers`
- `/newsroom`
- `/data-sources`
- `/atlas` + `/atlas/[chr]`

These routes are what an investor, BD prospect, or pharma collaborator clicks through during evaluation. They carry no live data-binding complexity and are the highest-leverage surface to look investor-grade.

### Tier 2 — Working tools
- `/view/[build]/[region]/page.tsx` — the genome browser (the demo)
- `/evaluate`
- `/dmp`
- `/clocks`
- `/hla`
- `/transposome`
- `/te-methylation`
- `/gene/[build]/[symbol]`

These routes carry the actual scientific product. They are demoed live, and they are where a technical evaluator spends real time. Tier 2 is where Carbon-derived discipline must scale to data-dense interfaces.

### Tier 3 — Portal and dev
- `/portal/page.tsx`, `/portal/submit`, `/portal/umap`, `/portal/graph`, `/portal/cohort`, `/portal/latent3d`, `/portal/pathway`
- `/dev/claim/[id]`
- `/privacy`, `/terms`

Portal routes include the heaviest 3D and graph components (`@react-three/*`, `@xyflow/react`). They benefit most from a coherent visual baseline that's already settled by Tiers 0–2.

---

## 7. Migration Strategy

- Sandbox iteration loop: `cd Polymer-3 && npm run dev` on `:3100`. Eyeball alongside `viewer/` on `:3000`. Iterate.
- Per-tier port-back: when a tier reads investor-grade in the sandbox **and the user explicitly approves the port-back**, the modified files are copied into `viewer/` and `viewer/src/config/theme.ts` is updated with the new token values. Because the token shape was preserved, the port-back diff is mostly hex value changes + small component-shape changes. The user is the sole arbiter of "investor-grade" — no automated gate.
- No tier is "complete" until both the sandbox and the ported-back `viewer/` version render correctly in the browser.
- No deploy from sandbox under any circumstance. The sandbox has no `vercel.json`, no deploy hooks, and is not connected to any Vercel project.
- Original viewer dark-theme tokens are not deleted during the transition — they are renamed to `themeLegacy.ts` and kept as a reference until Tier 3 ports back.

**Implementation-plan scoping.** Each tier is its own implementation plan. The next plan produced by `writing-plans` covers **Tier 0 only** — sandbox scaffolding + foundation files + landing page. Tiers 1, 2, 3 are subsequent plans, each preceded by a fresh look at how the previous tier landed.

---

## 8. Testing

The redesign is aesthetic, not behavioral. Testing strategy follows from that:

- **Primary test**: side-by-side browser comparison of `localhost:3100` (sandbox) and `localhost:3000` (current viewer) at each tier checkpoint.
- **Per-page checklist** (written informally per tier):
  - Hierarchy reads at 100% zoom on a 1440-wide viewport.
  - All data still legible — no contrast regressions for the data-identity colors against the light canvas.
  - No unintended `border-radius: 0` survivors.
  - No remaining `rgba(78, 205, 196, ...)` teal-wash artifacts.
  - Focus states visible, 2px solid blue outline only.
- **Optional Playwright screenshot regression**: introduced after Tier 1 ports back. Captures the redesigned pages so Tier 2/3 work can't silently regress them.
- **No unit tests added for this redesign.** Existing viewer unit tests carry over with the port-back; they test data logic, not visual style.

---

## 9. Open Decisions Resolved

- **Spec location**: `Polymer-3/docs/specs/2026-05-19-viewer-redesign-design.md` (this file). Sandbox owns its own design history.
- **Diatype licensing**: deferred. Sandbox builds against Inter. Diatype is a port-back-time decision when the redesign is otherwise ready and the question is "what's the production type system."
- **Dark-mode toggle**: out of scope. The redesign is light-mode only. If a dark variant is wanted later, it is its own design pass against the established token system.

---

## 10. Out of Scope

- Backend / API changes
- Data layer additions or removals
- New routes (existing 26 routes are the surface)
- Branding (logo, wordmark, domain) — kept verbatim
- Mobile redesign — current breakpoints (`mobile: 640`, `tablet: 1024`) are retained; mobile-specific tuning happens per-tier during port-back
- Animation library or motion design system — motion is constrained to the same simple transitions already in place (color, opacity, transform on hover)
