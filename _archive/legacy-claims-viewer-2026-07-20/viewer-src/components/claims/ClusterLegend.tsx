'use client';

import { COLOR, TYPE, FONT_FAMILY, WEIGHT, SPACE } from '@/config/theme';
import {
  CLAIMS,
  CLUSTER_COLORS,
  CLUSTER_LABELS,
  CLUSTER_DESCRIPTIONS,
  PC_AXES,
  type Cluster,
} from '@/config/claims';

export function ClusterLegend() {
  const clusters: Cluster[] = [
    'well_defended_rule',
    'simple_positive',
    'null_failed',
    'qualified_proof',
  ];

  const counts: Record<Cluster, number> = {
    well_defended_rule: 0,
    simple_positive: 0,
    null_failed: 0,
    qualified_proof: 0,
  };
  for (const c of CLAIMS) counts[c.cluster]++;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: SPACE[8],
      padding: `${SPACE[5]}px ${SPACE[6]}px`,
      borderTop: `1px solid ${COLOR.border.subtle}`,
      backgroundColor: COLOR.bg.primary,
    }}>
      {/* Left: cluster legend */}
      <div>
        <div style={{
          color: COLOR.accent.teal,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: SPACE[3],
        }}>
          Clusters
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: `${SPACE[3]}px ${SPACE[5]}px`,
        }}>
          {clusters.map((c) => (
            <div key={c} style={{ display: 'flex', alignItems: 'flex-start', gap: SPACE[2] + 2 }}>
              <div style={{
                width: 10,
                height: 10,
                backgroundColor: CLUSTER_COLORS[c],
                marginTop: 5,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: COLOR.text.secondary,
                  fontSize: TYPE.sm.fontSize,
                  fontFamily: FONT_FAMILY,
                  fontWeight: WEIGHT.medium,
                  letterSpacing: '0.02em',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}>
                  <span>{CLUSTER_LABELS[c]}</span>
                  <span style={{
                    color: COLOR.text.muted,
                    fontSize: TYPE.xs.fontSize,
                    letterSpacing: '0.1em',
                  }}>
                    {counts[c]}
                  </span>
                </div>
                <div style={{
                  color: COLOR.text.tertiary,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                  letterSpacing: '0.02em',
                  lineHeight: 1.5,
                  marginTop: 2,
                }}>
                  {CLUSTER_DESCRIPTIONS[c]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: PC axes */}
      <div>
        <div style={{
          color: COLOR.accent.teal,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: SPACE[3],
        }}>
          Principal components
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] + 2 }}>
          {PC_AXES.map((axis) => (
            <div key={axis.name} style={{
              display: 'grid',
              gridTemplateColumns: '46px 1fr auto',
              gap: SPACE[3],
              alignItems: 'baseline',
              paddingBottom: SPACE[2],
              borderBottom: `1px solid ${COLOR.border.subtle}`,
            }}>
              <span style={{
                color: COLOR.accent.teal,
                fontSize: TYPE.sm.fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: WEIGHT.medium,
                letterSpacing: '0.12em',
              }}>
                {axis.name}
              </span>
              <div>
                <div style={{
                  color: COLOR.text.secondary,
                  fontSize: TYPE.sm.fontSize,
                  fontFamily: FONT_FAMILY,
                  fontWeight: WEIGHT.medium,
                }}>
                  {axis.label}
                </div>
                <div style={{
                  color: COLOR.text.tertiary,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                  letterSpacing: '0.02em',
                  lineHeight: 1.5,
                  marginTop: 2,
                }}>
                  {axis.description}
                </div>
              </div>
              <span style={{
                color: COLOR.text.muted,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                letterSpacing: '0.08em',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {(axis.variance * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
