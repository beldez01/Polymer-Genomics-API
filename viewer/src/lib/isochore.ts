import { COLOR } from '@/config/theme';
import type { AggBin } from '@/lib/api';

export type IsochoreClass = 'L1' | 'L2' | 'H1' | 'H2' | 'H3';

export interface IsochoreBin {
  bin_start: number;
  bin_end: number;
  isoClass: IsochoreClass;
  color: string;
}

// Bernardi thresholds (GC fraction) — matches backend isochores.py
const THRESHOLDS: { max: number; cls: IsochoreClass }[] = [
  { max: 0.37, cls: 'L1' },
  { max: 0.41, cls: 'L2' },
  { max: 0.46, cls: 'H1' },
  { max: 0.53, cls: 'H2' },
];

export function classifyGC(gcFraction: number): IsochoreClass {
  for (const t of THRESHOLDS) {
    if (gcFraction < t.max) return t.cls;
  }
  return 'H3';
}

export function aggBinsToIsochores(bins: AggBin[]): IsochoreBin[] {
  return bins
    .filter((b): b is AggBin & { avg_gc: number } => b.avg_gc != null)
    .map(b => ({
      bin_start: b.bin_start,
      bin_end: b.bin_end,
      isoClass: classifyGC(b.avg_gc),
      color: COLOR.isochore[classifyGC(b.avg_gc)],
    }));
}
