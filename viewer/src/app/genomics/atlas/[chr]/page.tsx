'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getChromosomeByName } from '@/config/chromosomes';
import { CHROMOSOME_FEATURES, type FeatureEntry } from '@/config/chromosomeFeatures';
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
  return `/genomics/view/hg38/${chrName}:${start}-${end}?layers=${LAYERS}`;
}

function fmtMb(bp: number): string { return (bp / 1_000_000).toFixed(1) + ' Mb'; }
function fmtKb(bp: number): string { return (bp / 1_000).toFixed(1) + ' kb'; }

const DEEP_DIVE_TABS = [
  { id: 'architecture', label: 'Architecture',  key: 'genomicArchitecture'  as const },
  { id: 'disease',      label: 'Disease',       key: 'diseaseAssociations'  as const },
  { id: 'evolution',    label: 'Evolution',     key: 'evolutionaryHistory'  as const },
  { id: 'biophysics',   label: 'Biophysics',    key: 'biophysicalFeatures'  as const },
  { id: 'epigenetics',  label: 'Epigenetics',   key: 'epigeneticLandscape'  as const },
  { id: 'deep_cuts',    label: 'Deep cuts',     key: 'deepCuts'             as const },
];

interface DeepDiveProps {
  features: ReturnType<typeof getFeatures>;
}

function getFeatures(chrName: string) {
  return CHROMOSOME_FEATURES[chrName];
}

function DeepDive({ features }: DeepDiveProps) {
  const available = DEEP_DIVE_TABS.filter((t) => (features?.[t.key]?.length ?? 0) > 0);
  const [activeId, setActiveId] = useState<string>(available[0]?.id ?? '');
  if (available.length === 0 || !features) return null;
  const active = available.find((t) => t.id === activeId) ?? available[0];
  const rows: FeatureEntry[] = features[active.key] as FeatureEntry[];

  return (
    <section style={{ marginTop: SPACE[10] }}>
      {/* Tab strip — eyebrow + horizontal tabs in one line */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: SPACE[4],
        paddingBottom: SPACE[3],
        marginBottom: SPACE[5],
        borderBottom: `1px solid ${COLOR.border.strong}`,
      }}>
        <span style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          § Deep dive
        </span>
        <div style={{ display: 'flex', gap: 0, marginLeft: 'auto' }}>
          {available.map((t) => {
            const isActive = t.id === active.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? COLOR.primary.base : 'transparent'}`,
                  marginBottom: -1,
                  padding: `${SPACE[2]}px ${SPACE[3] + 2}px`,
                  color: isActive ? COLOR.primary.base : COLOR.text.tertiary,
                  fontFamily: FONT_FAMILY,
                  fontSize: TYPE.sm.fontSize,
                  fontWeight: isActive ? WEIGHT.semibold : WEIGHT.medium,
                  letterSpacing: '0.01em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.12s, border-color 0.12s',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active section content as striped term/detail table */}
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
              gridTemplateColumns: '200px 1fr',
              gap: SPACE[5],
              padding: `${SPACE[3]}px ${SPACE[5]}px`,
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
              lineHeight: 1.6,
            }}>
              {r.detail}
            </span>
          </div>
        ))}
      </div>
    </section>
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
            <Link href="/genomics/atlas" style={{ color: COLOR.primary.base, textDecoration: 'none' }}>
              Back to the atlas
            </Link>
            .
          </span>
        </section>
        <Footer />
      </main>
    );
  }

  const features = CHROMOSOME_FEATURES[chrInfo.name];
  const isMito = chrInfo.name === 'chrM';
  const chrLabel = isMito ? 'Mitochondrial Genome' : `Chromosome ${chrInfo.name.replace('chr', '')}`;

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
        maxWidth: 1080,
        width: '100%',
        margin: '0 auto',
        padding: `${SPACE[10]}px ${SPACE[6]}px ${SPACE[16]}px`,
      }}>
        {/* Compact header — title + CTA on one line */}
        <header style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: SPACE[4],
          flexWrap: 'wrap',
          paddingBottom: SPACE[3],
          borderBottom: `1px solid ${COLOR.border.subtle}`,
          marginBottom: SPACE[8],
        }}>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: SPACE[4] }}>
            <Link
              href="/genomics/atlas"
              style={{
                color: COLOR.text.tertiary,
                fontFamily: FONT_FAMILY_MONO,
                fontSize: TYPE.xs.fontSize,
                fontWeight: WEIGHT.medium,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <span aria-hidden>←</span> Atlas
            </Link>
            <h1 style={{
              margin: 0,
              color: COLOR.primary.base,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.lg.fontSize,
              lineHeight: 1,
              letterSpacing: TYPE.lg.letterSpacing,
              fontWeight: WEIGHT.bold,
            }}>
              {chrLabel}
            </h1>
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
              fontSize: TYPE.sm.fontSize,
              fontWeight: WEIGHT.medium,
              textDecoration: 'none',
              padding: `${SPACE[2]}px ${SPACE[4]}px`,
              borderRadius: 2,
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Open {chrInfo.name} in viewer <span aria-hidden>→</span>
          </Link>
        </header>

        {/* Two-column hero: chromosome | info panel */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(440px, auto) 1fr',
          gap: SPACE[10],
          alignItems: 'flex-start',
        }}>
          {/* LEFT: chromosome with isochore coloring + cytoband labels + gene labels */}
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <HighResChromosome chr={chrInfo} />
          </div>

          {/* RIGHT: tabular info panel */}
          <ChromosomeInfoPanel chr={chrInfo} />
        </div>

        {/* Single tabbed deep-dive */}
        {features && <DeepDive features={features} />}
      </section>

      <Footer />
    </main>
  );
}
