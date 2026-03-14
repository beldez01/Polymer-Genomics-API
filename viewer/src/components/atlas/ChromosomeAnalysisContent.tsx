'use client';

import { useState } from 'react';
import Link from 'next/link';
import { COLOR, TYPE, FONT_FAMILY, WEIGHT, SPACE } from '@/config/theme';
import type { ChromosomeFeatureData } from '@/config/chromosomeFeatures';

// ---------------------------------------------------------------------------
// Simple inline markdown renderer: **bold** → <strong>
// ---------------------------------------------------------------------------

function renderInline(text: string): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={match.index} style={{ color: COLOR.text.secondary, fontWeight: WEIGHT.medium }}>
        {match[1]}
      </strong>,
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionDivider({ title, index }: { title: string; index: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[4],
        marginTop: index === 0 ? 0 : SPACE[6],
        marginBottom: SPACE[4],
      }}
    >
      <div
        style={{
          width: 3,
          height: 16,
          backgroundColor: COLOR.accent.teal,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          color: COLOR.accent.teal,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
      <div
        style={{
          flex: 1,
          height: 1,
          backgroundColor: COLOR.border.subtle,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature Entry (term + detail)
// ---------------------------------------------------------------------------

function FeatureItem({ term, detail }: { term: string; detail: string }) {
  return (
    <div
      style={{
        padding: `${SPACE[2]}px 0`,
        borderBottom: `1px solid ${COLOR.border.subtle}`,
        lineHeight: 1.65,
      }}
    >
      {term && (
        <span
          style={{
            color: COLOR.text.secondary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.medium,
          }}
        >
          {term}
          <span style={{ color: COLOR.text.faint }}>{' — '}</span>
        </span>
      )}
      <span
        style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
        }}
      >
        {renderInline(detail)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gene Card
// ---------------------------------------------------------------------------

function GeneFeatureCard({
  symbol,
  band,
  detail,
  build,
}: {
  symbol: string;
  band: string;
  detail: string;
  build: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/gene/${build}/${symbol}`}
      style={{ textDecoration: 'none', display: 'block' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          backgroundColor: hovered ? COLOR.bg.surface : COLOR.bg.elevated,
          border: `1px solid ${hovered ? COLOR.accent.teal : COLOR.border.subtle}`,
          padding: `${SPACE[3]}px ${SPACE[4]}px`,
          transition: 'all 0.15s ease',
          cursor: 'pointer',
          height: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE[2], marginBottom: SPACE[1] }}>
          <span
            style={{
              color: hovered ? COLOR.accent.teal : COLOR.text.primary,
              fontSize: TYPE.base.fontSize,
              fontFamily: FONT_FAMILY,
              fontWeight: WEIGHT.bold,
              letterSpacing: '-0.01em',
              transition: 'color 0.15s',
            }}
          >
            {symbol}
          </span>
          {band && (
            <span
              style={{
                color: COLOR.text.faint,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
              }}
            >
              {band}
            </span>
          )}
        </div>
        <p
          style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            lineHeight: 1.55,
            margin: 0,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {detail}
        </p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Deep Cut Card — special editorial styling
// ---------------------------------------------------------------------------

function DeepCutItem({ term, detail, index }: { term: string; detail: string; index: number }) {
  return (
    <div
      style={{
        backgroundColor: COLOR.bg.track,
        borderLeft: `2px solid ${COLOR.accent.violet}`,
        padding: `${SPACE[3]}px ${SPACE[5]}px`,
        lineHeight: 1.65,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE[2], marginBottom: SPACE[1] }}>
        <span
          style={{
            color: COLOR.accent.violet,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.medium,
            opacity: 0.6,
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        {term && (
          <span
            style={{
              color: COLOR.text.secondary,
              fontSize: TYPE.sm.fontSize,
              fontFamily: FONT_FAMILY,
              fontWeight: WEIGHT.medium,
            }}
          >
            {term}
          </span>
        )}
      </div>
      <span
        style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
        }}
      >
        {renderInline(detail)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  index,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  index: number;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <SectionDivider title={`${open ? '−' : '+'} ${title}`} index={index} />
      </button>
      {open && <div style={{ paddingLeft: SPACE[2] }}>{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ChromosomeAnalysisContent({
  chrName,
  features,
  build = 'hg38',
}: {
  chrName: string;
  features: ChromosomeFeatureData;
  build?: string;
}) {
  let sectionIdx = 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE[2],
      }}
    >
      {/* Tagline — editorial pull quote */}
      <div
        style={{
          borderLeft: `3px solid ${COLOR.accent.teal}`,
          padding: `${SPACE[4]}px ${SPACE[6]}px`,
          margin: `0 0 ${SPACE[4]}px 0`,
          backgroundColor: COLOR.bg.elevated,
        }}
      >
        <p
          style={{
            color: COLOR.text.secondary,
            fontSize: TYPE.base.fontSize,
            fontFamily: FONT_FAMILY,
            lineHeight: 1.7,
            margin: 0,
            fontStyle: 'italic',
          }}
        >
          {features.tagline}
        </p>
      </div>

      {/* Physical Properties — always open */}
      {features.physicalProperties.length > 0 && (
        <div>
          <SectionDivider title="Physical Properties" index={sectionIdx++} />
          <div style={{ paddingLeft: SPACE[2] }}>
            {features.physicalProperties.map((entry, i) => (
              <FeatureItem key={i} term={entry.term} detail={entry.detail} />
            ))}
          </div>
        </div>
      )}

      {/* Notable Genes — interactive card grid */}
      {features.notableGenes.length > 0 && (
        <div>
          <SectionDivider title={`Notable Genes & Loci (${features.notableGenes.length})`} index={sectionIdx++} />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: SPACE[3],
              marginBottom: SPACE[2],
            }}
          >
            {features.notableGenes.map((gene) => {
              // Entries with spaces in "symbol" are descriptive items, not actual genes
              const isRealGene = !gene.symbol.includes(' ') && !gene.symbol.includes(',');
              return isRealGene ? (
                <GeneFeatureCard
                  key={gene.symbol}
                  symbol={gene.symbol}
                  band={gene.band}
                  detail={gene.detail}
                  build={build}
                />
              ) : (
                <div
                  key={gene.symbol}
                  style={{
                    backgroundColor: COLOR.bg.elevated,
                    border: `1px solid ${COLOR.border.subtle}`,
                    padding: `${SPACE[3]}px ${SPACE[4]}px`,
                  }}
                >
                  <div style={{ marginBottom: SPACE[1] }}>
                    <span style={{
                      color: COLOR.text.secondary,
                      fontSize: TYPE.sm.fontSize,
                      fontFamily: FONT_FAMILY,
                      fontWeight: WEIGHT.medium,
                    }}>
                      {gene.symbol}
                    </span>
                  </div>
                  <p style={{
                    color: COLOR.text.tertiary,
                    fontSize: TYPE.xs.fontSize,
                    fontFamily: FONT_FAMILY,
                    lineHeight: 1.55,
                    margin: 0,
                  }}>
                    {gene.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Genomic Architecture */}
      {features.genomicArchitecture.length > 0 && (
        <CollapsibleSection title="Genomic Architecture" index={sectionIdx++}>
          {features.genomicArchitecture.map((entry, i) => (
            <FeatureItem key={i} term={entry.term} detail={entry.detail} />
          ))}
        </CollapsibleSection>
      )}

      {/* Disease Associations */}
      {features.diseaseAssociations.length > 0 && (
        <CollapsibleSection title="Disease Associations" index={sectionIdx++}>
          {features.diseaseAssociations.map((entry, i) => (
            <FeatureItem key={i} term={entry.term} detail={entry.detail} />
          ))}
        </CollapsibleSection>
      )}

      {/* Evolutionary History */}
      {features.evolutionaryHistory.length > 0 && (
        <CollapsibleSection title="Evolutionary History" index={sectionIdx++}>
          {features.evolutionaryHistory.map((entry, i) => (
            <FeatureItem key={i} term={entry.term} detail={entry.detail} />
          ))}
        </CollapsibleSection>
      )}

      {/* Biophysical Features */}
      {features.biophysicalFeatures.length > 0 && (
        <CollapsibleSection title="Biophysical & Structural Features" index={sectionIdx++}>
          {features.biophysicalFeatures.map((entry, i) => (
            <FeatureItem key={i} term={entry.term} detail={entry.detail} />
          ))}
        </CollapsibleSection>
      )}

      {/* Epigenetic Landscape */}
      {features.epigeneticLandscape.length > 0 && (
        <CollapsibleSection title="Epigenetic Landscape" index={sectionIdx++}>
          {features.epigeneticLandscape.map((entry, i) => (
            <FeatureItem key={i} term={entry.term} detail={entry.detail} />
          ))}
        </CollapsibleSection>
      )}

      {/* Deep Cuts — editorial section */}
      {features.deepCuts.length > 0 && (
        <div>
          <SectionDivider title="Deep Cuts" index={sectionIdx++} />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE[2],
            }}
          >
            {features.deepCuts.map((entry, i) => (
              <DeepCutItem key={i} term={entry.term} detail={entry.detail} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
