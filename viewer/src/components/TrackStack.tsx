'use client';
import { useLayoutEffect, useRef } from 'react';

import type { ViewportData } from '@/lib/genomeFetcher';
import type { GRanges, LayerResolved, BiophysicsComputeResponse } from '@/lib/api';
import { SequenceTrack } from './tracks/SequenceTrack';
import { GeneTrack } from './tracks/GeneTrack';
import { CodonFrameTrack } from './tracks/CodonFrameTrack';
import { CpgTrack } from './tracks/CpgTrack';
import { ProbeTrack } from './tracks/ProbeTrack';
import { IsochoreTrack } from './tracks/IsochoreTrack';
import { CostTrack } from './tracks/CostTrack';
import { GCTrack } from './tracks/GCTrack';
import { MethylationReferenceTrack } from './tracks/MethylationReferenceTrack';
import { HistoneTrack } from './tracks/HistoneTrack';
import { GwasTrack } from './tracks/GwasTrack';
import { RepeatTrack } from './tracks/RepeatTrack';
import { DNAShapeTrack } from './tracks/DNAShapeTrack';
import { StabilityTrack } from './tracks/StabilityTrack';
import { StructureTrack } from './tracks/StructureTrack';
import { MotifTrack } from './tracks/MotifTrack';
import { NonBDnaTrack } from './tracks/NonBDnaTrack';
import { HervTrack } from './tracks/HervTrack';
import { BreakpointTrack } from './tracks/BreakpointTrack';
import { FragilityTrack } from './tracks/FragilityTrack';
import { TadDomainTrack } from './tracks/TadDomainTrack';
import { HicCompartmentTrack } from './tracks/HicCompartmentTrack';
import { InsulationTrack } from './tracks/InsulationTrack';
import { EvidenceBadge } from './EvidenceBadge';
import { basePairWidth } from '@/lib/coordinates';
import { COLOR, TYPE, FONT_FAMILY } from '@/config/theme';

import { TRACK_LABEL_WIDTH } from '@/config/viewerLayout';

const SEPARATOR_COLOR = `${COLOR.border.subtle}cc`;

export interface TrackStackProps {
  data: ViewportData | null;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  loading: boolean;
  error: string | null;
  showCodons?: boolean;
  showGC?: boolean;
  showStability?: boolean;
  showStructure?: boolean;
  showMotifs?: boolean;
  biophysicsData?: BiophysicsComputeResponse;
  computeLoading?: boolean;
  computeError?: string | null;
  visibleCellTypes?: string[];
  enabledMotifs?: string[];
}

/** Thin category header spanning the full width */
function CategoryHeader({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      paddingTop: 6,
      paddingBottom: 2,
      borderBottom: `1px solid ${SEPARATOR_COLOR}`,
    }}>
      <div style={{
        width: TRACK_LABEL_WIDTH,
        flexShrink: 0,
        paddingLeft: 6,
        color: COLOR.text.faint,
        fontSize: 9,
        fontFamily: FONT_FAMILY,
        fontWeight: 600,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        userSelect: 'none',
      }}>
        {label}
      </div>
    </div>
  );
}

interface TrackRowProps {
  label: string;
  evidenceClass?: string | null;
  /** Optional sub-labels rendered stacked in the label column (e.g. H3K4me3, Gran, Mono) */
  subLabels?: { text: string; color?: string }[];
  children: React.ReactNode;
}

function TrackRow({ label, evidenceClass, subLabels, children }: TrackRowProps) {
  return (
    <div data-track-id={label} style={{
      borderBottom: `1px solid ${SEPARATOR_COLOR}`,
      display: 'flex',
      alignItems: 'stretch',
    }}>
      <div style={{
        width: TRACK_LABEL_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: subLabels ? 'column' : 'row',
        alignItems: subLabels ? 'flex-end' : 'center',
        justifyContent: subLabels ? 'space-evenly' : 'flex-end',
        paddingRight: 8,
        paddingLeft: 4,
        paddingTop: subLabels ? 2 : 0,
        paddingBottom: subLabels ? 2 : 0,
        gap: subLabels ? 0 : 4,
        borderRight: `1px solid ${SEPARATOR_COLOR}`,
        color: COLOR.text.muted,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textAlign: 'right',
        userSelect: 'none',
      }}>
        {subLabels ? (
          subLabels.map((sl) => (
            <span key={sl.text} style={{
              fontSize: 8,
              fontWeight: 500,
              color: sl.color ?? COLOR.text.muted,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}>
              {sl.text}
            </span>
          ))
        ) : (
          <>
            {label}
            <EvidenceBadge evidenceClass={evidenceClass} />
          </>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

// Sub-label definitions for multi-row tracks
const HISTONE_SUB_LABELS = [
  { text: 'H3K4me3',  color: COLOR.histone.H3K4me3 },
  { text: 'H3K27ac',  color: COLOR.histone.H3K27ac },
  { text: 'H3K4me1',  color: COLOR.histone.H3K4me1 },
  { text: 'H3K36me3', color: COLOR.histone.H3K36me3 },
  { text: 'H3K27me3', color: COLOR.histone.H3K27me3 },
  { text: 'H3K9me3',  color: COLOR.histone.H3K9me3 },
];

const METH_CELL_TYPES = [
  { key: 'Gran',  text: 'Gran',  color: '#f59e0b' },
  { key: 'Mono',  text: 'Mono',  color: '#fb923c' },
  { key: 'NK',    text: 'NK',    color: '#a78bfa' },
  { key: 'Bcell', text: 'B',     color: '#60a5fa' },
  { key: 'CD4T',  text: 'CD4T',  color: '#34d399' },
  { key: 'CD8T',  text: 'CD8T',  color: '#4ade80' },
];

export function TrackStack(props: TrackStackProps) {
  const shell = useRef<HTMLDivElement>(null);
  const stableHeight = useRef(0);
  useLayoutEffect(() => {
    if (!props.loading && shell.current) stableHeight.current = shell.current.scrollHeight;
  });
  return <div ref={shell} style={{ minHeight: props.loading ? stableHeight.current : undefined }}>
    <TrackStackContent {...props} />
  </div>;
}

function TrackStackContent({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  loading,
  error,
  showCodons,
  showGC = true,
  showStability = false,
  showStructure = false,
  showMotifs = false,
  biophysicsData,
  computeLoading,
  computeError,
  visibleCellTypes,
  enabledMotifs,
}: TrackStackProps) {
  const trackWidth = Math.max(100, canvasWidth - TRACK_LABEL_WIDTH);
  const bpW = basePairWidth(viewStart, viewEnd, trackWidth);

  // Build layer_key → evidence_class lookup
  const ecMap = new Map<string, string>();
  for (const lr of data?.layersResolved ?? []) {
    if (lr.evidence_class) ecMap.set(lr.layer_key, lr.evidence_class);
  }
  const ec = (key: string) => ecMap.get(key);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: COLOR.bg.primary }}>
        <div className="text-center">
          <p style={{ color: COLOR.accent.rose, fontSize: TYPE.md.fontSize, fontWeight: 500, marginBottom: 4 }}>
            Error loading data
          </p>
          <p style={{ color: `${COLOR.accent.rose}99`, fontSize: TYPE.base.fontSize }}>{error}</p>
        </div>
      </div>
    );
  }

  if (loading && !data) return <p role="status" style={{ padding: 20 }}>Loading this region…</p>;

  // Filter visible methylation cell type sub-labels
  const visibleMethLabels = visibleCellTypes
    ? METH_CELL_TYPES.filter((ct) => visibleCellTypes.includes(ct.key))
    : METH_CELL_TYPES;

  // Check which categories have visible tracks
  const hasAnnotation = !!(data?.layers?.isochores || data?.sequence != null || (showCodons && bpW >= 1) || data?.layers?.gencode_v44 || data?.layers?.gene_costs_v1);
  const hasProbes = !!(['probe_epic_v2', 'probe_epic_v1', 'probe_450k'].some((k) => data?.layers?.[k]));
  const hasEpigenetic = !!(data?.layers?.methylation_atlas || data?.layers?.histone_peaks_encode_v1);
  const hasVariation = !!(data?.layers?.gwas_catalog_ebi_v1);
  const hasStructure = !!(data?.layers?.repeatmasker_v1 || data?.layers?.herv_loci_v1 || data?.layers?.nonb_dna || data?.layers?.breakpoints || data?.layers?.fragility || data?.layers?.tad_domain || data?.layers?.hic_compartment || data?.layers?.insulation_score);
  const hasBiophysics = !!(data?.layers?.sequence_biophysics_l0 || showGC || showStability || showStructure || showMotifs);

  return (
    <div className="relative" style={{ backgroundColor: COLOR.bg.primary }}>

      <div className="flex flex-col">

        {/* ─── Annotation ─── */}
        {hasAnnotation && <CategoryHeader label="Annotation" />}

        {data?.layers?.isochores && (
          <TrackRow label="Isochores" evidenceClass={ec('isochores')}>
            <IsochoreTrack data={data.layers.isochores} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={30} />
          </TrackRow>
        )}

        {data?.sequence != null && (
          <TrackRow label="Sequence" evidenceClass={ec('genome_sequence')}>
            <SequenceTrack sequence={data.sequence} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={44} cpgData={data?.layers?.cpg_sites} enabledMotifs={enabledMotifs} />
          </TrackRow>
        )}

        {showCodons && bpW >= 1 && (
          <TrackRow label="Codons">
            <CodonFrameTrack viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} sequence={data?.sequence ?? null} features={data?.layers?.gencode_v44} />
          </TrackRow>
        )}

        {data?.layers?.gencode_v44 && (
          <TrackRow label="Genes" evidenceClass={ec('gencode_v44')}>
            <GeneTrack data={data.layers.gencode_v44} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} showCodons={showCodons} />
          </TrackRow>
        )}

        {data?.layers?.gene_costs_v1 && (
          <TrackRow label="Cost" evidenceClass={ec('gene_costs_v1')}>
            <CostTrack data={data.layers.gene_costs_v1} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={36} />
          </TrackRow>
        )}

        {/* ─── Probes ─── */}
        {hasProbes && <CategoryHeader label="Probes" />}

        {(() => {
          const probeKeys = ['probe_epic_v2', 'probe_epic_v1', 'probe_450k'] as const;
          const datasets = probeKeys
            .filter((k) => data?.layers?.[k])
            .map((k) => ({ key: k, data: data!.layers![k]! }));
          if (datasets.length === 0) return null;
          return (
            <TrackRow label="Probes" evidenceClass={ec('probe_epic_v2') ?? ec('probe_epic_v1') ?? ec('probe_450k')}>
              <ProbeTrack datasets={datasets} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={40} />
            </TrackRow>
          );
        })()}

        {/* ─── Epigenetic ─── */}
        {hasEpigenetic && <CategoryHeader label="Epigenetic" />}

        {data?.layers?.methylation_atlas && (
          <TrackRow label="Meth Ref" evidenceClass={ec('methylation_atlas')} subLabels={visibleMethLabels}>
            <MethylationReferenceTrack data={data.layers.methylation_atlas} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={80} visibleCellTypes={visibleCellTypes} hideLabels />
          </TrackRow>
        )}

        {data?.layers?.histone_peaks_encode_v1 && (
          <TrackRow label="Histones" evidenceClass={ec('histone_peaks_encode_v1')} subLabels={HISTONE_SUB_LABELS}>
            <HistoneTrack data={data.layers.histone_peaks_encode_v1} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={60} hideLabels />
          </TrackRow>
        )}

        {/* ─── Variation ─── */}
        {hasVariation && <CategoryHeader label="Variation" />}

        {data?.layers?.gwas_catalog_ebi_v1 && (
          <TrackRow label="GWAS" evidenceClass={ec('gwas_catalog_ebi_v1')}>
            <GwasTrack data={data.layers.gwas_catalog_ebi_v1} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={80} />
          </TrackRow>
        )}

        {/* ─── Structure ─── */}
        {hasStructure && <CategoryHeader label="Structure" />}

        {data?.layers?.hic_compartment && (
          <TrackRow label="A/B" evidenceClass={ec('hic_compartment')}>
            <HicCompartmentTrack data={data.layers.hic_compartment} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={40} />
          </TrackRow>
        )}

        {data?.layers?.tad_domain && (
          <TrackRow label="TADs" evidenceClass={ec('tad_domain')}>
            <TadDomainTrack data={data.layers.tad_domain} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={50} />
          </TrackRow>
        )}

        {data?.layers?.insulation_score && (
          <TrackRow label="Insulation" evidenceClass={ec('insulation_score')}>
            <InsulationTrack data={data.layers.insulation_score} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={40} />
          </TrackRow>
        )}

        {data?.layers?.repeatmasker_v1 && (
          <TrackRow label="Repeats" evidenceClass={ec('repeatmasker_v1')}>
            <RepeatTrack data={data.layers.repeatmasker_v1} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={70} />
          </TrackRow>
        )}

        {data?.layers?.herv_loci_v1 && (
          <TrackRow label="HERVs" evidenceClass={ec('herv_loci_v1')}>
            <HervTrack data={data.layers.herv_loci_v1} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={50} hideLabels />
          </TrackRow>
        )}

        {data?.layers?.nonb_dna && (
          <TrackRow label="Non-B DNA" evidenceClass={ec('nonb_dna')}>
            <NonBDnaTrack data={data.layers.nonb_dna} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={60} />
          </TrackRow>
        )}

        {data?.layers?.breakpoints && (
          <TrackRow label="Breakpoints" evidenceClass={ec('breakpoints')}>
            <BreakpointTrack data={data.layers.breakpoints} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={40} />
          </TrackRow>
        )}

        {data?.layers?.fragility && (
          <TrackRow label="Fragility" evidenceClass={ec('fragility')}>
            <FragilityTrack data={data.layers.fragility} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={40} />
          </TrackRow>
        )}

        {/* ─── Biophysics ─── */}
        {!!data?.unsupportedLayers?.length && <p role="status" style={{ padding: '8px 12px', fontSize: 12 }}>Not available in this assembly’s layer registry: {data.unsupportedLayers.join(', ')}. Your layer selection is retained in the link.</p>}
        {data?.sequenceWarning && <p role="status" style={{ padding: '8px 12px', fontSize: 12 }}>{data.sequenceWarning}</p>}
        {(hasBiophysics || data) && <div className="viewer-biophysics-header">
          <span className="viewer-biophysics-title">Biophysics</span>
          <details className="viewer-layer-provenance"><summary>Loaded layer provenance and availability</summary>
          {data?.layersResolved.length ? <ul>{data.layersResolved.map(layer => <li key={layer.layer_key}>{layer.layer_key} · {layer.version} · {layer.status}{layer.evidence_class ? ` · Evidence ${layer.evidence_class}` : ''}{layer.content_hash ? ` · SHA ${layer.content_hash}` : ''}</li>)}</ul> : <p>No annotation-layer provenance returned. Empty results do not establish that a layer is unsupported.</p>}
          <a href="/genomics/data-sources">Sources and licenses</a>
        </details>
        </div>}
        {(showStability || showStructure || showMotifs) && <div style={{ padding: '4px 12px', display: 'flex', gap: 10, alignItems: 'center', minWidth: 0, fontSize: 11, color: COLOR.text.secondary }}>
          <p className="viewer-track-copy" style={{ margin: 0, flex: 1 }} role="status">{computeLoading ? 'Computing sequence models for this interval…' : computeError ? `Sequence models unavailable: ${computeError}` : biophysicsData ? 'Computed sequence models · Model version not supplied by the endpoint.' : 'No computed values. These models require a reference sequence and an interval of at most 1 Mb.'}</p>
          <a style={{ whiteSpace: 'nowrap', flexShrink: 0 }} href="/genomics/docs/methodology">Methods</a>
        </div>}

        {data?.layers?.sequence_biophysics_l0 && (
          <TrackRow label="DNA Shape" evidenceClass={ec('sequence_biophysics_l0')}>
            <DNAShapeTrack data={data.layers.sequence_biophysics_l0} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={60} />
          </TrackRow>
        )}

        {showGC && (
          <TrackRow label="GC%" evidenceClass={ec('sequence_biophysics_l0')}>
            <GCTrack data={data} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={40} />
          </TrackRow>
        )}

        {showStability && (
          <TrackRow label="Stability" evidenceClass="H">
            <StabilityTrack
              data={biophysicsData ? {
                class: 'GRanges' as const,
                seqnames: biophysicsData.data.seqnames,
                n: biophysicsData.data.n_steps,
                ranges: { ...biophysicsData.data.ranges, width: biophysicsData.data.ranges.start.map((s, i) => biophysicsData.data.ranges.end[i] - s + 1) },
                strand: biophysicsData.data.strand,
                mcols: biophysicsData.data.mcols,
              } satisfies GRanges : undefined}
              viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={80}
            />
          </TrackRow>
        )}

        {showStructure && (
          <TrackRow label="Structure" evidenceClass="H">
            <StructureTrack
              data={biophysicsData ? {
                class: 'GRanges' as const,
                seqnames: biophysicsData.data.seqnames,
                n: biophysicsData.data.n_steps,
                ranges: { ...biophysicsData.data.ranges, width: biophysicsData.data.ranges.start.map((s, i) => biophysicsData.data.ranges.end[i] - s + 1) },
                strand: biophysicsData.data.strand,
                mcols: biophysicsData.data.mcols,
              } satisfies GRanges : undefined}
              viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={60}
            />
          </TrackRow>
        )}

        {showMotifs && biophysicsData?.data?.motifs && (
          <TrackRow label="Motifs" evidenceClass="D">
            <MotifTrack
              motifs={biophysicsData.data.motifs}
              regionStart={viewStart}
              viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={40}
            />
          </TrackRow>
        )}

        {!data && !loading && (
          <div className="flex items-center justify-center py-16">
            <p style={{ color: COLOR.text.faint, fontSize: TYPE.base.fontSize, fontFamily: FONT_FAMILY }}>
              Enter a region or gene symbol above
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
