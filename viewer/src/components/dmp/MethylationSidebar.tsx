'use client';

import { useMemo } from 'react';
import { COLOR, FONT_FAMILY, TYPE, WEIGHT, SPACE } from '@/config/theme';
import type { DMPDataset, DMPRow, ThresholdState } from '@/lib/dmp/types';
import type { TEMethylationAnalysis } from '@/lib/te-methylation/types';
import type { TEDiffAnalysis } from '@/lib/te-methylation/dmp-scoring';
import type { InputFileType } from '@/lib/methylation-detect';
import type { Platform } from '@/lib/te-methylation/parse-betas';

/* ── Shared Styles (matches LensPanel / transposome) ── */

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 9,
  fontWeight: WEIGHT.medium,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: COLOR.text.faint,
  fontFamily: FONT_FAMILY,
  marginTop: 16,
  marginBottom: 8,
};

const SECTION_TITLE_FIRST: React.CSSProperties = {
  ...SECTION_TITLE,
  marginTop: 0,
};

const STAT_ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '2px 0',
};

const STAT_LABEL: React.CSSProperties = {
  fontSize: 9,
  color: COLOR.text.muted,
  fontFamily: FONT_FAMILY,
};

const STAT_VALUE: React.CSSProperties = {
  fontSize: 10,
  color: COLOR.text.secondary,
  fontFamily: FONT_FAMILY,
  fontWeight: WEIGHT.medium,
  fontVariantNumeric: 'tabular-nums',
};

const PILL: React.CSSProperties = {
  fontSize: 9,
  fontFamily: 'inherit',
  padding: '3px 7px',
  background: 'transparent',
  border: `1px solid ${COLOR.border.default}`,
  color: COLOR.text.muted,
  cursor: 'pointer',
  transition: 'all 0.15s',
};

const PILL_ACTIVE: React.CSSProperties = {
  ...PILL,
  borderColor: COLOR.accent.teal,
  color: COLOR.accent.teal,
  background: 'rgba(78,205,196,0.15)',
};

const DIVIDER: React.CSSProperties = {
  height: 1,
  background: COLOR.border.subtle,
  margin: '12px 0 4px',
};

const SLIDER_LABEL: React.CSSProperties = {
  fontSize: 9,
  color: COLOR.text.muted,
  fontFamily: FONT_FAMILY,
  marginBottom: 3,
  display: 'flex',
  justifyContent: 'space-between',
};

/* ── Mini bar chart (horizontal) ── */

function MiniBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 0' }}>
      <span style={{ fontSize: 8, color: COLOR.text.faint, fontFamily: FONT_FAMILY, minWidth: 28, textAlign: 'right' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 4, background: `${COLOR.border.subtle}40`, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 8, color: COLOR.text.muted, fontFamily: FONT_FAMILY, minWidth: 24, fontVariantNumeric: 'tabular-nums' }}>
        {value > 999 ? `${(value / 1000).toFixed(0)}k` : value}
      </span>
    </div>
  );
}

/* ── Genomic context distribution ── */

function computeGenomicContext(rows: DMPRow[], thresholds: ThresholdState) {
  // Rough classification by probe_id patterns and chromosomal context
  // In practice we'd use the API, but for sidebar we approximate from the data
  let sig = 0, hyper = 0, hypo = 0;
  const chrCounts: Record<string, number> = {};

  for (const r of rows) {
    const isSig = r.neg_log10_p >= thresholds.pValueCutoff
      && r.adj_p_value <= thresholds.adjPValueCutoff
      && Math.abs(r.delta_beta) >= thresholds.deltaBetaCutoff;
    if (isSig) {
      sig++;
      if (r.delta_beta > 0) hyper++;
      else hypo++;
    }
    if (r.chr) {
      chrCounts[r.chr] = (chrCounts[r.chr] ?? 0) + 1;
    }
  }

  return { sig, hyper, hypo, chrCounts };
}

/* ── Component Props ── */

type AnalysisMode = 'dmp' | 'te_erv' | 'clustering' | 'compare';

interface MethylationSidebarProps {
  // Input state
  inputType: InputFileType | null;
  analysisMode: AnalysisMode;
  platform?: Platform;
  filename?: string;

  // DMP state
  dmpDataset: DMPDataset | null;
  thresholds: ThresholdState;
  onThresholdsChange: (t: ThresholdState) => void;

  // TE/ERV state
  teAnalysis: TEMethylationAnalysis | null;
  teDiffAnalysis: TEDiffAnalysis | null;
  teClassFilter: string | null;
  onTeClassFilter: (cls: string | null) => void;

  // Export
  onExport?: () => void;
}

/* ── Component ── */

export function MethylationSidebar({
  inputType,
  analysisMode,
  platform,
  filename,
  dmpDataset,
  thresholds,
  onThresholdsChange,
  teAnalysis,
  teDiffAnalysis,
  teClassFilter,
  onTeClassFilter,
  onExport,
}: MethylationSidebarProps) {
  const rows = dmpDataset?.rows ?? [];

  const dmpStats = useMemo(() => {
    if (rows.length === 0) return null;
    return computeGenomicContext(rows, thresholds);
  }, [rows, thresholds]);

  // Compute lambda (genomic inflation)
  const lambda = useMemo(() => {
    if (rows.length === 0) return null;
    const pvals = rows.map((r) => r.p_value).filter((p) => p > 0 && p < 1).sort((a, b) => a - b);
    if (pvals.length === 0) return null;
    const median = pvals[Math.floor(pvals.length / 2)];
    // chi-squared with 1 df: qchisq(0.5, 1) ≈ 0.4549
    const chiMedian = -2 * Math.log(median);
    return Math.round((chiMedian / 0.4549) * 1000) / 1000;
  }, [rows]);

  // Chromosome distribution (top 5)
  const chrDist = useMemo(() => {
    if (!dmpStats?.chrCounts) return [];
    return Object.entries(dmpStats.chrCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [dmpStats]);

  const chrMax = chrDist.length > 0 ? chrDist[0][1] : 1;

  // TE class distribution
  const teClasses = useMemo(() => {
    if (inputType === 'betas' && teAnalysis) {
      return Object.entries(teAnalysis.summaryByClass)
        .sort((a, b) => b[1].nProbes - a[1].nProbes);
    }
    if (inputType === 'dmp' && teDiffAnalysis) {
      return Object.entries(teDiffAnalysis.summaryByClass)
        .sort((a, b) => b[1].nProbes - a[1].nProbes);
    }
    return [];
  }, [inputType, teAnalysis, teDiffAnalysis]);

  const CLASS_COLORS: Record<string, string> = {
    LINE: '#3b82f6',
    SINE: COLOR.accent.teal,
    LTR: COLOR.accent.rose,
    DNA: COLOR.accent.amber,
    SVA: COLOR.accent.violet,
    Other: COLOR.text.muted,
  };

  const hasData = inputType !== null;

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>

      {/* ── DATA FINGERPRINT ── */}
      <div style={SECTION_TITLE_FIRST}>DATA FINGERPRINT</div>
      {hasData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={STAT_ROW}>
            <span style={STAT_LABEL}>type</span>
            <span style={{
              ...STAT_VALUE,
              fontSize: 9,
              padding: '1px 5px',
              border: `1px solid ${inputType === 'dmp' ? COLOR.accent.rose : COLOR.accent.teal}40`,
              color: inputType === 'dmp' ? COLOR.accent.rose : COLOR.accent.teal,
            }}>
              {inputType === 'dmp' ? 'DMP' : 'BETA'}
            </span>
          </div>
          {platform && (
            <div style={STAT_ROW}>
              <span style={STAT_LABEL}>platform</span>
              <span style={STAT_VALUE}>{platform.toUpperCase().replace('_', ' ')}</span>
            </div>
          )}
          <div style={STAT_ROW}>
            <span style={STAT_LABEL}>probes</span>
            <span style={STAT_VALUE}>
              {inputType === 'dmp'
                ? rows.length.toLocaleString()
                : teAnalysis?.totalInputProbes.toLocaleString() ?? '—'}
            </span>
          </div>
          {inputType === 'dmp' && dmpStats && (
            <>
              <div style={STAT_ROW}>
                <span style={STAT_LABEL}>significant</span>
                <span style={{ ...STAT_VALUE, color: dmpStats.sig > 0 ? COLOR.accent.teal : COLOR.text.muted }}>
                  {dmpStats.sig.toLocaleString()}
                </span>
              </div>
              <div style={STAT_ROW}>
                <span style={STAT_LABEL}>hyper / hypo</span>
                <span style={STAT_VALUE}>
                  <span style={{ color: COLOR.accent.rose }}>{dmpStats.hyper}</span>
                  {' / '}
                  <span style={{ color: '#3b82f6' }}>{dmpStats.hypo}</span>
                </span>
              </div>
            </>
          )}
          {inputType === 'betas' && teAnalysis && (
            <>
              <div style={STAT_ROW}>
                <span style={STAT_LABEL}>TE probes</span>
                <span style={STAT_VALUE}>{teAnalysis.teProbesScored.toLocaleString()}</span>
              </div>
              <div style={STAT_ROW}>
                <span style={STAT_LABEL}>TE fraction</span>
                <span style={STAT_VALUE}>{(teAnalysis.teFraction * 100).toFixed(1)}%</span>
              </div>
            </>
          )}
          <div style={{ fontSize: 8, color: COLOR.text.faint, fontFamily: FONT_FAMILY, marginTop: 4, wordBreak: 'break-all' }}>
            {filename}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 9, color: COLOR.text.faint, fontFamily: FONT_FAMILY }}>
          No data loaded
        </div>
      )}

      {/* ── THRESHOLDS (DMP mode) ── */}
      {analysisMode === 'dmp' && inputType === 'dmp' && (
        <>
          <div style={SECTION_TITLE}>THRESHOLDS</div>

          <div style={SLIDER_LABEL}>
            <span>-log₁₀(p)</span>
            <span style={{ color: COLOR.text.secondary }}>{thresholds.pValueCutoff.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={thresholds.pValueCutoff}
            onChange={(e) => onThresholdsChange({ ...thresholds, pValueCutoff: Number(e.target.value) })}
            style={{ width: '100%', accentColor: COLOR.accent.teal, marginBottom: 8 }}
          />

          <div style={SLIDER_LABEL}>
            <span>|Δβ| cutoff</span>
            <span style={{ color: COLOR.text.secondary }}>{thresholds.deltaBetaCutoff.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.3}
            step={0.01}
            value={thresholds.deltaBetaCutoff}
            onChange={(e) => onThresholdsChange({ ...thresholds, deltaBetaCutoff: Number(e.target.value) })}
            style={{ width: '100%', accentColor: COLOR.accent.teal, marginBottom: 8 }}
          />

          <div style={SLIDER_LABEL}>
            <span>FDR cutoff</span>
            <span style={{ color: COLOR.text.secondary }}>{thresholds.adjPValueCutoff}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {[0.001, 0.01, 0.05, 0.1].map((v) => (
              <button
                key={v}
                onClick={() => onThresholdsChange({ ...thresholds, adjPValueCutoff: v })}
                style={thresholds.adjPValueCutoff === v ? PILL_ACTIVE : PILL}
              >
                {v}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── GENOMIC INFLATION (DMP) ── */}
      {inputType === 'dmp' && lambda !== null && (
        <>
          <div style={SECTION_TITLE}>INFLATION</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontSize: 16,
              fontWeight: WEIGHT.bold,
              fontFamily: FONT_FAMILY,
              color: lambda > 1.2 ? COLOR.accent.rose
                : lambda > 1.05 ? COLOR.accent.amber
                : COLOR.accent.teal,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {lambda.toFixed(3)}
            </span>
            <span style={{ fontSize: 9, color: COLOR.text.faint, fontFamily: FONT_FAMILY }}>
              λ<sub>gc</sub>
            </span>
          </div>
          <div style={{
            marginTop: 4,
            height: 3,
            borderRadius: 2,
            background: 'linear-gradient(to right, #4ECDC4, #F0A500, #F43F5E)',
            opacity: 0.5,
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: 7, color: COLOR.text.faint, fontFamily: FONT_FAMILY }}>1.0</span>
            <span style={{ fontSize: 7, color: COLOR.text.faint, fontFamily: FONT_FAMILY }}>1.5+</span>
          </div>
        </>
      )}

      {/* ── CHROMOSOME DISTRIBUTION (DMP) ── */}
      {inputType === 'dmp' && chrDist.length > 0 && (
        <>
          <div style={SECTION_TITLE}>CHR DISTRIBUTION</div>
          {chrDist.map(([chr, count]) => (
            <MiniBar
              key={chr}
              label={chr.replace('chr', '')}
              value={count}
              max={chrMax}
              color={COLOR.accent.teal}
            />
          ))}
        </>
      )}

      {/* ── TE CLASS FILTER (TE/ERV mode) ── */}
      {analysisMode === 'te_erv' && teClasses.length > 0 && (
        <>
          <div style={SECTION_TITLE}>TE CLASS FILTER</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <button
              onClick={() => onTeClassFilter(null)}
              style={teClassFilter === null ? PILL_ACTIVE : PILL}
            >
              All
            </button>
            {teClasses.map(([cls]) => (
              <button
                key={cls}
                onClick={() => onTeClassFilter(teClassFilter === cls ? null : cls)}
                style={{
                  ...(teClassFilter === cls ? PILL_ACTIVE : PILL),
                  ...(teClassFilter === cls ? {} : { borderColor: `${CLASS_COLORS[cls] ?? COLOR.border.default}60` }),
                }}
              >
                {cls}
              </button>
            ))}
          </div>

          {/* TE class distribution mini bars */}
          <div style={{ marginTop: 8 }}>
            {teClasses.map(([cls, data]) => (
              <MiniBar
                key={cls}
                label={cls}
                value={data.nProbes}
                max={teClasses[0]?.[1]?.nProbes ?? 1}
                color={CLASS_COLORS[cls] ?? COLOR.text.muted}
              />
            ))}
          </div>
        </>
      )}

      {/* ── RISK PROFILE (TE/ERV mode) ── */}
      {analysisMode === 'te_erv' && (
        <>
          {inputType === 'betas' && teAnalysis && (() => {
            const byRisk = { low: 0, moderate: 0, elevated: 0, high: 0 };
            for (const s of teAnalysis.familyScores) byRisk[s.riskLevel]++;
            const total = teAnalysis.familyScores.length;
            return (
              <>
                <div style={SECTION_TITLE}>REACTIVATION RISK</div>
                <MiniBar label="high" value={byRisk.high} max={total} color="#ef4444" />
                <MiniBar label="elev" value={byRisk.elevated} max={total} color="#f97316" />
                <MiniBar label="mod" value={byRisk.moderate} max={total} color="#f59e0b" />
                <MiniBar label="low" value={byRisk.low} max={total} color="#22c55e" />
              </>
            );
          })()}
          {inputType === 'dmp' && teDiffAnalysis && (() => {
            const dirs = { hypo: 0, hyper: 0, mixed: 0 };
            let withSig = 0;
            for (const s of teDiffAnalysis.familyScores) {
              dirs[s.direction]++;
              if (s.nSignificant > 0) withSig++;
            }
            return (
              <>
                <div style={SECTION_TITLE}>DIRECTION PROFILE</div>
                <MiniBar label="hypo" value={dirs.hypo} max={teDiffAnalysis.familyScores.length} color="#3b82f6" />
                <MiniBar label="hyper" value={dirs.hyper} max={teDiffAnalysis.familyScores.length} color={COLOR.accent.rose} />
                <MiniBar label="mixed" value={dirs.mixed} max={teDiffAnalysis.familyScores.length} color={COLOR.accent.amber} />
                <div style={{ ...STAT_ROW, marginTop: 6 }}>
                  <span style={STAT_LABEL}>families w/ sig</span>
                  <span style={STAT_VALUE}>{withSig}</span>
                </div>
              </>
            );
          })()}
        </>
      )}

      {/* ── RETRO-AGE (betas + TE mode) ── */}
      {analysisMode === 'te_erv' && inputType === 'betas' && teAnalysis?.retroAge && (
        <>
          <div style={SECTION_TITLE}>RETRO-AGE</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontSize: 18,
              fontWeight: WEIGHT.bold,
              fontFamily: FONT_FAMILY,
              color: COLOR.text.primary,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {teAnalysis.retroAge.age.toFixed(1)}
            </span>
            <span style={{ fontSize: 9, color: COLOR.text.faint, fontFamily: FONT_FAMILY }}>years</span>
          </div>
          {teAnalysis.retroAge.acceleration !== undefined && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
              <span style={{
                fontSize: 12,
                fontWeight: WEIGHT.medium,
                fontFamily: FONT_FAMILY,
                color: teAnalysis.retroAge.acceleration > 3 ? COLOR.accent.rose
                  : teAnalysis.retroAge.acceleration < -3 ? COLOR.accent.teal
                  : COLOR.text.secondary,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {teAnalysis.retroAge.acceleration > 0 ? '+' : ''}{teAnalysis.retroAge.acceleration.toFixed(1)}
              </span>
              <span style={{ fontSize: 8, color: COLOR.text.faint, fontFamily: FONT_FAMILY }}>accel</span>
            </div>
          )}
          <div style={{ ...STAT_ROW, marginTop: 4 }}>
            <span style={STAT_LABEL}>probe coverage</span>
            <span style={STAT_VALUE}>{(teAnalysis.retroAge.coverage * 100).toFixed(0)}%</span>
          </div>
        </>
      )}

      {/* ── EXPORT ── */}
      <div style={{ ...DIVIDER, marginTop: 16 }} />
      <div style={SECTION_TITLE}>EXPORT</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <button
          onClick={onExport}
          disabled={!hasData}
          style={{
            ...PILL,
            width: '100%',
            textAlign: 'center',
            opacity: hasData ? 1 : 0.3,
            cursor: hasData ? 'pointer' : 'default',
          }}
        >
          Download CSV
        </button>
      </div>

      {/* ── BUILD ── */}
      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <div style={{ ...DIVIDER, marginTop: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
          <div style={STAT_ROW}>
            <span style={{ ...STAT_LABEL, fontSize: 8 }}>build</span>
            <span style={{ ...STAT_VALUE, fontSize: 8 }}>hg38</span>
          </div>
          <div style={STAT_ROW}>
            <span style={{ ...STAT_LABEL, fontSize: 8 }}>api</span>
            <span style={{ ...STAT_VALUE, fontSize: 8 }}>polymerbio.org</span>
          </div>
          <div style={STAT_ROW}>
            <span style={{ ...STAT_LABEL, fontSize: 8 }}>engine</span>
            <span style={{ ...STAT_VALUE, fontSize: 8 }}>client-side</span>
          </div>
        </div>
      </div>
    </div>
  );
}
