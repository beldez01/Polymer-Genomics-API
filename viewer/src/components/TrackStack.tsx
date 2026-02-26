'use client';

import type { ViewportData } from '@/lib/genomeFetcher';
import { SequenceTrack } from './tracks/SequenceTrack';
import { GeneTrack } from './tracks/GeneTrack';
import { CpgTrack } from './tracks/CpgTrack';
import { ProbeTrack } from './tracks/ProbeTrack';
import { IsochoreTrack } from './tracks/IsochoreTrack';

export interface TrackStackProps {
  data: ViewportData | null;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  loading: boolean;
  error: string | null;
}

// ----- Track label component -----
function TrackLabel({ label }: { label: string }) {
  return (
    <div className="w-24 shrink-0 text-xs text-gray-400 font-medium pt-1 pr-2 text-right select-none">
      {label}
    </div>
  );
}

// ----- Track row wrapper -----
function TrackRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex border-b border-gray-800/50">
      <TrackLabel label={label} />
      <div className="flex-1 min-w-0">{children}</div>
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
  // Adjust canvas width to account for 96px label column
  const trackWidth = Math.max(100, canvasWidth - 96);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950 text-red-400 px-8">
        <div className="text-center">
          <p className="text-lg font-medium mb-1">Error loading data</p>
          <p className="text-sm text-red-500/80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full bg-gray-950 overflow-y-auto">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 text-gray-300">
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      )}

      {/* Tracks */}
      <div className="flex flex-col">
        {/* Sequence track: always shown when data is available */}
        {data?.sequence != null && (
          <TrackRow label="Sequence">
            <SequenceTrack
              sequence={data.sequence}
              viewStart={viewStart}
              viewEnd={viewEnd}
              canvasWidth={trackWidth}
              height={60}
            />
          </TrackRow>
        )}

        {/* Gene track */}
        {data?.layers?.gencode_v44 && (
          <TrackRow label="Genes">
            <GeneTrack
              data={data.layers.gencode_v44}
              viewStart={viewStart}
              viewEnd={viewEnd}
              canvasWidth={trackWidth}
            />
          </TrackRow>
        )}

        {/* CpG sites track */}
        {data?.layers?.cpg_sites && (
          <TrackRow label="CpG Sites">
            <CpgTrack
              data={data.layers.cpg_sites}
              viewStart={viewStart}
              viewEnd={viewEnd}
              canvasWidth={trackWidth}
              height={50}
            />
          </TrackRow>
        )}

        {/* Probe track */}
        {data?.layers?.probe_epic_v2 && (
          <TrackRow label="Probes">
            <ProbeTrack
              data={data.layers.probe_epic_v2}
              viewStart={viewStart}
              viewEnd={viewEnd}
              canvasWidth={trackWidth}
              height={40}
            />
          </TrackRow>
        )}

        {/* Isochore track */}
        {data?.layers?.isochores && (
          <TrackRow label="Isochores">
            <IsochoreTrack
              data={data.layers.isochores}
              viewStart={viewStart}
              viewEnd={viewEnd}
              canvasWidth={trackWidth}
              height={30}
            />
          </TrackRow>
        )}

        {/* Placeholder when no data at all */}
        {!data && !loading && (
          <div className="flex items-center justify-center py-16 text-gray-600">
            <p className="text-sm">Navigate to a genomic region to view tracks</p>
          </div>
        )}
      </div>
    </div>
  );
}
