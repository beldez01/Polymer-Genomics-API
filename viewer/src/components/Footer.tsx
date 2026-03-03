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
        height: 64,
        flexShrink: 0,
        backgroundColor: COLOR.bg.elevated,
        borderTop: `1px solid ${COLOR.border.default}`,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: SPACE[4],
        paddingRight: SPACE[4],
        gap: SPACE[4],
      }}
    >
      {/* Left: branding */}
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
          color: COLOR.text.faint,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.03em',
        }}>
          Reference genome browser · hg38 / hg37
        </span>
      </div>

      {/* Right: links + copyright */}
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

        <span style={{
          color: COLOR.text.faint,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
        }}>
          © 2026 Polymer Genomics
        </span>
      </div>
    </div>
  );
}
