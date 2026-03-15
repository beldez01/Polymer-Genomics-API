'use client';

import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT, COMPONENT } from '@/config/theme';
import type { ClockMetadata } from '@/lib/api';

// Clock generation metadata — not in API, this is interpretive context
const CLOCK_INFO: Record<string, {
  generation: string;
  genColor: string;
  metaphor: string;
  shortDesc: string;
  order: number;
}> = {
  horvath_2013: {
    generation: '1ST GEN',
    genColor: '#3b82f6',
    metaphor: 'Odometer',
    shortDesc: 'Universal multi-tissue clock. The original.',
    order: 0,
  },
  hannum_2013: {
    generation: '1ST GEN',
    genColor: '#3b82f6',
    metaphor: 'Odometer',
    shortDesc: 'Blood-optimized chronological age.',
    order: 1,
  },
  phenoage_2018: {
    generation: '2ND GEN',
    genColor: COLOR.accent.amber,
    metaphor: 'Dashboard',
    shortDesc: 'Trained on mortality via 9 clinical biomarkers.',
    order: 2,
  },
  grimage_2019: {
    generation: '2ND GEN',
    genColor: COLOR.accent.amber,
    metaphor: 'Dashboard',
    shortDesc: 'DNAm surrogates for 7 plasma proteins + smoking.',
    order: 3,
  },
  dunedinpace_2022: {
    generation: '3RD GEN',
    genColor: COLOR.accent.rose,
    metaphor: 'Speedometer',
    shortDesc: 'Pace of aging from 20-year longitudinal change.',
    order: 4,
  },
  retro_age_v2: {
    generation: 'ORTHOGONAL',
    genColor: COLOR.accent.violet,
    metaphor: 'Independent gauge',
    shortDesc: 'Retroelement CpGs only. Zero overlap with others.',
    order: 5,
  },
  retro_age_450k: {
    generation: 'ORTHOGONAL',
    genColor: COLOR.accent.violet,
    metaphor: 'Independent gauge',
    shortDesc: '450K platform retroelement clock.',
    order: 6,
  },
};

interface Props {
  clocks: ClockMetadata[];
  selectedClock: string | null;
  onSelect: (name: string) => void;
}

export function ClockObservatory({ clocks, selectedClock, onSelect }: Props) {
  const sorted = [...clocks].sort(
    (a, b) => (CLOCK_INFO[a.clock_name]?.order ?? 99) - (CLOCK_INFO[b.clock_name]?.order ?? 99),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[4] }}>
      {/* Generation legend */}
      <div style={{
        display: 'flex',
        gap: SPACE[6],
        flexWrap: 'wrap',
        marginBottom: SPACE[1],
      }}>
        {[
          { label: '1ST GENERATION', color: '#3b82f6', desc: 'Chronological age' },
          { label: '2ND GENERATION', color: COLOR.accent.amber, desc: 'Health/mortality' },
          { label: '3RD GENERATION', color: COLOR.accent.rose, desc: 'Rate of change' },
          { label: 'ORTHOGONAL', color: COLOR.accent.violet, desc: 'Retroelements' },
        ].map((g) => (
          <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
            <div style={{
              width: 8,
              height: 8,
              backgroundColor: g.color,
              borderRadius: 1,
              flexShrink: 0,
            }} />
            <span style={{
              color: COLOR.text.muted,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              letterSpacing: '0.06em',
            }}>
              {g.label}
            </span>
            <span style={{
              color: COLOR.text.faint,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
            }}>
              {g.desc}
            </span>
          </div>
        ))}
      </div>

      {/* Clock cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: SPACE[3],
      }}>
        {sorted.map((clock) => {
          const info = CLOCK_INFO[clock.clock_name];
          const isSelected = selectedClock === clock.clock_name;
          const genColor = info?.genColor ?? COLOR.text.muted;

          return (
            <button
              key={clock.clock_name}
              onClick={() => onSelect(clock.clock_name)}
              style={{
                backgroundColor: isSelected ? 'rgba(78, 205, 196, 0.04)' : COLOR.bg.elevated,
                border: `1px solid ${isSelected ? COLOR.accent.teal : COLOR.border.subtle}`,
                padding: `${SPACE[3]}px ${SPACE[4]}px`,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: FONT_FAMILY,
                transition: 'border-color 0.15s, background-color 0.15s',
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE[2],
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = COLOR.border.strong;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = COLOR.border.subtle;
                }
              }}
            >
              {/* Generation badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
                <div style={{
                  width: 6,
                  height: 6,
                  backgroundColor: genColor,
                  borderRadius: 1,
                  flexShrink: 0,
                }} />
                <span style={{
                  color: genColor,
                  fontSize: TYPE.xs.fontSize,
                  letterSpacing: '0.08em',
                  fontWeight: WEIGHT.medium,
                }}>
                  {info?.generation ?? 'UNKNOWN'}
                </span>
              </div>

              {/* Clock name */}
              <div style={{
                color: isSelected ? COLOR.accent.teal : COLOR.text.primary,
                fontSize: TYPE.base.fontSize,
                fontWeight: WEIGHT.medium,
                letterSpacing: '0.02em',
                lineHeight: 1.3,
              }}>
                {clock.display_name}
              </div>

              {/* Stats row */}
              <div style={{
                display: 'flex',
                gap: SPACE[3],
                color: COLOR.text.muted,
                fontSize: TYPE.xs.fontSize,
              }}>
                <span>{clock.n_probes} CpGs</span>
                <span>{clock.platform}</span>
                <span>{clock.tissue}</span>
              </div>

              {/* Metaphor */}
              <div style={{
                color: COLOR.text.faint,
                fontSize: TYPE.xs.fontSize,
                fontStyle: 'italic',
              }}>
                {info?.metaphor}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
