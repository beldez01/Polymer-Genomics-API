import type { GRanges } from '@/lib/api';
import { MetricPlot } from './MetricPlot';
export interface StabilityTrackProps { data?: GRanges; viewStart: number; viewEnd: number; canvasWidth: number; height?: number; }
export function StabilityTrack(props: StabilityTrackProps) {
  return <MetricPlot {...props} keys={['delta_g_37', 'contextual_delta_g_37']} label="DNA duplex formation ΔG° at 37 °C" units="kcal/mol per dinucleotide step" note="Nearest-neighbor sequence model; endpoint default 1,000 mM NaCl. More-negative values favor formation under the model; not a melting temperature or cellular risk score. Gaps are missing values." />;
}
