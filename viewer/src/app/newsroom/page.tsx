'use client';

import { useMemo } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { NewsroomEntry } from '@/components/newsroom/NewsroomEntry';
import { CLAIMS } from '@/config/claims';
import { COLOR, TYPE, FONT_FAMILY, FONT_FAMILY_SANS, WEIGHT, SPACE } from '@/config/theme';

export default function NewsroomPage() {
  const sorted = useMemo(
    () => [...CLAIMS].sort((a, b) => b.posted_at.localeCompare(a.posted_at)),
    [],
  );

  const latest = sorted[0];
  const oldest = sorted[sorted.length - 1];
  const rangeLabel = latest && oldest
    ? `${oldest.posted_at} → ${latest.posted_at}`
    : '';

  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: FONT_FAMILY,
    }}>
      <BrandBar subtitle="Newsroom" sticky />

      {/* Masthead */}
      <section style={{
        maxWidth: 760,
        width: '100%',
        margin: '0 auto',
        padding: `${SPACE[8]}px ${SPACE[6]}px ${SPACE[6]}px`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[3],
          marginBottom: SPACE[5],
        }}>
          <span style={{
            color: COLOR.accent.teal,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            Newsroom
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
            fontVariantNumeric: 'tabular-nums',
          }}>
            {rangeLabel}
          </span>
        </div>

        <h1 style={{
          color: COLOR.text.primary,
          fontSize: TYPE['2xl'].fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          letterSpacing: '-0.025em',
          lineHeight: 1.1,
          margin: 0,
          marginBottom: SPACE[4],
        }}>
          Dispatches
        </h1>

        <p style={{
          color: COLOR.text.tertiary,
          fontSize: 16,
          fontFamily: FONT_FAMILY_SANS,
          letterSpacing: 0,
          lineHeight: 1.6,
          margin: 0,
          maxWidth: 640,
        }}>
          Every typed claim posted to Polymer, in chronological order. Each dispatch carries its
          outcome, method, scale, and topology. For the structural view of the same corpus,{' '}
          <span style={{ color: COLOR.accent.teal }}>open the claims universe</span>.
        </p>

        {/* Stats row */}
        <div style={{
          display: 'flex',
          gap: SPACE[8],
          marginTop: SPACE[6],
          paddingTop: SPACE[5],
          borderTop: `1px solid ${COLOR.border.subtle}`,
        }}>
          <Stat label="Dispatches" value={sorted.length.toString().padStart(2, '0')} />
          <Stat label="Timeline" value={rangeLabel} />
          <Stat label="Schema" value="v2 · 21 features" />
        </div>
      </section>

      {/* Feed */}
      <section style={{
        maxWidth: 760,
        width: '100%',
        margin: '0 auto',
        padding: `0 ${SPACE[6]}px ${SPACE[12]}px`,
      }}>
        {sorted.map((claim) => (
          <NewsroomEntry key={claim.id} claim={claim} />
        ))}

        {/* End-of-feed marker */}
        <div style={{
          paddingTop: SPACE[8],
          borderTop: `1px solid ${COLOR.border.subtle}`,
          textAlign: 'center',
        }}>
          <span style={{
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
          }}>
            — End of feed —
          </span>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        color: COLOR.text.primary,
        fontSize: TYPE.lg.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.medium,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
      <span style={{
        color: COLOR.text.muted,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  );
}
