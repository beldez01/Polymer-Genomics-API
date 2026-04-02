'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { HLASidebar } from '@/components/hla/HLASidebar';
import { fetchLoci, fetchAlleles, fetchAlleleDetail, compareAlleles, fetchDivergence, fetchExpressionCorrelation } from '@/lib/hla/api';
import type {
  HLALocus, HLAClass, HLATab, LocusSummary, AlleleListItem,
  AlleleDetail, CompareResult, DivergenceResult, ExpressionCorrelationResult,
} from '@/lib/hla/types';

/* ── Styles ── */

const CELL: React.CSSProperties = {
  fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize, color: COLOR.text.primary,
  padding: `${SPACE[2]}px ${SPACE[3]}px`,
  borderBottom: `1px solid ${COLOR.border.subtle}20`,
  fontVariantNumeric: 'tabular-nums',
};

const HEADER: React.CSSProperties = {
  ...CELL, fontWeight: WEIGHT.medium, color: COLOR.text.tertiary,
  borderBottom: `1px solid ${COLOR.border.subtle}`,
  textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  cursor: 'pointer', userSelect: 'none', fontSize: 9,
};

const SECTION: React.CSSProperties = {
  marginBottom: SPACE[4], paddingBottom: SPACE[3],
  borderBottom: `1px solid ${COLOR.border.subtle}`,
};

const SECTION_HEADER: React.CSSProperties = {
  fontFamily: FONT_FAMILY, fontSize: TYPE.md.fontSize,
  fontWeight: WEIGHT.bold, color: COLOR.text.primary,
  letterSpacing: TYPE.md.letterSpacing, marginBottom: SPACE[3],
};

const CARD: React.CSSProperties = {
  border: `1px solid ${COLOR.border.subtle}`, borderRadius: 8,
  padding: SPACE[4], background: COLOR.bg.primary,
  cursor: 'pointer', transition: 'border-color 0.15s',
};

/* ── Page ── */

export default function HLAPage() {
  // Sidebar state
  const [selectedLocus, setSelectedLocus] = useState<HLALocus | null>(null);
  const [classFilter, setClassFilter] = useState<HLAClass | null>(null);
  const [genomicOnly, setGenomicOnly] = useState(false);
  const [alleleGroup, setAlleleGroup] = useState('');
  const [activeTab, setActiveTab] = useState<HLATab>('alleles');

  // Data state
  const [loci, setLoci] = useState<LocusSummary[]>([]);
  const [alleles, setAlleles] = useState<AlleleListItem[]>([]);
  const [alleleTotal, setAlleleTotal] = useState(0);
  const [alleleOffset, setAlleleOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail state
  const [selectedAllele, setSelectedAllele] = useState<AlleleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Compare state
  const [compareNames, setCompareNames] = useState<string[]>([]);
  const [compareInput, setCompareInput] = useState('');
  const [compareFocus, setCompareFocus] = useState<'noncoding' | 'full' | 'coding'>('noncoding');
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Divergence state
  const [divGroup, setDivGroup] = useState('');
  const [divProtein, setDivProtein] = useState('');
  const [divResult, setDivResult] = useState<DivergenceResult | null>(null);
  const [divLoading, setDivLoading] = useState(false);

  // Expression correlation state
  const [exprFocus, setExprFocus] = useState<'noncoding' | 'full' | 'both'>('noncoding');
  const [exprAllLoci, setExprAllLoci] = useState(false);
  const [exprResult, setExprResult] = useState<ExpressionCorrelationResult | null>(null);
  const [exprLoading, setExprLoading] = useState(false);

  // Sort
  const [sortKey, setSortKey] = useState<string>('allele_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Derived: unique allele groups
  const alleleGroups = useMemo(() => {
    const groups = new Set(alleles.map((a) => a.allele_group));
    return [...groups].sort((a, b) => Number(a) - Number(b));
  }, [alleles]);

  /* ── Fetch loci on mount ── */
  useEffect(() => {
    fetchLoci().then(setLoci).catch(() => {});
  }, []);

  /* ── Fetch alleles when locus/filters change ── */
  useEffect(() => {
    if (!selectedLocus) { setAlleles([]); return; }
    setLoading(true);
    setError(null);
    setAlleleOffset(0);
    fetchAlleles(selectedLocus, {
      genomic_only: genomicOnly,
      allele_group: alleleGroup || undefined,
      limit: 200,
      offset: 0,
    })
      .then((res) => { setAlleles(res.alleles); setAlleleTotal(res.total); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedLocus, genomicOnly, alleleGroup]);

  /* ── Load more ── */
  const loadMore = useCallback(async () => {
    if (!selectedLocus || loading) return;
    const newOffset = alleleOffset + 200;
    setLoading(true);
    try {
      const res = await fetchAlleles(selectedLocus, {
        genomic_only: genomicOnly,
        allele_group: alleleGroup || undefined,
        limit: 200,
        offset: newOffset,
      });
      setAlleles((prev) => [...prev, ...res.alleles]);
      setAlleleOffset(newOffset);
    } finally {
      setLoading(false);
    }
  }, [selectedLocus, genomicOnly, alleleGroup, alleleOffset, loading]);

  /* ── Select allele for detail ── */
  const handleSelectAllele = useCallback(async (name: string) => {
    setDetailLoading(true);
    try {
      const detail = await fetchAlleleDetail(name);
      setSelectedAllele(detail);
    } catch {
      setSelectedAllele(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  /* ── Compare ── */
  const handleCompare = useCallback(async () => {
    if (compareNames.length < 2) return;
    setCompareLoading(true);
    try {
      const result = await compareAlleles(compareNames, compareFocus);
      setCompareResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Compare failed');
    } finally {
      setCompareLoading(false);
    }
  }, [compareNames, compareFocus]);

  const addCompareAllele = useCallback(() => {
    const trimmed = compareInput.trim();
    if (trimmed && !compareNames.includes(trimmed)) {
      setCompareNames((prev) => [...prev, trimmed]);
      setCompareInput('');
    }
  }, [compareInput, compareNames]);

  /* ── Divergence ── */
  const handleDivergence = useCallback(async () => {
    if (!selectedLocus || !divGroup || !divProtein) return;
    setDivLoading(true);
    try {
      const result = await fetchDivergence(selectedLocus, divGroup, divProtein);
      setDivResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Divergence query failed');
    } finally {
      setDivLoading(false);
    }
  }, [selectedLocus, divGroup, divProtein]);

  /* ── Expression correlation ── */
  const handleExprCorrelation = useCallback(async () => {
    setExprLoading(true);
    try {
      const locus = exprAllLoci ? undefined : selectedLocus ?? undefined;
      const result = await fetchExpressionCorrelation({ locus: locus ?? undefined, focus: exprFocus });
      setExprResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Expression correlation failed');
    } finally {
      setExprLoading(false);
    }
  }, [selectedLocus, exprFocus, exprAllLoci]);

  // Auto-fetch when switching to expression tab
  useEffect(() => {
    if (activeTab === 'expression' && !exprResult && !exprLoading) {
      handleExprCorrelation();
    }
  }, [activeTab]);

  /* ── Sorting ── */
  const sortedAlleles = useMemo(() => {
    return [...alleles].sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [alleles, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const fmt = (v: number | null, dp = 3) => v != null ? v.toFixed(dp) : '—';

  /* ── Render ── */
  return (
    <div style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: FONT_FAMILY }}>
      <BrandBar subtitle="HLA Allele Biophysics" />

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          borderRight: `1px solid ${COLOR.border.subtle}`,
          background: COLOR.bg.elevated,
          overflowY: 'auto',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <HLASidebar
            selectedLocus={selectedLocus}
            onSelectLocus={(l) => { setSelectedLocus(l); setAlleleGroup(''); setSelectedAllele(null); }}
            classFilter={classFilter}
            onClassFilter={setClassFilter}
            genomicOnly={genomicOnly}
            onGenomicOnly={setGenomicOnly}
            alleleGroup={alleleGroup}
            onAlleleGroup={setAlleleGroup}
            alleleGroups={alleleGroups}
            loci={loci}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Main */}
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* ── No locus selected: overview cards ── */}
          {!selectedLocus && (
            <div style={{ padding: `${SPACE[8]}px ${SPACE[6]}px`, maxWidth: 900, margin: '0 auto', width: '100%' }}>
              <h1 style={{
                fontSize: TYPE.xl.fontSize, fontWeight: WEIGHT.bold, letterSpacing: TYPE.xl.letterSpacing,
                color: COLOR.text.primary, fontFamily: FONT_FAMILY, marginBottom: SPACE[2],
              }}>
                HLA Allele Biophysics
              </h1>
              <p style={{
                fontSize: TYPE.base.fontSize, color: COLOR.text.tertiary, fontFamily: FONT_FAMILY,
                lineHeight: TYPE.base.lineHeight, marginBottom: SPACE[8], maxWidth: 640,
              }}>
                Material-channel analysis of {loci.reduce((s, l) => s + l.total_alleles, 0).toLocaleString()} HLA
                alleles from IPD-IMGT/HLA. Non-coding biophysics (introns, UTRs) capture the hidden
                layer of expression-relevant variation that protein-level matching misses.
                <span style={{ display: 'block', marginTop: SPACE[2], fontSize: TYPE.sm.fontSize, color: COLOR.text.muted }}>
                  Bettens et al. 2022 — non-coding cis-eQTLs explain 13-50% of HLA class I expression variance.
                </span>
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: SPACE[4] }}>
                {loci.map((l) => (
                  <div
                    key={l.locus}
                    onClick={() => setSelectedLocus(l.locus)}
                    style={CARD}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLOR.accent.teal; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLOR.border.subtle; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2], marginBottom: SPACE[3] }}>
                      <span style={{
                        fontSize: 9, padding: '2px 5px',
                        border: `1px solid ${l.hla_class === 1 ? COLOR.accent.teal : COLOR.accent.violet}40`,
                        color: l.hla_class === 1 ? COLOR.accent.teal : COLOR.accent.violet,
                        fontFamily: FONT_FAMILY,
                      }}>
                        Class {l.hla_class === 1 ? 'I' : 'II'}
                      </span>
                      <span style={{ fontSize: TYPE.md.fontSize, fontWeight: WEIGHT.bold, color: COLOR.text.primary, fontFamily: FONT_FAMILY }}>
                        {l.locus.replace('HLA-', '')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <StatRow label="alleles" value={l.total_alleles.toLocaleString()} />
                      <StatRow label="genomic" value={l.genomic_alleles.toLocaleString()} />
                      <StatRow label="GC" value={fmt(l.mean_gc_content)} />
                      <StatRow label="ΔG₃₇" value={fmt(l.mean_stacking_dg37)} />
                      <StatRow label="nc GC" value={fmt(l.mean_nc_gc_content)} highlight />
                      <StatRow label="nc ΔG₃₇" value={fmt(l.mean_nc_stacking_dg37)} highlight />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Locus selected ── */}
          {selectedLocus && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* ── ALLELES TAB ── */}
              {activeTab === 'alleles' && (
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  {/* Table */}
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {[
                            { key: 'allele_name', label: 'Allele', w: '18%' },
                            { key: 'has_genomic', label: 'Seq', w: '5%' },
                            { key: 'gc_content', label: 'GC', w: '8%', align: 'right' as const },
                            { key: 'mean_stacking_dg37', label: 'ΔG₃₇', w: '9%', align: 'right' as const },
                            { key: 'melting_temp_est', label: 'Tm', w: '8%', align: 'right' as const },
                            { key: 'nc_gc_content', label: 'nc GC', w: '8%', align: 'right' as const },
                            { key: 'nc_mean_stacking_dg37', label: 'nc ΔG₃₇', w: '9%', align: 'right' as const },
                            { key: 'nc_melting_temp_est', label: 'nc Tm', w: '8%', align: 'right' as const },
                            { key: 'sequence_length', label: 'Length', w: '8%', align: 'right' as const },
                            { key: 'expression_suffix', label: 'Expr', w: '6%' },
                          ].map((col) => (
                            <th
                              key={col.key}
                              onClick={() => handleSort(col.key)}
                              style={{ ...HEADER, width: col.w, textAlign: col.align ?? 'left' }}
                            >
                              {col.label}
                              {sortKey === col.key && (
                                <span style={{ marginLeft: 3, fontSize: 8 }}>
                                  {sortDir === 'asc' ? '▲' : '▼'}
                                </span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedAlleles.map((a) => {
                          const isSelected = selectedAllele?.identity.allele_name === a.allele_name;
                          return (
                            <tr
                              key={a.allele_name}
                              onClick={() => handleSelectAllele(a.allele_name)}
                              style={{
                                cursor: 'pointer',
                                background: isSelected ? `${COLOR.accent.teal}0C` : 'transparent',
                                transition: 'background 0.1s',
                              }}
                              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = COLOR.bg.elevated; }}
                              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <td style={{ ...CELL, fontWeight: WEIGHT.medium }}>{a.allele_name}</td>
                              <td style={CELL}>
                                <span style={{
                                  width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                                  background: a.has_genomic ? COLOR.accent.teal : `${COLOR.text.faint}40`,
                                }} />
                              </td>
                              <td style={{ ...CELL, textAlign: 'right' }}>{fmt(a.gc_content)}</td>
                              <td style={{ ...CELL, textAlign: 'right' }}>{fmt(a.mean_stacking_dg37)}</td>
                              <td style={{ ...CELL, textAlign: 'right' }}>{fmt(a.melting_temp_est, 1)}</td>
                              <td style={{ ...CELL, textAlign: 'right', color: COLOR.accent.teal }}>{fmt(a.nc_gc_content)}</td>
                              <td style={{ ...CELL, textAlign: 'right', color: COLOR.accent.teal }}>{fmt(a.nc_mean_stacking_dg37)}</td>
                              <td style={{ ...CELL, textAlign: 'right', color: COLOR.accent.teal }}>{fmt(a.nc_melting_temp_est, 1)}</td>
                              <td style={{ ...CELL, textAlign: 'right' }}>{a.sequence_length?.toLocaleString() ?? '—'}</td>
                              <td style={{ ...CELL, color: a.expression_suffix ? COLOR.accent.amber : COLOR.text.muted }}>
                                {a.expression_suffix ?? '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {alleles.length < alleleTotal && (
                      <div style={{ padding: SPACE[4], textAlign: 'center' }}>
                        <button
                          onClick={loadMore}
                          disabled={loading}
                          style={{
                            ...COMPONENT.button.small,
                            opacity: loading ? 0.5 : 1,
                          }}
                        >
                          {loading ? 'Loading...' : `Load more (${alleles.length} / ${alleleTotal})`}
                        </button>
                      </div>
                    )}

                    {loading && alleles.length === 0 && (
                      <div style={{ padding: SPACE[8], textAlign: 'center', color: COLOR.text.muted, fontSize: TYPE.sm.fontSize }}>
                        Loading alleles...
                      </div>
                    )}
                  </div>

                  {/* Detail panel */}
                  <div style={{
                    width: 320, flexShrink: 0,
                    borderLeft: `1px solid ${COLOR.border.subtle}`,
                    overflowY: 'auto', padding: `${SPACE[4]}px ${SPACE[3]}px`,
                    background: COLOR.bg.primary,
                  }}>
                    {detailLoading && (
                      <div style={{ color: COLOR.text.muted, fontSize: TYPE.sm.fontSize }}>Loading...</div>
                    )}
                    {!detailLoading && !selectedAllele && (
                      <div style={{ color: COLOR.text.faint, fontSize: TYPE.sm.fontSize }}>
                        Select an allele to view full biophysical profile
                      </div>
                    )}
                    {!detailLoading && selectedAllele && (
                      <AlleleDetailPanel detail={selectedAllele} />
                    )}
                  </div>
                </div>
              )}

              {/* ── COMPARE TAB ── */}
              {activeTab === 'compare' && (
                <div style={{ padding: `${SPACE[5]}px ${SPACE[6]}px`, maxWidth: 900, overflow: 'auto' }}>
                  <div style={SECTION_HEADER}>Compare Alleles</div>
                  <p style={{ fontSize: TYPE.sm.fontSize, color: COLOR.text.tertiary, marginBottom: SPACE[4], lineHeight: 1.6 }}>
                    Enter 2-10 allele names. First allele is the reference for delta computation.
                    Focus on non-coding regions to reveal the expression-relevant hidden layer.
                  </p>

                  {/* Input */}
                  <div style={{ display: 'flex', gap: SPACE[2], marginBottom: SPACE[3], flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={compareInput}
                      onChange={(e) => setCompareInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addCompareAllele(); }}
                      placeholder={`e.g. ${selectedLocus?.replace('HLA-', '') ?? 'A'}*02:01:01:01`}
                      style={{
                        fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize,
                        padding: `${SPACE[2]}px ${SPACE[3]}px`,
                        border: `1px solid ${COLOR.border.default}`,
                        background: COLOR.bg.primary, color: COLOR.text.primary,
                        width: 220,
                      }}
                    />
                    <button onClick={addCompareAllele} style={COMPONENT.button.small}>Add</button>
                    <select
                      value={compareFocus}
                      onChange={(e) => setCompareFocus(e.target.value as any)}
                      style={{
                        fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize,
                        padding: `${SPACE[1]}px ${SPACE[2]}px`,
                        border: `1px solid ${COLOR.border.default}`,
                        background: COLOR.bg.surface, color: COLOR.text.secondary,
                      }}
                    >
                      <option value="noncoding">Non-coding focus</option>
                      <option value="full">Full sequence</option>
                      <option value="coding">Coding only</option>
                    </select>
                    <button
                      onClick={handleCompare}
                      disabled={compareNames.length < 2 || compareLoading}
                      style={{
                        ...COMPONENT.button.small,
                        backgroundColor: compareNames.length >= 2 ? COLOR.accent.teal : 'transparent',
                        color: compareNames.length >= 2 ? COLOR.bg.primary : COLOR.text.muted,
                        borderColor: compareNames.length >= 2 ? COLOR.accent.teal : COLOR.border.default,
                      }}
                    >
                      {compareLoading ? 'Running...' : 'Compare'}
                    </button>
                  </div>

                  {/* Selected alleles */}
                  {compareNames.length > 0 && (
                    <div style={{ display: 'flex', gap: SPACE[2], flexWrap: 'wrap', marginBottom: SPACE[4] }}>
                      {compareNames.map((name, i) => (
                        <span key={name} style={{
                          fontFamily: FONT_FAMILY, fontSize: 9, padding: '3px 8px',
                          border: `1px solid ${i === 0 ? COLOR.accent.teal : COLOR.border.default}`,
                          color: i === 0 ? COLOR.accent.teal : COLOR.text.secondary,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          {i === 0 && <span style={{ fontSize: 7, opacity: 0.6 }}>REF</span>}
                          {name}
                          <span
                            onClick={() => setCompareNames((prev) => prev.filter((_, j) => j !== i))}
                            style={{ cursor: 'pointer', color: COLOR.text.faint, fontSize: 10, marginLeft: 2 }}
                          >
                            ×
                          </span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Results */}
                  {compareResult && (
                    <div>
                      <div style={{ ...SECTION, marginTop: SPACE[4] }}>
                        <div style={{ fontSize: TYPE.sm.fontSize, color: COLOR.text.muted, marginBottom: SPACE[2] }}>
                          {compareResult.shared_protein ? 'Protein-identical alleles' : 'Different proteins'} ·
                          Focus: {compareResult.focus} · Reference: {compareResult.reference}
                        </div>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={HEADER}>Metric</th>
                            {Object.keys(compareResult.comparison).map((name) => (
                              <th key={name} style={{ ...HEADER, textAlign: 'right' }}>
                                {name === compareResult.reference ? `${name} (ref)` : name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const ref = compareResult.comparison[compareResult.reference];
                            const bio = compareResult.focus === 'noncoding' ? ref?.noncoding_biophysics : ref?.biophysics;
                            if (!bio) return null;
                            return Object.keys(bio).map((metric) => (
                              <tr key={metric}>
                                <td style={{ ...CELL, fontSize: 9 }}>{metric.replace(/_/g, ' ')}</td>
                                {Object.entries(compareResult.comparison).map(([name, data]) => {
                                  const val = compareResult.focus === 'noncoding'
                                    ? (data.noncoding_biophysics as any)?.[metric]
                                    : (data.biophysics as any)?.[metric];
                                  const delta = compareResult.deltas_vs_reference[name]?.[`delta_${metric}`];
                                  return (
                                    <td key={name} style={{ ...CELL, textAlign: 'right' }}>
                                      {val != null ? Number(val).toFixed(4) : '—'}
                                      {delta != null && name !== compareResult.reference && (
                                        <span style={{
                                          display: 'block', fontSize: 8,
                                          color: Math.abs(delta) > 0.01 ? COLOR.accent.rose : COLOR.text.faint,
                                        }}>
                                          {delta > 0 ? '+' : ''}{delta.toFixed(4)}
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── DIVERGENCE TAB ── */}
              {activeTab === 'divergence' && (
                <div style={{ padding: `${SPACE[5]}px ${SPACE[6]}px`, maxWidth: 900, overflow: 'auto' }}>
                  <div style={SECTION_HEADER}>Non-Coding Divergence</div>
                  <p style={{ fontSize: TYPE.sm.fontSize, color: COLOR.text.tertiary, marginBottom: SPACE[4], lineHeight: 1.6 }}>
                    Select a protein (e.g., {selectedLocus?.replace('HLA-', '')}*02:01) to find all alleles encoding
                    the same protein and rank non-coding regions by biophysical variance.
                    High variance = potential expression mismatch despite protein identity.
                  </p>

                  <div style={{ display: 'flex', gap: SPACE[2], marginBottom: SPACE[4], alignItems: 'center' }}>
                    <span style={{ fontSize: TYPE.xs.fontSize, color: COLOR.text.muted }}>
                      {selectedLocus?.replace('HLA-', '')}*
                    </span>
                    <input
                      type="text"
                      value={divGroup}
                      onChange={(e) => setDivGroup(e.target.value)}
                      placeholder="02"
                      style={{
                        fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize,
                        padding: `${SPACE[2]}px ${SPACE[2]}px`, width: 50,
                        border: `1px solid ${COLOR.border.default}`,
                        background: COLOR.bg.primary, color: COLOR.text.primary,
                      }}
                    />
                    <span style={{ fontSize: TYPE.xs.fontSize, color: COLOR.text.muted }}>:</span>
                    <input
                      type="text"
                      value={divProtein}
                      onChange={(e) => setDivProtein(e.target.value)}
                      placeholder="01"
                      style={{
                        fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize,
                        padding: `${SPACE[2]}px ${SPACE[2]}px`, width: 50,
                        border: `1px solid ${COLOR.border.default}`,
                        background: COLOR.bg.primary, color: COLOR.text.primary,
                      }}
                    />
                    <button
                      onClick={handleDivergence}
                      disabled={!divGroup || !divProtein || divLoading}
                      style={{
                        ...COMPONENT.button.small,
                        backgroundColor: divGroup && divProtein ? COLOR.accent.teal : 'transparent',
                        color: divGroup && divProtein ? COLOR.bg.primary : COLOR.text.muted,
                        borderColor: divGroup && divProtein ? COLOR.accent.teal : COLOR.border.default,
                      }}
                    >
                      {divLoading ? 'Querying...' : 'Analyze'}
                    </button>
                  </div>

                  {divResult && (
                    <div>
                      <div style={{ fontSize: TYPE.sm.fontSize, color: COLOR.text.muted, marginBottom: SPACE[3] }}>
                        {divResult.n_alleles} alleles encode {divResult.query.locus.replace('HLA-', '')}*{divResult.query.allele_group}:{divResult.query.protein}
                        {divResult.most_variable_metric && (
                          <span> · Most variable: <strong style={{ color: COLOR.accent.teal }}>
                            {divResult.most_variable_metric.replace(/^nc_/, '').replace(/_/g, ' ')}
                          </strong></span>
                        )}
                      </div>

                      {/* Variance ranking */}
                      <div style={SECTION_HEADER}>Metric Variance Ranking</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: SPACE[5] }}>
                        <thead>
                          <tr>
                            <th style={HEADER}>NC Metric</th>
                            <th style={{ ...HEADER, textAlign: 'right' }}>Variance</th>
                            <th style={{ ...HEADER, textAlign: 'right' }}>Mean</th>
                            <th style={{ ...HEADER, textAlign: 'right' }}>Range</th>
                            <th style={{ ...HEADER, textAlign: 'right' }}>n</th>
                          </tr>
                        </thead>
                        <tbody>
                          {divResult.ranked_by_variance.map((m, i) => (
                            <tr key={m.metric}>
                              <td style={{ ...CELL, fontWeight: i === 0 ? WEIGHT.bold : WEIGHT.normal, color: i === 0 ? COLOR.accent.teal : COLOR.text.primary }}>
                                {m.metric.replace(/^nc_/, '').replace(/_/g, ' ')}
                              </td>
                              <td style={{ ...CELL, textAlign: 'right' }}>{m.variance.toFixed(6)}</td>
                              <td style={{ ...CELL, textAlign: 'right' }}>{m.mean.toFixed(4)}</td>
                              <td style={{ ...CELL, textAlign: 'right', fontSize: 9 }}>
                                [{m.range[0].toFixed(4)}, {m.range[1].toFixed(4)}]
                              </td>
                              <td style={{ ...CELL, textAlign: 'right' }}>{m.n}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── EXPRESSION TAB ── */}
              {activeTab === 'expression' && (
                <div style={{ padding: `${SPACE[5]}px ${SPACE[6]}px`, maxWidth: 1000, overflow: 'auto' }}>
                  <div style={SECTION_HEADER}>Expression Correlation</div>
                  <p style={{ fontSize: TYPE.sm.fontSize, color: COLOR.text.tertiary, marginBottom: SPACE[4], lineHeight: 1.6 }}>
                    Do biophysical properties of HLA allele DNA predict expression phenotype?
                    Groups alleles by IMGT expression suffix and computes Cohen&apos;s d effect sizes
                    for each biophysical metric (normal vs aberrant expression classes).
                  </p>

                  {/* Controls */}
                  <div style={{ display: 'flex', gap: SPACE[2], marginBottom: SPACE[4], alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={exprFocus}
                      onChange={(e) => { setExprFocus(e.target.value as any); setExprResult(null); }}
                      style={{
                        fontFamily: FONT_FAMILY, fontSize: TYPE.xs.fontSize,
                        padding: `${SPACE[1]}px ${SPACE[2]}px`,
                        border: `1px solid ${COLOR.border.default}`,
                        background: COLOR.bg.surface, color: COLOR.text.secondary,
                      }}
                    >
                      <option value="noncoding">Non-coding metrics</option>
                      <option value="full">Whole-allele metrics</option>
                      <option value="both">All metrics</option>
                    </select>
                    <button
                      onClick={() => { setExprAllLoci(!exprAllLoci); setExprResult(null); }}
                      style={exprAllLoci ? { ...COMPONENT.button.small, borderColor: COLOR.accent.teal, color: COLOR.accent.teal } : COMPONENT.button.small}
                    >
                      {exprAllLoci ? 'All loci' : selectedLocus?.replace('HLA-', '') ?? 'This locus'}
                    </button>
                    <button
                      onClick={handleExprCorrelation}
                      disabled={exprLoading}
                      style={{
                        ...COMPONENT.button.small,
                        backgroundColor: COLOR.accent.teal,
                        color: COLOR.bg.primary,
                        borderColor: COLOR.accent.teal,
                        opacity: exprLoading ? 0.5 : 1,
                      }}
                    >
                      {exprLoading ? 'Analyzing...' : 'Run'}
                    </button>
                  </div>

                  {exprLoading && !exprResult && (
                    <div style={{ padding: SPACE[8], textAlign: 'center', color: COLOR.text.muted, fontSize: TYPE.sm.fontSize }}>
                      Analyzing expression correlation...
                    </div>
                  )}

                  {exprResult && (
                    <div>
                      {/* Class distribution */}
                      <div style={{ ...SECTION, marginBottom: SPACE[5] }}>
                        <div style={{ fontSize: 9, fontWeight: WEIGHT.medium, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: COLOR.text.faint, marginBottom: SPACE[3] }}>
                          CLASS DISTRIBUTION — {exprResult.n_alleles.toLocaleString()} genomic alleles
                        </div>
                        <div style={{ display: 'flex', gap: SPACE[2], flexWrap: 'wrap' }}>
                          {Object.entries(exprResult.class_distribution).map(([label, info]) => {
                            const isNormal = label === 'normal';
                            const pct = ((info.n / exprResult.n_alleles) * 100).toFixed(1);
                            return (
                              <div key={label} style={{
                                padding: `${SPACE[2]}px ${SPACE[3]}px`,
                                border: `1px solid ${isNormal ? COLOR.accent.teal : COLOR.accent.amber}30`,
                                background: isNormal ? `${COLOR.accent.teal}08` : 'transparent',
                                minWidth: 80,
                              }}>
                                <div style={{ fontSize: 9, color: isNormal ? COLOR.accent.teal : COLOR.accent.amber, fontWeight: WEIGHT.medium, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                                  {label}{info.suffix ? ` (${info.suffix})` : ''}
                                </div>
                                <div style={{ fontSize: TYPE.md.fontSize, fontWeight: WEIGHT.bold, color: COLOR.text.primary, fontVariantNumeric: 'tabular-nums' }}>
                                  {info.n.toLocaleString()}
                                </div>
                                <div style={{ fontSize: 8, color: COLOR.text.muted }}>{pct}%</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Pooled: normal vs all-aberrant */}
                      {exprResult.pooled_normal_vs_aberrant.length > 0 && (
                        <div style={{ marginBottom: SPACE[5] }}>
                          <div style={{ fontSize: 9, fontWeight: WEIGHT.medium, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: COLOR.text.faint, marginBottom: SPACE[3] }}>
                            NORMAL vs ALL ABERRANT — ranked by |Cohen&apos;s d|
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={HEADER}>Metric</th>
                                <th style={{ ...HEADER, textAlign: 'right' }}>Cohen&apos;s d</th>
                                <th style={{ ...HEADER, textAlign: 'right' }}>|d|</th>
                                <th style={{ ...HEADER, textAlign: 'right' }}>Normal mean</th>
                                <th style={{ ...HEADER, textAlign: 'right' }}>Aberrant mean</th>
                                <th style={{ ...HEADER, textAlign: 'right' }}>n normal</th>
                                <th style={{ ...HEADER, textAlign: 'right' }}>n aberrant</th>
                                <th style={HEADER}>Direction</th>
                              </tr>
                            </thead>
                            <tbody>
                              {exprResult.pooled_normal_vs_aberrant.map((e, i) => {
                                const isLarge = e.abs_d >= 0.8;
                                const isMed = e.abs_d >= 0.5;
                                return (
                                  <tr key={e.metric}>
                                    <td style={{ ...CELL, fontWeight: isLarge ? WEIGHT.bold : WEIGHT.normal, color: isLarge ? COLOR.accent.teal : COLOR.text.primary }}>
                                      {e.metric.replace(/^nc_/, '').replace(/_/g, ' ')}
                                    </td>
                                    <td style={{ ...CELL, textAlign: 'right', color: isLarge ? COLOR.accent.teal : isMed ? COLOR.accent.amber : COLOR.text.secondary }}>
                                      {e.cohens_d > 0 ? '+' : ''}{e.cohens_d.toFixed(3)}
                                    </td>
                                    <td style={{ ...CELL, textAlign: 'right', fontWeight: WEIGHT.medium }}>
                                      {e.abs_d.toFixed(3)}
                                    </td>
                                    <td style={{ ...CELL, textAlign: 'right' }}>{e.normal_mean.toFixed(4)}</td>
                                    <td style={{ ...CELL, textAlign: 'right' }}>{e.aberrant_mean.toFixed(4)}</td>
                                    <td style={{ ...CELL, textAlign: 'right', color: COLOR.text.muted }}>{e.normal_n.toLocaleString()}</td>
                                    <td style={{ ...CELL, textAlign: 'right', color: COLOR.text.muted }}>{e.aberrant_n.toLocaleString()}</td>
                                    <td style={{ ...CELL, fontSize: 9, color: COLOR.text.muted }}>{e.direction}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <div style={{ marginTop: SPACE[2], fontSize: 8, color: COLOR.text.faint }}>
                            Effect size: |d| &ge; 0.8 large · &ge; 0.5 medium · &ge; 0.2 small
                          </div>
                        </div>
                      )}

                      {/* Per-class effect sizes (top 20) */}
                      {exprResult.effect_sizes.length > 0 && (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: WEIGHT.medium, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: COLOR.text.faint, marginBottom: SPACE[3] }}>
                            PER-CLASS EFFECT SIZES — top {Math.min(30, exprResult.effect_sizes.length)}
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={HEADER}>Metric</th>
                                <th style={HEADER}>Class</th>
                                <th style={{ ...HEADER, textAlign: 'right' }}>d</th>
                                <th style={{ ...HEADER, textAlign: 'right' }}>|d|</th>
                                <th style={{ ...HEADER, textAlign: 'right' }}>Normal</th>
                                <th style={{ ...HEADER, textAlign: 'right' }}>Class mean</th>
                                <th style={{ ...HEADER, textAlign: 'right' }}>n</th>
                              </tr>
                            </thead>
                            <tbody>
                              {exprResult.effect_sizes.slice(0, 30).map((e, i) => {
                                const isLarge = e.abs_d >= 0.8;
                                const isMed = e.abs_d >= 0.5;
                                return (
                                  <tr key={`${e.metric}-${e.expression_class}`}>
                                    <td style={{ ...CELL, fontWeight: isLarge ? WEIGHT.bold : WEIGHT.normal }}>
                                      {e.metric.replace(/^nc_/, '').replace(/_/g, ' ')}
                                    </td>
                                    <td style={{ ...CELL, color: COLOR.accent.amber }}>{e.expression_class}</td>
                                    <td style={{ ...CELL, textAlign: 'right', color: isLarge ? COLOR.accent.teal : isMed ? COLOR.accent.amber : COLOR.text.secondary }}>
                                      {e.cohens_d > 0 ? '+' : ''}{e.cohens_d.toFixed(3)}
                                    </td>
                                    <td style={{ ...CELL, textAlign: 'right', fontWeight: WEIGHT.medium }}>{e.abs_d.toFixed(3)}</td>
                                    <td style={{ ...CELL, textAlign: 'right' }}>{e.normal_mean.toFixed(4)}</td>
                                    <td style={{ ...CELL, textAlign: 'right' }}>{e.class_mean.toFixed(4)}</td>
                                    <td style={{ ...CELL, textAlign: 'right', color: COLOR.text.muted }}>{e.class_n}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              margin: SPACE[4], padding: `${SPACE[2]}px ${SPACE[4]}px`,
              background: 'rgba(244,63,94,0.08)', border: `1px solid ${COLOR.accent.rose}40`,
              color: COLOR.accent.rose, fontSize: TYPE.sm.fontSize, fontFamily: FONT_FAMILY,
            }}>
              {error}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

/* ── Sub-components ── */

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '1px 0' }}>
      <span style={{ fontSize: 9, color: COLOR.text.muted, fontFamily: FONT_FAMILY }}>{label}</span>
      <span style={{
        fontSize: 10, fontFamily: FONT_FAMILY, fontWeight: WEIGHT.medium,
        fontVariantNumeric: 'tabular-nums',
        color: highlight ? COLOR.accent.teal : COLOR.text.secondary,
      }}>
        {value}
      </span>
    </div>
  );
}

function AlleleDetailPanel({ detail }: { detail: AlleleDetail }) {
  const { identity: id, sequence_metadata: seq, biophysics: bio, noncoding_biophysics: nc, features } = detail;
  const fmt = (v: number | null, dp = 4) => v != null ? v.toFixed(dp) : '—';

  const SECT: React.CSSProperties = {
    marginBottom: 14, paddingBottom: 14,
    borderBottom: `1px solid ${COLOR.border.subtle}`,
  };
  const SECT_TITLE: React.CSSProperties = {
    fontSize: 9, fontWeight: WEIGHT.medium, letterSpacing: '0.08em',
    textTransform: 'uppercase' as const, color: COLOR.text.faint,
    fontFamily: FONT_FAMILY, marginBottom: 8,
  };

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* Identity */}
      <div style={SECT}>
        <div style={{ fontSize: TYPE.md.fontSize, fontWeight: WEIGHT.bold, color: COLOR.text.primary, marginBottom: SPACE[2] }}>
          {id.allele_name}
        </div>
        <div style={{ display: 'flex', gap: SPACE[2], flexWrap: 'wrap', marginBottom: SPACE[2] }}>
          <span style={{
            fontSize: 9, padding: '2px 5px',
            border: `1px solid ${id.hla_class === 1 ? COLOR.accent.teal : COLOR.accent.violet}40`,
            color: id.hla_class === 1 ? COLOR.accent.teal : COLOR.accent.violet,
          }}>
            Class {id.hla_class === 1 ? 'I' : 'II'}
          </span>
          {id.expression_suffix && (
            <span style={{ fontSize: 9, padding: '2px 5px', border: `1px solid ${COLOR.accent.amber}40`, color: COLOR.accent.amber }}>
              {id.expression_suffix}
            </span>
          )}
          {seq.has_genomic && (
            <span style={{ fontSize: 9, padding: '2px 5px', border: `1px solid ${COLOR.accent.teal}40`, color: COLOR.accent.teal }}>
              Genomic
            </span>
          )}
        </div>
        <StatRow label="length" value={seq.sequence_length?.toLocaleString() ?? '—'} />
        <StatRow label="CDS" value={seq.cds_length?.toLocaleString() ?? '—'} />
        <StatRow label="exons" value={String(seq.n_exons ?? '—')} />
        <StatRow label="introns" value={String(seq.n_introns ?? '—')} />
      </div>

      {/* Whole-allele biophysics */}
      <div style={SECT}>
        <div style={SECT_TITLE}>WHOLE-ALLELE BIOPHYSICS</div>
        <StatRow label="GC" value={fmt(bio.gc_content)} />
        <StatRow label="CpG count" value={String(bio.cpg_count ?? '—')} />
        <StatRow label="CpG obs/exp" value={fmt(bio.cpg_obs_exp)} />
        <StatRow label="CpG islands" value={String(bio.cpg_island_count ?? '—')} />
        <StatRow label="ΔG₃₇" value={fmt(bio.mean_stacking_dg37)} />
        <StatRow label="Tm" value={fmt(bio.melting_temp_est, 1)} />
        <StatRow label="A-form" value={fmt(bio.mean_a_form_prop)} />
        <StatRow label="Z-form" value={fmt(bio.mean_z_form_prop)} />
        <StatRow label="Z penalty" value={fmt(bio.total_z_penalty, 2)} />
        <StatRow label="major groove" value={`${fmt(bio.mean_major_groove_w, 2)} Å`} />
        <StatRow label="minor groove" value={`${fmt(bio.mean_minor_groove_w, 2)} Å`} />
      </div>

      {/* Non-coding biophysics */}
      <div style={SECT}>
        <div style={SECT_TITLE}>NON-CODING BIOPHYSICS</div>
        <StatRow label="nc GC" value={fmt(nc.gc_content)} highlight />
        <StatRow label="nc CpG" value={String(nc.cpg_count ?? '—')} highlight />
        <StatRow label="nc ΔG₃₇" value={fmt(nc.mean_stacking_dg37)} highlight />
        <StatRow label="nc Tm" value={fmt(nc.melting_temp_est, 1)} highlight />
        <StatRow label="nc A-form" value={fmt(nc.mean_a_form_prop)} highlight />
        <StatRow label="nc Z-form" value={fmt(nc.mean_z_form_prop)} highlight />
        <StatRow label="nc CpG islands" value={String(nc.cpg_island_count ?? '—')} highlight />
      </div>

      {/* Features */}
      {features.length > 0 && (
        <div>
          <div style={SECT_TITLE}>FEATURES ({features.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {features.map((f) => {
              const isNC = f.feature_type !== 'exon';
              return (
                <div
                  key={f.feature_label}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '3px 6px', background: isNC ? `${COLOR.accent.teal}08` : 'transparent',
                    borderLeft: `2px solid ${isNC ? COLOR.accent.teal : COLOR.text.faint}40`,
                  }}
                >
                  <span style={{ fontSize: 9, color: isNC ? COLOR.accent.teal : COLOR.text.secondary, fontWeight: WEIGHT.medium }}>
                    {f.feature_label}
                  </span>
                  <span style={{ fontSize: 8, color: COLOR.text.muted, fontVariantNumeric: 'tabular-nums' }}>
                    {f.length_bp}bp · GC {fmt(f.gc_content)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
