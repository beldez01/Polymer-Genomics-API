'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { ALLELES, pairwiseDivergence, type HLAAllele } from '@/config/hlaMockData';

interface DivergenceComparisonProps {
  alleleA: string | null;
  alleleB: string | null;
}

export function DivergenceComparison({ alleleA, alleleB }: DivergenceComparisonProps) {
  const a = ALLELES.find((x) => x.name === alleleA);
  const b = ALLELES.find((x) => x.name === alleleB);

  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      padding: SPACE[5],
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[3],
        paddingBottom: SPACE[3],
        borderBottom: `1px solid ${COLOR.border.strong}`,
        marginBottom: SPACE[4],
      }}>
        <span style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
        }}>
          Pairwise comparison
        </span>
        <AlleleChip allele={a} slot="A" />
        <span style={{ color: COLOR.text.faint, fontFamily: FONT_FAMILY_MONO, fontSize: TYPE.base.fontSize }}>vs</span>
        <AlleleChip allele={b} slot="B" />
        <span style={{ flex: 1 }} />
        {a && b && a.locus === b.locus && (
          <span className="tabular" style={{
            color: COLOR.primary.base,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.md.fontSize,
            fontWeight: WEIGHT.semibold,
          }}>
            Δ = {pairwiseDivergence(a, b).toFixed(3)}
          </span>
        )}
      </div>

      {!a || !b ? (
        <div style={{
          padding: SPACE[6],
          textAlign: 'center',
          color: COLOR.text.muted,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.sm.fontSize,
        }}>
          Click two rows in the allele table above — first selection is slot{' '}
          <span style={{ color: COLOR.primary.base, fontWeight: WEIGHT.semibold }}>A</span>, second is slot{' '}
          <span style={{ color: COLOR.accent.violet, fontWeight: WEIGHT.semibold }}>B</span>.
          Click again to deselect.
        </div>
      ) : a.locus !== b.locus ? (
        <div style={{
          padding: SPACE[6],
          textAlign: 'center',
          color: COLOR.accent.amber,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.sm.fontSize,
        }}>
          Cross-locus comparison not supported — alleles must be at the same locus.
        </div>
      ) : (
        <ProfileChart a={a} b={b} />
      )}
    </div>
  );
}

function AlleleChip({ allele, slot }: { allele: HLAAllele | undefined; slot: 'A' | 'B' }) {
  const color = slot === 'A' ? COLOR.primary.base : COLOR.accent.violet;
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: SPACE[2],
      padding: '4px 10px 4px 4px',
      border: `1px solid ${allele ? color : COLOR.border.strong}`,
      borderRadius: 2,
      backgroundColor: allele ? `${color}10` : 'transparent',
    }}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        backgroundColor: color,
        color: COLOR.bg.white,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: 10,
        fontWeight: WEIGHT.semibold,
        borderRadius: 2,
      }}>
        {slot}
      </span>
      <span style={{
        color: allele ? COLOR.text.primary : COLOR.text.faint,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: TYPE.sm.fontSize,
        fontWeight: WEIGHT.semibold,
      }}>
        {allele ? allele.name : '—'}
      </span>
    </div>
  );
}

function ProfileChart({ a, b }: { a: HLAAllele; b: HLAAllele }) {
  const VB_W = 1200;
  const VB_H = 260;
  const PAD_L = 60;
  const PAD_R = 24;
  const PAD_TOP = 16;
  const PAD_BOT = 50;
  const PLOT_W = VB_W - PAD_L - PAD_R;
  const PLOT_H = VB_H - PAD_TOP - PAD_BOT;

  const xAt = (i: number) => PAD_L + (i / (a.profile.length - 1)) * PLOT_W;
  const yAt = (v: number) => PAD_TOP + (1 - v) * PLOT_H;
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const pathFor = (profile: number[]) => 'M ' + profile.map((v, i) => `${r2(xAt(i))} ${r2(yAt(v))}`).join(' L ');
  const diffPath = 'M ' + a.profile.map((v, i) => `${r2(xAt(i))} ${r2(yAt(Math.abs(v - b.profile[i])))}`).join(' L ');

  return (
    <div>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: 'block' }}>
        {/* Reference horizontal lines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD_L} x2={PAD_L + PLOT_W}
            y1={PAD_TOP + PLOT_H * f} y2={PAD_TOP + PLOT_H * f}
            stroke={COLOR.border.subtle}
            strokeWidth={1}
            strokeDasharray={f === 0.5 ? undefined : '2 3'}
          />
        ))}

        {/* B profile (back) */}
        <path d={pathFor(b.profile)} fill="none" stroke={COLOR.accent.violet} strokeWidth={1.4} strokeLinejoin="round" opacity={0.85} />
        {/* A profile (front) */}
        <path d={pathFor(a.profile)} fill="none" stroke={COLOR.primary.base} strokeWidth={1.6} strokeLinejoin="round" />
        {/* |A - B| difference (bottom, dashed) */}
        <path d={diffPath} fill="none" stroke={COLOR.text.tertiary} strokeWidth={1} strokeDasharray="4 3" />

        {/* X axis */}
        <line x1={PAD_L} x2={PAD_L + PLOT_W} y1={PAD_TOP + PLOT_H} y2={PAD_TOP + PLOT_H} stroke={COLOR.border.strong} strokeWidth={1} />
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const anchor: 'start' | 'middle' | 'end' = i === 0 ? 'start' : i === 4 ? 'end' : 'middle';
          const x = xAt(t * (a.profile.length - 1));
          return (
            <g key={`xt-${i}`}>
              <line x1={x} x2={x} y1={PAD_TOP + PLOT_H} y2={PAD_TOP + PLOT_H + 4} stroke={COLOR.border.strong} strokeWidth={1} />
              <text x={x} y={PAD_TOP + PLOT_H + 16} textAnchor={anchor}
                fontFamily="var(--font-jetbrains-mono), monospace" fontSize={9} fill={COLOR.text.tertiary}>
                {(t * 100).toFixed(0)} %
              </text>
            </g>
          );
        })}
        <text
          x={PAD_L + PLOT_W / 2}
          y={PAD_TOP + PLOT_H + 32}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fill={COLOR.text.tertiary}
          letterSpacing="0.16em"
          style={{ textTransform: 'uppercase' }}
        >
          gene span · non-coding biophysics signature
        </text>

        {/* Y axis */}
        <line x1={PAD_L} x2={PAD_L} y1={PAD_TOP} y2={PAD_TOP + PLOT_H} stroke={COLOR.border.strong} strokeWidth={1} />
        {[0, 0.5, 1].map((v) => (
          <g key={`yt-${v}`}>
            <line x1={PAD_L - 4} x2={PAD_L} y1={yAt(v)} y2={yAt(v)} stroke={COLOR.border.strong} strokeWidth={1} />
            <text x={PAD_L - 8} y={yAt(v) + 3} textAnchor="end"
              fontFamily="var(--font-jetbrains-mono), monospace" fontSize={9} fill={COLOR.text.tertiary}>
              {v.toFixed(1)}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: SPACE[5],
        marginTop: SPACE[2],
        justifyContent: 'center',
        fontFamily: FONT_FAMILY_MONO,
        fontSize: TYPE.xs.fontSize,
        color: COLOR.text.secondary,
        letterSpacing: '0.04em',
      }}>
        <LegendItem color={COLOR.primary.base} label={`A · ${a.name}`} />
        <LegendItem color={COLOR.accent.violet} label={`B · ${b.name}`} />
        <LegendItem color={COLOR.text.tertiary} label="|A − B|" dashed />
      </div>
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE[2] }}>
      <span style={{
        display: 'inline-block',
        width: 18,
        height: 2,
        backgroundColor: dashed ? 'transparent' : color,
        borderTop: dashed ? `2px dashed ${color}` : 'none',
      }} />
      <span>{label}</span>
    </span>
  );
}
