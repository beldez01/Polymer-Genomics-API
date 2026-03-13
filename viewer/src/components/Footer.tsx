'use client';

import Link from 'next/link';
import { COLOR, FONT_FAMILY, TYPE, WEIGHT, SPACE } from '@/config/theme';

const DOT = (
  <span style={{ color: COLOR.border.strong, fontSize: 12, lineHeight: 1 }}>·</span>
);

export function Footer() {
  return (
    <div
      style={{
        flexShrink: 0,
        backgroundColor: COLOR.bg.elevated,
        borderTop: `1px solid ${COLOR.border.default}`,
        padding: `${SPACE[6]}px ${SPACE[4]}px`,
      }}
    >
      {/* Top row: branding + links */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[4],
        flexWrap: 'wrap',
        marginBottom: SPACE[4],
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{
            color: COLOR.accent.teal,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.bold,
            letterSpacing: '0.08em',
          }}>
            POLYMER GENOMICS
          </span>
          <span style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            letterSpacing: '0.03em',
          }}>
            Reference genome browser &middot; hg38 / hg37
          </span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
          <Link href="/atlas" style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}>
            Atlas
          </Link>
          {DOT}
          <Link href="/docs" style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}>
            API Docs
          </Link>
          {DOT}
          <Link href="/developers" style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}>
            Developers
          </Link>
          {DOT}
          <Link href="/terms" style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}>
            Terms
          </Link>
          {DOT}
          <Link href="/privacy" style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}>
            Privacy
          </Link>
          {DOT}
          <Link href="/data-sources" style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}>
            Data Sources
          </Link>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: COLOR.border.subtle, marginBottom: SPACE[4] }} />

      {/* Bottom row: RUO + legal + copyright */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE[2],
        alignItems: 'center',
        textAlign: 'center',
      }}>
        <span style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.06em',
        }}>
          RESEARCH USE ONLY
        </span>
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          lineHeight: 1.6,
          maxWidth: 560,
        }}>
          Not for clinical or diagnostic use. Data provided as-is without warranty.
          Not intended as a substitute for professional medical advice, diagnosis, or treatment.
          Reference assembly coordinates may differ from clinical-grade annotations.
        </span>
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          marginTop: SPACE[1],
        }}>
          &copy; 2026 Polymer Genomics
        </span>
      </div>
    </div>
  );
}
