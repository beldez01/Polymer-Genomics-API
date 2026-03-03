/**
 * Polymer Genomics — Design Token System
 *
 * Single source of truth for every visual decision.
 * Nothing in the UI should use a raw value that isn't defined here.
 */

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
// Modular scale anchored at 13px, ratio ~1.25

export const FONT_FAMILY = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export const TYPE = {
  xs:  { fontSize: 10, lineHeight: 1.4, letterSpacing: '0.02em' },
  sm:  { fontSize: 11, lineHeight: 1.5, letterSpacing: '0.01em' },
  base:{ fontSize: 13, lineHeight: 1.6, letterSpacing: '0em' },
  md:  { fontSize: 16, lineHeight: 1.5, letterSpacing: '-0.01em' },
  lg:  { fontSize: 20, lineHeight: 1.4, letterSpacing: '-0.02em' },
  xl:  { fontSize: 28, lineHeight: 1.3, letterSpacing: '-0.025em' },
  '2xl': { fontSize: 36, lineHeight: 1.2, letterSpacing: '-0.03em' },
} as const;

export const WEIGHT = {
  normal: 400,
  medium: 500,
  bold:   700,
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------
// 4px base unit. Use sp(n) for computed values.

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
// Color Palette
// ---------------------------------------------------------------------------

export const COLOR = {
  // Backgrounds — near-black gradient
  bg: {
    primary:  '#0A0A0A',
    elevated: '#0D0D0D',
    track:    '#111111',
    surface:  '#1a1a1a',
  },

  // Borders — subtle separation
  border: {
    subtle:  '#1a1a1a',
    default: '#222222',
    strong:  '#333333',
    input:   '#333333',
  },

  // Text — accessible contrast ratios on #0A0A0A
  text: {
    primary:  '#E0E0E0',  // 14.4:1
    secondary:'#CCCCCC',  // 11.5:1
    tertiary: '#8a8a8a',  // 4.7:1  — minimum for body text
    muted:    '#777777',  // 3.5:1  — large text / decorative only
    faint:    '#555555',  // 2.2:1  — borders-as-text, hints
  },

  // Accents — the four signature colors
  accent: {
    teal:   '#4ECDC4',
    amber:  '#F0A500',
    violet: '#8B5CF6',
    rose:   '#F43F5E',
  },

  // Data layer identity colors
  layer: {
    gencode_v44:      '#3b82f6',
    cpg_sites:        '#4ECDC4',
    probe_epic_v2:    '#F0A500',
    isochores:        '#8B5CF6',
    methylation_atlas:'#f43f5e',
  },

  // Isochore classes — earth tones, low-key
  isochore: {
    L1: '#1a3a5c',
    L2: '#1f3a4a',
    H1: '#2a4a3a',
    H2: '#3a4a2a',
    H3: '#5c3a1a',
  },

  // CpG context — greens/blues by proximity to island
  cpgContext: {
    island:   '#22c55e',
    shore:    '#14b8a6',
    shelf:    '#3b82f6',
    open_sea: '#6b7280',
  },

  // Canvas-specific
  canvas: {
    background:   '#0A0A0A',
    gridLine:     '#1a1a1a',
    tickMark:     '#333333',
    axisLabel:    '#888888',
    featureLabel: '#CCCCCC',
    emptyText:    '#777777',
  },

  // DNA bases
  base: {
    A: '#22c55e',
    T: '#ef4444',
    G: '#f59e0b',
    C: '#3b82f6',
    N: '#6b7280',
  },
} as const;

// ---------------------------------------------------------------------------
// Component Primitives
// ---------------------------------------------------------------------------

export const COMPONENT = {
  button: {
    ghost: {
      backgroundColor: 'transparent',
      color: COLOR.text.secondary,
      border: `1px solid ${COLOR.border.strong}`,
      padding: `${sp(2)}px ${sp(4)}px`,
      fontSize: TYPE.base.fontSize,
      fontFamily: FONT_FAMILY,
      fontWeight: WEIGHT.medium,
      cursor: 'pointer',
      transition: 'border-color 0.15s, color 0.15s',
    } as React.CSSProperties,
    ghostHover: {
      borderColor: COLOR.accent.teal,
      color: COLOR.accent.teal,
    },
    active: {
      backgroundColor: 'rgba(78, 205, 196, 0.08)',
      color: COLOR.accent.teal,
      border: `1px solid ${COLOR.accent.teal}`,
      padding: `${sp(2)}px ${sp(4)}px`,
      fontSize: TYPE.base.fontSize,
      fontFamily: FONT_FAMILY,
      fontWeight: WEIGHT.medium,
      cursor: 'pointer',
    } as React.CSSProperties,
    small: {
      backgroundColor: COLOR.bg.track,
      color: COLOR.text.secondary,
      border: `1px solid ${COLOR.border.strong}`,
      padding: `${sp(1) + 1}px ${sp(2) + 2}px`,
      fontSize: TYPE.xs.fontSize,
      fontFamily: FONT_FAMILY,
      cursor: 'pointer',
      transition: 'border-color 0.15s, color 0.15s',
    } as React.CSSProperties,
    smallActive: {
      backgroundColor: 'rgba(78, 205, 196, 0.08)',
      color: COLOR.accent.teal,
      border: `1px solid ${COLOR.accent.teal}`,
      padding: `${sp(1) + 1}px ${sp(2) + 2}px`,
      fontSize: TYPE.xs.fontSize,
      fontFamily: FONT_FAMILY,
      cursor: 'pointer',
    } as React.CSSProperties,
  },

  input: {
    default: {
      backgroundColor: COLOR.bg.track,
      color: COLOR.text.secondary,
      border: `1px solid ${COLOR.border.strong}`,
      padding: `${sp(1) + 1}px ${sp(3)}px`,
      fontSize: TYPE.sm.fontSize,
      fontFamily: FONT_FAMILY,
      outline: 'none',
      transition: 'border-color 0.15s',
    } as React.CSSProperties,
  },

  sectionHeader: {
    color: COLOR.accent.teal,
    fontSize: TYPE.sm.fontSize,
    fontFamily: FONT_FAMILY,
    fontWeight: WEIGHT.medium,
    letterSpacing: '0.08em',
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
// Layout constants
// ---------------------------------------------------------------------------

export const LAYOUT = {
  headerHeight: 48,
  ideogramHeight: 32,
  sidebarWidth: 240,
  contextPanelWidth: 160,
  docsSidebarWidth: 200,
} as const;
