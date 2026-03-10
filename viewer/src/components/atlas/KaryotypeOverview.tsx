'use client';

import { useState } from 'react';
import { CHROMOSOMES, ChromosomeInfo } from '@/config/chromosomes';
import { getBandsForChromosome } from '@/config/cytobands';
import { ChromosomeSVG } from './ChromosomeSVG';
import { COLOR, TYPE, FONT_FAMILY, WEIGHT, SPACE } from '@/config/theme';

interface ChrStats {
  genes: number | null;
  cpgIslands: number | null;
  probes: number | null;
  loaded: boolean;
}

interface KaryotypeOverviewProps {
  onSelectChromosome: (chrName: string) => void;
  chrStats?: Record<string, ChrStats>;
}

// Max height for chr1 (largest chromosome); others scale proportionally
const MAX_HEIGHT = 340;
const CHR_WIDTH = 22;
const MAX_CHR_LENGTH = CHROMOSOMES[0].length; // chr1

// All non-M chromosomes in karyotype order
const KARYOTYPE_ORDER = CHROMOSOMES.filter(c => c.name !== 'chrM');
const CHR_M = CHROMOSOMES.find(c => c.name === 'chrM')!;

function chrHeight(chr: ChromosomeInfo): number {
  return Math.max(36, Math.round((chr.length / MAX_CHR_LENGTH) * MAX_HEIGHT));
}

export function KaryotypeOverview({ onSelectChromosome, chrStats }: KaryotypeOverviewProps) {
  const [hoveredChr, setHoveredChr] = useState<string | null>(null);

  return (
    <div style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: `${SPACE[8]}px ${SPACE[4]}px ${SPACE[12]}px`,
    }}>
      {/* Single row — all chromosomes bottom-aligned */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: SPACE[3],
        flexWrap: 'nowrap',
      }}>
        {KARYOTYPE_ORDER.map(chr => {
          const h = chrHeight(chr);
          const bands = getBandsForChromosome(chr.name);
          const isHovered = hoveredChr === chr.name;
          const label = chr.name.replace('chr', '');
          const stats = chrStats?.[chr.name];
          const tooltipText = stats?.genes != null ? `${chr.name} \u2014 ${stats.genes.toLocaleString()} genes \u00B7 ${(stats.cpgIslands ?? 0).toLocaleString()} CpG islands` : `${chr.name} \u2014 Click to explore`;

          return (
            <div
              key={chr.name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: SPACE[1],
                cursor: 'pointer',
                position: 'relative',
              }}
              onMouseEnter={() => setHoveredChr(chr.name)}
              onMouseLeave={() => setHoveredChr(null)}
              onClick={() => onSelectChromosome(chr.name)}
            >
              {isHovered && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 4,
                  backgroundColor: COLOR.bg.surface,
                  border: `1px solid ${COLOR.border.strong}`,
                  padding: `${SPACE[1]}px ${SPACE[2]}px`,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                  color: COLOR.text.secondary,
                  whiteSpace: 'nowrap',
                  zIndex: 50,
                  pointerEvents: 'none',
                }}>
                  {tooltipText}
                </div>
              )}
              <ChromosomeSVG
                chrName={chr.name}
                bands={bands}
                chrLength={chr.length}
                centromereStart={chr.centromereStart}
                centromereEnd={chr.centromereEnd}
                width={CHR_WIDTH}
                height={h}
                detail="low"
                hovered={isHovered}
              />
              <span style={{
                color: isHovered ? COLOR.accent.teal : COLOR.text.tertiary,
                fontSize: 9,
                fontFamily: FONT_FAMILY,
                fontWeight: isHovered ? WEIGHT.medium : WEIGHT.normal,
                letterSpacing: '0.02em',
                transition: 'color 0.15s',
                userSelect: 'none',
              }}>
                {label}
              </span>
            </div>
          );
        })}

        {/* chrM as small teal circle at the end */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: SPACE[1],
            cursor: 'pointer',
            alignSelf: 'flex-end',
          }}
          onMouseEnter={() => setHoveredChr('chrM')}
          onMouseLeave={() => setHoveredChr(null)}
          onClick={() => onSelectChromosome('chrM')}
        >
          <ChromosomeSVG
            chrName="chrM"
            bands={[]}
            chrLength={CHR_M.length}
            centromereStart={0}
            centromereEnd={0}
            width={28}
            height={28}
            detail="low"
            hovered={hoveredChr === 'chrM'}
          />
          <span style={{
            color: hoveredChr === 'chrM' ? COLOR.accent.teal : COLOR.text.tertiary,
            fontSize: 9,
            fontFamily: FONT_FAMILY,
            transition: 'color 0.15s',
            userSelect: 'none',
          }}>
            M
          </span>
        </div>
      </div>
    </div>
  );
}
