'use client';

import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE } from '@/config/theme';
import type { RetroAgeResult } from '@/lib/te-methylation/types';

interface Props {
  result: RetroAgeResult | null;
  loading?: boolean;
}

export function RetroAgePanel({ result, loading }: Props) {
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>Retro-Age Clock</div>
        <span style={{ fontFamily: FONT_FAMILY, fontSize: TYPE.sm.fontSize, color: COLOR.text.muted }}>
          Computing...
        </span>
      </div>
    );
  }

  if (!result) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>Retro-Age Clock</div>
        <span style={{ fontFamily: FONT_FAMILY, fontSize: TYPE.sm.fontSize, color: COLOR.text.muted }}>
          Clock coefficients not available or insufficient probe overlap.
        </span>
      </div>
    );
  }

  const accelColor =
    result.acceleration === undefined
      ? COLOR.text.secondary
      : result.acceleration > 3
        ? COLOR.accent.rose
        : result.acceleration < -3
          ? COLOR.accent.teal
          : COLOR.text.secondary;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Retro-Age Clock</div>

      <div style={{ display: 'flex', gap: SPACE[8], flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Main age */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: FONT_FAMILY,
            fontSize: 48,
            fontWeight: WEIGHT.bold,
            color: COLOR.text.primary,
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}>
            {result.age.toFixed(1)}
          </div>
          <div style={{ fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize, color: COLOR.text.muted, marginTop: SPACE[1] }}>
            Retro-Age (years)
          </div>
        </div>

        {/* Acceleration */}
        {result.acceleration !== undefined && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: FONT_FAMILY,
              fontSize: 32,
              fontWeight: WEIGHT.bold,
              color: accelColor,
              lineHeight: 1,
            }}>
              {result.acceleration > 0 ? '+' : ''}{result.acceleration.toFixed(1)}
            </div>
            <div style={{ fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize, color: COLOR.text.muted, marginTop: SPACE[1] }}>
              Acceleration (years)
            </div>
          </div>
        )}

        {/* Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[1] }}>
          <MetaRow label="Probes used" value={`${result.probesUsed} / ${result.probesTotal}`} />
          <MetaRow label="Coverage" value={`${(result.coverage * 100).toFixed(1)}%`} />
          {result.chronologicalAge !== undefined && (
            <MetaRow label="Chronological age" value={`${result.chronologicalAge}`} />
          )}
        </div>
      </div>

      <div style={{
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.xs.fontSize,
        color: COLOR.text.muted,
        marginTop: SPACE[3],
        lineHeight: 1.5,
      }}>
        Retro-Age V2 (Ndhlovu et al. 2024, Aging Cell). Built from 1,378 retroelement-overlapping
        CpGs. Does not overlap standard epigenetic clocks (Horvath, Hannum, PhenoAge).
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: SPACE[3] }}>
      <span style={{ fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize, color: COLOR.text.muted, minWidth: 110 }}>
        {label}
      </span>
      <span style={{ fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize, color: COLOR.text.secondary, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  border: `1px solid ${COLOR.border.subtle}`,
  borderRadius: 12,
  padding: SPACE[5],
  background: COLOR.bg.primary,
};

const headerStyle: React.CSSProperties = {
  fontFamily: FONT_FAMILY,
  fontSize: TYPE.md.fontSize,
  fontWeight: WEIGHT.bold,
  color: COLOR.text.primary,
  marginBottom: SPACE[4],
  letterSpacing: TYPE.md.letterSpacing,
};
