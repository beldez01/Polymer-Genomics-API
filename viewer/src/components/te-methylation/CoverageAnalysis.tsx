'use client';

import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE } from '@/config/theme';
import type { TEFamily } from '@/lib/transposome-types';

interface Props {
  families: TEFamily[];
}

const PLATFORMS = ['epic_v2', 'epic_v1', '450k'] as const;
const PLATFORM_LABELS: Record<string, string> = {
  epic_v2: 'EPIC v2',
  epic_v1: 'EPIC v1',
  '450k': '450K',
};
const PLATFORM_COLORS: Record<string, string> = {
  epic_v2: COLOR.accent.teal,
  epic_v1: '#3b82f6',
  '450k': COLOR.accent.amber,
};

export function CoverageAnalysis({ families }: Props) {
  // Only show clinically relevant or high-probe-count families
  const relevant = families
    .filter((f) => {
      const counts = (f as any).probe_counts_by_platform;
      if (!counts) return f.epic_v2_probes > 0;
      return counts.epic_v2 > 0 || counts.epic_v1 > 0 || counts['450k'] > 0;
    })
    .sort((a, b) => {
      const ac = (a as any).probe_counts_by_platform?.epic_v2 ?? a.epic_v2_probes;
      const bc = (b as any).probe_counts_by_platform?.epic_v2 ?? b.epic_v2_probes;
      return bc - ac;
    })
    .slice(0, 20);

  const maxProbes = Math.max(
    1,
    ...relevant.map((f) => {
      const c = (f as any).probe_counts_by_platform;
      return c ? Math.max(c.epic_v2, c.epic_v1, c['450k']) : f.epic_v2_probes;
    }),
  );

  return (
    <div style={{
      border: `1px solid ${COLOR.border.subtle}`,
      borderRadius: 12,
      padding: SPACE[5],
      background: COLOR.bg.primary,
    }}>
      <div style={{
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.md.fontSize,
        fontWeight: WEIGHT.bold,
        color: COLOR.text.primary,
        marginBottom: SPACE[4],
      }}>
        Probe Coverage by Platform
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: SPACE[4], marginBottom: SPACE[4] }}>
        {PLATFORMS.map((p) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: PLATFORM_COLORS[p] }} />
            <span style={{ fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize, color: COLOR.text.secondary }}>
              {PLATFORM_LABELS[p]}
            </span>
          </div>
        ))}
      </div>

      {/* Horizontal bar chart */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[1] }}>
        {relevant.map((f) => {
          const counts = (f as any).probe_counts_by_platform ?? {
            epic_v2: f.epic_v2_probes,
            epic_v1: 0,
            '450k': 0,
          };
          return (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
              <span style={{
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.xs.fontSize,
                color: COLOR.text.secondary,
                minWidth: 120,
                textAlign: 'right',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {f.display_name}
              </span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {PLATFORMS.map((p) => {
                  const n = counts[p] ?? 0;
                  const w = n > 0 ? Math.max(2, (n / maxProbes) * 100) : 0;
                  return (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
                      <div style={{
                        height: 5,
                        width: `${w}%`,
                        background: PLATFORM_COLORS[p],
                        borderRadius: 2,
                        minWidth: n > 0 ? 2 : 0,
                      }} />
                      {n > 0 && (
                        <span style={{
                          fontFamily: FONT_FAMILY,
                          fontSize: 9,
                          color: COLOR.text.muted,
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {n.toLocaleString()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.xs.fontSize,
        color: COLOR.text.muted,
        marginTop: SPACE[4],
        lineHeight: 1.5,
      }}>
        Top 20 TE families by probe coverage. Families with 0 probes on all platforms are omitted.
        EPIC v2 removed probes in repetitive regions vs v1; some families have better v1 coverage.
      </div>
    </div>
  );
}
