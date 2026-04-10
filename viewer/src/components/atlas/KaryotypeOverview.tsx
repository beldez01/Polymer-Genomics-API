'use client';

import { useState } from 'react';
import { CHROMOSOMES, GENOME_LENGTH, ChromosomeInfo } from '@/config/chromosomes';
import { getBandsForChromosome } from '@/config/cytobands';
import { ChromosomeSVG } from './ChromosomeSVG';
import { COLOR, TYPE, FONT_FAMILY, WEIGHT, SPACE } from '@/config/theme';
import type { LayerSummary } from '@/lib/api';
import type { IsochoreBin } from '@/lib/isochore';
import { KARYOTYPE_ISOCHORES } from '@/config/karyotypeIsochores';

interface ChrStats {
  genes: number | null;
  cpgIslands: number | null;
  probes: number | null;
  loaded: boolean;
}

interface KaryotypeOverviewProps {
  onSelectChromosome: (chrName: string) => void;
  chrStats?: Record<string, ChrStats>;
  /** Authoritative genome-wide summary from /v1/layers/summary */
  layerSummary?: LayerSummary | null;
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

interface StatItem {
  label: string;
  value: string;
}

export function KaryotypeOverview({ onSelectChromosome, chrStats, layerSummary }: KaryotypeOverviewProps) {
  const [hoveredChr, setHoveredChr] = useState<string | null>(null);

  // Compute genome overview stats — authoritative counts from /v1/layers/summary,
  // falling back to per-chromosome aggregation sums until summary loads.
  let totalGenes: number | null = null;
  let totalCpgSites: number | null = null;
  let totalCpgIslands: number | null = null;
  let totalProbes: number | null = null;
  let geneLabel = 'Genes';

  if (layerSummary) {
    const counts = layerSummary.layer_counts ?? {};
    totalGenes = layerSummary.protein_coding_genes ?? layerSummary.total_genes ?? null;
    totalCpgSites = counts['cpg_sites'] ?? null;
    totalCpgIslands = counts['cpg_islands'] ?? null;
    totalProbes = counts['probe_epic_v2'] ?? null;
    if (layerSummary.protein_coding_genes != null) geneLabel = 'Protein-coding genes';
  } else if (chrStats) {
    const entries = Object.entries(chrStats).filter(([name]) => name !== 'chrM');
    const allLoaded = entries.every(([, s]) => s.loaded);
    if (allLoaded && entries.some(([, s]) => s.genes !== null)) {
      totalGenes = entries.reduce((s, [, v]) => s + (v.genes ?? 0), 0);
      totalProbes = entries.reduce((s, [, v]) => s + (v.probes ?? 0), 0);
    }
  }

  const genomeSizeGb = (GENOME_LENGTH / 1_000_000_000).toFixed(2);

  const leftStats: StatItem[] = [
    { label: 'Genome size', value: `${genomeSizeGb} Gb` },
    { label: 'Chromosomes', value: '24' },
  ];
  if (totalGenes != null) {
    leftStats.push({ label: geneLabel, value: totalGenes.toLocaleString() });
  }

  const rightStats: StatItem[] = [];
  if (totalCpgSites != null) {
    rightStats.push({ label: 'CpG sites', value: totalCpgSites.toLocaleString() });
  }
  if (totalCpgIslands != null) {
    rightStats.push({ label: 'CpG islands', value: totalCpgIslands.toLocaleString() });
  }
  if (totalProbes != null) {
    rightStats.push({ label: 'EPIC v2 probes', value: totalProbes.toLocaleString() });
  }

  const renderStat = (stat: StatItem, align: 'left' | 'right') => (
    <div
      key={stat.label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE[1] + 2,
        textAlign: align,
      }}
    >
      <span style={{
        color: COLOR.text.primary,
        fontSize: TYPE.xl.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.medium,
        letterSpacing: '-0.02em',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {stat.value}
      </span>
      <span style={{
        color: COLOR.text.tertiary,
        fontSize: TYPE.sm.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.normal,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
      }}>
        {stat.label}
      </span>
    </div>
  );

  return (
    <section style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: `${SPACE[8]}px ${SPACE[6]}px ${SPACE[6]}px`,
    }}>
      {/* Editorial overline */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[3],
        marginBottom: SPACE[8],
      }}>
        <span style={{
          color: COLOR.accent.teal,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          GRCh38 / hg38
        </span>
        <div style={{
          flex: 1,
          height: 1,
          backgroundColor: COLOR.border.strong,
        }} />
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          Genome Reference
        </span>
      </div>

      {/* Flanked layout: left stats | karyotype | right stats — all bottom-aligned */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr 160px',
        gap: SPACE[6],
        alignItems: 'end',
      }}>
        {/* Left stats column */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE[6],
          paddingBottom: SPACE[4],
        }}>
          {leftStats.map((s) => renderStat(s, 'right'))}
        </div>

        {/* Center column: karyotype only */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: SPACE[4],
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
                  isochoreBins={KARYOTYPE_ISOCHORES[chr.name]}
                />
                <span style={{
                  color: isHovered ? COLOR.accent.teal : COLOR.text.tertiary,
                  fontSize: 11,
                  fontFamily: FONT_FAMILY,
                  fontWeight: isHovered ? WEIGHT.medium : WEIGHT.normal,
                  letterSpacing: '0.04em',
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
              fontSize: 11,
              fontFamily: FONT_FAMILY,
              letterSpacing: '0.04em',
              transition: 'color 0.15s',
              userSelect: 'none',
            }}>
              M
            </span>
          </div>
        </div>

        {/* Right stats column */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE[6],
          paddingBottom: SPACE[4],
        }}>
          {rightStats.map((s) => renderStat(s, 'left'))}
        </div>
      </div>

      {/* Isochore legend — anchored below, aligned with the baseline */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: SPACE[5],
        marginTop: SPACE[6],
        paddingTop: SPACE[4],
        borderTop: `1px solid ${COLOR.border.subtle}`,
      }}>
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
        }}>
          Isochores
        </span>
        {(['L1', 'L2', 'H1', 'H2', 'H3'] as const).map(cls => (
          <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: SPACE[1] + 2 }}>
            <div style={{
              width: 12,
              height: 12,
              backgroundColor: COLOR.isochore[cls],
              borderRadius: 1,
            }} />
            <span style={{
              color: COLOR.text.tertiary,
              fontSize: TYPE.sm.fontSize,
              fontFamily: FONT_FAMILY,
              letterSpacing: '0.06em',
            }}>
              {cls}
            </span>
          </div>
        ))}
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.1em',
          marginLeft: SPACE[2],
        }}>
          AT-rich &rarr; GC-rich
        </span>
      </div>
    </section>
  );
}
