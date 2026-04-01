'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE } from '@/config/theme';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { TEUploadZone } from '@/components/te-methylation/TEUploadZone';
import { FamilyScoreTable } from '@/components/te-methylation/FamilyScoreTable';
import { SummaryStats } from '@/components/te-methylation/SummaryStats';
import { RetroAgePanel } from '@/components/te-methylation/RetroAgePanel';
import { CoverageAnalysis } from '@/components/te-methylation/CoverageAnalysis';
import { StoplightBar } from '@/components/te-methylation/StoplightBar';
import { buildAnalysis, computeRetroAge } from '@/lib/te-methylation/scoring';
import type { TEMethylationAnalysis, TEProbeMapping, ClockProbe } from '@/lib/te-methylation/types';
import type { TEFamily } from '@/lib/transposome-types';
import type { Platform } from '@/lib/te-methylation/parse-betas';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://api.polymerbio.org';

type Tab = 'overview' | 'retro_age' | 'coverage';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'retro_age', label: 'Retro-Age' },
  { key: 'coverage', label: 'Coverage' },
];

export default function TEMethylationPage() {
  // Reference data (fetched once)
  const [families, setFamilies] = useState<TEFamily[]>([]);
  const [mapping, setMapping] = useState<TEProbeMapping | null>(null);
  const [clockProbes, setClockProbes] = useState<ClockProbe[]>([]);
  const [clockIntercept, setClockIntercept] = useState(62.074);
  const [loadingRef, setLoadingRef] = useState(true);

  // User data
  const [betas, setBetas] = useState<Map<string, number> | null>(null);
  const [platform, setPlatform] = useState<Platform>('epic_v2');
  const [filename, setFilename] = useState<string>('');
  const [chronoAge, setChronoAge] = useState<number | undefined>(undefined);

  // Analysis result
  const [analysis, setAnalysis] = useState<TEMethylationAnalysis | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [tabHover, setTabHover] = useState<Tab | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);

  // Fetch reference data on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [famRes, clockRes] = await Promise.allSettled([
          fetch(`${API_BASE}/v1/transposome/families`).then((r) => r.json()),
          fetch(`${API_BASE}/v1/reference/clock-probes?clock=retro_age_v2`).then((r) => r.json()),
        ]);

        if (cancelled) return;

        if (famRes.status === 'fulfilled') {
          setFamilies(famRes.value?.data?.families ?? []);
        }
        if (clockRes.status === 'fulfilled') {
          const cd = clockRes.value?.data;
          if (cd?.probes) {
            setClockProbes(
              cd.probes.map((p: any) => ({
                probe_id: p.probe_id,
                coefficient: p.coefficient,
              })),
            );
          }
          if (cd?.intercept !== undefined) {
            setClockIntercept(cd.intercept);
          }
        }
      } catch {
        // Silently fail — user can still upload
      } finally {
        if (!cancelled) setLoadingRef(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Fetch mapping when platform changes (after upload)
  const fetchMapping = useCallback(async (p: Platform) => {
    try {
      const res = await fetch(`${API_BASE}/v1/transposome/probe-te-mapping?platform=${p}&build=hg38`);
      const json = await res.json();
      return json?.data as TEProbeMapping | null;
    } catch {
      return null;
    }
  }, []);

  // Handle data upload
  const handleDataLoaded = useCallback(
    async (newBetas: Map<string, number>, detectedPlatform: Platform, fname: string) => {
      setBetas(newBetas);
      setPlatform(detectedPlatform);
      setFilename(fname);
      setAnalysis(null);

      // Fetch mapping for this platform
      const m = await fetchMapping(detectedPlatform);
      setMapping(m);

      if (m && families.length > 0) {
        const retroAge = computeRetroAge(newBetas, clockProbes, clockIntercept, chronoAge);
        const result = buildAnalysis(newBetas, m, families, detectedPlatform, fname, retroAge);
        setAnalysis(result);
        setActiveTab('overview');
      }
    },
    [families, clockProbes, clockIntercept, chronoAge, fetchMapping],
  );

  // Recompute when chrono age changes
  useEffect(() => {
    if (!betas || !mapping || families.length === 0) return;
    const retroAge = computeRetroAge(betas, clockProbes, clockIntercept, chronoAge);
    const result = buildAnalysis(betas, mapping, families, platform, filename, retroAge);
    setAnalysis(result);
  }, [chronoAge]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ background: COLOR.bg.primary, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <BrandBar subtitle="TE Methylation Analyzer" />

      <main style={{
        flex: 1,
        maxWidth: 1200,
        margin: '0 auto',
        padding: `${SPACE[6]}px ${SPACE[5]}px`,
        width: '100%',
      }}>
        {/* Hero */}
        <div style={{ marginBottom: SPACE[6] }}>
          <h1 style={{
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.xl.fontSize,
            fontWeight: WEIGHT.bold,
            color: COLOR.text.primary,
            letterSpacing: TYPE.xl.letterSpacing,
            margin: 0,
          }}>
            TE/ERV Methylation State
          </h1>
          <p style={{
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            color: COLOR.text.tertiary,
            marginTop: SPACE[2],
            maxWidth: 700,
            lineHeight: 1.6,
          }}>
            Upload beta values to score transposable element methylation by family.
            Identifies reactivation risk, computes Retro-Age, and provides biophysical
            context for each TE family. Supports 450K, EPIC v1, and EPIC v2 arrays.
          </p>
        </div>

        {/* Upload zone (always visible, but dimmed after upload) */}
        {!analysis && (
          <div style={{ marginBottom: SPACE[6] }}>
            <TEUploadZone onDataLoaded={handleDataLoaded} />
            {loadingRef && (
              <div style={{
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.xs.fontSize,
                color: COLOR.text.muted,
                marginTop: SPACE[2],
                textAlign: 'center',
              }}>
                Loading reference data...
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {analysis && (
          <>
            {/* Summary bar */}
            <SummaryStats analysis={analysis} />

            {/* Re-upload + chrono age input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE[4],
              marginTop: SPACE[4],
              marginBottom: SPACE[4],
              flexWrap: 'wrap',
            }}>
              <button
                onClick={() => { setAnalysis(null); setBetas(null); setMapping(null); }}
                style={{
                  fontFamily: FONT_FAMILY,
                  fontSize: TYPE.xs.fontSize,
                  padding: `${SPACE[1]}px ${SPACE[3]}px`,
                  borderRadius: 8,
                  border: `1px solid ${COLOR.border.subtle}`,
                  background: 'transparent',
                  color: COLOR.text.secondary,
                  cursor: 'pointer',
                }}
              >
                Upload new file
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
                <label style={{
                  fontFamily: FONT_FAMILY,
                  fontSize: TYPE.xs.fontSize,
                  color: COLOR.text.muted,
                }}>
                  Chronological age:
                </label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  step={1}
                  value={chronoAge ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setChronoAge(v ? Number(v) : undefined);
                  }}
                  placeholder="optional"
                  style={{
                    fontFamily: FONT_FAMILY,
                    fontSize: TYPE.xs.fontSize,
                    width: 80,
                    padding: `${SPACE[1]}px ${SPACE[2]}px`,
                    borderRadius: 4,
                    border: `1px solid ${COLOR.border.subtle}`,
                    background: COLOR.bg.primary,
                    color: COLOR.text.primary,
                  }}
                />
              </div>
              <span style={{
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.xs.fontSize,
                color: COLOR.text.muted,
              }}>
                {filename}
              </span>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex',
              gap: SPACE[1],
              borderBottom: `1px solid ${COLOR.border.subtle}`,
              marginBottom: SPACE[5],
            }}>
              {TABS.map((tab) => {
                const active = activeTab === tab.key;
                const hover = tabHover === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    onMouseEnter={() => setTabHover(tab.key)}
                    onMouseLeave={() => setTabHover(null)}
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: TYPE.sm.fontSize,
                      fontWeight: active ? WEIGHT.bold : WEIGHT.normal,
                      color: active ? COLOR.accent.teal : hover ? COLOR.text.secondary : COLOR.text.tertiary,
                      padding: `${SPACE[2]}px ${SPACE[4]}px`,
                      border: 'none',
                      borderBottom: active ? `2px solid ${COLOR.accent.teal}` : '2px solid transparent',
                      background: 'transparent',
                      cursor: 'pointer',
                      transition: 'color 0.1s, border-color 0.1s',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[5] }}>
                {/* Class summary cards */}
                <div style={{ display: 'flex', gap: SPACE[3], flexWrap: 'wrap' }}>
                  {Object.entries(analysis.summaryByClass)
                    .sort((a, b) => b[1].nProbes - a[1].nProbes)
                    .map(([cls, data]) => (
                      <div key={cls} style={{
                        flex: '1 1 140px',
                        border: `1px solid ${COLOR.border.subtle}`,
                        borderRadius: 8,
                        padding: SPACE[3],
                        textAlign: 'center',
                      }}>
                        <div style={{
                          fontFamily: FONT_FAMILY,
                          fontSize: TYPE.xs.fontSize,
                          color: COLOR.text.muted,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}>
                          {cls}
                        </div>
                        <div style={{
                          fontFamily: FONT_FAMILY,
                          fontSize: TYPE.lg.fontSize,
                          fontWeight: WEIGHT.bold,
                          color: COLOR.text.primary,
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {data.meanBeta.toFixed(3)}
                        </div>
                        <div style={{
                          fontFamily: FONT_FAMILY,
                          fontSize: TYPE.xs.fontSize,
                          color: COLOR.text.muted,
                        }}>
                          {data.nProbes.toLocaleString()} probes / {data.nFamilies} families
                        </div>
                      </div>
                    ))}
                </div>

                <FamilyScoreTable
                  scores={analysis.familyScores}
                  onSelectFamily={setSelectedFamily}
                  selectedFamily={selectedFamily}
                />
              </div>
            )}

            {activeTab === 'retro_age' && (
              <RetroAgePanel result={analysis.retroAge} />
            )}

            {activeTab === 'coverage' && (
              <CoverageAnalysis families={families} />
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
