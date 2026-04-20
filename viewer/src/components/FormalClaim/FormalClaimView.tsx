'use client';

import type { FormalClaim } from '@/config/formal_claims';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { exportClaimJSON, exportClaimNotebook } from '@/lib/formalClaimsExport';
import { outcomeBadge } from '@/lib/formalClaimsHelpers';
import { useState } from 'react';
import { Chip } from './Panel';
import { PremisesPanel } from './PremisesPanel';
import { OperationsPanel } from './OperationsPanel';
import { StatisticsPanel } from './StatisticsPanel';
import { InferencePanel } from './InferencePanel';
import { ConclusionPanel } from './ConclusionPanel';

interface FormalClaimViewProps {
  claim: FormalClaim;
  fixturePath: string;
}

/**
 * Full-page wrapper with dev-mode ribbon. Used at /dev/claim/[id].
 */
export function FormalClaimView({ claim, fixturePath }: FormalClaimViewProps) {
  return (
    <main
      style={{
        backgroundColor: COLOR.bg.primary,
        minHeight: '100vh',
        fontFamily: FONT_FAMILY,
        color: COLOR.text.secondary,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          width: '100%',
          margin: '0 auto',
          padding: `${SPACE[8]}px ${SPACE[6]}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE[6],
        }}
      >
        {/* Dev-mode ribbon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACE[3],
            padding: `${SPACE[2]}px ${SPACE[3]}px`,
            border: `1px dashed ${COLOR.border.strong}`,
            borderRadius: 3,
            backgroundColor: COLOR.bg.elevated,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
            <Chip color={COLOR.accent.amber}>DEV MODE</Chip>
            <span style={{ color: COLOR.text.tertiary, fontSize: TYPE.sm.fontSize }}>
              Formal Claim IR · v3-formal · schema {claim.schema_version}
            </span>
          </div>
          <span style={{ color: COLOR.text.muted, fontSize: TYPE.sm.fontSize }}>
            {fixturePath}
          </span>
        </div>

        <FormalClaimBody claim={claim} />
      </div>
    </main>
  );
}

/**
 * Inline body: header + 5 panels + footer. No outer <main>, no dev ribbon.
 * Used below the /claims 3D canvas when a claim is selected.
 */
export function FormalClaimBody({ claim }: { claim: FormalClaim }) {
  const badge = outcomeBadge(claim.conclusion.outcome);
  const [rawOpen, setRawOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  async function copyDeepLink() {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 1500);
    } catch {
      // Clipboard may be unavailable on http://; swallow silently.
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE[6],
        color: COLOR.text.secondary,
      }}
    >
        {/* Header */}
        <header style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
            <span
              style={{
                color: COLOR.accent.teal,
                fontSize: TYPE.sm.fontSize,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                fontWeight: WEIGHT.medium,
              }}
            >
              Formal Claim
            </span>
            <div style={{ flex: 1, height: 1, backgroundColor: COLOR.border.strong }} />
            <Chip color={badge.color}>{badge.label}</Chip>
          </div>
          <h1
            style={{
              margin: 0,
              color: COLOR.text.primary,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.xl.fontSize,
              lineHeight: TYPE.xl.lineHeight,
              letterSpacing: TYPE.xl.letterSpacing,
              fontWeight: WEIGHT.medium,
            }}
          >
            {claim.title}
          </h1>

          {/* Meta row */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: SPACE[2],
              fontSize: TYPE.sm.fontSize,
              color: COLOR.text.tertiary,
            }}
          >
            {claim.exp_number !== null && claim.exp_number !== undefined ? (
              <Chip>exp {String(claim.exp_number).padStart(2, '0')}</Chip>
            ) : null}
            <Chip>posted {claim.posted_at}</Chip>
            <Chip>api {claim.api_version}</Chip>
            <Chip>data {claim.data_version}</Chip>
            <Chip>claim {claim.version}</Chip>
          </div>

          {/* ID */}
          <div
            style={{
              color: COLOR.text.muted,
              fontSize: TYPE.sm.fontSize,
              wordBreak: 'break-all',
            }}
          >
            {claim.id}
          </div>
        </header>

        {/* Panels — Operations DAG first (most compelling). Internal indices
            still reflect the ⟨P,O,S,I,C⟩ 5-tuple (O = 02, P = 01, …). */}
        <OperationsPanel claim={claim} />
        <PremisesPanel premises={claim.premises} />
        <StatisticsPanel statistics={claim.statistics} />
        <InferencePanel rule={claim.inference} statistics={claim.statistics} />
        <ConclusionPanel
          conclusion={claim.conclusion}
          externalAssumptions={claim.external_assumptions}
        />

        {/* Footer — dependencies + notebook + raw JSON toggle */}
        <footer
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE[3],
            paddingTop: SPACE[4],
            borderTop: `1px solid ${COLOR.border.default}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: SPACE[4],
              fontSize: TYPE.sm.fontSize,
              color: COLOR.text.tertiary,
            }}
          >
            <div>
              <SectionLabel>Depends on</SectionLabel>
              {claim.depends_on.length === 0 ? (
                <span style={{ color: COLOR.text.muted }}>— (root claim)</span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[1] }}>
                  {claim.depends_on.map((id) => (
                    <Chip key={id}>{id}</Chip>
                  ))}
                </div>
              )}
            </div>
            {claim.notebook ? (
              <div>
                <SectionLabel>Notebook</SectionLabel>
                <code style={{ color: COLOR.text.secondary, fontSize: TYPE.sm.fontSize }}>
                  {claim.notebook}
                </code>
              </div>
            ) : null}
          </div>

          {/* Export / raw JSON toolbar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[2] }}>
            <ToolbarButton onClick={() => exportClaimJSON(claim)} accent={COLOR.accent.teal}>
              Export canonical JSON ↓
            </ToolbarButton>
            <ToolbarButton onClick={() => exportClaimNotebook(claim)} accent={COLOR.accent.violet}>
              Export scaffold notebook (.ipynb) ↓
            </ToolbarButton>
            <ToolbarButton onClick={copyDeepLink} accent={COLOR.accent.amber}>
              {copyStatus === 'copied' ? 'Link copied ✓' : 'Copy deep link'}
            </ToolbarButton>
            <ToolbarButton onClick={() => setRawOpen((v) => !v)}>
              {rawOpen ? 'Hide raw JSON' : 'Show raw JSON'}
            </ToolbarButton>
          </div>
          <div>
            {rawOpen ? (
              <pre
                style={{
                  marginTop: SPACE[2],
                  padding: SPACE[3],
                  backgroundColor: COLOR.bg.elevated,
                  border: `1px solid ${COLOR.border.default}`,
                  borderRadius: 3,
                  color: COLOR.text.secondary,
                  fontSize: TYPE.sm.fontSize,
                  lineHeight: 1.6,
                  maxHeight: 480,
                  overflow: 'auto',
                  whiteSpace: 'pre',
                }}
              >
                {JSON.stringify(claim, null, 2)}
              </pre>
            ) : null}
          </div>
        </footer>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: COLOR.text.muted,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.sm.fontSize,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        marginBottom: SPACE[1],
      }}
    >
      {children}
    </div>
  );
}

function ToolbarButton({
  onClick,
  accent,
  children,
}: {
  onClick: () => void;
  accent?: string;
  children: React.ReactNode;
}) {
  const color = accent ?? COLOR.text.tertiary;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: `1px solid ${accent ? color : COLOR.border.default}`,
        color: color,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.sm.fontSize,
        padding: `${SPACE[1]}px ${SPACE[3]}px`,
        borderRadius: 3,
        cursor: 'pointer',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </button>
  );
}
