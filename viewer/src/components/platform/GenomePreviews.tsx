import { ChromosomeSVG } from '@/components/atlas/ChromosomeSVG';
import { KARYOTYPE, KARYOTYPE_MAX_LEN, getIsochoreBins } from '@/config/karyotypeData';
import { COLOR, SPACE } from '@/config/theme';

const EXONS: Array<[number, number]> = [
  [10, 18], [38, 12], [66, 26], [110, 9], [136, 20], [176, 14], [214, 30], [262, 11], [288, 22],
];
const CPG: number[] = [
  3, 5, 4, 8, 14, 19, 15, 9, 5, 4, 6, 5, 3, 4, 7, 12, 17, 21, 16, 10,
  6, 4, 3, 5, 4, 6, 9, 13, 11, 7, 5, 3, 4, 6, 5, 4, 8, 12, 9, 5,
];
const PROBES: number[] = [
  14, 29, 36, 52, 61, 78, 84, 97, 118, 131, 147, 158, 173, 189, 196, 214,
  228, 241, 256, 268, 279, 291, 303, 312,
];
const ISOCHORE_RUN: Array<[number, keyof typeof COLOR.isochore]> = [
  [34, 'L2'], [22, 'H1'], [46, 'H2'], [30, 'H3'], [26, 'H2'], [40, 'L2'], [52, 'L1'], [70, 'H1'],
];

export function ViewerThumb() {
  let x = 0;
  return (
    <svg
      viewBox="0 0 320 96"
      preserveAspectRatio="none"
      role="img"
      aria-label="Stacked genome tracks: gene model, CpG density, array probes, and isochore classes."
      style={{ display: 'block', width: '100%', height: 96 }}
    >
      {/* coordinate ruler */}
      <line x1={0} y1={9} x2={320} y2={9} stroke={COLOR.border.strong} strokeWidth={1} />
      {[0, 64, 128, 192, 256, 319].map((tx) => (
        <line key={tx} x1={tx} y1={5} x2={tx} y2={9} stroke={COLOR.border.strong} strokeWidth={1} />
      ))}

      {/* gene model — intron spine with exon blocks */}
      <line x1={6} y1={28} x2={314} y2={28} stroke={COLOR.layer.gencode_v44} strokeWidth={1} />
      {EXONS.map(([ex, ew]) => (
        <rect key={ex} x={ex} y={22} width={ew} height={12} rx={1} fill={COLOR.layer.gencode_v44} />
      ))}

      {/* CpG density — column chart */}
      {CPG.map((v, i) => (
        <rect
          key={i}
          x={i * 8}
          y={62 - v}
          width={6}
          height={v}
          fill={COLOR.layer.cpg_sites}
          opacity={0.85}
        />
      ))}

      {/* EPIC probe ticks */}
      {PROBES.map((px) => (
        <rect key={px} x={px} y={68} width={1.5} height={8} fill={COLOR.layer.probe_epic_v2} />
      ))}

      {/* isochore classification band */}
      {ISOCHORE_RUN.map(([w, klass], i) => {
        const seg = <rect key={i} x={x} y={84} width={w} height={8} fill={COLOR.isochore[klass]} opacity={0.88} />;
        x += w;
        return seg;
      })}
    </svg>
  );
}

/* ── Thumbnail 2 — digital karyotype ─────────────────────────────────────
   The real Atlas component at miniature scale. Geometry and isochore
   coloring come from the same source the Atlas renders from, so the
   preview stays honest for free.
   ──────────────────────────────────────────────────────────────────────── */

const THUMB_CHRS = KARYOTYPE.slice(0, 16);
const THUMB_MAX_H = 92;

export function KaryotypeThumb() {
  return (
    <div
      role="img"
      aria-label="Miniature digital karyotype: chromosomes colored by isochore class."
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 3,
        height: 96,
        paddingBottom: SPACE[1],
      }}
    >
      {THUMB_CHRS.map((chr) => (
        <ChromosomeSVG
          key={chr.name}
          chrName={chr.name}
          width={9}
          height={Math.max(30, Math.round((chr.length / KARYOTYPE_MAX_LEN) * THUMB_MAX_H))}
          centromereStart={chr.centromereStart}
          centromereEnd={chr.centromereEnd}
          isochoreBins={getIsochoreBins(chr.name)}
        />
      ))}
    </div>
  );
}

