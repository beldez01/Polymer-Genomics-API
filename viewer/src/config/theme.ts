/**
 * Polymer Genomics — Design Token System
 *
 * D2 direction (IBM Carbon × Bloomberg Reference) — light-gray canvas,
 * electric blue, hairline rules, grotesque typography.
 *
 * Single source of truth for every visual decision.
 * Nothing in the UI should use a raw value that isn't defined here.
 *
 * Foundation tokens (bg / border / text / primary / accent / type) come
 * from the Polymer-3 sandbox port-back. Biological color dictionaries
 * (histone marks, GWAS, repeats, HERV, non-B, base colors, etc.) are
 * preserved verbatim — they encode domain convention.
 */

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

// Sans primary. Inter served via next/font/google in app/layout.tsx,
// exposing var(--font-inter) on <html>. Falls back to system stack.
export const FONT_FAMILY_SANS =
  "var(--font-inter), -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Mono register — opt-in via FONT_FAMILY_MONO, used for data, coordinates,
// section markers (§01 / §02). Served via next/font/google as well.
export const FONT_FAMILY_MONO =
  "var(--font-jetbrains-mono), 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

// Body default — sans. Legacy callers that import FONT_FAMILY and expected
// mono now get sans; mono usage must opt-in via FONT_FAMILY_MONO.
export const FONT_FAMILY = FONT_FAMILY_SANS;

// Modular scale anchored at 14 px body, ratio ~1.25
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
  normal:   400,
  medium:   500,
  semibold: 600,
  bold:     700,
} as const;

// ---------------------------------------------------------------------------
// Spacing — unchanged
// ---------------------------------------------------------------------------

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
// Color — D2 foundation + preserved biology dictionaries
// ---------------------------------------------------------------------------

export const COLOR = {
  // ── Foundation — light-mode D2 ────────────────────────────────────────
  bg: {
    primary:  '#F4F4F5',   // canvas
    elevated: '#FAFAFA',   // cards, elevated panels
    track:    '#FAFAFA',   // legacy alias for surfaces
    surface:  '#FAFAFA',
    deep:     '#EBEBED',   // recessed sections, alt rows
    white:    '#FFFFFF',
  },

  border: {
    subtle:  '#D4D4D8',    // 1 px rules — "line container work"
    default: '#E4E4E7',
    strong:  '#A1A1AA',
    input:   '#A1A1AA',
  },

  text: {
    primary:   '#18181B',
    secondary: '#3F3F46',
    tertiary:  '#52525B',
    muted:     '#71717A',
    faint:     '#A1A1AA',
  },

  // Electric blue — IBM Carbon Blue 60. The signature D2 color.
  primary: {
    base:   '#0F62FE',
    hover:  '#0043CE',
    active: '#002D9C',
  },

  // Four signature accents — retuned for light-mode legibility.
  // Names preserved so existing imports keep working; values shifted darker.
  accent: {
    teal:   '#08A097',
    amber:  '#B45309',
    violet: '#7C3AED',
    rose:   '#BE123C',
    blue:   '#0F62FE',     // alias for primary
  },

  // ── Data-layer identity colors ────────────────────────────────────────
  // Four overlap names with accents and are retuned to match.
  // The rest are preserved verbatim — they encode biological convention
  // (GENCODE blue, H3K4me3 red, etc.).
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

  // Isochore classes — light-mode cool→warm gradient (AT-rich → GC-rich).
  isochore: {
    L1: '#1E3A8A',   // deep cool — most AT-rich
    L2: '#3B82F6',
    H1: '#A1A1AA',   // neutral pivot
    H2: '#F59E0B',
    H3: '#B91C1C',   // warm — most GC-rich
  },

  // ── Preserved biology dictionaries (unchanged from dark theme) ────────
  // These encode domain convention and would break TrackStack / canvas
  // renderers if retuned. Light-mode tuning happens per-renderer when each
  // working tool is ported in subsequent phases.

  // CpG context — proximity to island
  cpgContext: {
    island:   '#22c55e',
    shore:    '#14b8a6',
    shelf:    '#3b82f6',
    open_sea: '#6b7280',
  },

  // Histone marks — ENCODE convention
  histone: {
    H3K4me3:  '#FF0000',
    H3K27ac:  '#FF8C00',
    H3K4me1:  '#FFD700',
    H3K27me3: '#808080',
    H3K9me3:  '#2F2F2F',
    H3K36me3: '#006400',
  },

  // GWAS catalog
  gwas: {
    dot:      '#E040FB',
    dotHigh:  '#FF1744',
    stem:     '#555555',
  },

  // Bioenergetic cost tiers
  cost: {
    cheap:          '#22c55e',
    moderate:       '#eab308',
    expensive:      '#f97316',
    very_expensive: '#ef4444',
  },

  // Repeat classes
  repeat: {
    SINE: '#f59e0b',
    LINE: '#3b82f6',
    LTR:  '#ef4444',
    DNA:  '#22c55e',
    Simple_repeat: '#6b7280',
    Satellite: '#a855f7',
    Other: '#555555',
  },

  // HERV subfamilies
  herv: {
    'HERV-K': '#ef4444',
    'HERV-H': '#f59e0b',
    'HERV-W': '#3b82f6',
    'HERV-E': '#22c55e',
    'HERV-L': '#8b5cf6',
    Other: '#6b7280',
  },

  // Non-B DNA structures
  nonb: {
    g4:        '#4ECDC4',
    zdna:      '#ef4444',
    cruciform: '#f59e0b',
    rloop:     '#8b5cf6',
    triplex:   '#22c55e',
    total:     '#888888',
  },

  // Breakpoint types
  breakpoint: {
    fragile_site:    '#ef4444',
    translocation:   '#f59e0b',
    constitutional:  '#8b5cf6',
  },

  // DNA shape parameters
  shape: {
    mgw:  '#4ECDC4',
    prot: '#f59e0b',
    roll: '#ef4444',
    helt: '#3b82f6',
  },

  // Canvas-rendered tracks — light-mode tuned for D2.
  // (Canvas renderers can override per-track; these are baseline defaults.)
  canvas: {
    background:   '#F4F4F5',
    gridLine:     '#D4D4D8',
    tickMark:     '#A1A1AA',
    axisLabel:    '#52525B',
    featureLabel: '#18181B',
    emptyText:    '#71717A',
  },

  // DNA bases — IUPAC convention preserved
  base: {
    A: '#22c55e',
    T: '#ef4444',
    G: '#f59e0b',
    C: '#3b82f6',
    N: '#6b7280',
  },
} as const;

// ---------------------------------------------------------------------------
// Component primitives — D2 light-mode
// ---------------------------------------------------------------------------
// Shape preserved from legacy theme (existing components rely on these
// exact keys). Additive new keys (primary, secondary) for the redesigned
// CTAs without breaking existing button.ghost / button.active call-sites.

export const COMPONENT = {
  button: {
    // Primary CTA — solid electric blue
    primary: {
      backgroundColor: COLOR.primary.base,
      color: COLOR.bg.white,
      border: 'none',
      borderRadius: 2,
      padding: `${sp(2)}px ${sp(4)}px`,
      fontSize: TYPE.base.fontSize,
      fontFamily: FONT_FAMILY,
      fontWeight: WEIGHT.medium,
      cursor: 'pointer',
      transition: 'background-color 0.15s',
    } as React.CSSProperties,

    // Secondary CTA — outlined, blue text
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

    // Ghost (legacy key) — retuned for light-mode, electric blue text
    ghost: {
      backgroundColor: 'transparent',
      color: COLOR.text.secondary,
      border: `1px solid ${COLOR.border.strong}`,
      borderRadius: 2,
      padding: `${sp(2)}px ${sp(4)}px`,
      fontSize: TYPE.base.fontSize,
      fontFamily: FONT_FAMILY,
      fontWeight: WEIGHT.medium,
      cursor: 'pointer',
      transition: 'border-color 0.15s, color 0.15s',
    } as React.CSSProperties,
    ghostHover: {
      borderColor: COLOR.primary.base,
      color: COLOR.primary.base,
    },

    // Active state (legacy key) — electric-blue selected
    active: {
      backgroundColor: `${COLOR.primary.base}14`,  // ~8% opacity wash
      color: COLOR.primary.base,
      border: `1px solid ${COLOR.primary.base}`,
      borderRadius: 2,
      padding: `${sp(2)}px ${sp(4)}px`,
      fontSize: TYPE.base.fontSize,
      fontFamily: FONT_FAMILY,
      fontWeight: WEIGHT.medium,
      cursor: 'pointer',
    } as React.CSSProperties,

    // Small variant (legacy key)
    small: {
      backgroundColor: 'transparent',
      color: COLOR.text.secondary,
      border: `1px solid ${COLOR.border.strong}`,
      borderRadius: 2,
      padding: `${sp(1) + 1}px ${sp(2) + 2}px`,
      fontSize: TYPE.sm.fontSize,
      fontFamily: FONT_FAMILY,
      cursor: 'pointer',
      transition: 'border-color 0.15s, color 0.15s',
    } as React.CSSProperties,
    smallActive: {
      backgroundColor: `${COLOR.primary.base}14`,
      color: COLOR.primary.base,
      border: `1px solid ${COLOR.primary.base}`,
      borderRadius: 2,
      padding: `${sp(1) + 1}px ${sp(2) + 2}px`,
      fontSize: TYPE.sm.fontSize,
      fontFamily: FONT_FAMILY,
      cursor: 'pointer',
    } as React.CSSProperties,
  },

  input: {
    default: {
      backgroundColor: COLOR.bg.white,
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

  // Section header (legacy key)
  sectionHeader: {
    color: COLOR.text.tertiary,
    fontSize: TYPE.sm.fontSize,
    fontFamily: FONT_FAMILY_MONO,
    fontWeight: WEIGHT.medium,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  // Editorial section marker — new
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
      backgroundColor: COLOR.bg.primary,
      borderColor: COLOR.border.subtle,
    },
    elevated: {
      backgroundColor: COLOR.bg.elevated,
      borderColor: COLOR.border.subtle,
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Layout — bumped for D2 generosity
// ---------------------------------------------------------------------------

export const LAYOUT = {
  headerHeight:       56,    // up from 48
  ideogramHeight:     32,
  sidebarWidth:      220,    // up from 200
  contextPanelWidth: 180,    // up from 160
  docsSidebarWidth:  240,    // up from 200
  maxContentWidth:  1440,
  gridGutter:         24,
} as const;

// ---------------------------------------------------------------------------
// Breakpoints — unchanged
// ---------------------------------------------------------------------------

export const BREAKPOINT = { mobile: 640, tablet: 1024 } as const;
