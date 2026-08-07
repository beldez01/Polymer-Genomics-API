'use client';

import { useState } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { ClockCard } from '@/components/clocks/ClockCard';
import { ClockAnatomy } from '@/components/clocks/ClockAnatomy';
import { CrossClockMatrix } from '@/components/clocks/CrossClockMatrix';
import { ClockCalculator } from '@/components/clocks/ClockCalculator';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { CLOCKS, getClock } from '@/config/clocksMockData';

const subtitle = (
  <span style={{
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 12,
    fontFamily: FONT_FAMILY_MONO,
    fontSize: TYPE.sm.fontSize,
    letterSpacing: '0.04em',
  }}>
    <span style={{ color: COLOR.text.tertiary }}>Epigenetic clocks</span>
    <span style={{ color: COLOR.border.strong }}>·</span>
    <span style={{ color: COLOR.text.tertiary }}>6 clocks · cross-comparison</span>
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

export default function ClocksPage() {
  const [selectedId, setSelectedId] = useState<string>('horvath');
  const selected = getClock(selectedId);

  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <BrandBar sticky subtitle={subtitle} />

      <section style={{
        maxWidth: 1200,
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
            § CLOCKS · 6 epigenetic clocks · probe-level anatomy
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
            Epigenetic clocks
          </h1>
          <p style={{
            margin: 0,
            maxWidth: 720,
            color: COLOR.text.secondary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            lineHeight: 1.55,
          }}>
            Probe-level anatomy and cross-comparison of canonical DNAm clocks —
            Horvath, Hannum, PhenoAge, GrimAge — plus DunedinPACE and the Polymer
            in-house <span style={{ color: COLOR.text.primary, fontWeight: WEIGHT.medium }}>Retro-Age</span>{' '}
            (built on TE/ERV-overlapping probes). Click any card to inspect its anatomy;
            scroll for cross-clock overlap and the age calculator.
          </p>
        </div>

        {/* Clock grid */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead index="01" label="Clocks" count={`${CLOCKS.length} clocks · ${CLOCKS.reduce((s, c) => s + c.probes, 0).toLocaleString()} total probes`} />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: SPACE[3],
          }}>
            {CLOCKS.map((c) => (
              <ClockCard
                key={c.id}
                clock={c}
                selected={c.id === selectedId}
                onSelect={() => setSelectedId(c.id)}
              />
            ))}
          </div>
        </div>

        {/* Anatomy of selected clock */}
        {selected && (
          <div style={{ marginBottom: SPACE[12] }}>
            <SectionHead
              index="02"
              label="Clock anatomy"
              count={`Selected: ${selected.name}`}
            />
            <ClockAnatomy clock={selected} />
          </div>
        )}

        {/* Cross-clock matrix */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead
            index="03"
            label="Cross-clock probe overlap"
            count="% of smaller set shared"
          />
          <CrossClockMatrix />
        </div>

        {/* Calculator */}
        <div style={{ marginBottom: SPACE[8] }}>
          <SectionHead
            index="04"
            label="Age calculator"
            count="Acceleration vs chronological"
          />
          <ClockCalculator />
        </div>
      </section>

      <Footer />
    </main>
  );
}
