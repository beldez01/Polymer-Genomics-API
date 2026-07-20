'use client';

import { COLOR, TYPE, FONT_FAMILY, WEIGHT, SPACE } from '@/config/theme';
import { CLUSTER_COLORS, CLUSTER_LABELS, type Claim } from '@/config/claims';

interface ClaimDetailProps {
  claim: Claim | null;
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingTop: SPACE[2],
      paddingBottom: SPACE[2],
      borderBottom: `1px solid ${COLOR.border.subtle}`,
    }}>
      <span style={{
        color: COLOR.text.muted,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{
        color: color || COLOR.text.secondary,
        fontSize: TYPE.sm.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.02em',
        textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  );
}

function methodLabel(c: Claim): string {
  const m = c.features;
  const parts: string[] = [];
  if (m.method_proof) parts.push('Proof');
  if (m.method_ml) parts.push('ML classifier');
  if (m.method_partial_corr) parts.push('Partial correlation');
  if (m.method_statistical) parts.push('Statistical');
  if (m.method_enrichment) parts.push('Enrichment');
  return parts.length ? parts.join(' + ') : '—';
}

function gcLabel(v: number): string {
  if (v === 2) return 'Fully';
  if (v === 1) return 'Partial';
  return 'No';
}

function scaleLabel(log10: number): string {
  const bp = Math.round(Math.pow(10, log10));
  if (bp >= 1000) return `${(bp / 1000).toFixed(bp >= 10000 ? 0 : 1)} kb`;
  return `${bp} bp`;
}

function nLabel(log10: number): string {
  const n = Math.round(Math.pow(10, log10));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function outcomeBadge(outcome: string): { label: string; color: string } {
  switch (outcome) {
    case 'strong_positive':    return { label: 'STRONG POSITIVE', color: '#4ECDC4' };
    case 'positive':            return { label: 'POSITIVE', color: '#4ECDC4' };
    case 'qualified_positive':  return { label: 'QUALIFIED', color: '#F0A500' };
    case 'negative':            return { label: 'NEGATIVE', color: '#F43F5E' };
    case 'fail':                return { label: 'FAIL', color: '#F43F5E' };
    default:                    return { label: outcome.toUpperCase(), color: COLOR.text.muted };
  }
}

export function ClaimDetail({ claim }: ClaimDetailProps) {
  if (!claim) {
    return (
      <aside style={{
        width: 360,
        flexShrink: 0,
        padding: SPACE[6],
        borderLeft: `1px solid ${COLOR.border.subtle}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACE[3],
      }}>
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>
          No claim selected
        </span>
        <span style={{
          color: COLOR.text.faint,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          textAlign: 'center',
          maxWidth: 240,
          lineHeight: 1.6,
        }}>
          Click any node in the universe to inspect its claim graph, features, and protocol pull.
        </span>
      </aside>
    );
  }

  const clusterColor = CLUSTER_COLORS[claim.cluster];
  const badge = outcomeBadge(claim.outcome);

  return (
    <aside style={{
      width: 360,
      flexShrink: 0,
      padding: `${SPACE[6]}px ${SPACE[5]}px ${SPACE[8]}px`,
      borderLeft: `1px solid ${COLOR.border.subtle}`,
      overflowY: 'auto',
      backgroundColor: COLOR.bg.elevated,
    }}>
      {/* Cluster color strip (masthead signature) */}
      <div style={{
        height: 3,
        backgroundColor: clusterColor,
        marginLeft: -SPACE[5],
        marginRight: -SPACE[5],
        marginTop: -SPACE[6],
        marginBottom: SPACE[5],
      }} />

      {/* Overline: exp number · cluster */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: SPACE[3],
      }}>
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>
          Exp {claim.exp_number.toString().padStart(2, '0')} / Claim
        </span>
        <span style={{
          color: clusterColor,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          fontWeight: WEIGHT.medium,
        }}>
          {CLUSTER_LABELS[claim.cluster]}
        </span>
      </div>

      {/* Title */}
      <h2 style={{
        color: COLOR.text.primary,
        fontSize: TYPE.lg.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.01em',
        lineHeight: 1.25,
        margin: 0,
        marginBottom: SPACE[3],
      }}>
        {claim.title}
      </h2>

      {/* Outcome badge */}
      <div style={{
        display: 'inline-block',
        padding: `${SPACE[1] + 1}px ${SPACE[2] + 2}px`,
        border: `1px solid ${badge.color}66`,
        color: badge.color,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.15em',
        marginBottom: SPACE[5],
      }}>
        {badge.label}
      </div>

      {/* Assertion (blockquote with cluster-color rule) */}
      <div style={{
        borderLeft: `2px solid ${clusterColor}`,
        paddingLeft: SPACE[3],
        marginBottom: SPACE[6],
        fontSize: TYPE.base.fontSize,
        color: COLOR.text.secondary,
        fontFamily: FONT_FAMILY,
        lineHeight: 1.6,
        letterSpacing: '0.01em',
      }}>
        {claim.assertion}
      </div>

      {/* Features section header */}
      <div style={{
        color: COLOR.accent.teal,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        marginBottom: SPACE[2],
        paddingBottom: SPACE[2],
        borderBottom: `1px solid ${COLOR.border.strong}`,
      }}>
        Features
      </div>

      <div style={{ marginBottom: SPACE[6] }}>
        <MetricRow
          label="Effect magnitude"
          value={claim.features.effect_magnitude_log.toFixed(3)}
        />
        <MetricRow
          label="GC controlled"
          value={gcLabel(claim.features.gc_controlled)}
          color={claim.features.gc_controlled === 2 ? COLOR.accent.teal : COLOR.text.secondary}
        />
        <MetricRow
          label="Within-group tested"
          value={claim.features.within_group_tested ? 'Yes' : 'No'}
        />
        <MetricRow
          label="Replicated"
          value={claim.features.replicated ? 'Yes' : 'No'}
        />
        <MetricRow
          label="Method"
          value={methodLabel(claim)}
        />
        <MetricRow
          label="Scale"
          value={scaleLabel(claim.features.scale_log)}
        />
        <MetricRow
          label="Sample size"
          value={nLabel(claim.features.n_instances_log)}
        />
        <MetricRow
          label="Data layers"
          value={`${claim.features.data_layer_count}`}
        />
        <MetricRow
          label="Domain"
          value={claim.domain}
        />
      </div>

      {/* Topology sub-block */}
      <div style={{
        color: COLOR.accent.teal,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        marginBottom: SPACE[2],
        paddingBottom: SPACE[2],
        borderBottom: `1px solid ${COLOR.border.strong}`,
      }}>
        Graph topology
      </div>

      <div style={{ marginBottom: SPACE[6] }}>
        <MetricRow label="Nodes (log₂)" value={claim.features.n_nodes_log.toFixed(2)} />
        <MetricRow label="Edges (log₂)" value={claim.features.n_edges_log.toFixed(2)} />
        <MetricRow label="Evidence density" value={claim.features.evidence_density.toFixed(2)} />
        <MetricRow label="Qualifier density" value={claim.features.qualifier_density.toFixed(2)} />
        <MetricRow label="Exception density" value={claim.features.exception_density.toFixed(2)} />
        <MetricRow label="Max depth" value={claim.features.max_depth.toString()} />
        <MetricRow label="Defense density" value={claim.features.defense_density.toFixed(2)} />
      </div>

      {/* Protocol pull placeholder */}
      <button
        disabled
        style={{
          width: '100%',
          padding: `${SPACE[3]}px ${SPACE[4]}px`,
          backgroundColor: 'transparent',
          border: `1px solid ${COLOR.border.strong}`,
          color: COLOR.text.muted,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: 'not-allowed',
          transition: 'border-color 0.15s',
        }}
        title="Coming soon — content-addressed protocol pull via query_recipe"
      >
        Pull protocol →
      </button>
    </aside>
  );
}
