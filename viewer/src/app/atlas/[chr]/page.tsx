'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getChromosomeByName } from '@/config/chromosomes';
import { CHROMOSOME_FEATURES } from '@/config/chromosomeFeatures';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { ChromosomeAnalysisContent } from '@/components/atlas/ChromosomeAnalysisContent';
import { COLOR, TYPE, FONT_FAMILY, FONT_FAMILY_MONO, WEIGHT, SPACE } from '@/config/theme';

const LAYERS = 'gencode_v44,cpg_sites,probe_epic_v2,isochores';

// Same viewer-URL helper as /atlas — opens at the chromosome's center
// with a 1 Mb window (or the whole chromosome if shorter, e.g. chrM).
function viewerHrefFor(chrName: string, length: number): string {
  const targetWidth = Math.min(1_000_000, length);
  const center = Math.round(length / 2);
  const start = Math.max(1, center - Math.floor(targetWidth / 2));
  const end = Math.min(length, start + targetWidth - 1);
  return `/view/hg38/${chrName}:${start}-${end}?layers=${LAYERS}`;
}

function fmtMb(bp: number): string { return (bp / 1_000_000).toFixed(1) + ' Mb'; }
function fmtKb(bp: number): string { return (bp / 1_000).toFixed(1) + ' kb'; }

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
        maxWidth: 960,
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

        {/* Header — overline / title / subtitle / CTA */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: SPACE[4],
          flexWrap: 'wrap',
          paddingBottom: SPACE[5],
          marginBottom: SPACE[8],
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
            </p>
          </div>

          {/* Open in viewer CTA */}
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

        {/* Analysis content */}
        {features ? (
          <ChromosomeAnalysisContent
            chrName={chrInfo.name}
            features={features}
            build="hg38"
          />
        ) : (
          <div style={{
            backgroundColor: COLOR.bg.elevated,
            border: `1px solid ${COLOR.border.subtle}`,
            borderRadius: 2,
            padding: `${SPACE[8]}px ${SPACE[6]}px`,
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
