'use client';

import Link from 'next/link';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, TYPE, SPACE } from '@/config/theme';

const VIEWER_HREF =
  '/genomics/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites,probe_epic_v2,isochores';

const Dot = () => (
  <span aria-hidden style={{ color: COLOR.border.strong, fontSize: 12, lineHeight: 1 }}>·</span>
);

const linkStyle: React.CSSProperties = {
  color: COLOR.text.tertiary,
  fontSize: TYPE.sm.fontSize,
  fontFamily: FONT_FAMILY,
  textDecoration: 'none',
  letterSpacing: '0.01em',
  transition: 'color 0.15s',
};

function FootLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={linkStyle}
      onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.primary.base; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.text.tertiary; }}
    >
      {children}
    </Link>
  );
}

export function Footer() {
  return (
    <footer style={{
      flexShrink: 0,
      backgroundColor: COLOR.bg.primary,
      borderTop: `1px solid ${COLOR.border.subtle}`,
      padding: `${SPACE[4]}px ${SPACE[6]}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: SPACE[3],
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3], flexWrap: 'wrap' }}>
        <FootLink href={VIEWER_HREF}>Viewer</FootLink>
        <Dot />
        <FootLink href="/genomics/atlas">Atlas</FootLink>
        <Dot />
        <FootLink href="/claims">Claims</FootLink>
        <Dot />
        <FootLink href="/genomics/docs">Docs</FootLink>
        <Dot />
        <FootLink href="/genomics/developers">Developers</FootLink>
        <Dot />
        <FootLink href="/genomics/data-sources">Data sources</FootLink>
        <Dot />
        <FootLink href="/terms">Terms</FootLink>
        <Dot />
        <FootLink href="/privacy">Privacy</FootLink>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
        <Link
          href="/terms"
          style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY_MONO,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            borderBottom: `1px dotted ${COLOR.text.faint}`,
          }}
          title="Not for clinical or diagnostic use. Data provided as-is without warranty. Not intended as a substitute for professional medical advice, diagnosis, or treatment."
        >
          Research tools: research use only
        </Link>
        <Dot />
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY_MONO,
          letterSpacing: '0.04em',
        }}>
          © 2026 Polymer Bio
        </span>
      </div>
    </footer>
  );
}
