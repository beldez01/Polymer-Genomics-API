'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getChromosomeByName } from '@/config/chromosomes';
import { CHROMOSOME_FEATURES } from '@/config/chromosomeFeatures';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { ChromosomeAnalysisContent } from '@/components/atlas/ChromosomeAnalysisContent';
import { COLOR, TYPE, FONT_FAMILY, WEIGHT, SPACE } from '@/config/theme';

function fmtMb(bp: number): string {
  return (bp / 1_000_000).toFixed(1) + ' Mb';
}

function fmtKb(bp: number): string {
  return (bp / 1_000).toFixed(1) + ' kb';
}

export default function ChromosomeAnalysisPage() {
  const params = useParams<{ chr: string }>();
  const chrName = params.chr ?? '';
  const chrInfo = getChromosomeByName(chrName);

  if (!chrInfo) {
    return (
      <div style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh', fontFamily: FONT_FAMILY }}>
        <BrandBar subtitle="Analysis · hg38" sticky />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
        }}>
          <span style={{ color: COLOR.text.muted, fontSize: TYPE.base.fontSize, fontFamily: FONT_FAMILY }}>
            Chromosome &ldquo;{chrName}&rdquo; not found.
          </span>
        </div>
        <Footer />
      </div>
    );
  }

  const sizeStr = chrInfo.name === 'chrM' ? fmtKb(chrInfo.length) : fmtMb(chrInfo.length);
  const features = CHROMOSOME_FEATURES[chrInfo.name];

  return (
    <div style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      fontFamily: FONT_FAMILY,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <BrandBar subtitle={`Analysis · ${chrInfo.name} · hg38`} sticky />

      <main style={{
        flex: 1,
        maxWidth: 900,
        margin: '0 auto',
        padding: `${SPACE[8]}px ${SPACE[6]}px ${SPACE[12]}px`,
        width: '100%',
      }}>
        {/* Back link */}
        <Link
          href={`/atlas?chr=${chrInfo.name}`}
          style={{
            color: COLOR.text.secondary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: SPACE[1],
            marginBottom: SPACE[6],
          }}
        >
          <span style={{ fontSize: TYPE.md.fontSize }}>&#8592;</span> Back to {chrInfo.name}
        </Link>

        {/* Header */}
        <div style={{ marginBottom: SPACE[6] }}>
          <h1 style={{
            color: COLOR.accent.teal,
            fontSize: TYPE['2xl'].fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.bold,
            letterSpacing: '-0.03em',
            margin: 0,
          }}>
            {chrInfo.name === 'chrM' ? 'Mitochondrial Genome' : `Chromosome ${chrInfo.name.replace('chr', '')}`}
          </h1>
          <span style={{
            color: COLOR.text.muted,
            fontSize: TYPE.base.fontSize,
            fontFamily: FONT_FAMILY,
          }}>
            {sizeStr} &middot; GRCh38/hg38
          </span>
        </div>

        {/* Rich content or fallback */}
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
            padding: `${SPACE[8]}px ${SPACE[6]}px`,
            textAlign: 'center',
          }}>
            <span style={{
              color: COLOR.text.muted,
              fontSize: TYPE.base.fontSize,
              fontFamily: FONT_FAMILY,
            }}>
              Analysis content for {chrInfo.name} is coming soon.
            </span>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
