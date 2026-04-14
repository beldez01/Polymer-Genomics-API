'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { CLAIMS, CLUSTER_COLORS, type Claim, type Outcome } from '@/config/claims';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, FONT_FAMILY_SANS, SPACE } from '@/config/theme';
import { useIsMobile } from '@/hooks/useBreakpoint';
import {
  MCP_COMPUTE_TOOL_COUNT,
  MCP_REFERENCE_TOOL_COUNT,
  MCP_TOOL_COUNT,
  usePlatformStats,
} from '@/lib/platform-stats';

/* ────────────────────────────────────────────────────────────────────────────
   Module directory — accent colors preserved as semantic identity
   (small dots only; no decorative stripes on the landing page)
   ──────────────────────────────────────────────────────────────────────────── */

const VIEWER_HREF = '/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites,probe_epic_v2,isochores';

interface Module {
  name: string;
  desc: string;
  href: string;
  accent: string;
  /** Short count label surfaced on the right of the row (e.g., "63K txs", "70 tools") */
  count?: string;
}

const MODULES_BROWSE: Module[] = [
  {
    name: 'Genome Viewer',
    desc: 'Browse any locus with biophysics layers — stacking energy, curvature, CpG density, isochores. hg38 + hg37.',
    href: VIEWER_HREF,
    accent: COLOR.accent.teal,
    count: '50 layers',
  },
  {
    name: 'Atlas',
    desc: 'GENCODE v44 gene profiles with expression, pathways, constraint, biosynthetic cost.',
    href: '/atlas',
    accent: COLOR.layer.gencode_v44,
    count: '63K txs',
  },
];

const MODULES_ANALYZE: Module[] = [
  {
    name: 'Evaluate',
    desc: 'Physics linter for any DNA sequence. Thermodynamic profile, CpG islands, structural flags, batch mode.',
    href: '/evaluate',
    accent: COLOR.layer.gene_costs_v1,
    count: '13 flags',
  },
  {
    name: 'Methylation',
    desc: 'DMP volcano and manhattan plots, TE/ERV family scoring, reactivation risk, Retro-Age clock.',
    href: '/dmp',
    accent: COLOR.accent.rose,
    count: '937K probes',
  },
  {
    name: 'Epigenetic Clocks',
    desc: 'Probe anatomy, cross-clock comparison, coefficient application.',
    href: '/clocks',
    accent: COLOR.accent.amber,
    count: '6 clocks',
  },
  {
    name: 'Transposome',
    desc: 'Transposable elements with TE age, awakening potential, EPIC v2 probe overlap.',
    href: '/transposome',
    accent: COLOR.accent.violet,
    count: '5.6M TEs',
  },
  {
    name: 'HLA',
    desc: 'Allele biophysics for transplant loci. Non-coding divergence, expression mismatch scoring.',
    href: '/hla',
    accent: COLOR.layer.gencode_v44,
    count: '6 loci',
  },
];

const MODULES_BUILD: Module[] = [
  {
    name: 'API & MCP',
    desc: `${MCP_REFERENCE_TOOL_COUNT} reference + ${MCP_COMPUTE_TOOL_COUNT} compute. REST endpoints and Model Context Protocol for AI agents.`,
    href: '/docs',
    accent: COLOR.accent.teal,
    count: `${MCP_TOOL_COUNT} tools`,
  },
  {
    name: 'Developers',
    desc: 'Quickstart, code examples, try-it evaluator, data inventory.',
    href: '/developers',
    accent: COLOR.accent.teal,
    count: 'Python · R · curl',
  },
];

/* ────────────────────────────────────────────────────────────────────────────
   Primitives
   ──────────────────────────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: COLOR.text.muted,
      fontSize: 10,
      fontFamily: FONT_FAMILY,
      fontWeight: WEIGHT.medium,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      marginBottom: SPACE[6],
    }}>
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Latest Dispatches — claim feed surface between modules and thesis
   ──────────────────────────────────────────────────────────────────────────── */

function outcomeBadge(outcome: Outcome): { label: string; color: string } {
  switch (outcome) {
    case 'strong_positive':    return { label: 'STRONG POS', color: COLOR.accent.teal };
    case 'positive':           return { label: 'POSITIVE',   color: COLOR.accent.teal };
    case 'qualified_positive': return { label: 'QUALIFIED',  color: COLOR.accent.amber };
    case 'negative':           return { label: 'NEGATIVE',   color: COLOR.accent.rose };
    case 'fail':               return { label: 'FAIL',       color: COLOR.accent.rose };
    default:                   return { label: String(outcome).toUpperCase(), color: COLOR.text.muted };
  }
}

function formatDispatchDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${month} ${day}`;
}

function DispatchRow({ claim, isMobile }: { claim: Claim; isMobile: boolean }) {
  const badge = outcomeBadge(claim.outcome);
  const dateLabel = formatDispatchDate(claim.posted_at);
  const expLabel = `Exp ${claim.exp_number.toString().padStart(2, '0')}`;
  const clusterColor = CLUSTER_COLORS[claim.cluster];

  return (
    <Link
      href="/newsroom"
      className="module-row"
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '14px 1fr 20px' : '14px 140px 1fr auto 20px',
        columnGap: SPACE[4],
        rowGap: SPACE[1],
        alignItems: 'baseline',
        padding: `${SPACE[4]}px ${SPACE[1]}px`,
        borderBottom: `1px solid ${COLOR.border.subtle}`,
        textDecoration: 'none',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          backgroundColor: clusterColor,
          alignSelf: 'center',
          justifySelf: 'center',
        }}
      />

      {!isMobile && (
        <span style={{
          color: COLOR.text.muted,
          fontFamily: FONT_FAMILY,
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}>
          {dateLabel} <span style={{ color: COLOR.border.strong }}>·</span> {expLabel}
        </span>
      )}

      {isMobile ? (
        <span style={{
          gridColumn: '2 / 3',
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE[1],
        }}>
          <span style={{
            color: COLOR.text.muted,
            fontFamily: FONT_FAMILY,
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}>
            {dateLabel} <span style={{ color: COLOR.border.strong }}>·</span> {expLabel}
          </span>
          <span
            className="module-row-name"
            style={{
              color: COLOR.text.secondary,
              fontFamily: FONT_FAMILY_SANS,
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: '-0.005em',
              lineHeight: 1.35,
            }}
          >
            {claim.title}
          </span>
          <span style={{
            color: badge.color,
            fontFamily: FONT_FAMILY,
            fontSize: 9,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: WEIGHT.medium,
          }}>
            {badge.label}
          </span>
        </span>
      ) : (
        <>
          <span
            className="module-row-name"
            style={{
              color: COLOR.text.secondary,
              fontFamily: FONT_FAMILY_SANS,
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: '-0.005em',
              lineHeight: 1.4,
            }}
          >
            {claim.title}
          </span>
          <span
            className="module-row-count"
            style={{
              padding: '2px 8px',
              border: `1px solid ${badge.color}55`,
              color: badge.color,
              fontFamily: FONT_FAMILY,
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: WEIGHT.medium,
              whiteSpace: 'nowrap',
              alignSelf: 'center',
            }}
          >
            {badge.label}
          </span>
        </>
      )}

      <span
        aria-hidden
        className="module-row-arrow"
        style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          justifySelf: 'end',
          alignSelf: 'center',
        }}
      >
        →
      </span>
    </Link>
  );
}

function LatestDispatches({ isMobile }: { isMobile: boolean }) {
  const latest = useMemo(() => {
    return [...CLAIMS]
      .sort((a, b) => b.posted_at.localeCompare(a.posted_at))
      .slice(0, 3);
  }, []);

  if (latest.length === 0) return null;

  return (
    <div style={{ marginBottom: SPACE[12] }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: SPACE[3],
        paddingBottom: SPACE[3],
        marginBottom: SPACE[2],
        borderBottom: `1px solid ${COLOR.border.default}`,
      }}>
        <span style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY,
          fontSize: 10,
          letterSpacing: '0.14em',
        }}>
          04
        </span>
        <span style={{
          color: COLOR.text.secondary,
          fontFamily: FONT_FAMILY,
          fontSize: 12,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>
          Latest dispatches
        </span>
        <span style={{ flex: 1 }} />
        <Link
          href="/newsroom"
          style={{
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY,
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.accent.teal; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.text.tertiary; }}
        >
          View all →
        </Link>
      </div>

      {/* Rows */}
      <div>
        {latest.map((c) => <DispatchRow key={c.id} claim={c} isMobile={isMobile} />)}
      </div>
    </div>
  );
}

function ModuleGroup({
  index,
  label,
  modules,
  isMobile,
}: {
  index: string;
  label: string;
  modules: Module[];
  isMobile: boolean;
}) {
  return (
    <div style={{ marginBottom: SPACE[12] }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: SPACE[3],
        paddingBottom: SPACE[3],
        marginBottom: SPACE[2],
        borderBottom: `1px solid ${COLOR.border.default}`,
      }}>
        <span style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY,
          fontSize: 10,
          letterSpacing: '0.14em',
        }}>
          {index}
        </span>
        <span style={{
          color: COLOR.text.secondary,
          fontFamily: FONT_FAMILY,
          fontSize: 12,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>
      <div>
        {modules.map((m) => <ModuleRow key={m.name} mod={m} isMobile={isMobile} />)}
      </div>
    </div>
  );
}

function PrimaryCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACE[2],
        padding: `${SPACE[3]}px ${SPACE[5]}px`,
        border: `1px solid ${COLOR.accent.teal}`,
        backgroundColor: 'rgba(78, 205, 196, 0.06)',
        color: COLOR.accent.teal,
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.04em',
        textDecoration: 'none',
        transition: 'background-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(78, 205, 196, 0.14)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(78, 205, 196, 0.06)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

function SecondaryCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACE[2],
        padding: `${SPACE[3]}px ${SPACE[5]}px`,
        border: `1px solid ${COLOR.border.strong}`,
        color: COLOR.text.secondary,
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.04em',
        textDecoration: 'none',
        transition: 'border-color 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = COLOR.text.secondary;
        e.currentTarget.style.color = COLOR.text.primary;
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

function InstallSnippet() {
  const [copied, setCopied] = useState(false);
  const cmd = 'pip install polymer-genomics';
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable — silently no-op */ }
  };
  return (
    <button
      onClick={onCopy}
      aria-label="Copy install command"
      className="brand-nav-scroll"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACE[3],
        padding: `${SPACE[2]}px ${SPACE[4]}px`,
        backgroundColor: COLOR.bg.elevated,
        border: `1px solid ${COLOR.border.default}`,
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        cursor: 'pointer',
        transition: 'border-color 0.15s, background-color 0.15s',
        maxWidth: '100%',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = COLOR.border.strong;
        e.currentTarget.style.backgroundColor = COLOR.bg.surface;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = COLOR.border.default;
        e.currentTarget.style.backgroundColor = COLOR.bg.elevated;
      }}
    >
      <span style={{ color: COLOR.text.faint, userSelect: 'none' }}>$</span>
      <span style={{ color: COLOR.text.secondary }}>{cmd}</span>
      <span
        style={{
          color: copied ? COLOR.accent.teal : COLOR.text.muted,
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          transition: 'color 0.15s',
        }}
      >
        {copied ? 'copied ✓' : 'copy'}
      </span>
    </button>
  );
}

function TrustStrip() {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: SPACE[3],
      fontFamily: FONT_FAMILY,
      fontSize: 11,
      color: COLOR.text.muted,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    }}>
      <InstallSnippet />
      <span style={{ color: COLOR.border.strong }}>·</span>
      <a
        href="https://pypi.org/project/polymer-genomics/"
        target="_blank"
        rel="noreferrer"
        style={{ color: COLOR.text.muted, textDecoration: 'none', transition: 'color 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.accent.teal; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.text.muted; }}
      >
        PyPI ↗
      </a>
      <span style={{ color: COLOR.border.strong }}>·</span>
      <Link
        href="/terms"
        style={{ color: COLOR.text.muted, textDecoration: 'none', transition: 'color 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.accent.teal; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.text.muted; }}
      >
        Research use only
      </Link>
    </div>
  );
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACE[1],
        color: COLOR.text.tertiary,
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        textDecoration: 'none',
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.accent.teal; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.text.tertiary; }}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

function ModuleRow({ mod, isMobile }: { mod: Module; isMobile: boolean }) {
  return (
    <Link
      href={mod.href}
      className="module-row"
      style={{
        display: 'grid',
        // Desktop: [dot] [name 180] [desc 1fr] [count auto] [→ 20]
        // Mobile:  [dot] [name 1fr] [→ 20]  — desc + count stack below on row 2
        gridTemplateColumns: isMobile ? '14px 1fr 20px' : '14px 180px 1fr auto 20px',
        columnGap: SPACE[4],
        rowGap: SPACE[1],
        alignItems: 'baseline',
        padding: `${SPACE[4]}px ${SPACE[1]}px`,
        borderBottom: `1px solid ${COLOR.border.subtle}`,
        textDecoration: 'none',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          backgroundColor: mod.accent,
          alignSelf: 'center',
          justifySelf: 'center',
        }}
      />
      <span
        className="module-row-name"
        style={{
          color: COLOR.text.secondary,
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.02em',
        }}
      >
        {mod.name}
      </span>

      {isMobile ? (
        /* Row 2 on mobile: description + count inline */
        <span style={{
          gridColumn: '2 / 3',
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE[1],
        }}>
          <span style={{
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_SANS,
            fontSize: 14,
            lineHeight: 1.5,
          }}>
            {mod.desc}
          </span>
          {mod.count && (
            <span style={{
              color: COLOR.text.muted,
              fontFamily: FONT_FAMILY,
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}>
              {mod.count}
            </span>
          )}
        </span>
      ) : (
        <>
          <span style={{
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_SANS,
            fontSize: 14,
            lineHeight: 1.5,
          }}>
            {mod.desc}
          </span>
          <span
            className="module-row-count"
            style={{
              color: COLOR.text.muted,
              fontFamily: FONT_FAMILY,
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              justifySelf: 'end',
              whiteSpace: 'nowrap',
              alignSelf: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {mod.count ?? ''}
          </span>
        </>
      )}

      <span
        aria-hidden
        className="module-row-arrow"
        style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          justifySelf: 'end',
          alignSelf: 'center',
        }}
      >
        →
      </span>
    </Link>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Hero visualization — inline SVG
   Three stacked tracks: stacking ΔG trace · CpG ticks · gene body
   Decorative, deterministic, sized to feel real.
   ──────────────────────────────────────────────────────────────────────────── */

function HeroViz() {
  /* Layout */
  const W = 720;
  const H = 260;
  const MARGIN_L = 72;   // axis labels live here
  const MARGIN_R = 8;
  const PLOT_W = W - MARGIN_L - MARGIN_R;

  /* Track geometry */
  const T1 = { top: 20, h: 88 };   // stacking ΔG
  const T2 = { top: 124, h: 28 };  // CpG density
  const T3 = { top: 168, h: 22 };  // gene body
  const AXIS_Y = 212;

  /* Deterministic sum-of-sines + seeded pseudo-noise */
  const SAMPLES = 280;
  const hash = (i: number) => {
    const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  const trace = Array.from({ length: SAMPLES }, (_, i) => {
    const t = i / (SAMPLES - 1);
    // Multi-scale: slow wave + mid frequency + micro noise
    const slow = Math.sin(t * Math.PI * 2.1 - 0.4) * 0.34;
    const mid  = Math.sin(t * Math.PI * 7.3 + 0.9) * 0.19;
    const fast = Math.sin(t * Math.PI * 19 - 1.7) * 0.08;
    const noise = (hash(i) - 0.5) * 0.14;
    // Normalize to [0.1, 0.9] band
    const norm = Math.max(0.08, Math.min(0.92, 0.5 + slow + mid + fast + noise));
    const x = MARGIN_L + t * PLOT_W;
    const y = T1.top + (1 - norm) * T1.h;
    return { x, y };
  });

  const tracePath = 'M ' + trace.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ');
  const fillPath =
    `M ${MARGIN_L} ${T1.top + T1.h} ` +
    'L ' + trace.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ') +
    ` L ${MARGIN_L + PLOT_W} ${T1.top + T1.h} Z`;

  // Round to 2 decimals to keep SSR/client serialization identical (avoids hydration mismatch)
  const r2 = (n: number) => Math.round(n * 100) / 100;

  /* CpG density — dense island cluster + scattered singletons */
  const islandCenter = r2(MARGIN_L + PLOT_W * 0.12);
  const islandCpGs = Array.from({ length: 38 }, (_, i) => {
    const jitter = (hash(i + 400) - 0.5) * 1.6;
    return r2(islandCenter + (i - 19) * 2.3 + jitter);
  });
  const scatteredCpGs = [
    0.22, 0.27, 0.33, 0.38, 0.44, 0.49, 0.54, 0.59, 0.63, 0.68,
    0.72, 0.76, 0.80, 0.83, 0.86, 0.89, 0.92, 0.95, 0.97,
  ].map((t) => r2(MARGIN_L + t * PLOT_W + (hash(Math.round(t * 1000)) - 0.5) * 3));

  /* TP53-like gene body — proportional layout, 11 exons + introns */
  const geneStart = r2(MARGIN_L + PLOT_W * 0.055);
  const geneEnd   = r2(MARGIN_L + PLOT_W * 0.965);
  const exonDefs: Array<[number, number]> = [
    // [relative start, relative width] within gene span
    [0.000, 0.022],
    [0.095, 0.018],
    [0.165, 0.030],
    [0.235, 0.020],
    [0.290, 0.028],
    [0.360, 0.018],
    [0.415, 0.035],
    [0.500, 0.022],
    [0.570, 0.038],
    [0.670, 0.022],
    [0.740, 0.260],
  ];
  const geneSpan = geneEnd - geneStart;
  const exons = exonDefs.map(([s, w]) => ({
    x: r2(geneStart + s * geneSpan),
    w: r2(w * geneSpan),
  }));

  /* Coordinate axis ticks */
  const axisTicks = [0, 0.25, 0.5, 0.75, 1.0].map((t) => ({
    x: r2(MARGIN_L + t * PLOT_W),
    label: `${(7668 + t * (7687 - 7668)).toFixed(0)} kb`,
  }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: 'block' }}
      role="img"
      aria-label="Biophysical profile over TP53 locus: stacking free energy, CpG density, exon structure"
    >
      <defs>
        <linearGradient id="traceFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={COLOR.accent.teal} stopOpacity="0.22" />
          <stop offset="100%" stopColor={COLOR.accent.teal} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* ─── Track 1: Stacking ΔG ─── */}
      {/* Horizontal gridlines (subtle) */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={MARGIN_L}
          x2={MARGIN_L + PLOT_W}
          y1={T1.top + T1.h * f}
          y2={T1.top + T1.h * f}
          stroke={COLOR.border.subtle}
          strokeWidth="1"
          strokeDasharray={f === 0.5 ? undefined : '2 3'}
        />
      ))}
      {/* Left border */}
      <line x1={MARGIN_L} x2={MARGIN_L} y1={T1.top} y2={T1.top + T1.h} stroke={COLOR.border.default} strokeWidth="1" />

      {/* Trace */}
      <path d={fillPath} fill="url(#traceFill)" />
      <path d={tracePath} fill="none" stroke={COLOR.accent.teal} strokeWidth="1.25" strokeLinejoin="round" />

      {/* Track label + y-scale */}
      <text x="0" y={T1.top + 4} fontFamily={FONT_FAMILY} fontSize="9" fill={COLOR.text.muted} letterSpacing="0.12em">
        STACKING
      </text>
      <text x="0" y={T1.top + 16} fontFamily={FONT_FAMILY} fontSize="9" fill={COLOR.text.muted} letterSpacing="0.12em">
        ΔG₃₇
      </text>
      <text x={MARGIN_L - 6} y={T1.top + 4} textAnchor="end" fontFamily={FONT_FAMILY} fontSize="8" fill={COLOR.text.faint}>
        −7.2
      </text>
      <text x={MARGIN_L - 6} y={T1.top + T1.h + 2} textAnchor="end" fontFamily={FONT_FAMILY} fontSize="8" fill={COLOR.text.faint}>
        −9.8
      </text>
      <text x={W - MARGIN_R} y={T1.top + 4} textAnchor="end" fontFamily={FONT_FAMILY} fontSize="8" fill={COLOR.text.faint}>
        kcal/mol
      </text>

      {/* ─── Track 2: CpG density ─── */}
      {/* Island shading */}
      <rect
        x={islandCenter - 46}
        y={T2.top - 2}
        width="92"
        height={T2.h + 4}
        fill="rgba(78, 205, 196, 0.05)"
      />
      {/* Track baseline */}
      <line x1={MARGIN_L} x2={MARGIN_L + PLOT_W} y1={T2.top + T2.h} y2={T2.top + T2.h} stroke={COLOR.border.default} strokeWidth="1" />
      {/* CpG ticks — island cluster (denser, taller) */}
      {islandCpGs.map((x, i) => (
        <line
          key={`isl-${i}`}
          x1={x}
          x2={x}
          y1={T2.top + 4}
          y2={T2.top + T2.h}
          stroke={COLOR.accent.teal}
          strokeWidth="1"
          strokeOpacity="0.75"
        />
      ))}
      {/* Scattered CpGs (shorter, muted) */}
      {scatteredCpGs.map((x, i) => (
        <line
          key={`sc-${i}`}
          x1={x}
          x2={x}
          y1={T2.top + 12}
          y2={T2.top + T2.h}
          stroke={COLOR.text.muted}
          strokeWidth="1"
          strokeOpacity="0.55"
        />
      ))}
      {/* Labels */}
      <text x="0" y={T2.top + 10} fontFamily={FONT_FAMILY} fontSize="9" fill={COLOR.text.muted} letterSpacing="0.12em">
        CpG
      </text>
      <text x="0" y={T2.top + 22} fontFamily={FONT_FAMILY} fontSize="9" fill={COLOR.text.muted} letterSpacing="0.12em">
        SITES
      </text>
      <text x={islandCenter} y={T2.top - 4} textAnchor="middle" fontFamily={FONT_FAMILY} fontSize="8" fill={COLOR.accent.teal}>
        island
      </text>

      {/* ─── Track 3: Gene body ─── */}
      {/* Intron backbone with directionality chevrons */}
      <line x1={geneStart} x2={geneEnd} y1={T3.top + T3.h / 2} y2={T3.top + T3.h / 2} stroke={COLOR.text.muted} strokeWidth="1" />
      {Array.from({ length: 14 }, (_, i) => {
        const cx = r2(geneStart + (i + 0.5) * (geneSpan / 14));
        const cy = T3.top + T3.h / 2;
        return (
          <path
            key={`chev-${i}`}
            d={`M ${cx - 2} ${cy - 3} L ${cx + 1} ${cy} L ${cx - 2} ${cy + 3}`}
            fill="none"
            stroke={COLOR.text.muted}
            strokeWidth="0.8"
            strokeOpacity="0.7"
          />
        );
      })}
      {/* Exons */}
      {exons.map((ex, i) => (
        <rect
          key={`ex-${i}`}
          x={ex.x}
          y={T3.top + 2}
          width={Math.max(2, ex.w)}
          height={T3.h - 4}
          fill={COLOR.text.primary}
        />
      ))}
      {/* Labels */}
      <text x="0" y={T3.top + 7} fontFamily={FONT_FAMILY} fontSize="9" fill={COLOR.text.muted} letterSpacing="0.12em">
        TP53
      </text>
      <text x="0" y={T3.top + 19} fontFamily={FONT_FAMILY} fontSize="9" fill={COLOR.text.faint} letterSpacing="0.12em">
        11 EX
      </text>

      {/* ─── Coordinate axis ─── */}
      <line x1={MARGIN_L} x2={MARGIN_L + PLOT_W} y1={AXIS_Y} y2={AXIS_Y} stroke={COLOR.border.strong} strokeWidth="1" />
      {axisTicks.map((tk, i) => (
        <g key={`ax-${i}`}>
          <line x1={tk.x} x2={tk.x} y1={AXIS_Y} y2={AXIS_Y + 4} stroke={COLOR.border.strong} strokeWidth="1" />
          <text
            x={tk.x}
            y={AXIS_Y + 16}
            textAnchor={i === 0 ? 'start' : i === axisTicks.length - 1 ? 'end' : 'middle'}
            fontFamily={FONT_FAMILY}
            fontSize="9"
            fill={COLOR.text.faint}
          >
            {i === 0 ? 'chr17 : 7,668,421' : i === axisTicks.length - 1 ? '7,687,490' : tk.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────────────────────── */

export default function Home() {
  const isMobile = useIsMobile();
  const stats = usePlatformStats();

  const STATS = [
    { value: '50', label: 'layers' },
    { value: stats.cpg, label: 'CpG sites' },
    { value: stats.probes, label: 'probes' },
    { value: stats.transcripts, label: 'transcripts' },
    { value: stats.mcpTools, label: 'MCP tools' },
  ];

  return (
    <main style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh' }}>
      <BrandBar />

      {/* ─────────────────────────────────────────────────────────────────
          HERO — single column, tight, answers "what/do/trust" in 3 seconds
          ───────────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 880,
        margin: '0 auto',
        padding: isMobile ? `${SPACE[16]}px ${SPACE[5]}px ${SPACE[10]}px` : `${SPACE[24]}px ${SPACE[6]}px ${SPACE[12]}px`,
      }}>
        {/* Eyebrow */}
        <div style={{
          color: COLOR.accent.teal,
          fontFamily: FONT_FAMILY,
          fontSize: 10,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          marginBottom: SPACE[5],
        }}>
          Genome-wide DNA biophysics · hg38 + hg37
        </div>

        {/* Wordmark */}
        <h1 style={{
          margin: 0,
          fontFamily: FONT_FAMILY,
          fontSize: isMobile ? 32 : 44,
          fontWeight: WEIGHT.bold,
          letterSpacing: '0.08em',
          color: COLOR.text.primary,
          marginBottom: SPACE[6],
          lineHeight: 1.1,
        }}>
          POLYMER GENOMICS
        </h1>

        {/* Value prop — sans, generous, high-contrast */}
        <p
          className="prose-sans"
          style={{
            margin: 0,
            maxWidth: 620,
            color: COLOR.text.secondary,
            fontSize: isMobile ? 17 : 19,
            lineHeight: 1.5,
            marginBottom: SPACE[10],
            fontWeight: 400,
            letterSpacing: '-0.005em',
          }}
        >
          The material channel of the genome — stacking energy, curvature, flexibility,
          groove geometry — computed at base-pair resolution and cross-indexed with{' '}
          <span style={{ color: COLOR.text.primary }}>50 genomic layers</span>. Queryable
          by humans and by agents.
        </p>

        {/* CTAs */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: SPACE[3],
          alignItems: 'center',
          marginBottom: SPACE[12],
        }}>
          <PrimaryCTA href={VIEWER_HREF}>Open the viewer</PrimaryCTA>
          <SecondaryCTA href="/evaluate">Evaluate a sequence</SecondaryCTA>
          <div style={{ marginLeft: isMobile ? 0 : SPACE[2] }}>
            <TextLink href="/docs">API &amp; MCP for agents</TextLink>
          </div>
        </div>

        {/* Trust strip — install snippet + PyPI + RUO */}
        <div style={{ marginBottom: SPACE[10] }}>
          <TrustStrip />
        </div>

        {/* Hero viz */}
        <div style={{
          border: `1px solid ${COLOR.border.default}`,
          backgroundColor: COLOR.bg.elevated,
          padding: isMobile ? SPACE[4] : SPACE[6],
          marginBottom: SPACE[8],
        }}>
          <HeroViz />
        </div>

        {/* Stats strip — quiet, mono, under the viz */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: isMobile ? SPACE[4] : SPACE[6],
          color: COLOR.text.muted,
          fontFamily: FONT_FAMILY,
          fontSize: 12,
          letterSpacing: '0.02em',
        }}>
          {STATS.map((s, i) => (
            <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE[4] }}>
              {i > 0 && <span style={{ color: COLOR.border.strong }}>·</span>}
              <span>
                <span style={{ color: COLOR.text.primary, fontWeight: WEIGHT.medium }}>{s.value}</span>{' '}
                <span>{s.label}</span>
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          MODULES — hairline-divided rows, editorial rather than card-grid
          ───────────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 880,
        margin: '0 auto',
        padding: isMobile ? `${SPACE[10]}px ${SPACE[5]}px` : `${SPACE[16]}px ${SPACE[6]}px`,
      }}>
        <ModuleGroup index="01" label="Browse"  modules={MODULES_BROWSE}  isMobile={isMobile} />
        <ModuleGroup index="02" label="Analyze" modules={MODULES_ANALYZE} isMobile={isMobile} />
        <ModuleGroup index="03" label="Build"   modules={MODULES_BUILD}   isMobile={isMobile} />
        <LatestDispatches isMobile={isMobile} />
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          THESIS — moved below the fold, full sans for readability
          ───────────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: isMobile ? `${SPACE[10]}px ${SPACE[5]}px` : `${SPACE[16]}px ${SPACE[6]}px`,
        borderTop: `1px solid ${COLOR.border.subtle}`,
      }}>
        <SectionLabel>Thesis</SectionLabel>

        <div className="prose-sans" style={{
          color: COLOR.text.secondary,
          fontSize: 16,
          lineHeight: 1.65,
        }}>
          <p style={{ marginTop: 0, marginBottom: SPACE[5] }}>
            The central dogma describes how <em>sequence</em> information flows between
            biopolymers — DNA to RNA to protein — and the asymmetries that constrain that flow.
            It is correct as far as it goes. Its scope, however, is sequence; the molecule
            carrying those sequences is also a physical object, and the dogma is silent on
            that channel.
          </p>

          <p style={{ marginTop: 0, marginBottom: SPACE[5] }}>
            DNA is a heteropolymer: a chain of monomers with position-dependent
            physical-chemical properties. Every base-pair step has a stacking energy, a melting
            temperature, an intrinsic curvature, a flexibility. An AT-rich region and a GC-rich
            region are, in the language of polymer physics, <em>different materials</em>.
          </p>

          <p style={{ marginTop: 0, marginBottom: SPACE[8] }}>
            That gives two information channels on one molecule. The{' '}
            <strong style={{ color: COLOR.text.primary, fontWeight: 600 }}>symbolic channel</strong>{' '}
            maps codons, motifs, and recognition sites to discrete decoded outcomes —
            localized in the genome, decoder-dependent. The{' '}
            <strong style={{ color: COLOR.accent.teal, fontWeight: 600 }}>material channel</strong>{' '}
            maps sequence to a continuous energy surface — self-executing, present across the
            entire genome, physically prior to the genetic code by billions of years. This site
            computes the second one.
          </p>
        </div>

        {/* Two channels comparison */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: SPACE[4],
          marginBottom: SPACE[8],
        }}>
          <div style={{
            borderTop: `1px solid ${COLOR.border.strong}`,
            paddingTop: SPACE[4],
          }}>
            <div style={{
              color: COLOR.text.muted,
              fontFamily: FONT_FAMILY,
              fontSize: 10,
              fontWeight: WEIGHT.medium,
              letterSpacing: '0.16em',
              marginBottom: SPACE[3],
            }}>
              σ — SYMBOLIC
            </div>
            {['Codons, motifs, recognition sites', 'Localized in the genome', 'Decoder-dependent', 'Largely described by the central dogma'].map((l) => (
              <div key={l} style={{
                color: COLOR.text.tertiary,
                fontFamily: FONT_FAMILY_SANS,
                fontSize: 14,
                lineHeight: 1.8,
              }}>
                {l}
              </div>
            ))}
          </div>

          <div style={{
            borderTop: `1px solid ${COLOR.accent.teal}`,
            paddingTop: SPACE[4],
          }}>
            <div style={{
              color: COLOR.accent.teal,
              fontFamily: FONT_FAMILY,
              fontSize: 10,
              fontWeight: WEIGHT.medium,
              letterSpacing: '0.16em',
              marginBottom: SPACE[3],
            }}>
              Λ — MATERIAL
            </div>
            {['Sequence → energy surface', '100% of the genome', 'Self-executing (physics)', 'Computed here'].map((l) => (
              <div key={l} style={{
                color: COLOR.text.secondary,
                fontFamily: FONT_FAMILY_SANS,
                fontSize: 14,
                lineHeight: 1.8,
              }}>
                {l}
              </div>
            ))}
          </div>
        </div>

        <p style={{
          fontFamily: FONT_FAMILY_SANS,
          color: COLOR.text.muted,
          fontSize: 13,
          fontStyle: 'italic',
          lineHeight: 1.6,
          marginTop: SPACE[8],
          marginBottom: 0,
        }}>
          Under active construction. New layers and tools added continuously.
          A full elaboration of the theoretical framework is in preparation.
        </p>
      </section>

      <Footer />
    </main>
  );
}
