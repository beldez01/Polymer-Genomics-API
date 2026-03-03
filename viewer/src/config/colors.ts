/**
 * Legacy COLORS export — bridges existing component imports to the new theme.
 * Components that import { COLORS } from '@/config/colors' continue to work.
 * New code should import from '@/config/theme' directly.
 */
import { COLOR } from './theme';

export const COLORS = {
  bg: {
    primary:  COLOR.bg.primary,
    track:    COLOR.bg.track,
    sidebar:  COLOR.bg.primary,
    tooltip:  COLOR.bg.surface,
    ideogram: COLOR.bg.elevated,
  },
  border: {
    subtle:  COLOR.border.subtle,
    axis:    COLOR.border.default,
    tooltip: COLOR.border.strong,
  },
  text: {
    label:   COLOR.text.tertiary,
    axis:    COLOR.canvas.axisLabel,
    tooltip: COLOR.text.secondary,
    primary: COLOR.text.primary,
    muted:   COLOR.text.muted,
  },
  accent: COLOR.accent,
  layer:  COLOR.layer,
  isochore: COLOR.isochore,
  cpgContext: COLOR.cpgContext,
  canvas: COLOR.canvas,
} as const;
