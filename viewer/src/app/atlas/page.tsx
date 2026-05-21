'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { ChromosomeSVG } from '@/components/atlas/ChromosomeSVG';
import { GeneSearch } from '@/components/atlas/GeneSearch';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import {
  KARYOTYPE,
  KARYOTYPE_MAX_LEN,
  CHR_M,
  GENOME_STATS,
  getIsochoreBins,
} from '@/config/karyotypeData';

// All atlas clicks navigate to the working mock viewer (TP53) for now.
const VIEWER_HREF = '/view/hg38/chr17:7668421-7687490';

const MAX_CHR_HEIGHT = 340;
const CHR_WIDTH = 22;

function chrHeight(length: number): number {
  return Math.max(36, Math.round((length / KARYOTYPE_MAX_LEN) * MAX_CHR_HEIGHT));
}

interface StatProps { label: string; value: string; align: 'left' | 'right' }

function Stat({ label, value, align }: StatProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE[1] + 2,
      textAlign: align,
    }}>
      <span className="tabular" style={{
        color: COLOR.text.primary,
        fontSize: TYPE.xl.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.semibold,
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}>
        {value}
      </span>
      <span style={{
        color: COLOR.text.tertiary,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY_MONO,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  );
}

export default function AtlasPage() {
  const [hoveredChr, setHoveredChr] = useState<string | null>(null);

  const subtitle = (
    <span style={{
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: 12,
      fontFamily: FONT_FAMILY_MONO,
      fontSize: TYPE.sm.fontSize,
      letterSpacing: '0.04em',
    }}>
      <span style={{ color: COLOR.text.tertiary }}>Chromosome Atlas</span>
      <span style={{ color: COLOR.border.strong }}>·</span>
      <span style={{ color: COLOR.text.tertiary }}>hg38</span>
    </span>
  );

  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <BrandBar sticky subtitle={subtitle} />

      <section style={{
        maxWidth: 1280,
        width: '100%',
        margin: '0 auto',
        padding: `${SPACE[12]}px ${SPACE[6]}px ${SPACE[8]}px`,
        flex: 1,
      }}>
        {/* Gene search — typeahead above the karyotype */}
        <div style={{ marginBottom: SPACE[10] }}>
          <GeneSearch />
        </div>

        {/* Editorial overline — GRCh38 / hg38 ━━━━━━━━━━━━ GENOME REFERENCE */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[3],
          marginBottom: SPACE[10],
        }}>
          <span style={{
            color: COLOR.primary.base,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY_MONO,
            fontWeight: WEIGHT.semibold,
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
            color: COLOR.text.tertiary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY_MONO,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            Genome Reference
          </span>
        </div>

        {/* Flanked layout: [stats] [karyotype] [stats], bottom-aligned */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '180px 1fr 180px',
          gap: SPACE[6],
          alignItems: 'end',
        }}>
          {/* Left stats column — right-aligned text so it reads "as you approach the karyotype" */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE[6],
            paddingBottom: SPACE[4],
          }}>
            {GENOME_STATS.left.map((s) => (
              <Stat key={s.label} label={s.label} value={s.value} align="right" />
            ))}
          </div>

          {/* Center column: karyotype */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: SPACE[3],
            flexWrap: 'nowrap',
          }}>
            {KARYOTYPE.map((chr) => {
              const h = chrHeight(chr.length);
              const isHovered = hoveredChr === chr.name;
              const label = chr.name.replace('chr', '');
              const bins = getIsochoreBins(chr.name);
              return (
                <Link
                  key={chr.name}
                  href={VIEWER_HREF}
                  onMouseEnter={() => setHoveredChr(chr.name)}
                  onMouseLeave={() => setHoveredChr(null)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: SPACE[1] + 2,
                    position: 'relative',
                    textDecoration: 'none',
                  }}
                >
                  {/* Hover tooltip */}
                  {isHovered && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: 6,
                      backgroundColor: COLOR.bg.elevated,
                      border: `1px solid ${COLOR.border.strong}`,
                      borderRadius: 2,
                      padding: `${SPACE[1]}px ${SPACE[2]}px`,
                      fontSize: TYPE.xs.fontSize,
                      fontFamily: FONT_FAMILY_MONO,
                      color: COLOR.text.secondary,
                      whiteSpace: 'nowrap',
                      zIndex: 50,
                      pointerEvents: 'none',
                      letterSpacing: '0.04em',
                    }}>
                      {chr.name} · {(chr.length / 1e6).toFixed(1)} Mb
                    </div>
                  )}
                  <ChromosomeSVG
                    chrName={chr.name}
                    width={CHR_WIDTH}
                    height={h}
                    centromereStart={chr.centromereStart}
                    centromereEnd={chr.centromereEnd}
                    isochoreBins={bins}
                    hovered={isHovered}
                  />
                  <span style={{
                    color: isHovered ? COLOR.primary.base : COLOR.text.tertiary,
                    fontSize: 11,
                    fontFamily: FONT_FAMILY_MONO,
                    fontWeight: isHovered ? WEIGHT.semibold : WEIGHT.medium,
                    letterSpacing: '0.04em',
                    transition: 'color 0.15s',
                    userSelect: 'none',
                  }}>
                    {label}
                  </span>
                </Link>
              );
            })}

            {/* chrM — small electric-blue ring at the end */}
            <Link
              href={VIEWER_HREF}
              onMouseEnter={() => setHoveredChr('chrM')}
              onMouseLeave={() => setHoveredChr(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: SPACE[1] + 2,
                alignSelf: 'flex-end',
                position: 'relative',
                textDecoration: 'none',
              }}
            >
              {hoveredChr === 'chrM' && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 6,
                  backgroundColor: COLOR.bg.elevated,
                  border: `1px solid ${COLOR.border.strong}`,
                  borderRadius: 2,
                  padding: `${SPACE[1]}px ${SPACE[2]}px`,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY_MONO,
                  color: COLOR.text.secondary,
                  whiteSpace: 'nowrap',
                  zIndex: 50,
                  pointerEvents: 'none',
                  letterSpacing: '0.04em',
                }}>
                  chrM · {(CHR_M.length / 1000).toFixed(1)} kb (mitochondrial)
                </div>
              )}
              <ChromosomeSVG
                chrName="chrM"
                width={28}
                height={28}
                centromereStart={0}
                centromereEnd={0}
                hovered={hoveredChr === 'chrM'}
              />
              <span style={{
                color: hoveredChr === 'chrM' ? COLOR.primary.base : COLOR.text.tertiary,
                fontSize: 11,
                fontFamily: FONT_FAMILY_MONO,
                fontWeight: hoveredChr === 'chrM' ? WEIGHT.semibold : WEIGHT.medium,
                letterSpacing: '0.04em',
                transition: 'color 0.15s',
                userSelect: 'none',
              }}>
                M
              </span>
            </Link>
          </div>

          {/* Right stats column — left-aligned */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE[6],
            paddingBottom: SPACE[4],
          }}>
            {GENOME_STATS.right.map((s) => (
              <Stat key={s.label} label={s.label} value={s.value} align="left" />
            ))}
          </div>
        </div>

        {/* Isochore legend — anchored below */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: SPACE[5],
          marginTop: SPACE[10],
          paddingTop: SPACE[5],
          borderTop: `1px solid ${COLOR.border.subtle}`,
        }}>
          <span style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY_MONO,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}>
            Isochores
          </span>
          {(['L1', 'L2', 'H1', 'H2', 'H3'] as const).map((cls) => (
            <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: SPACE[1] + 2 }}>
              <div style={{
                width: 14,
                height: 14,
                backgroundColor: COLOR.isochore[cls],
                border: `1px solid ${COLOR.border.subtle}`,
              }} />
              <span style={{
                color: COLOR.text.secondary,
                fontSize: TYPE.sm.fontSize,
                fontFamily: FONT_FAMILY_MONO,
                fontWeight: WEIGHT.medium,
                letterSpacing: '0.06em',
              }}>
                {cls}
              </span>
            </div>
          ))}
          <span style={{
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY_MONO,
            letterSpacing: '0.1em',
            marginLeft: SPACE[2],
            textTransform: 'uppercase',
          }}>
            AT-rich → GC-rich
          </span>
        </div>
      </section>

      <Footer />
    </main>
  );
}
