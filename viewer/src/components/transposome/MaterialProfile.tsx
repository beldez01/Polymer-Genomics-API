'use client';

import { COLOR, FONT_FAMILY, WEIGHT } from '@/config/theme';
import type { TEFamily } from '@/lib/transposome-types';

interface MaterialProfileProps {
  family: TEFamily;
}

interface PropertyRow {
  key: keyof TEFamily;
  label: string;
  range: [number, number];
  color: string;
  invert?: boolean;
  decimals: number;
}

const PROPERTIES: PropertyRow[] = [
  { key: 'cpg_density', label: 'CpG density', range: [0, 1.5], color: COLOR.accent.teal, decimals: 2 },
  { key: 'gc_content', label: 'GC content', range: [0.3, 0.7], color: 'rgba(78,205,196,0.7)', decimals: 2 },
  { key: 'stacking_dg37', label: 'Stacking dG37', range: [-1.8, -1.0], color: COLOR.accent.amber, invert: true, decimals: 2 },
  { key: 'wrapping_energy', label: 'Wrapping E', range: [14, 22], color: 'rgba(240,165,0,0.7)', decimals: 1 },
  { key: 'ndr_score', label: 'NDR score', range: [0, 1], color: COLOR.accent.violet, decimals: 2 },
  { key: 'periodicity_power', label: 'Periodicity', range: [0, 1], color: 'rgba(139,92,246,0.7)', decimals: 2 },
];

function normalize(value: number, range: [number, number], invert?: boolean): number {
  const [min, max] = range;
  let norm = (value - min) / (max - min);
  norm = Math.max(0, Math.min(1, norm));
  return invert ? 1 - norm : norm;
}

export function MaterialProfile({ family }: MaterialProfileProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 40px', rowGap: 0 }}>
      {PROPERTIES.map((prop) => {
        const raw = family[prop.key] as number;
        const norm = normalize(raw, prop.range, prop.invert);
        return (
          <div key={prop.key} style={{ display: 'contents' }}>
            <div style={{ fontSize: 9, color: COLOR.text.muted, fontFamily: FONT_FAMILY, padding: '3px 0', alignSelf: 'center' }}>
              {prop.label}
            </div>
            <div style={{ padding: '3px 0', alignSelf: 'center' }}>
              <div style={{ height: 4, background: COLOR.bg.surface, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${norm * 100}%`, background: prop.color, borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            </div>
            <div style={{ fontSize: 9, color: COLOR.text.tertiary, fontFamily: FONT_FAMILY, textAlign: 'right', padding: '3px 0', alignSelf: 'center' }}>
              {raw.toFixed(prop.decimals)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
