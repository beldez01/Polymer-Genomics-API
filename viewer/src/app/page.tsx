'use client';

import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE } from '@/config/theme';

const LAYERS = [
  { name: 'Genes',      color: COLOR.layer.gencode_v44,   desc: 'GENCODE v44 \u00B7 63,000 transcripts', href: '/atlas' },
  { name: 'CpG Sites',  color: COLOR.layer.cpg_sites,     desc: 'Islands, shores, shelves \u00B7 28M sites', href: '/view/hg38/chr17:7668421-7687490?layers=cpg_sites' },
  { name: 'Probes',     color: COLOR.layer.probe_epic_v2, desc: 'EPIC v2, v1, 450K arrays', href: '/view/hg38/chr17:7668421-7687490?layers=probe_epic_v2' },
  { name: 'Isochores',  color: COLOR.layer.isochores,     desc: 'GC composition structure', href: '/view/hg38/chr17:7668421-7687490?layers=isochores' },
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
      <BrandBar />

      {/* ─── Hero ─── */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 44px)',
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
        padding: `${SPACE[10]}px 0`,
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
          <Link
            key={layer.name}
            href={layer.href}
            style={{
              textDecoration: 'none',
              cursor: 'pointer',
              borderLeft: '3px solid transparent',
              paddingLeft: SPACE[2],
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderLeftColor = COLOR.accent.teal;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderLeftColor = 'transparent';
            }}
          >
            <div
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
          </Link>
        ))}
      </section>

      {/* ─── Divider ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: `${SPACE[10]}px 0`,
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
          color: COLOR.text.tertiary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
        }}>
          hg38 &middot; hg37 &mdash; Polymer Genomics
        </p>
        <p style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          marginTop: SPACE[3],
        }}>
          Research Use Only &mdash; Not for clinical or diagnostic use
        </p>
        <p style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          marginTop: SPACE[2],
          maxWidth: 500,
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.6,
        }}>
          Data provided as-is without warranty. Not intended as a substitute for professional
          medical advice, diagnosis, or treatment. Reference assembly coordinates may differ
          from clinical-grade annotations. &copy; 2026 Polymer Genomics.
        </p>
      </footer>
    </main>
  );
}
