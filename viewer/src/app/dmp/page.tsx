'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import { BrandBar } from '@/components/BrandBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Footer } from '@/components/Footer';
import { UploadZone, type UploadResult } from '@/components/dmp/UploadZone';
import { VolcanoPlot } from '@/components/dmp/VolcanoPlot';
import { ManhattanPlot } from '@/components/dmp/ManhattanPlot';
import { ProbeDetail } from '@/components/dmp/ProbeDetail';
import { ResultsTable } from '@/components/dmp/ResultsTable';
import { SummaryBar } from '@/components/dmp/SummaryBar';
import { EnrichmentPanel } from '@/components/dmp/EnrichmentPanel';
import { ClusteringPanel } from '@/components/dmp/ClusteringPanel';
import { ComparisonPanel } from '@/components/dmp/ComparisonPanel';
import { IdatUploadZone } from '@/components/dmp/IdatUploadZone';
import { MethylationSidebar } from '@/components/dmp/MethylationSidebar';
import { FamilyScoreTable } from '@/components/te-methylation/FamilyScoreTable';
import { FamilyDiffTable } from '@/components/te-methylation/FamilyDiffTable';
import { SummaryStats } from '@/components/te-methylation/SummaryStats';
import { RetroAgePanel } from '@/components/te-methylation/RetroAgePanel';
import { CoverageAnalysis } from '@/components/te-methylation/CoverageAnalysis';
import type { DMPDataset, DMPRow, ThresholdState, PlotTab } from '@/lib/dmp/types';
import type { TEMethylationAnalysis, TEProbeMapping, ClockProbe } from '@/lib/te-methylation/types';
import type { TEFamily } from '@/lib/transposome-types';
import type { Platform } from '@/lib/te-methylation/parse-betas';
import type { TEDiffAnalysis } from '@/lib/te-methylation/dmp-scoring';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { buildAnalysis, computeRetroAge } from '@/lib/te-methylation/scoring';
import { buildDiffAnalysis } from '@/lib/te-methylation/dmp-scoring';
import { computeSummary } from '@/lib/dmp/stats';

const API_BASE = '/api';

/* ── Types ── */

type InputType = 'dmp' | 'betas' | null;
type AnalysisMode = 'dmp' | 'te_erv' | 'clustering' | 'compare';
type DMPSubTab = 'volcano' | 'manhattan' | 'enrichment';
type TESubTab = 'overview' | 'retro_age' | 'coverage';

const DEFAULT_THRESHOLDS: ThresholdState = {
  pValueCutoff: 1.301,
  adjPValueCutoff: 0.05,
  deltaBetaCutoff: 0.05,
};

/* ── Analysis mode config ── */

interface ModeConfig {
  key: AnalysisMode;
  label: string;
  needsData: boolean; // requires file upload
}

const MODES: ModeConfig[] = [
  { key: 'dmp', label: 'DMP', needsData: true },
  { key: 'te_erv', label: 'TE / ERV', needsData: true },
  { key: 'clustering', label: 'Clustering', needsData: false },
  { key: 'compare', label: 'Compare', needsData: false },
];

const DMP_TABS: { key: DMPSubTab; label: string }[] = [
  { key: 'volcano', label: 'Volcano' },
  { key: 'manhattan', label: 'Manhattan' },
  { key: 'enrichment', label: 'Enrichment' },
];

const TE_TABS: { key: TESubTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'retro_age', label: 'Retro-Age' },
  { key: 'coverage', label: 'Coverage' },
];

/* ── Page ── */

export default function MethylationPage() {
  // Input state
  const [inputType, setInputType] = useState<InputType>(null);
  const [dmpDataset, setDmpDataset] = useState<DMPDataset | null>(null);
  const [betaData, setBetaData] = useState<{
    betas: Map<string, number>;
    platform: Platform;
    filename: string;
  } | null>(null);

  // Analysis mode & sub-tabs
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('dmp');
  const [dmpSubTab, setDmpSubTab] = useState<DMPSubTab>('volcano');
  const [teSubTab, setTeSubTab] = useState<TESubTab>('overview');

  // DMP state
  const [thresholds, setThresholds] = useState<ThresholdState>(DEFAULT_THRESHOLDS);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // TE/ERV reference data (fetched once)
  const [teFamilies, setTeFamilies] = useState<TEFamily[]>([]);
  const [teMapping, setTeMapping] = useState<TEProbeMapping | null>(null);
  const [clockProbes, setClockProbes] = useState<ClockProbe[]>([]);
  const [clockIntercept, setClockIntercept] = useState(62.074);

  // TE/ERV analysis results
  const [teAnalysis, setTeAnalysis] = useState<TEMethylationAnalysis | null>(null);
  const [teDiffAnalysis, setTeDiffAnalysis] = useState<TEDiffAnalysis | null>(null);
  const [chronoAge, setChronoAge] = useState<number | undefined>(undefined);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);

  // TE/ERV sidebar filter
  const [teClassFilter, setTeClassFilter] = useState<string | null>(null);

  // Mobile
  const isMobile = useIsMobile();

  // UI
  const [modeHover, setModeHover] = useState<AnalysisMode | null>(null);
  const [subTabHover, setSubTabHover] = useState<string | null>(null);

  // Computed
  const rows: DMPRow[] = dmpDataset?.rows ?? [];
  const summary = useMemo(() => computeSummary(rows, thresholds), [rows, thresholds]);
  const selectedRow = selectedIndex !== null ? rows[selectedIndex] ?? null : null;
  const hasGenomic = useMemo(() => rows.some((r) => r.chr && r.pos), [rows]);

  const filename = inputType === 'dmp'
    ? dmpDataset?.filename ?? ''
    : betaData?.filename ?? '';

  // Mode availability
  const modeAvailable = useCallback(
    (mode: AnalysisMode): boolean => {
      if (mode === 'clustering' || mode === 'compare') return true;
      if (mode === 'dmp') return inputType === 'dmp';
      if (mode === 'te_erv') return inputType !== null;
      return false;
    },
    [inputType],
  );

  /* ── Fetch TE reference data on mount ── */
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
          setTeFamilies(famRes.value?.data?.families ?? []);
        }
        if (clockRes.status === 'fulfilled') {
          const cd = clockRes.value?.data;
          if (cd?.probes) {
            setClockProbes(
              cd.probes.map((p: any) => ({ probe_id: p.probe_id, coefficient: p.coefficient })),
            );
          }
          if (cd?.intercept !== undefined) setClockIntercept(cd.intercept);
        }
      } catch {
        // Silently fail — user can still upload
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* ── Fetch TE probe mapping ── */
  const fetchMapping = useCallback(async (platform: Platform) => {
    try {
      const res = await fetch(`${API_BASE}/v1/transposome/probe-te-mapping?platform=${platform}&build=hg38`);
      const json = await res.json();
      return json?.data as TEProbeMapping | null;
    } catch {
      return null;
    }
  }, []);

  /* ── Handle file upload ── */
  const handleDataLoaded = useCallback(
    async (result: UploadResult) => {
      setSelectedIndex(null);
      setHoveredIndex(null);
      setTeAnalysis(null);
      setTeDiffAnalysis(null);
      setSelectedFamily(null);

      if (result.type === 'dmp') {
        setInputType('dmp');
        setDmpDataset(result.dataset);
        setBetaData(null);
        setAnalysisMode('dmp');
        setDmpSubTab('volcano');

        // Also build TE diff analysis
        const m = teMapping ?? await fetchMapping('epic_v2');
        if (m) setTeMapping(m);
        if (m && teFamilies.length > 0) {
          setTeDiffAnalysis(buildDiffAnalysis(result.dataset.rows, m, teFamilies));
        }
      } else {
        setInputType('betas');
        setBetaData(result);
        setDmpDataset(null);
        setAnalysisMode('te_erv');
        setTeSubTab('overview');

        // Build TE beta analysis
        const m = teMapping ?? await fetchMapping(result.platform);
        if (m) setTeMapping(m);
        if (m && teFamilies.length > 0) {
          const retroAge = computeRetroAge(result.betas, clockProbes, clockIntercept, chronoAge);
          setTeAnalysis(buildAnalysis(result.betas, m, teFamilies, result.platform, result.filename, retroAge));
        }
      }
    },
    [teFamilies, teMapping, clockProbes, clockIntercept, chronoAge, fetchMapping],
  );

  /* ── Handle IDAT results (produces DMP data) ── */
  const handleIdatResults = useCallback(
    (dataset: DMPDataset) => {
      handleDataLoaded({ type: 'dmp', dataset });
    },
    [handleDataLoaded],
  );

  /* ── Recompute TE analysis when chrono age changes ── */
  useEffect(() => {
    if (!betaData || !teMapping || teFamilies.length === 0) return;
    const retroAge = computeRetroAge(betaData.betas, clockProbes, clockIntercept, chronoAge);
    setTeAnalysis(buildAnalysis(betaData.betas, teMapping, teFamilies, betaData.platform, betaData.filename, retroAge));
  }, [chronoAge]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Reset ── */
  const handleReset = useCallback(() => {
    setInputType(null);
    setDmpDataset(null);
    setBetaData(null);
    setTeAnalysis(null);
    setTeDiffAnalysis(null);
    setSelectedIndex(null);
    setHoveredIndex(null);
    setSelectedFamily(null);
    setThresholds(DEFAULT_THRESHOLDS);
    setAnalysisMode('dmp');
    setDmpSubTab('volcano');
    setTeSubTab('overview');
  }, []);

  const hasData = inputType !== null;
  const isIndependentMode = analysisMode === 'clustering' || analysisMode === 'compare';

  // Filtered TE scores by sidebar class filter
  const filteredTeScores = useMemo(() => {
    if (!teAnalysis) return [];
    if (!teClassFilter) return teAnalysis.familyScores;
    return teAnalysis.familyScores.filter((s) => s.teClass === teClassFilter);
  }, [teAnalysis, teClassFilter]);

  const filteredTeDiffScores = useMemo(() => {
    if (!teDiffAnalysis) return [];
    if (!teClassFilter) return teDiffAnalysis.familyScores;
    return teDiffAnalysis.familyScores.filter((s) => s.teClass === teClassFilter);
  }, [teDiffAnalysis, teClassFilter]);

  /* ── Export handler ── */
  const handleExport = useCallback(() => {
    let csvContent = '';
    if (inputType === 'dmp' && dmpDataset) {
      const header = 'probe_id,delta_beta,p_value,adj_p_value,gene_symbol,chr,pos\n';
      csvContent = header + rows.map((r) =>
        `${r.probe_id},${r.delta_beta},${r.p_value},${r.adj_p_value},${r.gene_symbol ?? ''},${r.chr ?? ''},${r.pos ?? ''}`,
      ).join('\n');
    } else if (inputType === 'betas' && teAnalysis) {
      const header = 'family,class,mean_beta,delta,n_probes,risk_level,reactivation_risk\n';
      csvContent = header + teAnalysis.familyScores.map((s) =>
        `${s.familyName},${s.teClass},${s.meanBeta},${s.delta},${s.nProbes},${s.riskLevel},${s.reactivationRisk}`,
      ).join('\n');
    }
    if (!csvContent) return;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace(/\.[^.]+$/, '')}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [inputType, dmpDataset, rows, teAnalysis, filename]);

  /* ── Render ── */
  return (
    <div style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: FONT_FAMILY,
    }}>
      <BrandBar subtitle="Methylation Analysis">
        {(hasData || isIndependentMode) && (
          <button
            onClick={handleReset}
            style={COMPONENT.button.small}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = COLOR.accent.teal;
              e.currentTarget.style.color = COLOR.accent.teal;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = COLOR.border.strong;
              e.currentTarget.style.color = COLOR.text.secondary;
            }}
          >
            New File
          </button>
        )}
      </BrandBar>

      {/* ── Upload state ── */}
      {!hasData && !isIndependentMode ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: SPACE[8],
          gap: SPACE[6],
        }}>
          <div style={{ maxWidth: 600, textAlign: 'center' }}>
            <h1 style={{
              color: COLOR.text.primary,
              fontSize: TYPE.xl.fontSize,
              fontFamily: FONT_FAMILY,
              fontWeight: WEIGHT.bold,
              letterSpacing: TYPE.xl.letterSpacing,
              marginBottom: SPACE[2],
            }}>
              Methylation Analysis
            </h1>
            <p style={{
              color: COLOR.text.tertiary,
              fontSize: TYPE.base.fontSize,
              fontFamily: FONT_FAMILY,
              lineHeight: TYPE.base.lineHeight,
              marginBottom: SPACE[8],
            }}>
              Upload methylation data to analyze. Auto-detects DMP results
              (limma, minfi, DMRcate) or beta values for TE/ERV family scoring.
            </p>
          </div>

          <div style={{ width: '100%', maxWidth: 600 }}>
            <UploadZone onDataLoaded={handleDataLoaded} />
          </div>

          <div style={{
            display: 'flex',
            gap: SPACE[3],
            marginTop: SPACE[4],
          }}>
            <button
              onClick={() => setAnalysisMode('clustering')}
              style={COMPONENT.button.small}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = COLOR.accent.teal;
                e.currentTarget.style.color = COLOR.accent.teal;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLOR.border.strong;
                e.currentTarget.style.color = COLOR.text.secondary;
              }}
            >
              Upload Beta Matrix
            </button>
            <button
              onClick={() => setAnalysisMode('compare')}
              style={COMPONENT.button.small}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = COLOR.accent.teal;
                e.currentTarget.style.color = COLOR.accent.teal;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLOR.border.strong;
                e.currentTarget.style.color = COLOR.text.secondary;
              }}
            >
              Compare Studies
            </button>
            <IdatUploadZone onResultsReady={handleIdatResults} />
          </div>

          <div style={{
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            maxWidth: 520,
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            <strong>DMP results:</strong> CSV/TSV with probe_id, delta_beta, p_value columns (limma, minfi, DMRcate).
            <br />
            <strong>Beta values:</strong> CSV/TSV with probe_id + beta column (single sample or averaged).
            <br />
            All processing is local — no data leaves your browser.
          </div>
        </div>
      ) : (
        /* ── Results state: sidebar + main ── */
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '220px 1fr',
          overflow: 'hidden',
        }}>
          {/* Left sidebar — hidden on mobile */}
          <div style={{
            borderRight: `1px solid ${COLOR.border.subtle}`,
            background: COLOR.bg.elevated,
            overflowY: 'auto',
            padding: '16px 12px',
            display: isMobile ? 'none' : 'flex',
            flexDirection: 'column',
          }}>
            <MethylationSidebar
              inputType={inputType}
              analysisMode={analysisMode}
              platform={inputType === 'betas' ? betaData?.platform : undefined}
              filename={filename}
              dmpDataset={dmpDataset}
              thresholds={thresholds}
              onThresholdsChange={setThresholds}
              teAnalysis={teAnalysis}
              teDiffAnalysis={teDiffAnalysis}
              teClassFilter={teClassFilter}
              onTeClassFilter={setTeClassFilter}
              onExport={handleExport}
            />
          </div>

          {/* Main content area */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
          {/* ── Analysis mode tabs ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            padding: `0 ${SPACE[4]}px`,
            backgroundColor: COLOR.bg.elevated,
            borderBottom: `1px solid ${COLOR.border.subtle}`,
            flexShrink: 0,
          }}>
            {MODES.map((mode) => {
              const isActive = analysisMode === mode.key;
              const isHovered = modeHover === mode.key;
              const available = modeAvailable(mode.key);
              const disabled = mode.needsData && !available;

              return (
                <button
                  key={mode.key}
                  onClick={() => !disabled && setAnalysisMode(mode.key)}
                  onMouseEnter={() => setModeHover(mode.key)}
                  onMouseLeave={() => setModeHover(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: isActive
                      ? `2px solid ${COLOR.accent.teal}`
                      : '2px solid transparent',
                    color: disabled
                      ? COLOR.text.faint
                      : isActive
                        ? COLOR.accent.teal
                        : isHovered
                          ? COLOR.text.primary
                          : COLOR.text.muted,
                    fontSize: TYPE.sm.fontSize,
                    fontFamily: FONT_FAMILY,
                    fontWeight: isActive ? WEIGHT.bold : WEIGHT.medium,
                    padding: `${SPACE[3]}px ${SPACE[4]}px`,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'color 0.15s, border-color 0.15s',
                    letterSpacing: '0.04em',
                    opacity: disabled ? 0.4 : 1,
                  }}
                  title={disabled && mode.key === 'dmp' ? 'Upload DMP results (limma/minfi) to enable' : undefined}
                >
                  {mode.label}
                </button>
              );
            })}

            {/* File info */}
            {hasData && (
              <div style={{
                marginLeft: 'auto',
                display: 'flex',
                gap: SPACE[4],
                alignItems: 'center',
              }}>
                <span style={{
                  color: COLOR.text.muted,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                  padding: `2px 8px`,
                  border: `1px solid ${COLOR.border.subtle}`,
                  borderRadius: 4,
                }}>
                  {inputType === 'dmp' ? 'DMP results' : 'Beta values'}
                </span>
                <span style={{
                  color: COLOR.text.tertiary,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                }}>
                  {filename}
                </span>
              </div>
            )}
          </div>

          {/* ── DMP mode ── */}
          {analysisMode === 'dmp' && dmpDataset && (
            <>
              {/* Sub-tabs */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE[1],
                padding: `0 ${SPACE[4]}px`,
                borderBottom: `1px solid ${COLOR.border.subtle}`,
                flexShrink: 0,
              }}>
                {DMP_TABS.map((tab) => {
                  const isActive = dmpSubTab === tab.key;
                  const isHovered = subTabHover === tab.key;
                  const disabled = tab.key === 'manhattan' && !hasGenomic;

                  return (
                    <button
                      key={tab.key}
                      onClick={() => !disabled && setDmpSubTab(tab.key)}
                      onMouseEnter={() => setSubTabHover(tab.key)}
                      onMouseLeave={() => setSubTabHover(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        borderBottom: isActive ? `2px solid ${COLOR.accent.teal}` : '2px solid transparent',
                        color: disabled
                          ? COLOR.text.faint
                          : isActive
                            ? COLOR.accent.teal
                            : isHovered
                              ? COLOR.text.primary
                              : COLOR.text.muted,
                        fontSize: TYPE.xs.fontSize,
                        fontFamily: FONT_FAMILY,
                        fontWeight: isActive ? WEIGHT.medium : WEIGHT.normal,
                        padding: `${SPACE[2]}px ${SPACE[3]}px`,
                        cursor: disabled ? 'default' : 'pointer',
                        transition: 'color 0.15s, border-color 0.15s',
                        letterSpacing: '0.04em',
                        opacity: disabled ? 0.4 : 1,
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}

                <div style={{ marginLeft: 'auto', display: 'flex', gap: SPACE[4], alignItems: 'center' }}>
                  <span style={{ color: COLOR.text.muted, fontSize: TYPE.xs.fontSize, fontFamily: FONT_FAMILY }}>
                    {summary.total.toLocaleString()} probes
                  </span>
                </div>
              </div>

              <SummaryBar summary={summary} filename={dmpDataset.filename} />

              {/* Volcano */}
              {dmpSubTab === 'volcano' && (
                <ErrorBoundary fallbackLabel="Volcano Plot">
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div style={{ flex: 1, minHeight: 300, overflow: 'hidden' }}>
                          <VolcanoPlot
                            rows={rows}
                            thresholds={thresholds}
                            selectedIndex={selectedIndex}
                            onSelectIndex={setSelectedIndex}
                            onHoverIndex={setHoveredIndex}
                            hoveredIndex={hoveredIndex}
                          />
                        </div>
                      </div>
                      <div style={{ width: 320, flexShrink: 0, borderLeft: `1px solid ${COLOR.border.subtle}`, overflowY: 'auto' }}>
                        <ProbeDetail row={selectedRow} />
                      </div>
                    </div>
                    <div style={{ maxHeight: 400, overflowY: 'auto', borderTop: `1px solid ${COLOR.border.subtle}` }}>
                      <ResultsTable rows={rows} thresholds={thresholds} selectedIndex={selectedIndex} onSelectIndex={setSelectedIndex} />
                    </div>
                  </div>
                </ErrorBoundary>
              )}

              {/* Manhattan */}
              {dmpSubTab === 'manhattan' && (
                <ErrorBoundary fallbackLabel="Manhattan Plot">
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div style={{ flex: 1, minHeight: 300, overflow: 'hidden' }}>
                          <ManhattanPlot
                            rows={rows}
                            thresholds={thresholds}
                            selectedIndex={selectedIndex}
                            onSelectIndex={setSelectedIndex}
                            onHoverIndex={setHoveredIndex}
                            hoveredIndex={hoveredIndex}
                          />
                        </div>
                      </div>
                      <div style={{ width: 320, flexShrink: 0, borderLeft: `1px solid ${COLOR.border.subtle}`, overflowY: 'auto' }}>
                        <ProbeDetail row={selectedRow} />
                      </div>
                    </div>
                    <div style={{ maxHeight: 400, overflowY: 'auto', borderTop: `1px solid ${COLOR.border.subtle}` }}>
                      <ResultsTable rows={rows} thresholds={thresholds} selectedIndex={selectedIndex} onSelectIndex={setSelectedIndex} />
                    </div>
                  </div>
                </ErrorBoundary>
              )}

              {/* Enrichment */}
              {dmpSubTab === 'enrichment' && (
                <ErrorBoundary fallbackLabel="Enrichment">
                  <div style={{ flex: 1, overflow: 'auto' }}>
                    <EnrichmentPanel rows={rows} thresholds={thresholds} />
                  </div>
                </ErrorBoundary>
              )}
            </>
          )}

          {/* ── TE/ERV mode ── */}
          {analysisMode === 'te_erv' && hasData && (
            <>
              {/* Sub-tabs */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE[1],
                padding: `0 ${SPACE[4]}px`,
                borderBottom: `1px solid ${COLOR.border.subtle}`,
                flexShrink: 0,
              }}>
                {TE_TABS.map((tab) => {
                  const isActive = teSubTab === tab.key;
                  const isHovered = subTabHover === tab.key;
                  // Retro-Age only available for beta values (not DMP)
                  const disabled = tab.key === 'retro_age' && inputType === 'dmp';

                  return (
                    <button
                      key={tab.key}
                      onClick={() => !disabled && setTeSubTab(tab.key)}
                      onMouseEnter={() => setSubTabHover(tab.key)}
                      onMouseLeave={() => setSubTabHover(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        borderBottom: isActive ? `2px solid ${COLOR.accent.teal}` : '2px solid transparent',
                        color: disabled
                          ? COLOR.text.faint
                          : isActive
                            ? COLOR.accent.teal
                            : isHovered
                              ? COLOR.text.primary
                              : COLOR.text.muted,
                        fontSize: TYPE.xs.fontSize,
                        fontFamily: FONT_FAMILY,
                        fontWeight: isActive ? WEIGHT.medium : WEIGHT.normal,
                        padding: `${SPACE[2]}px ${SPACE[3]}px`,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        transition: 'color 0.15s, border-color 0.15s',
                        letterSpacing: '0.04em',
                        opacity: disabled ? 0.4 : 1,
                      }}
                      title={disabled ? 'Retro-Age requires beta values (not DMP results)' : undefined}
                    >
                      {tab.label}
                    </button>
                  );
                })}

                {/* Chrono age input (betas only) */}
                {inputType === 'betas' && (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
                    <label style={{ fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize, color: COLOR.text.muted }}>
                      Chronological age:
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      step={1}
                      value={chronoAge ?? ''}
                      onChange={(e) => setChronoAge(e.target.value ? Number(e.target.value) : undefined)}
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
                )}
              </div>

              {/* TE/ERV content */}
              <div style={{ flex: 1, overflow: 'auto', padding: `${SPACE[4]}px ${SPACE[5]}px` }}>
                {/* ── Beta values mode ── */}
                {inputType === 'betas' && teAnalysis && (
                  <>
                    {teSubTab === 'overview' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[5] }}>
                        <SummaryStats analysis={teAnalysis} />

                        {/* Class summary cards */}
                        <div style={{ display: 'flex', gap: SPACE[3], flexWrap: 'wrap' }}>
                          {Object.entries(teAnalysis.summaryByClass)
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
                                  fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize,
                                  color: COLOR.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em',
                                }}>
                                  {cls}
                                </div>
                                <div style={{
                                  fontFamily: FONT_FAMILY, fontSize: TYPE.lg.fontSize,
                                  fontWeight: WEIGHT.bold, color: COLOR.text.primary, fontVariantNumeric: 'tabular-nums',
                                }}>
                                  {data.meanBeta.toFixed(3)}
                                </div>
                                <div style={{
                                  fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize, color: COLOR.text.muted,
                                }}>
                                  {data.nProbes.toLocaleString()} probes / {data.nFamilies} families
                                </div>
                              </div>
                            ))}
                        </div>

                        <FamilyScoreTable
                          scores={filteredTeScores}
                          onSelectFamily={setSelectedFamily}
                          selectedFamily={selectedFamily}
                        />
                      </div>
                    )}

                    {teSubTab === 'retro_age' && (
                      <RetroAgePanel result={teAnalysis.retroAge} />
                    )}

                    {teSubTab === 'coverage' && (
                      <CoverageAnalysis families={teFamilies} />
                    )}
                  </>
                )}

                {/* ── DMP mode: TE differential analysis ── */}
                {inputType === 'dmp' && teDiffAnalysis && (
                  <>
                    {teSubTab === 'overview' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[5] }}>
                        {/* Diff summary stats */}
                        <div style={{
                          display: 'flex', gap: SPACE[5], flexWrap: 'wrap',
                          padding: `${SPACE[3]}px ${SPACE[4]}px`,
                          border: `1px solid ${COLOR.border.subtle}`, borderRadius: 8,
                        }}>
                          {[
                            { label: 'Total DMPs', value: teDiffAnalysis.totalDMPs.toLocaleString() },
                            { label: 'TE-overlapping', value: teDiffAnalysis.teDMPs.toLocaleString() },
                            { label: 'TE fraction', value: `${(teDiffAnalysis.teFraction * 100).toFixed(1)}%` },
                            { label: 'Families scored', value: String(teDiffAnalysis.familyScores.length) },
                            {
                              label: 'Families with sig. probes',
                              value: String(teDiffAnalysis.familyScores.filter((f) => f.nSignificant > 0).length),
                            },
                          ].map((s) => (
                            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{
                                fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize,
                                color: COLOR.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em',
                              }}>
                                {s.label}
                              </span>
                              <span style={{
                                fontFamily: FONT_FAMILY, fontSize: TYPE.base.fontSize,
                                fontWeight: WEIGHT.bold, color: COLOR.text.primary, fontVariantNumeric: 'tabular-nums',
                              }}>
                                {s.value}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Class summary cards (differential) */}
                        <div style={{ display: 'flex', gap: SPACE[3], flexWrap: 'wrap' }}>
                          {Object.entries(teDiffAnalysis.summaryByClass)
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
                                  fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize,
                                  color: COLOR.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em',
                                }}>
                                  {cls}
                                </div>
                                <div style={{
                                  fontFamily: FONT_FAMILY, fontSize: TYPE.lg.fontSize,
                                  fontWeight: WEIGHT.bold, fontVariantNumeric: 'tabular-nums',
                                  color: data.meanDeltaBeta < -0.02 ? '#3b82f6'
                                    : data.meanDeltaBeta > 0.02 ? COLOR.accent.rose
                                    : COLOR.text.primary,
                                }}>
                                  {data.meanDeltaBeta > 0 ? '+' : ''}{data.meanDeltaBeta.toFixed(4)}
                                </div>
                                <div style={{
                                  fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize, color: COLOR.text.muted,
                                }}>
                                  {data.nSignificant} sig / {data.nProbes.toLocaleString()} probes / {data.nFamilies} families
                                </div>
                              </div>
                            ))}
                        </div>

                        <FamilyDiffTable
                          scores={filteredTeDiffScores}
                          onSelectFamily={setSelectedFamily}
                          selectedFamily={selectedFamily}
                        />
                      </div>
                    )}

                    {teSubTab === 'coverage' && (
                      <CoverageAnalysis families={teFamilies} />
                    )}
                  </>
                )}

                {/* No TE data yet (mapping still loading) */}
                {((inputType === 'betas' && !teAnalysis) || (inputType === 'dmp' && !teDiffAnalysis)) && (
                  <div style={{
                    fontFamily: FONT_FAMILY, fontSize: TYPE.sm.fontSize,
                    color: COLOR.text.muted, textAlign: 'center', padding: SPACE[8],
                  }}>
                    Loading TE/ERV reference data...
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Clustering mode ── */}
          {analysisMode === 'clustering' && (
            <ErrorBoundary fallbackLabel="Clustering">
              <div style={{ flex: 1, overflow: 'auto' }}>
                <ClusteringPanel />
              </div>
            </ErrorBoundary>
          )}

          {/* ── Compare mode ── */}
          {analysisMode === 'compare' && (
            <ErrorBoundary fallbackLabel="Comparison">
              <div style={{ flex: 1, overflow: 'auto' }}>
                <ComparisonPanel thresholds={thresholds} />
              </div>
            </ErrorBoundary>
          )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
