import type { LibraryFigureKind } from '@/content/library';
import { CompositionFigure } from './CompositionFigure';
import { PhysicalFoundationFigure } from './PhysicalFoundationFigure';

/** Illustrations use synthetic examples; they are not measured genomic data. */
export function LibraryFigure({ kind }: { kind: LibraryFigureKind }) {
  if (kind === 'mechanics' || kind === 'evidence') {
    return <PhysicalFoundationFigure kind={kind} />;
  }
  if (kind === 'gc-windows' || kind === 'isochore-windows') {
    return <CompositionFigure showClasses={kind === 'isochore-windows'} />;
  }
  if (kind === 'chromatin') {
    return <figure className="library-figure library-chromatin-figure">
      <div className="library-figure-kicker">DNA replication / chromatin restoration</div>
      <div className="library-chromatin-stages">
        <div><span className="library-stage-number">01 / Before replication</span><ChromatinStage stage="parent" /><strong>Parental chromatin</strong><p>Histones are associated with the DNA before replication.</p></div>
        <div><span className="library-stage-number">02 / Replication &amp; assembly</span><ChromatinStage stage="assembly" /><strong>Recycling and deposition</strong><p>Parental histones are redistributed; new histones are incorporated.</p></div>
        <div><span className="library-stage-number">03 / After replication</span><ChromatinStage stage="restoration" /><strong>Restoration over time</strong><p>Modification patterns are restored with mark- and locus-specific kinetics.</p></div>
      </div>
      <div className="library-histone-key"><span><i data-histone="parental" aria-hidden="true" />Parental histones</span><span><i data-histone="new" aria-hidden="true" />New histones</span></div>
      <figcaption>Schematic of histone handling, not a measured trajectory or a model of exact histone ratios. The arrow in the final panel indicates time, not modification levels. Based on the CAF-1, MCM2, and parental-histone recycling studies cited below.</figcaption>
    </figure>;
  }
  if (kind === 'sequence') {
    return (
      <figure className="library-figure">
        <div className="library-figure-kicker">Composition / arrangement</div>
        <div className="library-sequences">
          {['AAAACCCCGGGGTTTT', 'ACGTACGTACGTACGT'].map(sequence => (
            <div key={sequence} className="library-sequence-row">
              <code aria-label={sequence}>{sequence.split('').map((base, index) => <span key={index} data-gc={base === 'G' || base === 'C' ? 'true' : undefined}>{base}</span>)}</code>
              <span>50% GC</span>
            </div>
          ))}
        </div>
        <figcaption>Two synthetic sequences. Identical base counts; different arrangements. Blue highlights G and C.</figcaption>
      </figure>
    );
  }
  if (kind === 'coordinates') {
    return (
      <figure className="library-figure">
        <div className="library-figure-kicker">One interval / two conventions</div>
        <dl className="library-coordinate-example">
          <div><dt>1-based, closed</dt><dd>101–200</dd></div>
          <div><dt>0-based, half-open</dt><dd>[100, 200)</dd></div>
        </dl>
        <figcaption>Both describe 100 bases on the same reference sequence. Illustration only; no genomic locus is implied.</figcaption>
      </figure>
    );
  }
  return (
    <figure className="library-figure library-scale-figure">
      <div className="library-figure-kicker">A connected view of the genome</div>
      <div className="library-scales">
        <div><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M39 8C20 8 25 28 33 43L38 51 30 78C25 98 49 99 50 79L50 59 50 79C51 99 75 98 70 78L62 51 67 43C75 28 80 8 61 8L50 35Z" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M31 22h16m7 0h16M33 33h13m9 0h12M35 68h13m5 0h13M32 81h15m6 0h15" stroke="currentColor" strokeWidth="3" /></svg><span>Chromosome</span></div>
        <div><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M5 35h90M5 65h90" stroke="currentColor" opacity=".3" /><path d="M8 35h15v30h14V35h10v30h17V35h12v30h16" fill="none" stroke="currentColor" strokeWidth="3" /></svg><span>Region</span></div>
        <div><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M5 50h90" stroke="currentColor" /><path d="M16 39h12v22H16zm28 0h9v22h-9zm26 0h15v22H70z" fill="currentColor" /></svg><span>Gene</span></div>
        <div><svg viewBox="0 0 100 100" aria-hidden="true"><text x="50" y="46" textAnchor="middle" fill="currentColor" fontFamily="monospace" fontSize="17">ACGT</text><text x="50" y="69" textAnchor="middle" fill="currentColor" fontFamily="monospace" fontSize="17">TGCA</text></svg><span>Sequence</span></div>
      </div>
      <figcaption>Different scales, connected questions. Schematic illustrations; not to scale.</figcaption>
    </figure>
  );
}

function ChromatinStage({ stage }: { stage: 'parent' | 'assembly' | 'restoration' }) {
  const rows = stage === 'parent' ? [50] : [30, 70];
  return <svg viewBox="0 0 180 105" aria-hidden="true" className="library-chromatin-stage">
    {rows.map((y, row) => <g key={y}>
      <path d={`M8 ${y} H172`} stroke="currentColor" strokeWidth="2" opacity=".5" />
      {[36, 88, 140].map((x, index) => {
        const parental = stage === 'parent' || (index + row) % 2 === 0;
        return <circle key={x} cx={x} cy={y} r="11" fill={parental ? 'currentColor' : 'var(--bg-elevated)'} stroke="currentColor" strokeWidth="2" />;
      })}
    </g>)}
    {stage === 'assembly' && <path d="M90 3v10m-5-5 5 5 5-5" stroke="currentColor" fill="none" strokeWidth="2" />}
    {stage === 'restoration' && <path d="M12 97h155m-6-4 6 4-6 4" stroke="currentColor" fill="none" strokeWidth="2" />}
  </svg>;
}
