'use client';

import type { ViewportData } from '@/lib/genomeFetcher';
import { SequenceTrack } from './tracks/SequenceTrack';
import { GeneTrack } from './tracks/GeneTrack';
import { CpgTrack } from './tracks/CpgTrack';
import { ProbeTrack } from './tracks/ProbeTrack';
import { IsochoreTrack } from './tracks/IsochoreTrack';
import { GCTrack } from './tracks/GCTrack';

export interface TrackStackProps {
  data: ViewportData | null;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  loading: boolean;
  error: string | null;
}

function TrackRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid #1a1a1a', marginTop: 4, overflow: 'hidden' }}>
      {children}
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
}: TrackStackProps) {
  const trackWidth = Math.max(100, canvasWidth);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: '#0A0A0A' }}>
        <div className="text-center">
          <p style={{ color: '#F43F5E', fontSize: 16, fontWeight: 500, marginBottom: 4 }}>Error loading data</p>
          <p style={{ color: 'rgba(244,63,94,0.6)', fontSize: 13 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-y-auto" style={{ backgroundColor: '#0A0A0A' }}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ backgroundColor: 'rgba(10,10,10,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="flex items-center gap-3" style={{ color: '#E0E0E0' }}>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span style={{ fontSize: 13 }}>Loading...</span>
          </div>
        </div>
      )}

      <div className="flex flex-col">
        {data?.sequence != null && (
          <TrackRow>
            <SequenceTrack sequence={data.sequence} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={60} />
          </TrackRow>
        )}

        <TrackRow>
          <GCTrack data={data} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={40} />
        </TrackRow>

        {data?.layers?.gencode_v44 && (
          <TrackRow>
            <GeneTrack data={data.layers.gencode_v44} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} />
          </TrackRow>
        )}

        {data?.layers?.cpg_sites && (
          <TrackRow>
            <CpgTrack data={data.layers.cpg_sites} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={50} />
          </TrackRow>
        )}

        {data?.layers?.probe_epic_v2 && (
          <TrackRow>
            <ProbeTrack data={data.layers.probe_epic_v2} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={40} />
          </TrackRow>
        )}

        {data?.layers?.isochores && (
          <TrackRow>
            <IsochoreTrack data={data.layers.isochores} viewStart={viewStart} viewEnd={viewEnd} canvasWidth={trackWidth} height={30} />
          </TrackRow>
        )}

        {!data && !loading && (
          <div className="flex items-center justify-center py-16">
            <p style={{ color: '#444444', fontSize: 13 }}>Navigate to a genomic region to view tracks</p>
          </div>
        )}
      </div>
    </div>
  );
}
