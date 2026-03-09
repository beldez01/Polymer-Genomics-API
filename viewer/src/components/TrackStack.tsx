'use client';

import type { ViewportData } from '@/lib/genomeFetcher';
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
import { basePairWidth } from '@/lib/coordinates';
import { COLOR, TYPE, FONT_FAMILY } from '@/config/theme';

const TRACK_LABEL_WIDTH = 72;

export interface TrackStackProps {
  data: ViewportData | null;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  loading: boolean;
  error: string | null;
  showCodons?: boolean;
  showGC?: boolean;
  visibleCellTypes?: string[];
  enabledMotifs?: string[];
}

function TrackRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      borderBottom: `1px solid ${COLOR.border.subtle}`,
      marginTop: 4,
      display: 'flex',
      alignItems: 'stretch',
    }}>
      <div style={{
        width: TRACK_LABEL_WIDTH,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 8,
        paddingLeft: 4,
        borderRight: `1px solid ${COLOR.border.subtle}`,
        color: COLOR.text.muted,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textAlign: 'right',
        userSelect: 'none',
      }}>
        {label}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

export function TrackStack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  loading,
  error,
  showCodons,
  showGC = true,
  visibleCellTypes,
  enabledMotifs,
}: TrackStackProps) {
  const trackWidth = Math.max(100, canvasWidth - TRACK_LABEL_WIDTH);
  const bpW = basePairWidth(viewStart, viewEnd, trackWidth);

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

  return (
    <div className="relative h-full overflow-y-auto" style={{ backgroundColor: COLOR.bg.primary }}>

      <div className="flex flex-col">
        {data?.layers?.isochores && (
          <TrackRow label="Isochores">
            <IsochoreTrack data={data.layers.isochores} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={30} />
          </TrackRow>
        )}

        {data?.sequence != null && (
          <TrackRow label="Sequence">
            <SequenceTrack sequence={data.sequence} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={44} cpgData={data?.layers?.cpg_sites} enabledMotifs={enabledMotifs} />
          </TrackRow>
        )}

        {showCodons && bpW >= 1 && (
          <TrackRow label="Frames">
            <CodonFrameTrack viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} sequence={data?.sequence ?? null} />
          </TrackRow>
        )}

        {data?.layers?.gencode_v44 && (
          <TrackRow label="Genes">
            <GeneTrack data={data.layers.gencode_v44} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} showCodons={showCodons} />
          </TrackRow>
        )}

        {data?.layers?.gene_costs_v1 && (
          <TrackRow label="Cost">
            <CostTrack data={data.layers.gene_costs_v1} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={36} />
          </TrackRow>
        )}

        {/* CpG Sites rendered as overlay on Sequence track — no separate row */}

        {(() => {
          const probeKeys = ['probe_epic_v2', 'probe_epic_v1', 'probe_450k'] as const;
          const datasets = probeKeys
            .filter((k) => data?.layers?.[k])
            .map((k) => ({ key: k, data: data!.layers![k]! }));
          if (datasets.length === 0) return null;
          return (
            <TrackRow label="Probes">
              <ProbeTrack datasets={datasets} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={40} />
            </TrackRow>
          );
        })()}

        {data?.layers?.methylation_atlas && (
          <TrackRow label="Meth Ref">
            <MethylationReferenceTrack data={data.layers.methylation_atlas} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={80} visibleCellTypes={visibleCellTypes} />
          </TrackRow>
        )}

        {data?.layers?.histone_peaks_encode_v1 && (
          <TrackRow label="Histones">
            <HistoneTrack data={data.layers.histone_peaks_encode_v1} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={60} />
          </TrackRow>
        )}

        {data?.layers?.gwas_catalog_ebi_v1 && (
          <TrackRow label="GWAS">
            <GwasTrack data={data.layers.gwas_catalog_ebi_v1} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={80} />
          </TrackRow>
        )}

        {showGC && (
          <TrackRow label="GC%">
            <GCTrack data={data} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={40} />
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
