'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { COLOR, FONT_FAMILY, TYPE, WEIGHT } from '@/config/theme';
import { fetchTEFamilyDetail } from '@/lib/api';
import { useTransposome } from '@/stores/transposome';
import { SILENCING_COLORS } from '@/lib/transposome-types';
import type { EvidenceLevel } from '@/lib/transposome-types';
import { SilencingBar } from './SilencingBar';
import { MaterialProfile } from './MaterialProfile';
import { MiniIdeogram } from './MiniIdeogram';

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 9,
  fontWeight: WEIGHT.medium,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: COLOR.text.faint,
  fontFamily: FONT_FAMILY,
  marginBottom: 8,
};

const SECTION: React.CSSProperties = {
  marginBottom: 14,
  paddingBottom: 14,
  borderBottom: `1px solid ${COLOR.border.subtle}`,
};

const SECTION_LAST: React.CSSProperties = {
  marginBottom: 14,
  paddingBottom: 0,
};

const STAT_ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '3px 0',
};

const STAT_LABEL: React.CSSProperties = {
  fontSize: 10,
  color: COLOR.text.muted,
  fontFamily: FONT_FAMILY,
};

const STAT_VALUE: React.CSSProperties = {
  fontSize: 10,
  color: COLOR.text.primary,
  fontWeight: WEIGHT.medium,
  fontFamily: FONT_FAMILY,
};

const EVIDENCE_COLORS: Record<EvidenceLevel, string> = {
  STRONG: COLOR.accent.rose,
  MODERATE: COLOR.accent.amber,
  PREDICTED: COLOR.accent.teal,
  UNKNOWN: COLOR.text.faint,
};

export function FamilyInspector() {
  const selectedFamilyId = useTransposome((s) => s.selectedFamilyId);
  const selectedDetail = useTransposome((s) => s.selectedDetail);
  const loadingDetail = useTransposome((s) => s.loadingDetail);
  const setSelectedDetail = useTransposome((s) => s.setSelectedDetail);
  const setLoadingDetail = useTransposome((s) => s.setLoadingDetail);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!selectedFamilyId) {
      setSelectedDetail(null);
      setDetailError(null);
      return;
    }

    setLoadingDetail(true);
    setDetailError(null);
    setSelectedDetail(null);
    fetchTEFamilyDetail(selectedFamilyId)
      .then((res) => {
        setSelectedDetail(res.data);
      })
      .catch((err: unknown) => {
        setDetailError(err instanceof Error ? err.message : 'Family detail unavailable.');
        setLoadingDetail(false);
      });
  }, [selectedFamilyId, reloadKey, setSelectedDetail, setLoadingDetail]);

  // Empty state
  if (!selectedFamilyId) {
    return (
      <div style={{ color: COLOR.text.muted, fontSize: TYPE.sm.fontSize, fontFamily: FONT_FAMILY, textAlign: 'center', paddingTop: 40 }}>
        Select a family in the landscape to inspect.
      </div>
    );
  }

  // Error state
  if (detailError && !loadingDetail) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 40, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <span style={{ color: COLOR.accent.rose, fontSize: TYPE.sm.fontSize, fontFamily: FONT_FAMILY, lineHeight: 1.5 }}>
          {detailError}
        </span>
        <button
          onClick={() => setReloadKey((v) => v + 1)}
          style={{
            backgroundColor: 'transparent',
            border: `1px solid ${COLOR.border.strong}`,
            color: COLOR.text.secondary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            padding: '4px 12px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading state
  if (loadingDetail || !selectedDetail) {
    return (
      <div style={{ color: COLOR.text.muted, fontSize: TYPE.sm.fontSize, fontFamily: FONT_FAMILY, textAlign: 'center', paddingTop: 40 }}>
        Loading family data...
      </div>
    );
  }

  const detail = selectedDetail;

  return (
    <div>
      <style>{`@keyframes inspectorPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      {/* Section A: Family Identity */}
      <div style={SECTION}>
        <div style={{ fontSize: 16, fontWeight: WEIGHT.bold, color: COLOR.text.primary, fontFamily: FONT_FAMILY, marginBottom: 2 }}>
          {detail.display_name}
        </div>
        <div style={{ fontSize: 10, color: COLOR.text.muted, fontFamily: FONT_FAMILY, letterSpacing: '0.04em', marginBottom: 6 }}>
          {detail.class} Retrotransposon &middot; {detail.family}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {detail.reactivation_score > 0.5 && (
            <span style={{
              display: 'inline-block', padding: '2px 6px', fontSize: 8, fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', fontFamily: FONT_FAMILY,
              background: 'rgba(244,63,94,0.1)', color: COLOR.accent.rose, border: `1px solid rgba(244,63,94,0.3)`,
            }}>
              REACTIVATION-PRONE
            </span>
          )}
          {detail.epic_v2_probes > 0 && (
            <span style={{
              display: 'inline-block', padding: '2px 6px', fontSize: 8, fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', fontFamily: FONT_FAMILY,
              background: 'rgba(78,205,196,0.1)', color: COLOR.accent.teal, border: `1px solid rgba(78,205,196,0.3)`,
            }}>
              PROBE-COVERED
            </span>
          )}
        </div>

        <div style={STAT_ROW}>
          <span style={STAT_LABEL}>Consensus length</span>
          <span style={STAT_VALUE}>{detail.consensus_length.toLocaleString()} bp</span>
        </div>
        <div style={STAT_ROW}>
          <span style={STAT_LABEL}>Copy count</span>
          <span style={STAT_VALUE}>{detail.copy_count.toLocaleString()}</span>
        </div>
        <div style={STAT_ROW}>
          <span style={STAT_LABEL}>Total bp</span>
          <span style={STAT_VALUE}>{(detail.total_bp / 1000).toFixed(0)} kb</span>
        </div>
        <div style={STAT_ROW}>
          <span style={STAT_LABEL}>Divergence</span>
          <span style={STAT_VALUE}>{detail.divergence_pct.toFixed(1)}%</span>
        </div>
        <div style={STAT_ROW}>
          <span style={STAT_LABEL}>Activity</span>
          <span style={STAT_VALUE}>{detail.is_active ? 'Active' : 'Inactive'}</span>
        </div>
      </div>

      {/* Section B: Silencing Hierarchy */}
      <div style={SECTION}>
        <div style={SECTION_TITLE}>Silencing Hierarchy</div>
        <SilencingBar breakdown={detail.silencing_breakdown} />
      </div>

      {/* Section C: Material-Channel Profile */}
      <div style={SECTION}>
        <div style={SECTION_TITLE}>Material-Channel Profile</div>
        <MaterialProfile family={detail} />
      </div>

      {/* Section D: Genomic Distribution */}
      <div style={SECTION}>
        <div style={SECTION_TITLE}>Genomic Distribution</div>
        <MiniIdeogram chrDensity={detail.chr_density} color={SILENCING_COLORS[detail.silencing_primary]} />
      </div>

      {/* Section E: Probe Observability */}
      <div style={SECTION}>
        <div style={SECTION_TITLE}>Probe Observability</div>
        <div style={STAT_ROW}>
          <span style={STAT_LABEL}>EPIC v2 probes</span>
          <span style={STAT_VALUE}>{detail.epic_v2_probes.toLocaleString()}</span>
        </div>
        <div style={STAT_ROW}>
          <span style={STAT_LABEL}>Coverage fraction</span>
          <span style={STAT_VALUE}>{(detail.probe_coverage_fraction * 100).toFixed(1)}%</span>
        </div>
        <div style={STAT_ROW}>
          <span style={STAT_LABEL}>RetroAge probes</span>
          <span style={STAT_VALUE}>{detail.retro_age_probes.toLocaleString()}</span>
        </div>
        {detail.top_probes.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {detail.top_probes.map((p) => (
              <div key={p.probe_id} style={{ fontSize: 9, color: COLOR.accent.teal, fontFamily: FONT_FAMILY, padding: '2px 0', cursor: 'pointer' }}>
                {p.probe_id} &middot; {p.gene ?? 'intergenic'} &middot; {p.position}
                {p.is_retro_age && ' *'}
              </div>
            ))}
            {detail.epic_v2_probes > detail.top_probes.length && (
              <div style={{ fontSize: 8, color: COLOR.text.faint, fontFamily: FONT_FAMILY, marginTop: 4 }}>
                +{detail.epic_v2_probes - detail.top_probes.length} more probes
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section F: Reactivation Profile */}
      <div style={SECTION}>
        <div style={SECTION_TITLE}>Reactivation Profile</div>
        {detail.reactivation_score > 0.5 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', marginTop: 4, marginBottom: 8,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: COLOR.accent.rose,
              boxShadow: `0 0 6px ${COLOR.accent.rose}`, animation: 'inspectorPulse 2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 9, color: COLOR.accent.rose, fontFamily: FONT_FAMILY }}>
              High reactivation potential{detail.viral_mimicry ? ` \u00b7 ${detail.viral_mimicry}` : ''}
            </span>
          </div>
        )}
        {detail.reactivation_detail.map((rd, i) => (
          <div key={i} style={STAT_ROW}>
            <span style={STAT_LABEL}>{rd.context}</span>
            <span style={{ fontSize: 10, color: EVIDENCE_COLORS[rd.evidence], fontWeight: WEIGHT.medium, fontFamily: FONT_FAMILY }}>
              {rd.evidence}
            </span>
          </div>
        ))}
      </div>

      {/* Section G: Representative Loci */}
      <div style={SECTION}>
        <div style={SECTION_TITLE}>Representative Loci</div>
        {detail.representative_loci.map((loc, i) => (
          <Link
            key={i}
            href={`/genomics/view/hg38/${loc.region}`}
            style={{
              display: 'flex', justifyContent: 'space-between', padding: '3px 0', cursor: 'pointer',
              fontSize: 9, color: COLOR.text.tertiary, fontFamily: FONT_FAMILY, textDecoration: 'none',
            }}
          >
            <span>{loc.label}</span>
            <span style={{ color: COLOR.text.muted }}>{loc.region}</span>
          </Link>
        ))}
        <div style={{ fontSize: 8, color: COLOR.text.faint, fontFamily: FONT_FAMILY, marginTop: 6 }}>
          Click to open in Viewer &rarr;
        </div>
      </div>

      {/* Section H: Key References */}
      {detail.references.length > 0 && (
        <div style={SECTION_LAST}>
          <div style={SECTION_TITLE}>Key References</div>
          {detail.references.map((ref, i) => (
            <div key={i} style={{ fontSize: 9, color: COLOR.text.muted, fontFamily: FONT_FAMILY, lineHeight: 1.6, marginBottom: 4 }}>
              {ref.citation} <em>{ref.journal}</em> &middot; {ref.summary}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
