import type { GRanges } from '@/lib/api';
import { MetricPlot } from './MetricPlot';
export interface DNAShapeTrackProps { data?: GRanges; viewStart: number; viewEnd: number; canvasWidth: number; height?: number; }
export function DNAShapeTrack(props: DNAShapeTrackProps) {
  return <>{[
    { key: 'mgw_mean', label: 'Minor groove width', units: 'Å' },
    { key: 'prot_mean', label: 'Propeller twist', units: 'degrees' },
    { key: 'roll_mean', label: 'Roll', units: 'degrees' },
    { key: 'helt_mean', label: 'Helix twist', units: 'degrees' },
  ].map(metric => <MetricPlot {...props} key={metric.key} keys={[metric.key]} label={metric.label} units={metric.units} note="Precomputed sequence-model mean over each returned genomic range; independent visible-range axis. Source/version in loaded-layer provenance; not a direct structural measurement." />)}</>;
}
