'use client';

import { useEffect, useState, useRef } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import type { DMPRow } from '@/lib/dmp/types';
import { fetchProbe, fetchCpgProfile } from '@/lib/api';
import type { ProbeResponse, CpgProfileResponse, CpgProfileSection } from '@/lib/api';

interface ProbeDetailProps {
  row: DMPRow | null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: SPACE[4] }}>
      <h3 style={{
        ...COMPONENT.sectionHeader,
        marginBottom: SPACE[2],
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function KVRow({ label, value, color }: { label: string; value: string | number | null | undefined; color?: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      padding: `${SPACE[1]}px 0`,
      borderBottom: `1px solid ${COLOR.border.subtle}`,
    }}>
      <span style={{
        color: COLOR.text.muted,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
      }}>
        {label}
      </span>
      <span style={{
        color: color || COLOR.text.secondary,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.medium,
        textAlign: 'right',
        maxWidth: '60%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </span>
    </div>
  );
}

function formatNumber(n: number): string {
  if (Math.abs(n) < 0.001 && n !== 0) return n.toExponential(3);
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(4);
}

function renderProfileSection(section: CpgProfileSection, title: string) {
  const skip = new Set(['evidence_class', 'scale', 'status', 'provenance', 'rationale']);
  const entries = Object.entries(section).filter(([k]) => !skip.has(k));
  if (entries.length === 0) return null;

  return (
    <Section title={title}>
      {section.rationale && (
        <div style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          fontStyle: 'italic',
          marginBottom: SPACE[2],
        }}>
          {section.rationale as string}
        </div>
      )}
      {entries.map(([key, val]) => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'object' && !Array.isArray(val)) {
          // Nested object: render each sub-key
          return Object.entries(val as Record<string, unknown>).map(([sk, sv]) => (
            <KVRow
              key={`${key}.${sk}`}
              label={`${key}.${sk}`}
              value={sv as string | number}
            />
          ));
        }
        if (Array.isArray(val)) {
          return <KVRow key={key} label={key} value={`[${val.length} items]`} />;
        }
        return <KVRow key={key} label={key} value={val as string | number} />;
      })}
    </Section>
  );
}

export function ProbeDetail({ row }: ProbeDetailProps) {
  const [probeData, setProbeData] = useState<ProbeResponse | null>(null);
  const [profileData, setProfileData] = useState<CpgProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!row) {
      setProbeData(null);
      setProfileData(null);
      setError(null);
      return;
    }

    // Cancel previous requests
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const probeId = row.probe_id;

    Promise.allSettled([
      fetchProbe('hg38', probeId),
      fetchCpgProfile('hg38', probeId),
    ]).then(([probeResult, profileResult]) => {
      if (controller.signal.aborted) return;

      if (probeResult.status === 'fulfilled') {
        setProbeData(probeResult.value);
      } else {
        setProbeData(null);
      }

      if (profileResult.status === 'fulfilled') {
        setProfileData(profileResult.value);
      } else {
        setProfileData(null);
      }

      // Only set error if both failed
      if (probeResult.status === 'rejected' && profileResult.status === 'rejected') {
        setError('Could not fetch probe data from API');
      }

      setLoading(false);
    });

    return () => {
      controller.abort();
    };
  }, [row]);

  if (!row) {
    return (
      <div style={{
        backgroundColor: COLOR.bg.elevated,
        border: `1px solid ${COLOR.border.subtle}`,
        padding: SPACE[6],
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
        }}>
          Select a probe to view details
        </span>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.subtle}`,
      padding: SPACE[4],
      height: '100%',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ marginBottom: SPACE[4] }}>
        <div style={{
          color: COLOR.text.primary,
          fontSize: TYPE.md.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.bold,
          marginBottom: SPACE[1],
          wordBreak: 'break-all',
        }}>
          {row.probe_id}
        </div>
        {row.gene_symbol && (
          <div style={{
            color: COLOR.accent.teal,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.medium,
          }}>
            {row.gene_symbol}
          </div>
        )}
      </div>

      {/* DMP Stats */}
      <Section title="DMP STATISTICS">
        <KVRow
          label="Delta Beta"
          value={row.delta_beta > 0 ? `+${row.delta_beta.toFixed(4)}` : row.delta_beta.toFixed(4)}
          color={row.delta_beta > 0 ? COLOR.accent.rose : COLOR.accent.teal}
        />
        <KVRow label="p-value" value={row.p_value.toExponential(4)} />
        <KVRow label="adj. p-value" value={row.adj_p_value.toExponential(4)} />
        <KVRow label="-log10(p)" value={row.neg_log10_p.toFixed(2)} />
        {row.chr && <KVRow label="Chromosome" value={row.chr} />}
        {row.pos && <KVRow label="Position" value={row.pos.toLocaleString()} />}
      </Section>

      {/* Loading/Error */}
      {loading && (
        <div style={{
          color: COLOR.text.muted,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          padding: `${SPACE[4]}px 0`,
        }}>
          Loading probe data...
        </div>
      )}

      {error && (
        <div style={{
          color: COLOR.accent.amber,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          padding: `${SPACE[2]}px ${SPACE[3]}px`,
          backgroundColor: 'rgba(240, 165, 0, 0.08)',
          border: `1px solid ${COLOR.accent.amber}40`,
          marginBottom: SPACE[3],
        }}>
          {error}
        </div>
      )}

      {/* Probe API Data */}
      {probeData && (
        <Section title="PROBE COORDINATES">
          <KVRow label="Chromosome" value={probeData.data.probe.seqname} />
          <KVRow label="Start" value={probeData.data.probe.start.toLocaleString()} />
          <KVRow label="End" value={probeData.data.probe.end.toLocaleString()} />
          <KVRow label="Gene" value={probeData.data.probe.gene_symbol || 'intergenic'} />
          <KVRow label="CpG Context" value={probeData.data.probe.cpg_context} />
          {probeData.data.crossmap.length > 0 && (
            <KVRow
              label="Crossmap"
              value={probeData.data.crossmap.map(c => `${c.dst_platform}:${c.dst_probe_id}`).join(', ')}
            />
          )}
        </Section>
      )}

      {/* CpG Profile Data */}
      {profileData && (
        <>
          {profileData.data.site_identity &&
            renderProfileSection(profileData.data.site_identity, 'SITE IDENTITY')}
          {profileData.data.gene_context &&
            renderProfileSection(profileData.data.gene_context, 'GENE CONTEXT')}
          {profileData.data.regulatory_context &&
            renderProfileSection(profileData.data.regulatory_context, 'REGULATORY CONTEXT')}
          {profileData.data.regional_sequence_biophysics &&
            renderProfileSection(profileData.data.regional_sequence_biophysics, 'SEQUENCE BIOPHYSICS')}
          {profileData.data.methylation_biophysics_model &&
            renderProfileSection(profileData.data.methylation_biophysics_model, 'METHYLATION BIOPHYSICS')}
        </>
      )}
    </div>
  );
}
