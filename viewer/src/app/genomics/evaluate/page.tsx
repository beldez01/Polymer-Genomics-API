'use client';

import { useState, useCallback } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { SequenceInput } from '@/components/evaluate/SequenceInput';
import { SummaryChips } from '@/components/evaluate/SummaryChips';
import { ThermoProfile } from '@/components/evaluate/ThermoProfile';
import { CpgIslandTable } from '@/components/evaluate/CpgIslandTable';
import { FlagList } from '@/components/evaluate/FlagList';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { EXAMPLE_SEQUENCE, MOCK_RESULT, type EvalResult } from '@/config/evaluateMockData';

const subtitle = (
  <span style={{
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 12,
    fontFamily: FONT_FAMILY_MONO,
    fontSize: TYPE.sm.fontSize,
    letterSpacing: '0.04em',
  }}>
    <span style={{ color: COLOR.text.tertiary }}>Evaluate</span>
    <span style={{ color: COLOR.border.strong }}>·</span>
    <span style={{ color: COLOR.text.tertiary }}>Physics linter</span>
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

export default function EvaluatePage() {
  const [seq, setSeq] = useState(EXAMPLE_SEQUENCE);
  const [result, setResult] = useState<EvalResult | null>(MOCK_RESULT);
  const [loading, setLoading] = useState(false);

  const evaluate = useCallback(() => {
    setLoading(true);
    // Sandbox: simulated latency to make the "Evaluate" button feel live.
    // Always returns MOCK_RESULT regardless of input.
    setTimeout(() => {
      setResult(MOCK_RESULT);
      setLoading(false);
    }, 350);
  }, []);

  const useExample = useCallback(() => {
    setSeq(EXAMPLE_SEQUENCE);
    setResult(MOCK_RESULT);
  }, []);

  const clear = useCallback(() => {
    setSeq('');
    setResult(null);
  }, []);

  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <BrandBar sticky subtitle={subtitle} />

      <section style={{
        maxWidth: 920,
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
            § EVALUATE · Physics linter for any DNA sequence
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
            Evaluate
          </h1>
          <p style={{
            margin: 0,
            maxWidth: 640,
            color: COLOR.text.secondary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            lineHeight: 1.55,
          }}>
            Paste any DNA sequence to get its thermodynamic profile, CpG islands,
            structural-form flags, and 13 anti-hallucination flag codes.
            Single sequences run in-browser; batch via{' '}
            <span style={{
              color: COLOR.text.primary,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.sm.fontSize,
              backgroundColor: COLOR.bg.deep,
              padding: '1px 6px',
              borderRadius: 2,
            }}>POST /v1/evaluate</span>.
          </p>
        </div>

        {/* Input */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SequenceInput
            value={seq}
            onChange={setSeq}
            onEvaluate={evaluate}
            onUseExample={useExample}
            onClear={clear}
            loading={loading}
          />
        </div>

        {/* Results — only render if we have one */}
        {result && (
          <>
            {/* Summary */}
            <div style={{ marginBottom: SPACE[12] }}>
              <SectionHead index="01" label="Summary" count={`${result.length_bp} bp · ${result.summary.cpg_island_count} islands`} />
              <SummaryChips result={result} />
            </div>

            {/* Thermodynamic profile */}
            <div style={{ marginBottom: SPACE[12] }}>
              <SectionHead index="02" label="Thermodynamic profile" count={`${result.thermodynamics.window_size_bp} bp window`} />
              <ThermoProfile result={result} />
            </div>

            {/* CpG islands */}
            <div style={{ marginBottom: SPACE[12] }}>
              <SectionHead
                index="03"
                label="CpG islands detected"
                count={`${result.cpg_islands.length} island${result.cpg_islands.length === 1 ? '' : 's'}`}
              />
              <CpgIslandTable islands={result.cpg_islands} />
            </div>

            {/* Flags */}
            <div style={{ marginBottom: SPACE[12] }}>
              <SectionHead
                index="04"
                label="Flags"
                count={`${result.flag_counts.warnings} warn · ${result.flag_counts.info} info`}
              />
              <FlagList flags={result.flags} />
            </div>

            {/* Structural footer */}
            <div style={{
              padding: SPACE[5],
              backgroundColor: COLOR.bg.elevated,
              border: `1px solid ${COLOR.border.subtle}`,
              borderRadius: 2,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: SPACE[5],
            }}>
              {[
                { label: 'Z-form penalty', value: `${result.structural.z_form_total_penalty_kcal.toFixed(1)} kcal/mol` },
                { label: 'Major groove width', value: `${result.structural.major_groove_width_A.toFixed(1)} Å` },
                { label: 'Minor groove width', value: `${result.structural.minor_groove_width_A.toFixed(1)} Å` },
              ].map((s) => (
                <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{
                    color: COLOR.text.tertiary,
                    fontFamily: FONT_FAMILY_MONO,
                    fontSize: TYPE.xs.fontSize,
                    fontWeight: WEIGHT.medium,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}>
                    {s.label}
                  </span>
                  <span className="tabular" style={{
                    color: COLOR.text.primary,
                    fontFamily: FONT_FAMILY,
                    fontSize: TYPE.md.fontSize,
                    fontWeight: WEIGHT.semibold,
                  }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {!result && (
          <div style={{
            padding: SPACE[8],
            textAlign: 'center',
            color: COLOR.text.muted,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            backgroundColor: COLOR.bg.elevated,
            border: `1px solid ${COLOR.border.subtle}`,
            borderRadius: 2,
          }}>
            Paste a sequence above, or hit <span style={{ color: COLOR.primary.base, fontWeight: WEIGHT.medium }}>Use example</span>, then click Evaluate.
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
