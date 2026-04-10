'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { ClaimDetail } from '@/components/claims/ClaimDetail';
import { ClusterLegend } from '@/components/claims/ClusterLegend';
import { CLAIMS, type Claim } from '@/config/claims';
import { COLOR, TYPE, FONT_FAMILY, WEIGHT, SPACE } from '@/config/theme';

// Three.js touches `window` — must load client-only.
const ClaimUniverse = dynamic(
  () => import('@/components/claims/ClaimUniverse'),
  { ssr: false, loading: () => <CanvasLoadingState /> },
);

function CanvasLoadingState() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLOR.bg.primary,
    }}>
      <span style={{
        color: COLOR.text.muted,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
      }}>
        Loading universe…
      </span>
    </div>
  );
}

export default function ClaimsPage() {
  const [selected, setSelected] = useState<Claim | null>(null);
  const [hovered, setHovered] = useState<Claim | null>(null);

  const displayed = selected ?? hovered;

  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: FONT_FAMILY,
    }}>
      <BrandBar subtitle="Claims Universe" sticky />

      {/* Page header: title + meta */}
      <section style={{
        maxWidth: 1600,
        width: '100%',
        margin: '0 auto',
        padding: `${SPACE[6]}px ${SPACE[6]}px ${SPACE[4]}px`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[3],
          marginBottom: SPACE[3],
        }}>
          <span style={{
            color: COLOR.accent.teal,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            Typed Claim Graph
          </span>
          <div style={{
            flex: 1,
            height: 1,
            backgroundColor: COLOR.border.strong,
          }} />
          <span style={{
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            {CLAIMS.length.toString().padStart(2, '0')} claims · 21 features · PC1–PC3 projection
          </span>
        </div>
        <p style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.02em',
          margin: 0,
          maxWidth: 760,
          lineHeight: 1.6,
        }}>
          Every in silico experiment decomposed into a claim graph, embedded in a 21-dimensional feature
          space, projected via PCA. Drag to orbit. Click a node to inspect its features, graph topology,
          and protocol.
        </p>
      </section>

      {/* Main: canvas + detail panel */}
      <div style={{
        display: 'flex',
        maxWidth: 1600,
        width: '100%',
        margin: '0 auto',
        border: `1px solid ${COLOR.border.subtle}`,
        height: 520,
      }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <ClaimUniverse
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            onHover={setHovered}
          />

          {/* Hover readout (top-left, subtle) */}
          {hovered && !selected && (
            <div style={{
              position: 'absolute',
              top: SPACE[4],
              left: SPACE[4],
              padding: `${SPACE[2]}px ${SPACE[3]}px`,
              backgroundColor: `${COLOR.bg.elevated}E6`,
              border: `1px solid ${COLOR.border.strong}`,
              pointerEvents: 'none',
            }}>
              <div style={{
                color: COLOR.text.muted,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginBottom: 2,
              }}>
                Exp {hovered.exp_number.toString().padStart(2, '0')}
              </div>
              <div style={{
                color: COLOR.text.primary,
                fontSize: TYPE.sm.fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: WEIGHT.medium,
              }}>
                {hovered.title}
              </div>
            </div>
          )}
        </div>

        <ClaimDetail claim={displayed} />
      </div>

      {/* Cluster legend + PC interpretation */}
      <div style={{
        maxWidth: 1600,
        width: '100%',
        margin: '0 auto',
        borderLeft: `1px solid ${COLOR.border.subtle}`,
        borderRight: `1px solid ${COLOR.border.subtle}`,
      }}>
        <ClusterLegend />
      </div>

      <Footer />
    </main>
  );
}
