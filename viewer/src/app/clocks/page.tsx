'use client';

import { useEffect, useState, useCallback } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { ClockObservatory } from '@/components/clocks/ClockObservatory';
import { ClockAnatomy } from '@/components/clocks/ClockAnatomy';
import { CrossClockComparison } from '@/components/clocks/CrossClockComparison';
import { ClockCalculator } from '@/components/clocks/ClockCalculator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [comparisonWarning, setComparisonWarning] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const retryAll = useCallback(() => {
    setClocks([]);
    setSelectedClock(null);
    setClockProbes({});
    setSelectedDetail(null);
    setActiveTab('anatomy');
    setLoading(true);
    setLoadingDetail(false);
    setAllLoaded(false);
    setLoadError(null);
    setDetailError(null);
    setComparisonWarning(null);
    setReloadToken((v) => v + 1);
  }, []);

  // Load clock list on mount
  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    (async () => {
      try {
        const res = await fetchClockList({ signal: controller.signal });
        setClocks(res.data.clocks);
      } catch (e) {
        if (!controller.signal.aborted) {
          console.error('Failed to load clocks', e);
          setClocks([]);
          setLoadError(e instanceof Error ? e.message : 'Failed to load clock data.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [reloadToken]);

  // Load all clock probes for cross-comparison
  useEffect(() => {
    if (!clocks.length || allLoaded) return;
    const controller = new AbortController();
    setComparisonWarning(null);
    (async () => {
      const all: Record<string, ClockProbe[]> = {};
      const failures: string[] = [];
      const results = await Promise.allSettled(
        clocks.map(async (clock) => {
          const res = await fetchClockDetail(clock.clock_name, { signal: controller.signal });
          return { clockName: clock.clock_name, probes: res.data.probes };
        }),
      );

      if (controller.signal.aborted) return;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          all[result.value.clockName] = result.value.probes;
        } else {
          const message = result.reason instanceof Error ? result.reason.message : 'unknown error';
          console.error('Failed to preload clock detail', message);
          failures.push(message);
        }
      }

      if (!controller.signal.aborted) {
        setClockProbes(all);
        setAllLoaded(true);
        if (failures.length > 0) {
          const loadedCount = Object.keys(all).length;
          setComparisonWarning(
            `${failures.length} clock dataset${failures.length === 1 ? '' : 's'} failed to load. Comparison and calculator currently use ${loadedCount} of ${clocks.length} clocks.`,
          );
        }
      }
    })();
    return () => controller.abort();
  }, [clocks, allLoaded]);

  // Load selected clock detail
  const handleSelectClock = useCallback(async (name: string) => {
    setSelectedClock(name);
    setActiveTab('anatomy');
    setDetailError(null);

    // Check if already loaded
    const cached = clockProbes[name];
    const meta = clocks.find((c) => c.clock_name === name);
    if (cached && meta) {
      setSelectedDetail({ meta, probes: cached });
      return;
    }

    setSelectedDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetchClockDetail(name);
      setSelectedDetail({ meta: res.data.clock, probes: res.data.probes });
      setClockProbes((prev) => ({ ...prev, [name]: res.data.probes }));
    } catch (e) {
      console.error('Failed to load clock detail', e);
      setDetailError(e instanceof Error ? e.message : 'Failed to load the selected clock.');
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
              {loading ? 'Loading clock data...' : `${clocks.length} clocks, ${clocks.reduce((s, c) => s + c.n_probes, 0).toLocaleString()} total CpG probes.`}
            </strong>
          </p>
        </section>

        {loadError && (
          <div style={{
            backgroundColor: `${COLOR.accent.rose}10`,
            border: `1px solid ${COLOR.accent.rose}40`,
            padding: `${SPACE[3]}px ${SPACE[4]}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACE[3],
            flexWrap: 'wrap',
          }}>
            <span style={{
              color: COLOR.accent.rose,
              fontSize: TYPE.sm.fontSize,
              fontFamily: FONT_FAMILY,
            }}>
              {loadError}
            </span>
            <button
              onClick={retryAll}
              style={{
                backgroundColor: 'transparent',
                border: `1px solid ${COLOR.border.strong}`,
                color: COLOR.text.secondary,
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.xs.fontSize,
                padding: '4px 12px',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {comparisonWarning && (
          <div style={{
            backgroundColor: `${COLOR.accent.amber}12`,
            border: `1px solid ${COLOR.accent.amber}40`,
            padding: `${SPACE[3]}px ${SPACE[4]}px`,
            color: COLOR.text.secondary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            lineHeight: 1.5,
          }}>
            {comparisonWarning}
          </div>
        )}

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
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 120, flexDirection: 'column', gap: 8,
            }}>
              <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }`}</style>
              <div style={{
                width: 200, height: 4, borderRadius: 2,
                background: COLOR.bg.surface, overflow: 'hidden',
              }}>
                <div style={{
                  width: '40%', height: '100%', borderRadius: 2,
                  background: `linear-gradient(90deg, ${COLOR.bg.surface}, ${COLOR.accent.teal}, ${COLOR.bg.surface})`,
                  animation: 'shimmer 1.5s infinite',
                }} />
              </div>
              <span style={{ color: COLOR.text.faint, fontSize: TYPE.xs.fontSize, fontFamily: FONT_FAMILY }}>
                Loading clocks...
              </span>
            </div>
          ) : loadError ? (
            <div style={{
              color: COLOR.accent.rose,
              fontSize: TYPE.sm.fontSize,
              fontFamily: FONT_FAMILY,
              padding: `${SPACE[4]}px 0`,
            }}>
              Clock observatory unavailable until clock metadata loads.
            </div>
          ) : clocks.length === 0 ? (
            <div style={{
              color: COLOR.text.muted,
              fontSize: TYPE.sm.fontSize,
              fontFamily: FONT_FAMILY,
              padding: `${SPACE[4]}px 0`,
            }}>
              No clock metadata is currently available.
            </div>
          ) : (
            <ErrorBoundary fallbackLabel="Clock Observatory">
              <ClockObservatory
                clocks={clocks}
                selectedClock={selectedClock}
                onSelect={handleSelectClock}
              />
            </ErrorBoundary>
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
              {detailError && !loadingDetail && (
                <div style={{
                  backgroundColor: `${COLOR.accent.rose}10`,
                  border: `1px solid ${COLOR.accent.rose}40`,
                  color: COLOR.accent.rose,
                  fontSize: TYPE.sm.fontSize,
                  fontFamily: FONT_FAMILY,
                  padding: `${SPACE[3]}px ${SPACE[4]}px`,
                }}>
                  {detailError}
                </div>
              )}
              {selectedDetail && !loadingDetail && (
                <ErrorBoundary fallbackLabel="Clock Anatomy">
                  <ClockAnatomy
                    clock={selectedDetail.meta}
                    probes={selectedDetail.probes}
                  />
                </ErrorBoundary>
              )}
            </>
          )}

          {activeTab === 'comparison' && allLoaded && (
            <ErrorBoundary fallbackLabel="Cross-Clock Comparison">
              <CrossClockComparison
                clockProbes={clockProbes}
                clockNames={clockNames}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'calculator' && allLoaded && (
            <ErrorBoundary fallbackLabel="Clock Calculator">
              <ClockCalculator
                clockMeta={clocks}
                clockProbes={clockProbes}
              />
            </ErrorBoundary>
          )}
        </section>
      </div>

      <Footer />
    </main>
  );
}
