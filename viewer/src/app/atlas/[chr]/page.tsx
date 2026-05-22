'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getChromosomeByName } from '@/config/chromosomes';
import { CHROMOSOME_FEATURES, type FeatureEntry } from '@/config/chromosomeFeatures';
import { CYTOBANDS } from '@/config/cytobands';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { HighResChromosome } from '@/components/atlas/HighResChromosome';
import { ChromosomeInfoPanel } from '@/components/atlas/ChromosomeInfoPanel';
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
      {open && (
        <div style={{
          border: `1px solid ${COLOR.border.default}`,
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          {rows.map((r, i) => (
            <div
              key={r.term + i}
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
      )}
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
        maxWidth: 1280,
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

        {/* Two-column architecture + info panel */}
        <div style={{
          display: 'flex',
          gap: SPACE[10],
          alignItems: 'flex-start',
          marginBottom: SPACE[12],
          flexWrap: 'wrap',
        }}>
          {/* LEFT: high-res chromosome with cytoband + gene labels */}
          <div style={{ flexShrink: 0 }}>
            <HighResChromosome chr={chrInfo} />
          </div>

          {/* RIGHT: info panel */}
          <div style={{
            flex: 1,
            minWidth: 320,
            paddingLeft: SPACE[6],
            borderLeft: `1px solid ${COLOR.border.subtle}`,
          }}>
            <ChromosomeInfoPanel chr={chrInfo} />
          </div>
        </div>

        {/* Deep-dive accordions for the rich editorial content */}
        {features && (
          <>
            <AccordionSection index="01" title="Physical properties" rows={features.physicalProperties} defaultOpen />
            <AccordionSection index="02" title="Genomic architecture" rows={features.genomicArchitecture} />
            <AccordionSection index="03" title="Disease associations" rows={features.diseaseAssociations} />
            <AccordionSection index="04" title="Evolutionary history" rows={features.evolutionaryHistory} />
            <AccordionSection index="05" title="Biophysical features" rows={features.biophysicalFeatures} />
            <AccordionSection index="06" title="Epigenetic landscape" rows={features.epigeneticLandscape} />
            <AccordionSection index="07" title="Deep cuts" rows={features.deepCuts} />
          </>
        )}
      </section>

      <Footer />
    </main>
  );
}
