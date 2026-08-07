'use client';

import { useState } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { FamilyCards } from '@/components/transposome/FamilyCards';
import { SubfamilyTable } from '@/components/transposome/SubfamilyTable';
import { AgeHistogram } from '@/components/transposome/AgeHistogram';
import { AwakeningPanel } from '@/components/transposome/AwakeningPanel';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { SUPERFAMILIES, SUBFAMILIES, type Superfamily } from '@/config/transposomeMockData';

const subtitle = (
  <span style={{
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 12,
    fontFamily: FONT_FAMILY_MONO,
    fontSize: TYPE.sm.fontSize,
    letterSpacing: '0.04em',
  }}>
    <span style={{ color: COLOR.text.tertiary }}>Transposome</span>
    <span style={{ color: COLOR.border.strong }}>·</span>
    <span style={{ color: COLOR.text.tertiary }}>5.6M TEs · 4 superfamilies</span>
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

export default function TransposomePage() {
  const [filter, setFilter] = useState<Superfamily | 'all'>('all');

  const totalCount = SUPERFAMILIES.reduce((s, sf) => s + sf.count, 0);
  const totalGenome = SUPERFAMILIES.reduce((s, sf) => s + sf.fractionOfGenome, 0);

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
            § TRANSPOSOME · {(totalCount / 1e6).toFixed(1)}M elements · {(totalGenome * 100).toFixed(0)} % of the genome
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
            Transposome
          </h1>
          <p style={{
            margin: 0,
            maxWidth: 720,
            color: COLOR.text.secondary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            lineHeight: 1.55,
          }}>
            Transposable elements with evolutionary age, reactivation propensity, and EPIC v2 probe overlap.
            Click any superfamily card to filter the subfamily table; scroll for the genome-wide age
            distribution and the top reactivation-risk loci.
          </p>
        </div>

        {/* Superfamily cards */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead
            index="01"
            label="Superfamilies"
            count={filter === 'all' ? 'click to filter' : `filtered: ${filter}`}
          />
          <FamilyCards selected={filter} onSelect={setFilter} />
        </div>

        {/* Subfamily breakdown */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead
            index="02"
            label="Subfamily breakdown"
            count={`${SUBFAMILIES.filter((s) => filter === 'all' || s.superfamily === filter).length} subfamilies`}
          />
          <SubfamilyTable filterSuperfamily={filter} />
        </div>

        {/* Age distribution */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead
            index="03"
            label="Genome-wide age distribution"
            count="0 → 200 MYA · bimodal: recent (L1HS, AluY, HERV-K) + ancient (L2, MIR)"
          />
          <AgeHistogram />
        </div>

        {/* Awakening risk */}
        <div style={{ marginBottom: SPACE[8] }}>
          <SectionHead
            index="04"
            label="Reactivation risk · top loci"
            count="hypo-methylated · young · context-flagged"
          />
          <AwakeningPanel />
        </div>
      </section>

      <Footer />
    </main>
  );
}
