'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getChromosomeByName } from '@/config/chromosomes';
import { CHROMOSOME_FEATURES, type FeatureEntry, type GeneEntry } from '@/config/chromosomeFeatures';
import { CYTOBANDS } from '@/config/cytobands';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { ChromosomeArchitecture } from '@/components/atlas/ChromosomeArchitecture';
import { COLOR, TYPE, FONT_FAMILY, FONT_FAMILY_MONO, WEIGHT, SPACE } from '@/config/theme';

const LAYERS = 'gencode_v44,cpg_sites,probe_epic_v2,isochores';

function viewerHrefFor(chrName: string, length: number): string {
  const targetWidth = Math.min(1_000_000, length);
  const center = Math.round(length / 2);
  const start = Math.max(1, center - Math.floor(targetWidth / 2));
  const end = Math.min(length, start + targetWidth - 1);
  return `/view/hg38/${chrName}:${start}-${end}?layers=${LAYERS}`;
}

function fmtMb(bp: number): string { return (bp / 1_000_000).toFixed(1) + ' Mb'; }
function fmtKb(bp: number): string { return (bp / 1_000).toFixed(1) + ' kb'; }

interface PropertyTableProps { rows: FeatureEntry[] }
function PropertyTable({ rows }: PropertyTableProps) {
  return (
    <div style={{
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      overflow: 'hidden',
    }}>
      {rows.map((r, i) => (
        <div
          key={r.term}
          style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr',
            gap: SPACE[4],
            padding: `${SPACE[3]}px ${SPACE[4]}px`,
            borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${COLOR.border.subtle}`,
            backgroundColor: i % 2 === 0 ? COLOR.bg.elevated : COLOR.bg.deep,
            alignItems: 'baseline',
          }}
        >
          <span style={{
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            {r.term}
          </span>
          <span style={{
            color: COLOR.text.primary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            lineHeight: 1.55,
          }}>
            {r.detail}
          </span>
        </div>
      ))}
    </div>
  );
}

interface AccordionSectionProps { index: string; title: string; rows: FeatureEntry[]; defaultOpen?: boolean }
function AccordionSection({ index, title, rows, defaultOpen }: AccordionSectionProps) {
  const [open, setOpen] = useState(!!defaultOpen);
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: SPACE[5] }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          backgroundColor: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${COLOR.border.strong}`,
          padding: `${SPACE[3]}px ${SPACE[1]}px`,
          marginBottom: SPACE[3],
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'baseline',
          gap: SPACE[3],
        }}
      >
        <span style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.1em',
        }}>
          §{index}
        </span>
        <span style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          flex: 1,
        }}>
          {title}
        </span>
        <span style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
        }}>
          {rows.length}
        </span>
        <span style={{
          color: COLOR.primary.base,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          fontWeight: WEIGHT.semibold,
          width: 14,
          textAlign: 'center',
        }}>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && <PropertyTable rows={rows} />}
    </div>
  );
}

interface GeneTableProps { genes: GeneEntry[] }
function GeneTable({ genes }: GeneTableProps) {
  return (
    <div style={{
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '120px 100px 1fr',
        gap: SPACE[4],
        padding: `${SPACE[2] + 2}px ${SPACE[4]}px`,
        backgroundColor: COLOR.bg.elevated,
        borderBottom: `1px solid ${COLOR.border.subtle}`,
      }}>
        {['Symbol', 'Band', 'Detail'].map((h) => (
          <span key={h} style={{
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: 10,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}>
            {h}
          </span>
        ))}
      </div>
      {genes.map((g, i) => (
        <div
          key={`${g.symbol}-${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '120px 100px 1fr',
            gap: SPACE[4],
            padding: `${SPACE[3]}px ${SPACE[4]}px`,
            borderBottom: i === genes.length - 1 ? 'none' : `1px solid ${COLOR.border.subtle}`,
            alignItems: 'baseline',
          }}
        >
          <span style={{
            color: COLOR.primary.base,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.sm.fontSize,
            fontWeight: WEIGHT.semibold,
            letterSpacing: '0.02em',
          }}>
            {g.symbol}
          </span>
          <span style={{
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            letterSpacing: '0.04em',
          }}>
            {g.band}
          </span>
          <span style={{
            color: COLOR.text.secondary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            lineHeight: 1.5,
          }}>
            {g.detail}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ChromosomeAnalysisPage() {
  const params = useParams<{ chr: string }>();
  const chrName = params.chr ?? '';
  const chrInfo = getChromosomeByName(chrName);

  const subtitle = chrInfo ? (
    <span style={{
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: 12,
      fontFamily: FONT_FAMILY_MONO,
      fontSize: TYPE.sm.fontSize,
      letterSpacing: '0.04em',
    }}>
      <span style={{ color: COLOR.text.tertiary }}>{chrInfo.name}</span>
      <span style={{ color: COLOR.border.strong }}>·</span>
      <span style={{ color: COLOR.text.tertiary }}>hg38</span>
      <span style={{ color: COLOR.border.strong }}>·</span>
      <span style={{ color: COLOR.text.tertiary }}>
        {chrInfo.name === 'chrM' ? fmtKb(chrInfo.length) : fmtMb(chrInfo.length)}
      </span>
    </span>
  ) : 'Analysis · hg38';

  if (!chrInfo) {
    return (
      <main style={{
        backgroundColor: COLOR.bg.primary,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <BrandBar subtitle={subtitle} sticky />
        <section style={{
          flex: 1,
          maxWidth: 720,
          width: '100%',
          margin: '0 auto',
          padding: `${SPACE[16]}px ${SPACE[6]}px`,
          textAlign: 'center',
        }}>
          <span style={{
            color: COLOR.text.muted,
            fontSize: TYPE.base.fontSize,
            fontFamily: FONT_FAMILY,
          }}>
            Chromosome &ldquo;{chrName}&rdquo; not found.{' '}
            <Link href="/atlas" style={{ color: COLOR.primary.base, textDecoration: 'none' }}>
              Back to the atlas
            </Link>
            .
          </span>
        </section>
        <Footer />
      </main>
    );
  }

  const sizeStr = chrInfo.name === 'chrM' ? fmtKb(chrInfo.length) : fmtMb(chrInfo.length);
  const features = CHROMOSOME_FEATURES[chrInfo.name];
  const isMito = chrInfo.name === 'chrM';
  const chrLabel = isMito ? 'Mitochondrial Genome' : `Chromosome ${chrInfo.name.replace('chr', '')}`;
  const bandCount = CYTOBANDS.filter((b) => b.chrom === chrInfo.name).length;

  // Separate "real" notable genes from descriptive entries (clusters / cassettes)
  const notableGenes = features?.notableGenes ?? [];

  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <BrandBar subtitle={subtitle} sticky />

      <section style={{
        flex: 1,
        maxWidth: 1120,
        width: '100%',
        margin: '0 auto',
        padding: `${SPACE[10]}px ${SPACE[6]}px ${SPACE[16]}px`,
      }}>
        {/* Back link */}
        <Link
          href="/atlas"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: SPACE[2],
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            marginBottom: SPACE[6],
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.primary.base; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.text.tertiary; }}
        >
          <span aria-hidden>←</span> Back to atlas
        </Link>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: SPACE[4],
          flexWrap: 'wrap',
          paddingBottom: SPACE[5],
          marginBottom: SPACE[6],
          borderBottom: `1px solid ${COLOR.border.strong}`,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              color: COLOR.text.faint,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.xs.fontSize,
              fontWeight: WEIGHT.medium,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              marginBottom: SPACE[3],
            }}>
              § CHROMOSOME · {chrInfo.name.replace('chr', '').toUpperCase()} · GRCh38 / hg38
            </div>
            <h1 style={{
              margin: 0,
              color: COLOR.primary.base,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.xl.fontSize,
              lineHeight: TYPE.xl.lineHeight,
              letterSpacing: TYPE.xl.letterSpacing,
              fontWeight: WEIGHT.bold,
              marginBottom: SPACE[2],
            }}>
              {chrLabel}
            </h1>
            <p className="tabular" style={{
              margin: 0,
              color: COLOR.text.secondary,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.sm.fontSize,
              letterSpacing: '0.04em',
            }}>
              {sizeStr}
              {chrInfo.centromereStart > 0 && (
                <>
                  <span style={{ color: COLOR.border.strong }}> · </span>
                  centromere {(chrInfo.centromereStart / 1_000_000).toFixed(1)}–{(chrInfo.centromereEnd / 1_000_000).toFixed(1)} Mb
                </>
              )}
              <span style={{ color: COLOR.border.strong }}> · </span>
              {bandCount} bands
              {notableGenes.length > 0 && (
                <>
                  <span style={{ color: COLOR.border.strong }}> · </span>
                  {notableGenes.length} notable loci
                </>
              )}
            </p>
          </div>

          <Link
            href={viewerHrefFor(chrInfo.name, chrInfo.length)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACE[2],
              backgroundColor: COLOR.primary.base,
              color: COLOR.bg.white,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.base.fontSize,
              fontWeight: WEIGHT.medium,
              textDecoration: 'none',
              padding: `${SPACE[3]}px ${SPACE[5]}px`,
              borderRadius: 2,
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Open {chrInfo.name} in viewer <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Tagline — short italic pull quote, top-loaded */}
        {features?.tagline && (
          <p style={{
            margin: `0 0 ${SPACE[8]}px 0`,
            color: COLOR.text.secondary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.md.fontSize,
            lineHeight: 1.55,
            fontStyle: 'italic',
            paddingLeft: SPACE[4],
            borderLeft: `3px solid ${COLOR.primary.base}`,
            maxWidth: 880,
          }}>
            {features.tagline}
          </p>
        )}

        {/* ARCHITECTURE — chromosome image + notable genes mapped to bands */}
        <div style={{ marginBottom: SPACE[10] }}>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: SPACE[3],
            paddingBottom: SPACE[3],
            marginBottom: SPACE[4],
            borderBottom: `1px solid ${COLOR.border.strong}`,
          }}>
            <span style={{ color: COLOR.text.faint, fontFamily: FONT_FAMILY_MONO, fontSize: TYPE.xs.fontSize, letterSpacing: '0.1em' }}>
              §01
            </span>
            <span style={{
              color: COLOR.text.tertiary,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.sm.fontSize,
              fontWeight: WEIGHT.medium,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}>
              Architecture
            </span>
            <span style={{ flex: 1 }} />
            <span className="tabular" style={{
              color: COLOR.text.tertiary,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.xs.fontSize,
              letterSpacing: '0.04em',
            }}>
              cytobands · notable loci
            </span>
          </div>

          {bandCount > 0 ? (
            <ChromosomeArchitecture
              chrName={chrInfo.name}
              chrLength={chrInfo.length}
              centromereStart={chrInfo.centromereStart}
              centromereEnd={chrInfo.centromereEnd}
              notableGenes={notableGenes.filter((g) => !g.symbol.includes(' ') || g.band)}
            />
          ) : (
            <div style={{
              padding: SPACE[6],
              textAlign: 'center',
              color: COLOR.text.muted,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.sm.fontSize,
              backgroundColor: COLOR.bg.elevated,
              border: `1px solid ${COLOR.border.subtle}`,
              borderRadius: 2,
            }}>
              No cytoband data for {chrInfo.name}.
            </div>
          )}
        </div>

        {/* Editorial sections — collapsible accordions, scannable tabular layouts */}
        {features && (
          <>
            <AccordionSection
              index="02"
              title="Physical properties"
              rows={features.physicalProperties}
              defaultOpen
            />

            {/* Notable genes — also tabular for scan-ability, even though architecture viz shows them visually */}
            {notableGenes.length > 0 && (
              <div style={{ marginBottom: SPACE[5] }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: SPACE[3],
                  paddingBottom: SPACE[3],
                  marginBottom: SPACE[3],
                  borderBottom: `1px solid ${COLOR.border.strong}`,
                }}>
                  <span style={{ color: COLOR.text.faint, fontFamily: FONT_FAMILY_MONO, fontSize: TYPE.xs.fontSize, letterSpacing: '0.1em' }}>
                    §03
                  </span>
                  <span style={{
                    color: COLOR.text.tertiary,
                    fontFamily: FONT_FAMILY_MONO,
                    fontSize: TYPE.sm.fontSize,
                    fontWeight: WEIGHT.medium,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    flex: 1,
                  }}>
                    Notable genes &amp; loci
                  </span>
                  <span className="tabular" style={{
                    color: COLOR.text.tertiary,
                    fontFamily: FONT_FAMILY_MONO,
                    fontSize: TYPE.xs.fontSize,
                  }}>
                    {notableGenes.length}
                  </span>
                </div>
                <GeneTable genes={notableGenes} />
              </div>
            )}

            <AccordionSection index="04" title="Genomic architecture" rows={features.genomicArchitecture} />
            <AccordionSection index="05" title="Disease associations" rows={features.diseaseAssociations} />
            <AccordionSection index="06" title="Evolutionary history" rows={features.evolutionaryHistory} />
            <AccordionSection index="07" title="Biophysical features" rows={features.biophysicalFeatures} />
            <AccordionSection index="08" title="Epigenetic landscape" rows={features.epigeneticLandscape} />
            <AccordionSection index="09" title="Deep cuts" rows={features.deepCuts} />
          </>
        )}

        {!features && (
          <div style={{
            backgroundColor: COLOR.bg.elevated,
            border: `1px solid ${COLOR.border.subtle}`,
            borderRadius: 2,
            padding: `${SPACE[6]}px ${SPACE[6]}px`,
            textAlign: 'center',
          }}>
            <span style={{
              color: COLOR.text.muted,
              fontSize: TYPE.base.fontSize,
              fontFamily: FONT_FAMILY,
            }}>
              Editorial content for {chrInfo.name} is in progress.{' '}
              <Link
                href={viewerHrefFor(chrInfo.name, chrInfo.length)}
                style={{ color: COLOR.primary.base, textDecoration: 'none' }}
              >
                Jump to the viewer →
              </Link>
            </span>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
