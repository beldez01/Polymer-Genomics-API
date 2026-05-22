'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import type { Probe } from '@/config/methylationMockData';

interface ProbeDetailProps {
  probe: Probe | null;
}

interface KVProps { label: string; value: React.ReactNode; mono?: boolean; emphasize?: boolean }

function KV({ label, value, mono, emphasize }: KVProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      paddingTop: SPACE[2],
      paddingBottom: SPACE[2],
      borderBottom: `1px solid ${COLOR.border.subtle}`,
    }}>
      <span style={{
        color: COLOR.text.tertiary,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: 10,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span
        className={mono ? 'tabular' : undefined}
        style={{
          color: emphasize ? COLOR.primary.base : COLOR.text.primary,
          fontFamily: mono ? FONT_FAMILY_MONO : FONT_FAMILY,
          fontSize: mono ? TYPE.sm.fontSize : TYPE.base.fontSize,
          fontWeight: emphasize ? WEIGHT.semibold : WEIGHT.medium,
          letterSpacing: mono ? '0.01em' : 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function ProbeDetail({ probe }: ProbeDetailProps) {
  if (!probe) {
    return (
      <div style={{
        padding: SPACE[6],
        textAlign: 'center',
        color: COLOR.text.muted,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.base.fontSize,
        backgroundColor: COLOR.bg.elevated,
        border: `1px solid ${COLOR.border.subtle}`,
        borderRadius: 2,
      }}>
        Click any probe in the volcano, Manhattan, or top-hits table to see its details.
      </div>
    );
  }

  const pStr = Math.pow(10, -probe.neglogp).toExponential(2);
  const qStr = Math.pow(10, -(probe.neglogp - 2.3)).toExponential(2);  // approx q ~ p × correction
  const isHyper = probe.delta_beta > 0;

  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      padding: SPACE[5],
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      columnGap: SPACE[6],
    }}>
      {/* Left column — identity */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[3],
          paddingBottom: SPACE[3],
          borderBottom: `1px solid ${COLOR.border.strong}`,
          marginBottom: SPACE[1],
        }}>
          <span style={{
            color: COLOR.primary.base,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.lg.fontSize,
            fontWeight: WEIGHT.bold,
            letterSpacing: '0.04em',
          }}>
            {probe.id}
          </span>
          <span style={{
            display: 'inline-block',
            padding: '3px 8px',
            backgroundColor: isHyper ? `${COLOR.primary.base}1F` : `${COLOR.accent.rose}1F`,
            color: isHyper ? COLOR.primary.base : COLOR.accent.rose,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: 10,
            fontWeight: WEIGHT.semibold,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            borderRadius: 2,
          }}>
            {isHyper ? 'Hyper-methyl.' : 'Hypo-methyl.'}
          </span>
        </div>

        <KV label="Gene"     value={probe.gene ?? '— intergenic —'} />
        <KV label="Position" value={`${probe.chr}:${probe.position.toLocaleString()}`} mono />
        <KV label="Context"  value={probe.context ? probe.context.replace('_', ' ') : '— open sea —'} />
      </div>

      {/* Right column — effect */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: SPACE[2],
          paddingBottom: SPACE[3],
          borderBottom: `1px solid ${COLOR.border.strong}`,
          marginBottom: SPACE[1],
        }}>
          <span style={{
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}>
            Effect
          </span>
          <span style={{ flex: 1 }} />
          <span className="tabular" style={{
            color: COLOR.text.faint,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            letterSpacing: '0.04em',
          }}>
            −log₁₀p = {probe.neglogp.toFixed(2)}
          </span>
        </div>

        <KV
          label="Δβ (A − B)"
          value={`${probe.delta_beta > 0 ? '+' : ''}${probe.delta_beta.toFixed(3)}`}
          mono
          emphasize
        />
        <KV label="Mean β · group A" value={probe.beta_a.toFixed(3)} mono />
        <KV label="Mean β · group B" value={probe.beta_b.toFixed(3)} mono />
        <KV label="p-value"            value={pStr} mono />
        <KV label="q-value (BH)"       value={qStr} mono />
      </div>
    </div>
  );
}
