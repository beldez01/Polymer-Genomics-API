'use client';

import Link from 'next/link';
import { COLOR, TYPE, FONT_FAMILY, FONT_FAMILY_SANS, WEIGHT, SPACE } from '@/config/theme';
import { CLUSTER_COLORS, CLUSTER_LABELS, type Claim } from '@/config/claims';

interface NewsroomEntryProps {
  claim: Claim;
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

function methodLabel(c: Claim): string {
  const m = c.features;
  const parts: string[] = [];
  if (m.method_proof) parts.push('Proof');
  if (m.method_ml) parts.push('ML');
  if (m.method_partial_corr) parts.push('Partial corr');
  if (m.method_statistical) parts.push('Statistical');
  if (m.method_enrichment) parts.push('Enrichment');
  return parts.length ? parts.join(' + ') : '—';
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

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const day = d.getUTCDate().toString().padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${month} ${day} · ${year}`;
}

export function NewsroomEntry({ claim }: NewsroomEntryProps) {
  const clusterColor = CLUSTER_COLORS[claim.cluster];
  const badge = outcomeBadge(claim.outcome);

  return (
    <article style={{
      paddingTop: SPACE[8],
      paddingBottom: SPACE[8],
      borderTop: `1px solid ${COLOR.border.subtle}`,
    }}>
      {/* Overline: date · exp · cluster */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: SPACE[3],
        marginBottom: SPACE[4],
      }}>
        <span style={{
          color: COLOR.accent.teal,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          {formatDate(claim.posted_at)}
        </span>
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          Exp {claim.exp_number.toString().padStart(2, '0')}
        </span>
        <div style={{
          flex: 1,
          height: 1,
          backgroundColor: COLOR.border.subtle,
        }} />
        <span style={{
          color: clusterColor,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontWeight: WEIGHT.medium,
          flexShrink: 0,
        }}>
          {CLUSTER_LABELS[claim.cluster]}
        </span>
      </div>

      {/* Title */}
      <h2 style={{
        color: COLOR.text.primary,
        fontSize: TYPE.xl.fontSize,
        fontFamily: FONT_FAMILY_SANS,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
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
        letterSpacing: '0.18em',
        marginBottom: SPACE[5],
      }}>
        {badge.label}
      </div>

      {/* Assertion — blockquote with cluster-color rule */}
      <div style={{
        borderLeft: `2px solid ${clusterColor}`,
        paddingLeft: SPACE[4],
        marginBottom: SPACE[5],
        fontSize: 17,
        color: COLOR.text.secondary,
        fontFamily: FONT_FAMILY_SANS,
        lineHeight: 1.55,
        letterSpacing: '-0.005em',
      }}>
        {claim.assertion}
      </div>

      {/* Metadata strip */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: `${SPACE[2]}px ${SPACE[5]}px`,
        marginBottom: SPACE[5],
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        color: COLOR.text.muted,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>
        <span>Effect {claim.features.effect_magnitude_log.toFixed(3)}</span>
        <span style={{ color: COLOR.border.strong }}>·</span>
        <span>{methodLabel(claim)}</span>
        <span style={{ color: COLOR.border.strong }}>·</span>
        <span>{scaleLabel(claim.features.scale_log)}</span>
        <span style={{ color: COLOR.border.strong }}>·</span>
        <span>{nLabel(claim.features.n_instances_log)} instances</span>
        <span style={{ color: COLOR.border.strong }}>·</span>
        <span>{claim.features.data_layer_count} layers</span>
        <span style={{ color: COLOR.border.strong }}>·</span>
        <span>{claim.domain}</span>
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          href="/portal/latent3d"
          style={{
            color: COLOR.accent.teal,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            padding: `${SPACE[2]}px ${SPACE[3]}px`,
            border: `1px solid transparent`,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLOR.accent.teal; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
        >
          View in universe →
        </Link>
      </div>
    </article>
  );
}
