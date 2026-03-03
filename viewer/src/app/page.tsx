'use client';

import Link from 'next/link';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE } from '@/config/theme';

const LAYERS = [
  { name: 'Genes',      color: COLOR.layer.gencode_v44,   desc: 'GENCODE v44 \u00B7 63,000 transcripts' },
  { name: 'CpG Sites',  color: COLOR.layer.cpg_sites,     desc: 'Islands, shores, shelves \u00B7 28M sites' },
  { name: 'Probes',     color: COLOR.layer.probe_epic_v2, desc: 'EPIC v2, v1, 450K arrays' },
  { name: 'Isochores',  color: COLOR.layer.isochores,     desc: 'GC composition structure' },
] as const;

function GhostButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        padding: `${SPACE[2]}px ${SPACE[6]}px`,
        backgroundColor: 'transparent',
        color: COLOR.text.secondary,
        border: `1px solid ${COLOR.border.strong}`,
        fontWeight: WEIGHT.medium,
        fontSize: TYPE.base.fontSize,
        fontFamily: FONT_FAMILY,
        textDecoration: 'none',
        transition: 'border-color 0.15s, color 0.15s',
        display: 'inline-block',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = COLOR.accent.teal;
        e.currentTarget.style.color = COLOR.accent.teal;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = COLOR.border.strong;
        e.currentTarget.style.color = COLOR.text.secondary;
      }}
    >
      {children}
    </Link>
  );
}

export default function Home() {
  return (
    <main style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh' }}>

      {/* ─── Hero ─── */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: `0 ${SPACE[6]}px`,
        }}
      >
        <h1 style={{
          fontSize: TYPE['2xl'].fontSize,
          fontWeight: WEIGHT.bold,
          letterSpacing: '0.12em',
          color: COLOR.accent.teal,
          fontFamily: FONT_FAMILY,
          marginBottom: SPACE[6],
          textAlign: 'center',
        }}>
          POLYMER GENOMICS
        </h1>

        <p style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          lineHeight: TYPE.base.lineHeight,
          textAlign: 'center',
          marginBottom: SPACE[2],
        }}>
          Curated genomic reference data
        </p>
        <p style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          lineHeight: TYPE.base.lineHeight,
          textAlign: 'center',
          marginBottom: SPACE[10],
        }}>
          Base-pair resolution
        </p>

        <div style={{ display: 'flex', gap: SPACE[6], flexWrap: 'wrap', justifyContent: 'center' }}>
          <GhostButton href="/view/hg38/chr1:100000000-100100000">
            Open Viewer
          </GhostButton>
          <GhostButton href="/atlas">
            Atlas →
          </GhostButton>
          <GhostButton href="/docs">
            API Docs
          </GhostButton>
        </div>
      </section>

      {/* ─── Divider ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: `${SPACE[24]}px 0`,
      }}>
        <div style={{
          width: 120,
          height: 1,
          backgroundColor: COLOR.border.subtle,
        }} />
      </div>

      {/* ─── Data Layers ─── */}
      <section style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: `0 ${SPACE[6]}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE[6],
      }}>
        {LAYERS.map((layer) => (
          <div
            key={layer.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE[4],
            }}
          >
            <div style={{
              width: 10,
              height: 10,
              backgroundColor: layer.color,
              flexShrink: 0,
            }} />
            <span style={{
              color: COLOR.text.primary,
              fontSize: TYPE.md.fontSize,
              fontFamily: FONT_FAMILY,
              fontWeight: WEIGHT.medium,
              flexShrink: 0,
            }}>
              {layer.name}
            </span>
            <span style={{
              color: COLOR.text.tertiary,
              fontSize: TYPE.base.fontSize,
              fontFamily: FONT_FAMILY,
            }}>
              {layer.desc}
            </span>
          </div>
        ))}
      </section>

      {/* ─── Divider ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: `${SPACE[24]}px 0`,
      }}>
        <div style={{
          width: 120,
          height: 1,
          backgroundColor: COLOR.border.subtle,
        }} />
      </div>

      {/* ─── Footer ─── */}
      <footer style={{
        textAlign: 'center',
        paddingBottom: SPACE[12],
      }}>
        <p style={{
          color: COLOR.text.faint,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
        }}>
          hg38 &middot; hg37 &mdash; Polymer Genomics
        </p>
      </footer>
    </main>
  );
}
