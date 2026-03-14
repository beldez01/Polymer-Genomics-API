'use client';

import { ChromosomeInfo } from '@/config/chromosomes';
import { getCentromereType } from '@/config/denverGroups';
import { CHROMOSOME_FACTS } from '@/config/chromosomeFacts';
import { CHROMOSOME_FEATURES } from '@/config/chromosomeFeatures';
import { COLOR, TYPE, FONT_FAMILY, WEIGHT, SPACE } from '@/config/theme';

interface ChromosomeInfoPanelProps {
  chr: ChromosomeInfo;
  geneCount: number | null;
  cpgIslandCount: number | null;
  probeCount: number | null;
}

function fmtMb(bp: number): string {
  return (bp / 1_000_000).toFixed(1) + ' Mb';
}

function fmtKb(bp: number): string {
  return (bp / 1_000).toFixed(1) + ' kb';
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      color: COLOR.accent.teal,
      fontSize: TYPE.xs.fontSize,
      fontFamily: FONT_FAMILY,
      fontWeight: WEIGHT.medium,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      marginBottom: SPACE[2],
      paddingBottom: SPACE[1],
      borderBottom: `1px solid ${COLOR.border.subtle}`,
    }}>
      {title}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      padding: `${SPACE[1]}px 0`,
    }}>
      <span style={{
        color: COLOR.text.tertiary,
        fontSize: TYPE.sm.fontSize,
        fontFamily: FONT_FAMILY,
      }}>
        {label}
      </span>
      <span style={{
        color: color || COLOR.text.secondary,
        fontSize: TYPE.sm.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.medium,
        textAlign: 'right' as const,
        maxWidth: '60%',
      }}>
        {value}
      </span>
    </div>
  );
}

function InfoBlock({ text }: { text: string }) {
  return (
    <div style={{
      color: COLOR.text.tertiary,
      fontSize: TYPE.xs.fontSize,
      fontFamily: FONT_FAMILY,
      lineHeight: 1.55,
      padding: `${SPACE[1]}px 0`,
    }}>
      {text}
    </div>
  );
}

/**
 * Static reference counts per chromosome (GENCODE v44 / UCSC CGI / EPIC v2).
 * Used as fallback when aggregation API data hasn't loaded.
 */
const REFERENCE_COUNTS: Record<string, { genes: number; cpgIslands: number; probes: number }> = {
  chr1:  { genes: 2058, cpgIslands: 28846, probes: 97108 },
  chr2:  { genes: 1309, cpgIslands: 20782, probes: 73979 },
  chr3:  { genes: 1078, cpgIslands: 15570, probes: 56811 },
  chr4:  { genes: 757,  cpgIslands: 12068, probes: 46063 },
  chr5:  { genes: 923,  cpgIslands: 14507, probes: 51741 },
  chr6:  { genes: 1057, cpgIslands: 16338, probes: 55940 },
  chr7:  { genes: 989,  cpgIslands: 15433, probes: 52800 },
  chr8:  { genes: 683,  cpgIslands: 11439, probes: 43413 },
  chr9:  { genes: 786,  cpgIslands: 12098, probes: 38448 },
  chr10: { genes: 733,  cpgIslands: 12462, probes: 43266 },
  chr11: { genes: 1298, cpgIslands: 14556, probes: 49497 },
  chr12: { genes: 1034, cpgIslands: 14008, probes: 47668 },
  chr13: { genes: 327,  cpgIslands: 7573,  probes: 28249 },
  chr14: { genes: 830,  cpgIslands: 10275, probes: 32990 },
  chr15: { genes: 613,  cpgIslands: 9626,  probes: 32021 },
  chr16: { genes: 873,  cpgIslands: 12890, probes: 37095 },
  chr17: { genes: 1197, cpgIslands: 15438, probes: 43584 },
  chr18: { genes: 270,  cpgIslands: 5729,  probes: 20736 },
  chr19: { genes: 1472, cpgIslands: 15168, probes: 36519 },
  chr20: { genes: 544,  cpgIslands: 7739,  probes: 24227 },
  chr21: { genes: 234,  cpgIslands: 3098,  probes: 10764 },
  chr22: { genes: 488,  cpgIslands: 6229,  probes: 18221 },
  chrX:  { genes: 842,  cpgIslands: 12662, probes: 38109 },
  chrY:  { genes: 71,   cpgIslands: 491,   probes: 1002  },
};

/**
 * Extract a specific property value from chromosomeFeatures physicalProperties.
 */
function findProperty(chrName: string, termMatch: RegExp): string | null {
  const features = CHROMOSOME_FEATURES[chrName];
  if (!features) return null;
  const entry = features.physicalProperties.find(p => termMatch.test(p.term));
  if (!entry) return null;
  // Extract just the key value (first sentence or short summary)
  const detail = entry.detail;
  // For GC content, extract the percentage
  const gcMatch = detail.match(/~?(\d+\.?\d*%)/);
  if (gcMatch) return gcMatch[1];
  return detail.split('.')[0];
}

export function ChromosomeInfoPanel({ chr, geneCount, cpgIslandCount, probeCount }: ChromosomeInfoPanelProps) {
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
    ? (effectiveGenes / (chr.length / 1_000_000)).toFixed(1) + '/Mb'
    : '—';

  const gcContent = findProperty(chr.name, /^GC/i);

  // Pull architecture highlights (first 3)
  const archHighlights = features?.genomicArchitecture.slice(0, 3) || [];

  // Pull deep cuts (first 3)
  const deepCuts = features?.deepCuts.slice(0, 3) || [];

  // Pull evolutionary highlights (first 2)
  const evoHighlights = features?.evolutionaryHistory.slice(0, 2) || [];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE[5],
      minWidth: 220,
    }}>
      {/* Tagline */}
      {features && (
        <div style={{
          borderLeft: `2px solid ${COLOR.accent.teal}`,
          paddingLeft: SPACE[3],
          marginBottom: SPACE[1],
        }}>
          <p style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            lineHeight: 1.6,
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
        {!isCircular && (
          <>
            <StatRow label="Centromere" value={cenType} />
            <StatRow label="p-arm" value={fmtMb(pArmLen)} />
            <StatRow label="q-arm" value={fmtMb(qArmLen)} />
          </>
        )}
        {isCircular && (
          <StatRow label="Topology" value="circular" />
        )}
        {gcContent && (
          <StatRow label="GC content" value={gcContent} />
        )}
      </div>

      {/* Genomic Features */}
      <div>
        <SectionHeader title="Genomic Features" />
        <StatRow
          label="Genes"
          value={effectiveGenes !== null ? effectiveGenes.toLocaleString() : '—'}
          color={COLOR.layer.gencode_v44}
        />
        <StatRow
          label="Gene density"
          value={geneDensity}
          color={COLOR.layer.gencode_v44}
        />
        <StatRow
          label="CpG islands"
          value={effectiveCpg !== null ? effectiveCpg.toLocaleString() : '—'}
          color={COLOR.layer.cpg_sites}
        />
        <StatRow
          label="EPIC v2 probes"
          value={effectiveProbes !== null ? effectiveProbes.toLocaleString() : '—'}
          color={COLOR.layer.probe_epic_v2}
        />
      </div>

      {/* Notable */}
      {facts && (
        <div>
          <SectionHeader title="Notable" />

          {facts.largestGene && (
            <StatRow label="Largest gene" value={facts.largestGene} />
          )}

          {facts.diseases.length > 0 && (
            <div style={{ marginTop: SPACE[2] }}>
              <span style={{
                color: COLOR.text.tertiary,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                display: 'block',
                marginBottom: SPACE[1],
              }}>
                Disease associations
              </span>
              {facts.diseases.map(d => (
                <div key={d} style={{
                  color: COLOR.text.secondary,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                  padding: `${SPACE[0]}px 0`,
                  paddingLeft: SPACE[2],
                }}>
                  {d}
                </div>
              ))}
            </div>
          )}

          {facts.facts.length > 0 && (
            <div style={{ marginTop: SPACE[3] }}>
              {facts.facts.map((fact, i) => (
                <InfoBlock key={i} text={fact} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Genomic Architecture */}
      {archHighlights.length > 0 && (
        <div>
          <SectionHeader title="Genomic Architecture" />
          {archHighlights.map((entry, i) => (
            <div key={i} style={{ padding: `${SPACE[1]}px 0` }}>
              {entry.term && (
                <span style={{
                  color: COLOR.text.secondary,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                  fontWeight: WEIGHT.medium,
                }}>
                  {entry.term}
                  <span style={{ color: COLOR.text.faint }}>{' — '}</span>
                </span>
              )}
              <span style={{
                color: COLOR.text.tertiary,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                lineHeight: 1.55,
              }}>
                {entry.detail.length > 200 ? entry.detail.slice(0, 197) + '...' : entry.detail}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Evolutionary History */}
      {evoHighlights.length > 0 && (
        <div>
          <SectionHeader title="Evolutionary History" />
          {evoHighlights.map((entry, i) => (
            <div key={i} style={{ padding: `${SPACE[1]}px 0` }}>
              {entry.term && (
                <span style={{
                  color: COLOR.text.secondary,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                  fontWeight: WEIGHT.medium,
                }}>
                  {entry.term}
                  <span style={{ color: COLOR.text.faint }}>{' — '}</span>
                </span>
              )}
              <span style={{
                color: COLOR.text.tertiary,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                lineHeight: 1.55,
              }}>
                {entry.detail.length > 200 ? entry.detail.slice(0, 197) + '...' : entry.detail}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Deep Cuts */}
      {deepCuts.length > 0 && (
        <div>
          <SectionHeader title="Deep Cuts" />
          {deepCuts.map((entry, i) => (
            <div key={i} style={{
              padding: `${SPACE[2]}px 0`,
              borderBottom: i < deepCuts.length - 1 ? `1px solid ${COLOR.border.subtle}` : 'none',
            }}>
              {entry.term && (
                <div style={{
                  color: COLOR.text.secondary,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                  fontWeight: WEIGHT.medium,
                  marginBottom: SPACE[1],
                }}>
                  {entry.term}
                </div>
              )}
              <div style={{
                color: COLOR.text.tertiary,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                lineHeight: 1.55,
              }}>
                {entry.detail.length > 250 ? entry.detail.slice(0, 247) + '...' : entry.detail}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
