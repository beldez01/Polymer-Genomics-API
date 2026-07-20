'use client';

import { useState, useMemo } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import {
  CLAIMS,
  CLUSTER_LABEL,
  CLUSTER_COLOR,
  getOutcomeBadge,
  type ClaimCluster,
} from '@/config/newsroomData';

const subtitle = (
  <span style={{
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 12,
    fontFamily: FONT_FAMILY_MONO,
    fontSize: TYPE.sm.fontSize,
    letterSpacing: '0.04em',
  }}>
    <span style={{ color: COLOR.text.tertiary }}>Newsroom</span>
    <span style={{ color: COLOR.border.strong }}>·</span>
    <span style={{ color: COLOR.text.tertiary }}>claim dispatches</span>
  </span>
);

const CLUSTERS: Array<{ id: ClaimCluster | 'all'; label: string }> = [
  { id: 'all',              label: 'All clusters' },
  { id: 'biophysics_proof', label: CLUSTER_LABEL.biophysics_proof },
  { id: 'recombination',    label: CLUSTER_LABEL.recombination },
  { id: 'TE_silencing',     label: CLUSTER_LABEL.TE_silencing },
  { id: 'HLA',              label: CLUSTER_LABEL.HLA },
  { id: 'methylation',      label: CLUSTER_LABEL.methylation },
];

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  const m = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${m} ${day}`;
}

export default function NewsroomPage() {
  const [filter, setFilter] = useState<ClaimCluster | 'all'>('all');

  const visible = useMemo(() => {
    return CLAIMS
      .filter((c) => filter === 'all' || c.cluster === filter)
      .sort((a, b) => b.posted_at.localeCompare(a.posted_at));
  }, [filter]);

  const counts = useMemo(() => {
    const pos = CLAIMS.filter((c) => c.outcome === 'positive' || c.outcome === 'strong_positive').length;
    const qual = CLAIMS.filter((c) => c.outcome === 'qualified_positive').length;
    const neg = CLAIMS.filter((c) => c.outcome === 'negative' || c.outcome === 'fail').length;
    return { pos, qual, neg };
  }, []);

  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <BrandBar sticky subtitle={subtitle} />

      <section style={{
        maxWidth: 1040,
        width: '100%',
        margin: '0 auto',
        padding: `${SPACE[12]}px ${SPACE[6]}px ${SPACE[16]}px`,
        flex: 1,
      }}>
        {/* Header */}
        <div style={{ marginBottom: SPACE[8] }}>
          <div style={{
            color: COLOR.text.faint,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: SPACE[3],
          }}>
            § NEWSROOM · {CLAIMS.length} claim dispatches · all evidence on the public record
          </div>
          <h1 style={{
            margin: 0,
            color: COLOR.primary.base,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.xl.fontSize,
            lineHeight: TYPE.xl.lineHeight,
            letterSpacing: TYPE.xl.letterSpacing,
            fontWeight: WEIGHT.bold,
            marginBottom: SPACE[3],
          }}>
            Newsroom
          </h1>
          <p style={{
            margin: 0,
            maxWidth: 720,
            color: COLOR.text.secondary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            lineHeight: 1.55,
          }}>
            Every in-silico experiment posts a formal claim — premise, operation, statistic,
            inference rule, conclusion — with the outcome flagged. Negative results included by design.
            Click a card to open its full claim record.
          </p>
        </div>

        {/* Stats strip */}
        <div className="tabular" style={{
          display: 'flex',
          gap: SPACE[6],
          paddingTop: SPACE[4],
          paddingBottom: SPACE[5],
          borderTop: `1px solid ${COLOR.border.subtle}`,
          borderBottom: `1px solid ${COLOR.border.strong}`,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          color: COLOR.text.tertiary,
          letterSpacing: '0.02em',
          marginBottom: SPACE[5],
        }}>
          <Stat n={counts.pos}  label="Positive"  color={COLOR.primary.base} />
          <Stat n={counts.qual} label="Qualified" color={COLOR.accent.amber} />
          <Stat n={counts.neg}  label="Negative"  color={COLOR.accent.rose} />
        </div>

        {/* Filter strip */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[3],
          marginBottom: SPACE[5],
          flexWrap: 'wrap',
        }}>
          <span style={{
            color: COLOR.text.faint,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}>
            Filter
          </span>
          {CLUSTERS.map((c) => {
            const active = c.id === filter;
            const cColor = c.id === 'all' ? COLOR.primary.base : CLUSTER_COLOR[c.id];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: SPACE[2],
                  padding: `${SPACE[1] + 2}px ${SPACE[3]}px`,
                  backgroundColor: active ? cColor : 'transparent',
                  color: active ? COLOR.bg.white : COLOR.text.secondary,
                  border: `1px solid ${active ? cColor : COLOR.border.strong}`,
                  borderRadius: 2,
                  fontFamily: FONT_FAMILY,
                  fontSize: TYPE.xs.fontSize,
                  fontWeight: WEIGHT.medium,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  transition: 'background-color 0.12s, color 0.12s, border-color 0.12s',
                }}
              >
                {c.id !== 'all' && (
                  <span style={{
                    width: 8,
                    height: 8,
                    backgroundColor: active ? COLOR.bg.white : cColor,
                    flexShrink: 0,
                  }} />
                )}
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Feed */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {visible.map((c) => {
            const badge = getOutcomeBadge(c.outcome);
            const clusterColor = CLUSTER_COLOR[c.cluster];
            return (
              <a
                key={c.id}
                href="#"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '14px 120px 1fr auto auto',
                  columnGap: SPACE[5],
                  alignItems: 'baseline',
                  padding: `${SPACE[5]}px ${SPACE[2]}px`,
                  borderBottom: `1px solid ${COLOR.border.subtle}`,
                  textDecoration: 'none',
                  transition: 'background-color 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLOR.bg.deep; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {/* Cluster dot */}
                <span style={{
                  width: 8,
                  height: 8,
                  backgroundColor: clusterColor,
                  alignSelf: 'center',
                  justifySelf: 'center',
                }} />

                {/* Date + Exp number */}
                <span className="tabular" style={{
                  color: COLOR.text.tertiary,
                  fontFamily: FONT_FAMILY_MONO,
                  fontSize: TYPE.xs.fontSize,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  alignSelf: 'center',
                }}>
                  {formatDate(c.posted_at)} &middot; EXP {c.exp_number.toString().padStart(2, '0')}
                </span>

                {/* Title + blurb */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{
                    color: COLOR.text.primary,
                    fontFamily: FONT_FAMILY,
                    fontSize: TYPE.md.fontSize,
                    fontWeight: WEIGHT.semibold,
                    letterSpacing: '-0.005em',
                    lineHeight: 1.3,
                  }}>
                    {c.title}
                  </span>
                  <span style={{
                    color: COLOR.text.secondary,
                    fontFamily: FONT_FAMILY,
                    fontSize: TYPE.sm.fontSize,
                    lineHeight: 1.5,
                  }}>
                    {c.blurb}
                  </span>
                </div>

                {/* Metric */}
                <span className="tabular" style={{
                  color: COLOR.text.primary,
                  fontFamily: FONT_FAMILY_MONO,
                  fontSize: TYPE.xs.fontSize,
                  fontWeight: WEIGHT.semibold,
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  alignSelf: 'center',
                }}>
                  {c.metric}
                </span>

                {/* Outcome badge */}
                <span style={{
                  padding: '3px 8px',
                  backgroundColor: badge.bg,
                  color: badge.color,
                  fontFamily: FONT_FAMILY_MONO,
                  fontSize: 10,
                  fontWeight: WEIGHT.semibold,
                  letterSpacing: '0.14em',
                  borderRadius: 2,
                  alignSelf: 'center',
                  whiteSpace: 'nowrap',
                }}>
                  {badge.label}
                </span>
              </a>
            );
          })}
        </div>

        {visible.length === 0 && (
          <div style={{
            padding: SPACE[8],
            textAlign: 'center',
            color: COLOR.text.muted,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            backgroundColor: COLOR.bg.elevated,
            border: `1px solid ${COLOR.border.subtle}`,
            borderRadius: 2,
            marginTop: SPACE[5],
          }}>
            No claims in this cluster yet.
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: SPACE[2] }}>
      <span className="tabular" style={{
        color,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.xl.fontSize,
        fontWeight: WEIGHT.semibold,
        letterSpacing: '-0.01em',
        lineHeight: 1,
      }}>
        {n}
      </span>
      <span style={{
        color: COLOR.text.tertiary,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: TYPE.xs.fontSize,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </span>
  );
}
