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

export function KaryotypeOverview({ onSelectChromosome, chrStats, layerSummary }: KaryotypeOverviewProps) {
  const [hoveredChr, setHoveredChr] = useState<string | null>(null);

  return (
    <div style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: `${SPACE[8]}px ${SPACE[4]}px ${SPACE[12]}px`,
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: SPACE[6] }}>
        <h1 style={{
          color: COLOR.text.primary,
          fontSize: TYPE.xl.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          letterSpacing: TYPE.xl.letterSpacing,
          margin: 0,
        }}>
          Digital Karyotype
        </h1>
      </div>

      {/* Single row — all chromosomes bottom-aligned */}
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
            fontSize: 11,
            fontFamily: FONT_FAMILY,
            transition: 'color 0.15s',
            userSelect: 'none',
          }}>
            M
          </span>
        </div>
      </div>

      {/* Isochore legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: SPACE[4],
        marginTop: SPACE[4],
      }}>
        {(['L1', 'L2', 'H1', 'H2', 'H3'] as const).map(cls => (
          <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: SPACE[1] }}>
            <div style={{
              width: 10,
              height: 10,
              backgroundColor: COLOR.isochore[cls],
              borderRadius: 1,
            }} />
            <span style={{
              color: COLOR.text.tertiary,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
            }}>
              {cls}
            </span>
          </div>
        ))}
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          marginLeft: SPACE[2],
        }}>
          AT-rich &larr; &rarr; GC-rich
        </span>
      </div>

      {/* Genome Overview summary */}
      {(() => {
        // Use authoritative counts from /v1/layers/summary when available;
        // fall back to aggregation sums only if summary hasn't loaded yet.

        let totalGenes: number | null = null;
        let totalCpgSites: number | null = null;
        let totalCpgIslands: number | null = null;
        let totalProbes: number | null = null;

        if (layerSummary) {
          const counts = layerSummary.layer_counts ?? {};
          // Prefer protein_coding count; fall back to total gene count
          totalGenes = layerSummary.protein_coding_genes ?? layerSummary.total_genes ?? null;
          totalCpgSites = counts['cpg_sites'] ?? null;
          totalCpgIslands = counts['cpg_islands'] ?? null;
          totalProbes = counts['probe_epic_v2'] ?? null;
        } else if (chrStats) {
          const entries = Object.entries(chrStats).filter(([name]) => name !== 'chrM');
          const allLoaded = entries.every(([, s]) => s.loaded);
          if (!allLoaded) return null;
          const anyData = entries.some(([, s]) => s.genes !== null);
          if (!anyData) return null;
          // Aggregation fallback (known to undercount — used only until summary loads)
          totalGenes = entries.reduce((s, [, v]) => s + (v.genes ?? 0), 0);
          totalProbes = entries.reduce((s, [, v]) => s + (v.probes ?? 0), 0);
        } else {
          return null;
        }

        if (totalGenes === null && totalCpgSites === null && totalProbes === null) return null;

        // Label depends on whether we have protein-coding or total gene count
        const geneLabel = layerSummary?.protein_coding_genes != null
          ? 'Protein-coding genes'
          : 'Genes';
        const genomeSizeGb = (GENOME_LENGTH / 1_000_000_000).toFixed(2);

        const statItemStyle = {
          display: 'flex' as const,
          flexDirection: 'column' as const,
          alignItems: 'center' as const,
          gap: SPACE[1],
        };
        const statValueStyle = {
          color: COLOR.text.secondary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
        };
        const statLabelStyle = {
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
        };

        return (
          <div style={{
            maxWidth: 800,
            margin: `${SPACE[8]}px auto 0`,
            backgroundColor: COLOR.bg.elevated,
            border: `1px solid ${COLOR.border.subtle}`,
            padding: `${SPACE[5]}px ${SPACE[6]}px`,
          }}>
            <div style={{
              color: COLOR.accent.teal,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              fontWeight: WEIGHT.medium,
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              marginBottom: SPACE[4],
            }}>
              Genome Overview
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              flexWrap: 'wrap',
              gap: SPACE[4],
              marginBottom: SPACE[4],
            }}>
              <div style={statItemStyle}>
                <span style={statValueStyle}>{genomeSizeGb} Gb</span>
                <span style={statLabelStyle}>Genome size</span>
              </div>
              <div style={statItemStyle}>
                <span style={statValueStyle}>24</span>
                <span style={statLabelStyle}>Chromosomes</span>
              </div>
              {totalGenes != null && (
                <div style={statItemStyle}>
                  <span style={statValueStyle}>{totalGenes.toLocaleString()}</span>
                  <span style={statLabelStyle}>{geneLabel}</span>
                </div>
              )}
              {totalCpgSites != null && (
                <div style={statItemStyle}>
                  <span style={statValueStyle}>{totalCpgSites.toLocaleString()}</span>
                  <span style={statLabelStyle}>CpG sites</span>
                </div>
              )}
              {totalCpgIslands != null && (
                <div style={statItemStyle}>
                  <span style={statValueStyle}>{totalCpgIslands.toLocaleString()}</span>
                  <span style={statLabelStyle}>CpG islands</span>
                </div>
              )}
              {totalProbes != null && (
                <div style={statItemStyle}>
                  <span style={statValueStyle}>{totalProbes.toLocaleString()}</span>
                  <span style={statLabelStyle}>EPIC v2 probes</span>
                </div>
              )}
            </div>
            <p style={{
              color: COLOR.text.tertiary,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              lineHeight: 1.6,
              margin: 0,
            }}>
              The human reference genome (GRCh38/hg38) spans {genomeSizeGb} Gb across 22 autosomes, two sex chromosomes, and a 16.6 kb circular mitochondrial genome. Per-chromosome annotations are aggregated from GENCODE v44, CpG island annotations, and Illumina EPIC v2 probe mappings.
            </p>
          </div>
        );
      })()}
    </div>
  );
}
