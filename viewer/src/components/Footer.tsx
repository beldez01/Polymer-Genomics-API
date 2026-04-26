'use client';

import Link from 'next/link';
import { COLOR, FONT_FAMILY, TYPE, SPACE } from '@/config/theme';

const DOT = (
  <span style={{ color: COLOR.border.strong, fontSize: 12, lineHeight: 1 }}>&middot;</span>
);

const linkStyle = {
  color: COLOR.text.tertiary,
  fontSize: TYPE.sm.fontSize,
  fontFamily: FONT_FAMILY,
  textDecoration: 'none',
  letterSpacing: '0.02em',
} as const;

export function Footer() {
  return (
    <div
      style={{
        flexShrink: 0,
        backgroundColor: COLOR.bg.elevated,
        borderTop: `1px solid ${COLOR.border.default}`,
        padding: `${SPACE[2]}px ${SPACE[4]}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: SPACE[2],
      }}
    >
      {/* Left: links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
        <Link href="/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites,probe_epic_v2,isochores" style={linkStyle}>Viewer</Link>
        {DOT}
        <Link href="/atlas" style={linkStyle}>Atlas</Link>
        {DOT}
        <Link href="/portal/latent3d" style={linkStyle}>Claims</Link>
        {DOT}
        <Link href="/newsroom" style={linkStyle}>Newsroom</Link>
        {DOT}
        <Link href="/docs" style={linkStyle}>Dev / API</Link>
        {DOT}
        <Link href="/terms" style={linkStyle}>Terms</Link>
        {DOT}
        <Link href="/privacy" style={linkStyle}>Privacy</Link>
        {DOT}
        <Link href="/data-sources" style={linkStyle}>Data Sources</Link>
      </div>

      {/* Right: RUO + copyright */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
        <Link
          href="/terms"
          style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            letterSpacing: '0.06em',
            textDecoration: 'none',
            borderBottom: `1px dotted ${COLOR.text.faint}`,
          }}
          title="Not for clinical or diagnostic use. Data provided as-is without warranty. Not intended as a substitute for professional medical advice, diagnosis, or treatment. Reference assembly coordinates may differ from clinical-grade annotations."
        >
          RESEARCH USE ONLY
        </Link>
        <span style={{ color: COLOR.border.strong, fontSize: 10 }}>&middot;</span>
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
        }}>
          &copy; 2026 Polymer Genomics
        </span>
      </div>
    </div>
  );
}
