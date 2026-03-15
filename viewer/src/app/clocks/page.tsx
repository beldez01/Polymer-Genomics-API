'use client';

import { useEffect, useState, useCallback } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { ClockObservatory } from '@/components/clocks/ClockObservatory';
import { ClockAnatomy } from '@/components/clocks/ClockAnatomy';
import { CrossClockComparison } from '@/components/clocks/CrossClockComparison';
import { ClockCalculator } from '@/components/clocks/ClockCalculator';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT, COMPONENT } from '@/config/theme';
import type { ClockMetadata, ClockProbe } from '@/lib/api';
import { fetchClockList, fetchClockDetail } from '@/lib/api';

type Tab = 'anatomy' | 'comparison' | 'calculator';

export default function ClocksPage() {
  const [clocks, setClocks] = useState<ClockMetadata[]>([]);
  const [selectedClock, setSelectedClock] = useState<string | null>(null);
  const [clockProbes, setClockProbes] = useState<Record<string, ClockProbe[]>>({});
  const [selectedDetail, setSelectedDetail] = useState<{ meta: ClockMetadata; probes: ClockProbe[] } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('anatomy');
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);

  // Load clock list on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchClockList();
        setClocks(res.data.clocks);
      } catch (e) {
        console.error('Failed to load clocks', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load all clock probes for cross-comparison
  useEffect(() => {
    if (!clocks.length || allLoaded) return;
    (async () => {
      const all: Record<string, ClockProbe[]> = {};
      for (const c of clocks) {
        try {
          const res = await fetchClockDetail(c.clock_name);
          all[c.clock_name] = res.data.probes;
        } catch (e) {
          console.error(`Failed to load ${c.clock_name}`, e);
        }
      }
      setClockProbes(all);
      setAllLoaded(true);
    })();
  }, [clocks, allLoaded]);

  // Load selected clock detail
  const handleSelectClock = useCallback(async (name: string) => {
    setSelectedClock(name);
    setActiveTab('anatomy');

    // Check if already loaded
    const cached = clockProbes[name];
    const meta = clocks.find((c) => c.clock_name === name);
    if (cached && meta) {
      setSelectedDetail({ meta, probes: cached });
      return;
    }

    setLoadingDetail(true);
    try {
      const res = await fetchClockDetail(name);
      setSelectedDetail({ meta: res.data.clock, probes: res.data.probes });
      setClockProbes((prev) => ({ ...prev, [name]: res.data.probes }));
    } catch (e) {
      console.error('Failed to load clock detail', e);
    } finally {
      setLoadingDetail(false);
    }
  }, [clocks, clockProbes]);

  const clockNames = clocks.map((c) => c.clock_name);

  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <BrandBar subtitle="Epigenetic Clocks" sticky />

      <div style={{
        flex: 1,
        maxWidth: 1100,
        width: '100%',
        margin: '0 auto',
        padding: `${SPACE[6]}px ${SPACE[6]}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE[8],
      }}>
        {/* ─── Hero ─── */}
        <section style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE[3],
        }}>
          <h1 style={{
            fontSize: TYPE.xl.fontSize,
            fontWeight: WEIGHT.bold,
            letterSpacing: '0.06em',
            color: COLOR.accent.teal,
            fontFamily: FONT_FAMILY,
            margin: 0,
          }}>
            EPIGENETIC CLOCKS
          </h1>
          <p style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.base.fontSize,
            fontFamily: FONT_FAMILY,
            lineHeight: 1.8,
            maxWidth: 720,
            margin: 0,
          }}>
            DNA methylation patterns change systematically with age. Epigenetic clocks
            use weighted combinations of CpG probe beta values to estimate biological age.
            Three generations of clocks measure different things: how old your DNA looks
            (1st gen), how healthy it is (2nd gen), and how fast it&apos;s aging right now (3rd gen).
            The retro-age clocks capture an entirely independent signal from retroelement methylation.
          </p>
          <p style={{
            color: COLOR.text.muted,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            lineHeight: 1.6,
            maxWidth: 720,
            margin: 0,
          }}>
            This page lets you look <em>inside</em> the clocks &mdash; inspect every probe,
            compare membership across clocks, and apply coefficients to your own data.
            {' '}
            <strong style={{ color: COLOR.text.tertiary }}>
              {clocks.length} clocks,{' '}
              {clocks.reduce((s, c) => s + c.n_probes, 0).toLocaleString()} total CpG probes.
            </strong>
          </p>
        </section>

        {/* ─── Panel A: Clock Observatory ─── */}
        <section>
          <div style={{
            ...COMPONENT.sectionHeader,
            textTransform: 'uppercase' as const,
            marginBottom: SPACE[3],
            fontSize: TYPE.sm.fontSize,
            letterSpacing: '0.1em',
          }}>
            CLOCK OBSERVATORY
          </div>
          {loading ? (
            <div style={{ color: COLOR.text.muted, fontSize: TYPE.sm.fontSize, fontFamily: FONT_FAMILY }}>
              Loading clocks...
            </div>
          ) : (
            <ClockObservatory
              clocks={clocks}
              selectedClock={selectedClock}
              onSelect={handleSelectClock}
            />
          )}
        </section>

        {/* ─── Divider ─── */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 120,
            height: 1,
            backgroundColor: COLOR.border.subtle,
          }} />
        </div>

        {/* ─── Tab bar ─── */}
        <div style={{
          display: 'flex',
          gap: SPACE[1],
          borderBottom: `1px solid ${COLOR.border.subtle}`,
        }}>
          {([
            { id: 'anatomy' as Tab, label: 'Clock Anatomy', disabled: !selectedClock },
            { id: 'comparison' as Tab, label: 'Cross-Clock Comparison', disabled: !allLoaded },
            { id: 'calculator' as Tab, label: 'Apply Clocks', disabled: !allLoaded },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? COLOR.accent.teal : 'transparent'}`,
                color: tab.disabled
                  ? COLOR.text.faint
                  : activeTab === tab.id
                    ? COLOR.accent.teal
                    : COLOR.text.muted,
                fontSize: TYPE.sm.fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: activeTab === tab.id ? WEIGHT.medium : WEIGHT.normal,
                letterSpacing: '0.04em',
                padding: `${SPACE[2]}px ${SPACE[4]}px`,
                cursor: tab.disabled ? 'default' : 'pointer',
                opacity: tab.disabled ? 0.4 : 1,
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}

          {!allLoaded && clocks.length > 0 && (
            <span style={{
              color: COLOR.text.faint,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              marginLeft: 'auto',
              alignSelf: 'center',
              paddingRight: SPACE[2],
            }}>
              Loading probe data...
            </span>
          )}
        </div>

        {/* ─── Tab content ─── */}
        <section style={{ minHeight: 300 }}>
          {activeTab === 'anatomy' && (
            <>
              {!selectedClock && (
                <div style={{
                  color: COLOR.text.muted,
                  fontSize: TYPE.base.fontSize,
                  fontFamily: FONT_FAMILY,
                  textAlign: 'center',
                  padding: `${SPACE[10]}px 0`,
                }}>
                  Select a clock above to inspect its probes.
                </div>
              )}
              {loadingDetail && (
                <div style={{
                  color: COLOR.text.muted,
                  fontSize: TYPE.sm.fontSize,
                  fontFamily: FONT_FAMILY,
                }}>
                  Loading probe data...
                </div>
              )}
              {selectedDetail && !loadingDetail && (
                <ClockAnatomy
                  clock={selectedDetail.meta}
                  probes={selectedDetail.probes}
                />
              )}
            </>
          )}

          {activeTab === 'comparison' && allLoaded && (
            <CrossClockComparison
              clockProbes={clockProbes}
              clockNames={clockNames}
            />
          )}

          {activeTab === 'calculator' && allLoaded && (
            <ClockCalculator
              clockMeta={clocks}
              clockProbes={clockProbes}
            />
          )}
        </section>
      </div>

      <Footer />
    </main>
  );
}
