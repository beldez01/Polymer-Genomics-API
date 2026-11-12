'use client';

import { useId, useState } from 'react';
import { COLOR } from '@/config/theme';
import { COMPOSITION_EXAMPLE, classifyComposition, compositionWindows, mergeCompositionClasses, summarizeComposition } from '@/lib/libraryComposition';
import type { CompositionClass } from '@/lib/libraryComposition';

const LENGTH = COMPOSITION_EXAMPLE.length;
const BASELINE = compositionWindows(COMPOSITION_EXAMPLE, 100);
const WHOLE = summarizeComposition(COMPOSITION_EXAMPLE);
const format = (value: number | null) => value === null ? 'Unavailable' : `${value.toFixed(1)}%`;
const x = (position: number) => 48 + (position / LENGTH) * 530;
const y = (percent: number) => 24 + (100 - percent) * 1.5;

function classStyle(klass: CompositionClass | null) {
  return {
    background: klass ? COLOR.isochore[klass] : 'var(--bg-deep)',
    color: klass === 'L1' || klass === 'L2' || klass === 'H3' ? 'white' : 'var(--text-primary)',
  };
}

export function CompositionFigure({ showClasses = false }: { showClasses?: boolean }) {
  const id = useId();
  const [windowSize, setWindowSize] = useState(100);
  const windows = compositionWindows(COMPOSITION_EXAMPLE, windowSize);
  const runs = mergeCompositionClasses(windows);
  return (
    <figure className="library-figure library-composition-figure" aria-labelledby={`${id}-title`}>
      <div className="library-figure-kicker">Synthetic sequence / 1,200 bp</div>
      <h3 id={`${id}-title`}>{showClasses ? 'One landscape, different classifications' : 'The window changes what you see'}</h3>
      <div className="library-composition-controls">
        <label htmlFor={`${id}-window`}>Window size</label>
        <select id={`${id}-window`} value={windowSize} onChange={event => setWindowSize(Number(event.target.value))} aria-controls={`${id}-plot`}>
          {[100, 300, 600, 1200].map(size => <option key={size} value={size}>{`${size.toLocaleString('en-US')} bp`}</option>)}
        </select>
        <span>Step = window size · no overlap</span>
      </div>
      <p className="library-composition-summary" role="status">{windows.length} {windows.length === 1 ? 'window' : 'windows'} · whole-sequence GC {format(WHOLE.gcPercent)}</p>
      <svg id={`${id}-plot`} viewBox="0 0 600 224" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-desc`} className="library-composition-plot">
        <title id={`${id}-chart-title`}>{`GC content in ${windowSize}-base windows`}</title>
        <desc id={`${id}-chart-desc`}>Blue bars show mean GC content in each selected window. The dashed line retains the 100-base baseline. Exact values are available in the table below.</desc>
        {[0, 50, 100].map(percent => <g key={percent}><path d={`M48 ${y(percent)} H578`} stroke="var(--border-subtle)" /><text x="38" y={y(percent) + 6} textAnchor="end">{percent}%</text></g>)}
        {windows.map(window => <rect key={window.start} x={x(window.start - 1)} y={y(window.gcPercent ?? 0)} width={x(window.end) - x(window.start - 1)} height={y(0) - y(window.gcPercent ?? 0)} fill="var(--primary)" fillOpacity=".22" stroke="var(--primary)" />)}
        <polyline points={BASELINE.map(window => `${x((window.start - 1 + window.end) / 2)},${y(window.gcPercent ?? 0)}`).join(' ')} fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeDasharray="5 5" />
        {[0, 600, 1200].map(position => <text key={position} x={x(position)} y="208" textAnchor={position === 0 ? 'start' : position === 1200 ? 'end' : 'middle'}>{position.toLocaleString('en-US')} bp</text>)}
      </svg>
      <div className="library-composition-legend"><span>Blue bars: selected windows</span><span>Dashed line: 100 bp baseline</span></div>
      {showClasses && <div className="library-composition-classes">
        <p>Classify each window</p>
        <div className="library-class-strip" aria-label="Class labels for individual windows">{windows.map(window => {
          const klass = classifyComposition(window.gcPercent);
          return <span key={window.start} style={{ ...classStyle(klass), flexBasis: `${100 * window.total / LENGTH}%` }} title={`Bases ${window.start}–${window.end}: ${format(window.gcPercent)}, ${klass ?? 'unclassified'}`}>{klass ?? '—'}</span>;
        })}</div>
        <p>Merge neighboring windows with the same class</p>
        <div className="library-class-strip" aria-label="Merged class runs">{runs.map(run => <span key={run.start} style={{ ...classStyle(run.klass), flexBasis: `${100 * (run.end - run.start + 1) / LENGTH}%` }} title={`Bases ${run.start}–${run.end}: ${run.klass ?? 'unclassified'}`}>{run.klass ?? '—'}</span>)}</div>
        <p className="library-class-explanation">{runs.length} {runs.length === 1 ? 'run' : 'runs'} of matching labels. Merging labels is a display operation; it does not test domain homogeneity.</p>
      </div>}
      <details className="library-composition-values"><summary>View exact window values</summary>
        <div className="library-table-scroll" role="region" aria-label="Synthetic composition window values" tabIndex={0}>
          <table className="library-table"><caption>Synthetic sequence · 1-based, closed intervals · all bases callable</caption>
            <thead><tr><th scope="col">Interval (bp)</th><th scope="col">G + C / ACGT</th><th scope="col">GC content</th>{showClasses && <th scope="col">Class</th>}</tr></thead>
            <tbody>{windows.map(window => <tr key={window.start}><th scope="row">{window.start.toLocaleString('en-US')}–{window.end.toLocaleString('en-US')}</th><td>{window.gc} / {window.callable}</td><td>{format(window.gcPercent)}</td>{showClasses && <td>{classifyComposition(window.gcPercent) ?? 'Unclassified'}</td>}</tr>)}</tbody>
          </table>
        </div>
      </details>
      <figcaption>Original teaching example calculated from a constructed sequence with 600 G/C bases among 1,200 A/C/G/T bases. Increasing the window width changes local averages; the full-sequence GC remains 50%. {showClasses ? 'Class thresholds follow the Polymer ingestion convention described below. This short example illustrates classification, not a biological isochore.' : 'This is not a measured chromosome profile.'}</figcaption>
    </figure>
  );
}
