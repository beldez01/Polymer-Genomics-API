'use client';

import { type ChromosomeInfo } from '@/config/chromosomes';
import { getCentromereType } from '@/config/denverGroups';
import { CHROMOSOME_FACTS } from '@/config/chromosomeFacts';
import { CHROMOSOME_FEATURES, type FeatureEntry } from '@/config/chromosomeFeatures';
import { COLOR, TYPE, FONT_FAMILY, FONT_FAMILY_MONO, WEIGHT, SPACE } from '@/config/theme';

interface ChromosomeInfoPanelProps {
  chr: ChromosomeInfo;
  geneCount?: number | null;
  cpgIslandCount?: number | null;
  probeCount?: number | null;
}

function fmtMb(bp: number): string { return (bp / 1_000_000).toFixed(1) + ' Mb'; }
function fmtKb(bp: number): string { return (bp / 1_000).toFixed(1) + ' kb'; }

function SectionHeader({ title, count }: { title: string; count?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: SPACE[2],
      color: COLOR.text.tertiary,
      fontSize: TYPE.xs.fontSize,
      fontFamily: FONT_FAMILY_MONO,
      fontWeight: WEIGHT.medium,
      letterSpacing: '0.16em',
      textTransform: 'uppercase' as const,
      marginBottom: SPACE[2],
      paddingBottom: SPACE[1] + 2,
      borderBottom: `1px solid ${COLOR.border.strong}`,
    }}>
      <span>{title}</span>
      {count && (
        <span className="tabular" style={{
          color: COLOR.text.faint,
          letterSpacing: '0.04em',
          textTransform: 'none' as const,
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: SPACE[3],
      padding: `${SPACE[1] + 1}px 0`,
      borderBottom: `1px solid ${COLOR.border.subtle}`,
    }}>
      <span style={{
        color: COLOR.text.tertiary,
        fontSize: TYPE.sm.fontSize,
        fontFamily: FONT_FAMILY,
      }}>
        {label}
      </span>
      <span className="tabular" style={{
        color: accent ? COLOR.primary.base : COLOR.text.primary,
        fontSize: TYPE.sm.fontSize,
        fontFamily: FONT_FAMILY_MONO,
        fontWeight: WEIGHT.semibold,
        textAlign: 'right' as const,
        letterSpacing: '0.01em',
      }}>
        {value}
      </span>
    </div>
  );
}

function ShortEntry({ entry }: { entry: FeatureEntry }) {
  return (
    <div style={{ padding: `${SPACE[1] + 2}px 0`, lineHeight: 1.55 }}>
      {entry.term && (
        <span style={{
          color: COLOR.text.primary,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.semibold,
        }}>
          {entry.term}
          <span style={{ color: COLOR.text.faint, fontWeight: WEIGHT.normal }}> — </span>
        </span>
      )}
      <span style={{
        color: COLOR.text.secondary,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
      }}>
        {entry.detail.length > 220 ? entry.detail.slice(0, 217) + '…' : entry.detail}
      </span>
    </div>
  );
}

/**
 * Static reference counts per chromosome (GENCODE v44 / UCSC CGI / EPIC v2).
 * Used as the source of truth on the static atlas page since we don't fetch
 * live aggregation data here.
 */
const REFERENCE_COUNTS: Record<string, { genes: number; cpgIslands: number; probes: number }> = {
  chr1:  { genes: 2058, cpgIslands: 28846, probes: 97108 },
  chr2:  { genes: 1309, cpgIslands: 20782, probes: 73979 },
  chr3:  { genes: 1078, cpgIslands: 15570, probes: 56811 },
  chr4:  { genes:  757, cpgIslands: 12068, probes: 46063 },
  chr5:  { genes:  923, cpgIslands: 14507, probes: 51741 },
  chr6:  { genes: 1057, cpgIslands: 16338, probes: 55940 },
  chr7:  { genes:  989, cpgIslands: 15433, probes: 52800 },
  chr8:  { genes:  683, cpgIslands: 11439, probes: 43413 },
  chr9:  { genes:  786, cpgIslands: 12098, probes: 38448 },
  chr10: { genes:  733, cpgIslands: 12462, probes: 43266 },
  chr11: { genes: 1298, cpgIslands: 14556, probes: 49497 },
  chr12: { genes: 1034, cpgIslands: 14008, probes: 47668 },
  chr13: { genes:  327, cpgIslands:  7573, probes: 28249 },
  chr14: { genes:  830, cpgIslands: 10275, probes: 32990 },
  chr15: { genes:  613, cpgIslands:  9626, probes: 32021 },
  chr16: { genes:  873, cpgIslands: 12890, probes: 37095 },
  chr17: { genes: 1197, cpgIslands: 15438, probes: 43584 },
  chr18: { genes:  270, cpgIslands:  5729, probes: 20736 },
  chr19: { genes: 1472, cpgIslands: 15168, probes: 36519 },
  chr20: { genes:  544, cpgIslands:  7739, probes: 24227 },
  chr21: { genes:  234, cpgIslands:  3098, probes: 10764 },
  chr22: { genes:  488, cpgIslands:  6229, probes: 18221 },
  chrX:  { genes:  842, cpgIslands: 12662, probes: 38109 },
  chrY:  { genes:   71, cpgIslands:   491, probes:  1002 },
};

function findProperty(chrName: string, termMatch: RegExp): string | null {
  const features = CHROMOSOME_FEATURES[chrName];
  if (!features) return null;
  const entry = features.physicalProperties.find((p) => termMatch.test(p.term));
  if (!entry) return null;
  const gcMatch = entry.detail.match(/~?(\d+\.?\d*\s*%)/);
  if (gcMatch) return gcMatch[1];
  return entry.detail.split('.')[0];
}

export function ChromosomeInfoPanel({
  chr,
  geneCount,
  cpgIslandCount,
  probeCount,
}: ChromosomeInfoPanelProps) {
  const facts = CHROMOSOME_FACTS[chr.name];
  const features = CHROMOSOME_FEATURES[chr.name];
  const cenType = getCentromereType(chr.centromereStart, chr.centromereEnd, chr.length);
  const pArmLen = chr.centromereStart;
  const qArmLen = chr.length - chr.centromereEnd;
  const isCircular = chr.name === 'chrM';

  const ref = REFERENCE_COUNTS[chr.name];
  const effectiveGenes = geneCount ?? ref?.genes ?? null;
  const effectiveCpg = cpgIslandCount ?? ref?.cpgIslands ?? null;
  const effectiveProbes = probeCount ?? ref?.probes ?? null;
  const geneDensity = effectiveGenes !== null
    ? (effectiveGenes / (chr.length / 1_000_000)).toFixed(1) + ' / Mb'
    : '—';
  const gcContent = findProperty(chr.name, /^GC/i);

  const archHighlights = features?.genomicArchitecture.slice(0, 3) ?? [];
  const evoHighlights = features?.evolutionaryHistory.slice(0, 2) ?? [];
  const deepCuts = features?.deepCuts.slice(0, 3) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[6], minWidth: 240 }}>
      {/* Tagline */}
      {features && (
        <div style={{
          borderLeft: `3px solid ${COLOR.primary.base}`,
          paddingLeft: SPACE[3],
        }}>
          <p style={{
            color: COLOR.text.secondary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            lineHeight: 1.55,
            margin: 0,
            fontStyle: 'italic',
          }}>
            {features.tagline}
          </p>
        </div>
      )}

      {/* Physical Properties */}
      <div>
        <SectionHeader title="Physical Properties" />
        <StatRow label="Length" value={isCircular ? fmtKb(chr.length) : fmtMb(chr.length)} />
        {!isCircular ? (
          <>
            <StatRow label="Centromere" value={cenType} />
            <StatRow label="p-arm" value={fmtMb(pArmLen)} />
            <StatRow label="q-arm" value={fmtMb(qArmLen)} />
          </>
        ) : (
          <StatRow label="Topology" value="circular" />
        )}
        {gcContent && <StatRow label="GC content" value={gcContent} />}
      </div>

      {/* Genomic Features */}
      <div>
        <SectionHeader title="Genomic Features" />
        <StatRow
          label="Protein-coding genes"
          value={effectiveGenes !== null ? effectiveGenes.toLocaleString() : '—'}
          accent
        />
        <StatRow label="Gene density" value={geneDensity} />
        <StatRow
          label="CpG islands"
          value={effectiveCpg !== null ? effectiveCpg.toLocaleString() : '—'}
        />
        <StatRow
          label="EPIC v2 probes"
          value={effectiveProbes !== null ? effectiveProbes.toLocaleString() : '—'}
        />
      </div>

      {/* Notable */}
      {facts && (facts.largestGene || facts.diseases.length > 0 || facts.facts.length > 0) && (
        <div>
          <SectionHeader title="Notable" />
          {facts.largestGene && <StatRow label="Largest gene" value={facts.largestGene} />}
          {facts.diseases.length > 0 && (
            <div style={{ marginTop: SPACE[2] }}>
              <span style={{
                color: COLOR.text.tertiary,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY_MONO,
                fontWeight: WEIGHT.medium,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: SPACE[1],
              }}>
                Disease associations
              </span>
              {facts.diseases.map((d) => (
                <div key={d} style={{
                  color: COLOR.text.secondary,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                  padding: `2px 0 2px ${SPACE[3]}px`,
                  borderLeft: `1px solid ${COLOR.border.default}`,
                  marginLeft: 1,
                }}>
                  {d}
                </div>
              ))}
            </div>
          )}
          {facts.facts.length > 0 && (
            <div style={{ marginTop: SPACE[3], display: 'flex', flexDirection: 'column', gap: SPACE[1] }}>
              {facts.facts.map((fact, i) => (
                <div key={i} style={{
                  color: COLOR.text.tertiary,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                  lineHeight: 1.55,
                }}>
                  · {fact}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Genomic Architecture */}
      {archHighlights.length > 0 && (
        <div>
          <SectionHeader title="Genomic Architecture" />
          {archHighlights.map((entry, i) => <ShortEntry key={i} entry={entry} />)}
        </div>
      )}

      {/* Evolutionary History */}
      {evoHighlights.length > 0 && (
        <div>
          <SectionHeader title="Evolutionary History" />
          {evoHighlights.map((entry, i) => <ShortEntry key={i} entry={entry} />)}
        </div>
      )}

      {/* Deep Cuts */}
      {deepCuts.length > 0 && (
        <div>
          <SectionHeader title="Deep Cuts" />
          {deepCuts.map((entry, i) => <ShortEntry key={i} entry={entry} />)}
        </div>
      )}
    </div>
  );
}
