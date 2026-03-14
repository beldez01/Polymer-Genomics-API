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

  const geneDensity = geneCount !== null
    ? (geneCount / (chr.length / 1_000_000)).toFixed(1) + '/Mb'
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
          value={geneCount !== null ? geneCount.toLocaleString() : '—'}
          color={COLOR.layer.gencode_v44}
        />
        <StatRow
          label="Gene density"
          value={geneDensity}
          color={COLOR.layer.gencode_v44}
        />
        <StatRow
          label="CpG islands"
          value={cpgIslandCount !== null ? cpgIslandCount.toLocaleString() : '—'}
          color={COLOR.layer.cpg_sites}
        />
        <StatRow
          label="EPIC v2 probes"
          value={probeCount !== null ? probeCount.toLocaleString() : '—'}
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
