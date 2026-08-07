'use client';

import { useState, useCallback } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { LocusCards } from '@/components/hla/LocusCards';
import { AlleleTable } from '@/components/hla/AlleleTable';
import { DivergenceComparison } from '@/components/hla/DivergenceComparison';
import { DivergenceDistribution } from '@/components/hla/DivergenceDistribution';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { LOCI, getLocus, allelesForLocus } from '@/config/hlaMockData';

const subtitle = (
  <span style={{
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 12,
    fontFamily: FONT_FAMILY_MONO,
    fontSize: TYPE.sm.fontSize,
    letterSpacing: '0.04em',
  }}>
    <span style={{ color: COLOR.text.tertiary }}>HLA</span>
    <span style={{ color: COLOR.border.strong }}>·</span>
    <span style={{ color: COLOR.text.tertiary }}>6 transplant loci · biophysics divergence</span>
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
      <span style={{ color: COLOR.text.faint, fontFamily: FONT_FAMILY_MONO, fontSize: TYPE.xs.fontSize, letterSpacing: '0.1em' }}>
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

export default function HLAPage() {
  const [selectedLocus, setSelectedLocus] = useState<string>('B');
  // Two-slot selection for pairwise comparison; pre-populated with first two alleles
  const initialAlleles = allelesForLocus('B').slice(0, 2);
  const [slotA, setSlotA] = useState<string | null>(initialAlleles[0]?.name ?? null);
  const [slotB, setSlotB] = useState<string | null>(initialAlleles[1]?.name ?? null);

  // Click toggles selection across the two slots
  const handleSelect = useCallback((name: string) => {
    if (slotA === name) {
      setSlotA(slotB);
      setSlotB(null);
      return;
    }
    if (slotB === name) {
      setSlotB(null);
      return;
    }
    if (slotA === null) {
      setSlotA(name);
      return;
    }
    if (slotB === null) {
      setSlotB(name);
      return;
    }
    // Both filled — replace A and shift
    setSlotA(slotB);
    setSlotB(name);
  }, [slotA, slotB]);

  // When locus changes, reset comparison
  const onLocusChange = useCallback((id: string) => {
    setSelectedLocus(id);
    const first = allelesForLocus(id).slice(0, 2);
    setSlotA(first[0]?.name ?? null);
    setSlotB(first[1]?.name ?? null);
  }, []);

  const locus = getLocus(selectedLocus);
  const alleleCount = allelesForLocus(selectedLocus).length;

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
            § HLA · 6 transplant loci · {LOCI.reduce((s, l) => s + l.totalAlleles, 0).toLocaleString()} named alleles
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
            HLA biophysics
          </h1>
          <p style={{
            margin: 0,
            maxWidth: 720,
            color: COLOR.text.secondary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            lineHeight: 1.55,
          }}>
            Allele-level biophysics for transplant loci. Non-coding divergence (NCDS),
            expression tier inference, and pairwise comparison at base-pair resolution.
            Coding-identity-matched alleles can still differ markedly in non-coding regions —
            that signal is what Polymer surfaces.
          </p>
        </div>

        {/* Loci */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead
            index="01"
            label="Loci"
            count={`Selected: ${locus?.name} · class ${locus?.class}`}
          />
          <LocusCards selected={selectedLocus} onSelect={onLocusChange} />
        </div>

        {/* Allele table */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead
            index="02"
            label="Alleles"
            count={`${alleleCount} representative · sorted by global frequency`}
          />
          <AlleleTable
            locusId={selectedLocus}
            selectedNames={[slotA, slotB]}
            onSelect={handleSelect}
          />
        </div>

        {/* Pairwise comparison */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead
            index="03"
            label="Pairwise non-coding divergence"
            count="biophysics signature across gene span"
          />
          <DivergenceComparison alleleA={slotA} alleleB={slotB} />
        </div>

        {/* Locus-wide distribution */}
        <div style={{ marginBottom: SPACE[8] }}>
          <SectionHead
            index="04"
            label="Locus-wide divergence distribution"
            count={`all pairs at ${locus?.name}`}
          />
          <DivergenceDistribution locusId={selectedLocus} />
        </div>
      </section>

      <Footer />
    </main>
  );
}
