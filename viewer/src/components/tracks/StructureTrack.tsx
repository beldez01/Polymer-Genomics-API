import type { GRanges } from '@/lib/api';
import { MetricPlot } from './MetricPlot';
export interface StructureTrackProps { data?: GRanges; viewStart: number; viewEnd: number; canvasWidth: number; height?: number; }
export function StructureTrack(props: StructureTrackProps) {
  return <>
    <MetricPlot {...props} keys={['curvature_curvature', 'curvature']} label="Wedge-model curvature" units="degrees per step" note="Roll/tilt trajectory model; 21-step centered window by endpoint default, shorter at edges. Independent visible-range axis." />
    <MetricPlot {...props} keys={['structural_deformability', 'deformability']} label="TRX deformability" units="model score" note="Dinucleotide lookup model, not a measured elastic modulus. Independent visible-range axis; missing values are gaps." />
  </>;
}
