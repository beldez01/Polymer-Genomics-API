'use client';

import { useState, useMemo } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { ModeTabs } from '@/components/dmp/ModeTabs';
import { SummaryChips } from '@/components/dmp/SummaryChips';
import { VolcanoPlot } from '@/components/dmp/VolcanoPlot';
import { ManhattanPlot } from '@/components/dmp/ManhattanPlot';
import { TopHitsTable } from '@/components/dmp/TopHitsTable';
import { ProbeDetail } from '@/components/dmp/ProbeDetail';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { PROBES, TOP_HITS } from '@/config/methylationMockData';

const subtitle = (
  <span style={{
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 12,
    fontFamily: FONT_FAMILY_MONO,
    fontSize: TYPE.sm.fontSize,
    letterSpacing: '0.04em',
  }}>
    <span style={{ color: COLOR.text.tertiary }}>Methylation</span>
    <span style={{ color: COLOR.border.strong }}>·</span>
    <span style={{ color: COLOR.text.tertiary }}>DMP / TE / clocks</span>
  </span>
);

function SectionHead({ index, label, count }: { index: string; label: string; count?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: SPACE[3],
      paddingBottom: SPACE[3],
      marginBottom: SPACE[4],
      borderBottom: `1px solid ${COLOR.border.strong}`,
    }}>
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
      }}>
        {label}
      </span>
      {count && (
        <>
          <span style={{ flex: 1 }} />
          <span className="tabular" style={{
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            letterSpacing: '0.04em',
          }}>
            {count}
          </span>
        </>
      )}
    </div>
  );
}

export default function MethylationPage() {
  const [mode, setMode] = useState('dmp');
  const [subTab, setSubTab] = useState('volcano');
  // Default to the top hit so detail panel has content on load
  const [selectedId, setSelectedId] = useState<string | undefined>(TOP_HITS[0]?.id);

  const selectedProbe = useMemo(
    () => PROBES.find((p) => p.id === selectedId) ?? null,
    [selectedId],
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
        padding: `${SPACE[12]}px ${SPACE[6]}px ${SPACE[16]}px`,
        flex: 1,
      }}>
        {/* Page header */}
        <div style={{ marginBottom: SPACE[10] }}>
          <div style={{
            color: COLOR.text.faint,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: SPACE[3],
          }}>
            § METHYLATION · DMP analysis · 937,690 EPIC v2 probes
          </div>
          <h1 style={{
            margin: 0,
            color: COLOR.primary.base,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.xl.fontSize,
            lineHeight: TYPE.xl.lineHeight,
            letterSpacing: TYPE.xl.letterSpacing,
            fontWeight: WEIGHT.bold,
            marginBottom: SPACE[3],
          }}>
            Methylation
          </h1>
          <p style={{
            margin: 0,
            maxWidth: 720,
            color: COLOR.text.secondary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            lineHeight: 1.55,
          }}>
            Differentially-methylated probes, TE/ERV family scoring, methylation-based
            clocks (Retro-Age, Horvath, Hannum), enrichment, and cross-cohort comparison.
            EPIC v2 + EPIC v1 + 450K platforms supported.
          </p>
        </div>

        {/* Mode + sub-tab strip */}
        <div style={{ marginBottom: SPACE[10] }}>
          <ModeTabs
            activeMode={mode}
            onModeChange={setMode}
            activeSubTab={subTab}
            onSubTabChange={setSubTab}
          />
        </div>

        {/* Summary */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead index="01" label="Summary" count="2 groups · 1,394 sig probes" />
          <SummaryChips />
        </div>

        {/* Volcano */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead
            index="02"
            label="Volcano plot"
            count={`|Δβ| > 0.05 · −log₁₀p > 7.3 · ${PROBES.length.toLocaleString()} probes`}
          />
          <VolcanoPlot
            selectedProbeId={selectedId}
            onProbeSelect={setSelectedId}
          />
        </div>

        {/* Manhattan */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead
            index="03"
            label="Manhattan plot"
            count="24 chromosomes"
          />
          <ManhattanPlot
            selectedProbeId={selectedId}
            onProbeSelect={setSelectedId}
          />
        </div>

        {/* Top hits */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead index="04" label="Top hits" count="Top 10 by p-value" />
          <TopHitsTable
            selectedProbeId={selectedId}
            onProbeSelect={setSelectedId}
          />
        </div>

        {/* Probe detail */}
        <div style={{ marginBottom: SPACE[8] }}>
          <SectionHead index="05" label="Probe detail" count={selectedProbe?.id} />
          <ProbeDetail probe={selectedProbe} />
        </div>
      </section>

      <Footer />
    </main>
  );
}
