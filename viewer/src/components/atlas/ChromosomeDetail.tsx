'use client';

import { ChromosomeInfo } from '@/config/chromosomes';
import { getCentromereType, getDenverGroupForChromosome } from '@/config/denverGroups';
import { HighResChromosome } from './HighResChromosome';
import { ChromosomeInfoPanel } from './ChromosomeInfoPanel';
import { COLOR, TYPE, FONT_FAMILY, WEIGHT, SPACE, COMPONENT } from '@/config/theme';

interface ChromosomeDetailProps {
  chr: ChromosomeInfo;
  geneCount: number | null;
  cpgIslandCount: number | null;
  probeCount: number | null;
  onBack: () => void;
}

function fmtMb(bp: number): string {
  return (bp / 1_000_000).toFixed(1) + ' Mb';
}

function fmtKb(bp: number): string {
  return (bp / 1_000).toFixed(1) + ' kb';
}

export function ChromosomeDetail({ chr, geneCount, cpgIslandCount, probeCount, onBack }: ChromosomeDetailProps) {
  const cenType = getCentromereType(chr.centromereStart, chr.centromereEnd, chr.length);
  const group = getDenverGroupForChromosome(chr.name);
  const isCircular = chr.name === 'chrM';
  const sizeStr = isCircular ? fmtKb(chr.length) : fmtMb(chr.length);

  return (
    <div style={{
      maxWidth: 1100,
      margin: '0 auto',
      padding: `${SPACE[6]}px ${SPACE[6]}px ${SPACE[12]}px`,
    }}>
      {/* Header: Back button + chromosome title */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[4],
        marginBottom: SPACE[6],
      }}>
        <button
          onClick={onBack}
          style={{
            ...COMPONENT.button.ghost,
            display: 'flex',
            alignItems: 'center',
            gap: SPACE[1],
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = COLOR.accent.teal;
            e.currentTarget.style.color = COLOR.accent.teal;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = COLOR.border.strong;
            e.currentTarget.style.color = COLOR.text.secondary;
          }}
        >
          <span style={{ fontSize: TYPE.md.fontSize }}>&#8592;</span> Back
        </button>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE[3] }}>
          <span style={{
            color: COLOR.accent.teal,
            fontSize: TYPE.xl.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.bold,
            letterSpacing: '-0.02em',
          }}>
            {chr.name}
          </span>
          <span style={{
            color: COLOR.text.muted,
            fontSize: TYPE.base.fontSize,
            fontFamily: FONT_FAMILY,
          }}>
            {sizeStr}
          </span>
          {!isCircular && (
            <span style={{
              color: COLOR.text.faint,
              fontSize: TYPE.sm.fontSize,
              fontFamily: FONT_FAMILY,
            }}>
              {cenType}
            </span>
          )}
          {group && (
            <span style={{
              color: COLOR.text.faint,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              letterSpacing: '0.05em',
            }}>
              Group {group.label}
            </span>
          )}
        </div>
      </div>

      {/* Two-column layout: high-res chromosome (left) + info panel (right) */}
      <div style={{
        display: 'flex',
        gap: SPACE[8],
        alignItems: 'flex-start',
      }}>
        {/* Left: high-res chromosome with gene labels */}
        <div style={{ flexShrink: 0 }}>
          <HighResChromosome chr={chr} />
        </div>

        {/* Right: info panel — takes remaining space */}
        <div style={{
          flex: 1,
          minWidth: 0,
          borderLeft: `1px solid ${COLOR.border.subtle}`,
          paddingLeft: SPACE[8],
        }}>
          <ChromosomeInfoPanel
            chr={chr}
            geneCount={geneCount}
            cpgIslandCount={cpgIslandCount}
            probeCount={probeCount}
          />
        </div>
      </div>
    </div>
  );
}
