'use client';

/**
 * /claims — 3D latent space of the v3-formal FormalClaim corpus + inline DAG.
 *
 * Supersedes the earlier v2 21-feature viewer (which inlined a hand-curated
 * corpus in viewer/src/config/claims.ts). This page reads the deterministic
 * PCA projection from viewer/src/data/formal_claim_projection_v1.json
 * (typed via viewer/src/config/formal_projection.ts). Clicking a node renders
 * the full ⟨P, O, S, I, C⟩ 5-panel body under the canvas using the fixture
 * payload shipped alongside each projection entry.
 */

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { FormalClaimBody } from '@/components/FormalClaim/FormalClaimView';
import {
  EDGES,
  OUTCOME_COLORS,
  PROJECTION,
  type FormalProjectionClaim,
} from '@/config/formal_projection';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';

// Three.js touches `window` — must load client-only.
const FormalClaimUniverse = dynamic(
  () => import('@/components/FormalClaimUniverse/FormalClaimUniverse'),
  { ssr: false, loading: () => <CanvasLoadingState /> },
);

function CanvasLoadingState() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLOR.bg.primary,
      }}
    >
      <span
        style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}
      >
        Loading projection…
      </span>
    </div>
  );
}

const OUTCOME_LABELS: Array<{ outcome: keyof typeof OUTCOME_COLORS; label: string }> = [
  { outcome: 'strong_positive', label: 'strong positive' },
  { outcome: 'positive', label: 'positive' },
  { outcome: 'qualified_positive', label: 'qualified' },
  { outcome: 'negative', label: 'negative' },
  { outcome: 'fail', label: 'fail (unused)' },
];

export default function FormalClaimsPage() {
  const [hovered, setHovered] = useState<FormalProjectionClaim | null>(null);
  const [selected, setSelected] = useState<FormalProjectionClaim | null>(null);
  const inlineRef = useRef<HTMLDivElement>(null);

  function handleSelect(claim: FormalProjectionClaim) {
    setSelected(claim);
    // Scroll the inline DAG into view once React commits.
    requestAnimationFrame(() => {
      inlineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const evr = PROJECTION.explained_variance;
  const sil = PROJECTION.silhouette;
  const dep = PROJECTION.depends_on_distance;

  return (
    <main
      style={{
        backgroundColor: COLOR.bg.primary,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT_FAMILY,
      }}
    >
      <BrandBar subtitle="Formal Claim Latent Space" sticky />

      {/* Page header */}
      <section
        style={{
          maxWidth: 1600,
          width: '100%',
          margin: '0 auto',
          padding: `${SPACE[6]}px ${SPACE[6]}px ${SPACE[4]}px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE[3],
            marginBottom: SPACE[3],
          }}
        >
          <span
            style={{
              color: COLOR.accent.teal,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              fontWeight: WEIGHT.medium,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            FormalClaim IR · v3-formal
          </span>
          <div style={{ flex: 1, height: 1, backgroundColor: COLOR.border.strong }} />
          <span
            style={{
              color: COLOR.text.muted,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            {PROJECTION.n_claims} claims · {PROJECTION.feature_dim_kept_after_zero_var_drop}
            d → 3d PCA · {EDGES.length} edges
          </span>
        </div>
        <p
          style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            letterSpacing: '0.02em',
            margin: 0,
            maxWidth: 760,
            lineHeight: 1.6,
          }}
        >
          Each FormalClaim ⟨P, O, S, I, C⟩ tuple summarized as a structural feature
          vector (operation-kind counts, inference depth, evidence-class distribution,
          provenance state, CV scheme, null-model kind). Coords are deterministic PCA
          on the standardized matrix. Click a node to inspect its DAG below.
        </p>
      </section>

      {/* Diagnostics strip */}
      <section
        style={{
          maxWidth: 1600,
          width: '100%',
          margin: '0 auto',
          padding: `0 ${SPACE[6]}px ${SPACE[3]}px`,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: SPACE[3],
        }}
      >
        {[
          {
            label: 'PC1',
            value: `${(evr[0] * 100).toFixed(1)}%`,
            sub: PROJECTION.top_features_per_pc[0][0][0].replace(/^[a-z_]+::/i, ''),
          },
          {
            label: 'PC2',
            value: `${(evr[1] * 100).toFixed(1)}%`,
            sub: PROJECTION.top_features_per_pc[1][0][0].replace(/^[a-z_]+::/i, ''),
          },
          {
            label: 'PC3',
            value: `${(evr[2] * 100).toFixed(1)}%`,
            sub: PROJECTION.top_features_per_pc[2][0][0].replace(/^[a-z_]+::/i, ''),
          },
          {
            label: 'silhouette · topic',
            value: sil.by_topic !== null ? sil.by_topic.toFixed(3) : '—',
            sub: 'RC excluded (n=1)',
          },
          {
            label: 'silhouette · outcome',
            value: sil.by_outcome !== null ? sil.by_outcome.toFixed(3) : '—',
            sub: 'higher = clusters',
          },
          {
            label: `${dep.n_edges} dep edges`,
            value:
              dep.mean_observed !== null && dep.mean_null !== null
                ? `${(dep.mean_null - dep.mean_observed).toFixed(2)}`
                : '—',
            sub:
              dep.p_value !== null
                ? `tighter than null (p=${dep.p_value.toFixed(3)})`
                : 'no edges',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: `${SPACE[2]}px ${SPACE[3]}px`,
              border: `1px solid ${COLOR.border.subtle}`,
              backgroundColor: COLOR.bg.elevated,
            }}
          >
            <div
              style={{
                color: COLOR.text.muted,
                fontSize: TYPE.xs.fontSize,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                color: COLOR.text.primary,
                fontSize: TYPE.md.fontSize,
                fontWeight: WEIGHT.medium,
                marginBottom: 2,
              }}
            >
              {stat.value}
            </div>
            <div style={{ color: COLOR.text.tertiary, fontSize: TYPE.xs.fontSize }}>
              {stat.sub}
            </div>
          </div>
        ))}
      </section>

      {/* Canvas */}
      <div
        style={{
          maxWidth: 1600,
          width: '100%',
          margin: '0 auto',
          border: `1px solid ${COLOR.border.subtle}`,
          height: 580,
          position: 'relative',
        }}
      >
        <FormalClaimUniverse
          hoveredId={hovered?.id ?? null}
          selectedId={selected?.id ?? null}
          onHover={setHovered}
          onSelect={handleSelect}
        />

        {hovered && (
          <div
            style={{
              position: 'absolute',
              top: SPACE[4],
              left: SPACE[4],
              padding: `${SPACE[2]}px ${SPACE[3]}px`,
              backgroundColor: `${COLOR.bg.elevated}E6`,
              border: `1px solid ${COLOR.border.strong}`,
              pointerEvents: 'none',
              maxWidth: 360,
            }}
          >
            <div
              style={{
                color: COLOR.text.muted,
                fontSize: TYPE.xs.fontSize,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              {hovered.topic}
            </div>
            <div
              style={{
                color: COLOR.text.primary,
                fontSize: TYPE.sm.fontSize,
                fontWeight: WEIGHT.medium,
                marginBottom: 4,
                fontFamily: FONT_FAMILY,
              }}
            >
              {hovered.id}
            </div>
            <div style={{ display: 'flex', gap: SPACE[2], alignItems: 'center' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: OUTCOME_COLORS[hovered.outcome],
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  color: COLOR.text.tertiary,
                  fontSize: TYPE.xs.fontSize,
                  letterSpacing: '0.06em',
                }}
              >
                {hovered.outcome.replace(/_/g, ' ')}
                {hovered.depends_on.length > 0 &&
                  ` · ${hovered.depends_on.length} dep`}
              </span>
            </div>
          </div>
        )}

        {/* Legend bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: SPACE[3],
            right: SPACE[3],
            padding: `${SPACE[2]}px ${SPACE[3]}px`,
            backgroundColor: `${COLOR.bg.elevated}E6`,
            border: `1px solid ${COLOR.border.subtle}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pointerEvents: 'none',
          }}
        >
          {OUTCOME_LABELS.filter((o) => o.outcome !== 'fail').map((o) => (
            <div
              key={o.outcome}
              style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: OUTCOME_COLORS[o.outcome],
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  color: COLOR.text.tertiary,
                  fontSize: TYPE.xs.fontSize,
                  letterSpacing: '0.04em',
                }}
              >
                {o.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Inline DAG body for the selected claim */}
      <section
        ref={inlineRef}
        style={{
          maxWidth: 1280,
          width: '100%',
          margin: '0 auto',
          padding: `${SPACE[6]}px ${SPACE[6]}px ${SPACE[8]}px`,
        }}
      >
        {selected ? (
          selected.fixture ? (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE[3],
                  marginBottom: SPACE[4],
                }}
              >
                <span
                  style={{
                    color: COLOR.accent.teal,
                    fontSize: TYPE.xs.fontSize,
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    fontWeight: WEIGHT.medium,
                    flexShrink: 0,
                  }}
                >
                  Selected claim
                </span>
                <div style={{ flex: 1, height: 1, backgroundColor: COLOR.border.strong }} />
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  style={{
                    background: 'none',
                    border: `1px solid ${COLOR.border.default}`,
                    color: COLOR.text.tertiary,
                    fontFamily: FONT_FAMILY,
                    fontSize: TYPE.sm.fontSize,
                    padding: `${SPACE[1]}px ${SPACE[3]}px`,
                    borderRadius: 3,
                    cursor: 'pointer',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  Close ×
                </button>
              </div>
              <FormalClaimBody claim={selected.fixture} />
            </>
          ) : (
            <div
              style={{
                color: COLOR.text.muted,
                fontSize: TYPE.sm.fontSize,
                padding: SPACE[4],
                border: `1px dashed ${COLOR.border.default}`,
              }}
            >
              No fixture payload attached to this projection entry. Rebuild the
              projection artifact via <code>make projection</code>.
            </div>
          )
        ) : (
          <div
            style={{
              color: COLOR.text.muted,
              fontSize: TYPE.xs.fontSize,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              textAlign: 'center',
              padding: `${SPACE[4]}px 0`,
            }}
          >
            Click a node above to inspect its DAG
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
