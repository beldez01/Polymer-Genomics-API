'use client';

import { ChromosomeInfo } from '@/config/chromosomes';
import { getCentromereType } from '@/config/denverGroups';
import { CHROMOSOME_FACTS } from '@/config/chromosomeFacts';
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
      }}>
        {value}
      </span>
    </div>
  );
}

export function ChromosomeInfoPanel({ chr, geneCount, cpgIslandCount, probeCount }: ChromosomeInfoPanelProps) {
  const facts = CHROMOSOME_FACTS[chr.name];
  const cenType = getCentromereType(chr.centromereStart, chr.centromereEnd, chr.length);
  const pArmLen = chr.centromereStart;
  const qArmLen = chr.length - chr.centromereEnd;
  const isCircular = chr.name === 'chrM';

  const geneDensity = geneCount !== null
    ? (geneCount / (chr.length / 1_000_000)).toFixed(1) + '/Mb'
    : '—';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE[5],
      minWidth: 220,
    }}>
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
                <div key={i} style={{
                  color: COLOR.text.tertiary,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                  lineHeight: 1.5,
                  padding: `${SPACE[1]}px 0`,
                }}>
                  {fact}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
