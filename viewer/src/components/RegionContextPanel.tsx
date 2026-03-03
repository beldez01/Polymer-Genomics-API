'use client';

import Link from 'next/link';
import type { RegionContext } from '@/hooks/useRegionContext';
import { useViewport } from '@/stores/viewport';
import { COLORS } from '@/config/colors';

const FONT = "'JetBrains Mono', monospace";

const styles = {
  sectionHeader: {
    color: COLORS.accent.teal,
    fontSize: 11,
    fontFamily: FONT,
    fontWeight: 500 as const,
    marginBottom: 4,
    letterSpacing: '0.05em',
  },
  value: {
    color: '#CCC',
    fontSize: 11,
    fontFamily: FONT,
    lineHeight: 1.6,
  },
  label: {
    color: '#999',
    fontSize: 10,
    fontFamily: FONT,
  },
  muted: {
    color: '#777',
    fontSize: 10,
    fontFamily: FONT,
  },
};

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        fontSize: 10,
        fontFamily: FONT,
        fontWeight: 500,
        color: '#000',
        backgroundColor: color,
        borderRadius: 3,
        marginRight: 6,
      }}
    >
      {text}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid #1a1a1a' }}>
      <div style={styles.sectionHeader}>{title}</div>
      {children}
    </div>
  );
}

function formatPosition(pos: number): string {
  if (pos >= 1_000_000) return `${(pos / 1_000_000).toFixed(3)} Mb`;
  if (pos >= 1_000) return `${(pos / 1_000).toFixed(1)} kb`;
  return `${pos}`;
}

function formatDistance(d: number): string {
  if (d >= 1_000_000) return `${(d / 1_000_000).toFixed(1)} Mb`;
  if (d >= 1_000) return `${(d / 1_000).toFixed(1)} kb`;
  return `${d} bp`;
}

function directionArrow(position: number, center: number): string {
  return position < center ? '\u2190' : '\u2192';
}

export interface RegionContextPanelProps {
  context: RegionContext;
}

export function RegionContextPanel({ context }: RegionContextPanelProps) {
  const { build } = useViewport();
  const isochoreColor = context.isochore.class
    ? (COLORS.isochore as Record<string, string>)[context.isochore.class] ?? '#333'
    : '#333';

  const cpgColor = context.cpg.context
    ? (COLORS.cpgContext as Record<string, string>)[context.cpg.context.toLowerCase()] ?? COLORS.cpgContext.open_sea
    : COLORS.cpgContext.open_sea;

  const strandChar = context.gene.strand === '+' ? '(+)' : context.gene.strand === '-' ? '(-)' : '';

  return (
    <div
      className="h-full overflow-y-auto flex-shrink-0 flex flex-col"
      style={{
        width: 160,
        backgroundColor: '#0A0A0A',
        borderLeft: '1px solid #1a1a1a',
      }}
    >
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #1a1a1a', backgroundColor: '#0D0D0D' }}>
        <span style={{ color: COLORS.accent.teal, fontSize: 11, fontFamily: FONT, fontWeight: 500 }}>
          REGION CONTEXT
        </span>
      </div>

      {/* LOCATION */}
      <Section title="LOCATION">
        <div style={styles.value}>{formatPosition(context.center)}</div>
        <div style={styles.muted}>{formatDistance(context.viewportWidth)} viewport</div>
      </Section>

      {/* ISOCHORE */}
      <Section title="ISOCHORE">
        {context.isochore.class ? (
          <>
            <Badge text={context.isochore.class} color={isochoreColor} />
            {context.isochore.gcPercent != null && (
              <span style={styles.value}>{context.isochore.gcPercent.toFixed(1)}% GC</span>
            )}
          </>
        ) : (
          <div style={styles.muted}>No isochore data</div>
        )}
      </Section>

      {/* CpG */}
      <Section title="CpG">
        {context.cpg.context ? (
          <>
            <Badge text={context.cpg.context} color={cpgColor} />
            <div style={styles.value}>
              {context.cpg.density.toFixed(1)} sites/kb
              <span style={styles.muted}> ({context.cpg.count} in view)</span>
            </div>
          </>
        ) : (
          <div style={styles.muted}>
            {context.cpg.count > 0
              ? `${context.cpg.density.toFixed(1)} sites/kb (${context.cpg.count} in view)`
              : 'No CpG data'}
          </div>
        )}
      </Section>

      {/* GENE */}
      <Section title="GENE">
        {context.gene.location === 'intergenic' ? (
          <>
            <div style={styles.value}>Intergenic</div>
            <div style={{ ...styles.muted, marginTop: 2 }}>
              {context.flankingGenes.left && (
                <span>
                  {'\u2190'} {context.flankingGenes.left.symbol} ({formatDistance(context.flankingGenes.left.distance)})
                </span>
              )}
              {context.flankingGenes.left && context.flankingGenes.right && (
                <span style={{ margin: '0 6px', color: '#555' }}>|</span>
              )}
              {context.flankingGenes.right && (
                <span>
                  {context.flankingGenes.right.symbol} ({formatDistance(context.flankingGenes.right.distance)}) {'\u2192'}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={styles.value}>
              {context.gene.geneSymbol && (
                <Link
                  href={`/gene/${build}/${context.gene.geneSymbol}`}
                  style={{ color: COLORS.accent.teal, fontWeight: 500, textDecoration: 'none' }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
                >
                  {context.gene.geneSymbol}
                </Link>
              )}{' '}
              <span style={styles.muted}>{strandChar}</span>
            </div>
            <div style={styles.value}>{context.gene.featureLabel ?? context.gene.location}</div>
            {context.gene.transcriptId && (
              <div style={styles.muted}>{context.gene.transcriptId}</div>
            )}
          </>
        )}
      </Section>

      {/* COST */}
      <Section title="COST">
        {context.cost ? (
          <>
            <div style={styles.value}>
              <span style={{ color: COLORS.accent.teal, fontWeight: 500 }}>{context.cost.geneSymbol}</span>
              {context.cost.proteinLength != null && (
                <span style={styles.muted}> ({context.cost.proteinLength} aa)</span>
              )}
            </div>
            {context.cost.ecpaB20 != null && (
              <div style={styles.value}>ECPA: {context.cost.ecpaB20.toFixed(1)} ATP/aa</div>
            )}
            {context.cost.cProtein != null && (
              <div style={styles.value}>C_prot: {(context.cost.cProtein / 1000).toFixed(1)}k ATP</div>
            )}
            {context.cost.nProtein != null && (
              <div style={styles.muted}>N: {context.cost.nProtein} S: {context.cost.sProtein ?? 0}</div>
            )}
            {context.cost.cai != null && (
              <div style={styles.value}>CAI: {context.cost.cai.toFixed(3)}</div>
            )}
            {context.cost.tai != null && (
              <div style={styles.value}>tAI: {context.cost.tai.toFixed(3)}</div>
            )}
            {context.cost.meanTpm != null && (
              <div style={styles.muted}>TPM: {context.cost.meanTpm.toFixed(1)}</div>
            )}
          </>
        ) : (
          <div style={styles.muted}>No cost data</div>
        )}
      </Section>

      {/* LANDMARKS */}
      <Section title="LANDMARKS">
        {context.nearestSplice ? (
          <div style={styles.value}>
            <span style={{ color: context.nearestSplice.type === 'donor' ? COLORS.accent.rose : '#22c55e' }}>
              {context.nearestSplice.type === 'donor' ? 'GT' : 'AG'}
            </span>{' '}
            {context.nearestSplice.type}{' '}
            {formatDistance(context.nearestSplice.distance)}{' '}
            {directionArrow(context.nearestSplice.position, context.center)}
          </div>
        ) : (
          <div style={styles.muted}>No splice sites in view</div>
        )}

        {context.nearestTSS ? (
          <div style={styles.value}>
            <span style={{ color: COLORS.accent.amber }}>TSS</span>{' '}
            {context.nearestTSS.symbol}{' '}
            {formatDistance(context.nearestTSS.distance)}{' '}
            {directionArrow(context.nearestTSS.position, context.center)}
          </div>
        ) : (
          <div style={styles.muted}>No TSS in view</div>
        )}

        {context.nearestAUG ? (
          <div style={styles.value}>
            <span style={{ color: COLORS.accent.violet }}>AUG</span>{' '}
            {context.nearestAUG.symbol}{' '}
            {formatDistance(context.nearestAUG.distance)}{' '}
            {directionArrow(context.nearestAUG.position, context.center)}
          </div>
        ) : (
          <div style={styles.muted}>No start codons in view</div>
        )}
      </Section>

      {/* GC CONTENT */}
      <Section title="GC CONTENT">
        {context.gc.percent != null ? (
          <>
            <div style={styles.value}>{context.gc.percent.toFixed(1)}%</div>
            <div style={styles.muted}>source: {context.gc.source.replace('_', ' ')}</div>
          </>
        ) : (
          <div style={styles.muted}>No GC data</div>
        )}
      </Section>
    </div>
  );
}
