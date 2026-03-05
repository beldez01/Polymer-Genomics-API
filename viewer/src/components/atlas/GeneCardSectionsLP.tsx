'use client';

/**
 * GeneCard Sections L–P
 *
 * L — Evolutionary Constraint (gnomAD pLI/LOEUF)
 * M — Protein Abundance (PaxDb tissue PPM)
 * N — Protein Atlas (HPA tissue + subcellular)
 * O — Pathways (Reactome)
 * P — Gene Sets (MSigDB Hallmark fingerprint)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  COLOR,
  SPACE,
  FONT_FAMILY,
  COMPONENT,
} from '@/config/theme';
import { GC_TYPE } from './GeneCardData';
import type {
  GeneConstraintData,
  ProteinAbundanceData,
  ProteinAtlasData,
  GenePathwaysData,
  GeneSetsData,
} from '@/lib/api';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{
      ...COMPONENT.sectionHeader,
      fontSize: GC_TYPE.sm,
      letterSpacing: '0.1em',
      textTransform: 'uppercase' as const,
      marginBottom: SPACE[1],
      display: 'flex',
      alignItems: 'baseline',
      gap: SPACE[3],
    }}>
      {title}
      {subtitle && (
        <span style={{
          color: COLOR.text.muted,
          fontSize: GC_TYPE.xs,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.02em',
          textTransform: 'none' as const,
          fontWeight: 400,
        }}>
          {subtitle}
        </span>
      )}
    </div>
  );
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.subtle}`,
      padding: `${SPACE[4]}px ${SPACE[5]}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE[3],
    }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// L — Evolutionary Constraint
// ---------------------------------------------------------------------------

// Constraint interpretation helpers
function pliInterpretation(pli: number): { label: string; color: string } {
  if (pli >= 0.9) return { label: 'Extremely intolerant of LoF', color: COLOR.accent.rose };
  if (pli >= 0.5) return { label: 'LoF-intolerant', color: COLOR.accent.amber };
  return { label: 'LoF-tolerant', color: COLOR.accent.teal };
}

function loeufInterpretation(loeuf: number): { label: string; color: string } {
  if (loeuf <= 0.35) return { label: 'Highly constrained', color: COLOR.accent.rose };
  if (loeuf <= 0.6) return { label: 'Constrained', color: COLOR.accent.amber };
  return { label: 'Unconstrained', color: COLOR.accent.teal };
}

export function ConstraintSection({ data }: { data: GeneConstraintData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  const c = data.constraint;

  const GAUGE_H = 140;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = GAUGE_H;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = COLOR.bg.track;
    ctx.fillRect(0, 0, W, H);

    const MID = W / 2;
    const COL_W = MID - 24;

    // ─── LEFT: pLI ring gauge ───
    const ringCx = MID / 2;
    const ringCy = 62;
    const ringR = 38;
    const ringW = 10;
    const pli = c.pli ?? 0;

    // Background ring
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = COLOR.border.default;
    ctx.lineWidth = ringW;
    ctx.stroke();

    // Value arc (starts from top, clockwise)
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + pli * Math.PI * 2;
    const interp = pliInterpretation(pli);
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringR, startAngle, endAngle);
    ctx.strokeStyle = interp.color;
    ctx.lineWidth = ringW;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Center text
    ctx.font = `bold ${GC_TYPE.lg}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.primary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pli.toFixed(2), ringCx, ringCy - 4);

    ctx.font = `${GC_TYPE.xs - 1}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.muted;
    ctx.fillText('pLI', ringCx, ringCy + 14);

    // Label below
    ctx.font = `${GC_TYPE.xs}px ${FONT_FAMILY}`;
    ctx.fillStyle = interp.color;
    ctx.fillText(interp.label, ringCx, ringCy + ringR + 20);

    // ─── RIGHT: LOEUF + Z-scores ───
    const rightX = MID + 16;
    const barH = 8;
    const barMaxW = COL_W - 60;

    // LOEUF bar
    const loeuf = c.loeuf ?? 0;
    const loeufInterp = loeufInterpretation(loeuf);
    let yPos = 18;

    ctx.font = `${GC_TYPE.xs}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.muted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOEUF', rightX, yPos);

    ctx.fillStyle = COLOR.border.default;
    ctx.fillRect(rightX + 52, yPos - barH / 2, barMaxW, barH);

    const loeufPct = Math.min(1, loeuf / 2);
    ctx.fillStyle = loeufInterp.color;
    ctx.fillRect(rightX + 52, yPos - barH / 2, loeufPct * barMaxW, barH);

    ctx.fillStyle = COLOR.text.secondary;
    ctx.textAlign = 'right';
    ctx.fillText(loeuf.toFixed(2), rightX + 52 + barMaxW + 4, yPos);

    ctx.font = `${GC_TYPE.xs - 1}px ${FONT_FAMILY}`;
    ctx.fillStyle = loeufInterp.color;
    ctx.textAlign = 'left';
    yPos += 16;
    ctx.fillText(loeufInterp.label, rightX + 52, yPos);

    // Z-scores (mis_z and syn_z) — horizontal signed bars
    const zScores = [
      { label: 'mis_z', value: c.mis_z },
      { label: 'syn_z', value: c.syn_z },
    ];

    yPos += 22;
    const zBarMaxW = (barMaxW - 20) / 2; // half-width for each direction
    const zCenter = rightX + 52 + barMaxW / 2;

    for (const z of zScores) {
      if (z.value == null) continue;

      ctx.font = `${GC_TYPE.xs}px ${FONT_FAMILY}`;
      ctx.fillStyle = COLOR.text.muted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(z.label, rightX, yPos);

      // Zero line
      ctx.strokeStyle = COLOR.border.strong;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(zCenter, yPos - barH / 2 - 1);
      ctx.lineTo(zCenter, yPos + barH / 2 + 1);
      ctx.stroke();

      // Background
      ctx.fillStyle = COLOR.border.default;
      ctx.fillRect(rightX + 52, yPos - barH / 2, barMaxW, barH);

      // Value bar — positive goes right, negative goes left
      const clampedZ = Math.max(-6, Math.min(6, z.value));
      const barPx = (Math.abs(clampedZ) / 6) * zBarMaxW;
      const barColor = z.value > 3 ? COLOR.accent.rose : z.value > 1 ? COLOR.accent.amber : COLOR.accent.teal;

      if (clampedZ >= 0) {
        ctx.fillStyle = barColor;
        ctx.fillRect(zCenter, yPos - barH / 2, barPx, barH);
      } else {
        ctx.fillStyle = barColor;
        ctx.fillRect(zCenter - barPx, yPos - barH / 2, barPx, barH);
      }

      // Value text
      ctx.fillStyle = COLOR.text.secondary;
      ctx.font = `${GC_TYPE.xs}px ${FONT_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillText(z.value.toFixed(2), rightX + 52 + barMaxW + 4, yPos);

      yPos += 24;
    }

    // Observed/Expected counts
    const counts = [
      { label: 'LoF', obs: c.obs_lof, exp: c.exp_lof },
      { label: 'Mis', obs: c.obs_mis, exp: c.exp_mis },
      { label: 'Syn', obs: c.obs_syn, exp: c.exp_syn },
    ];

    yPos += 4;
    ctx.font = `${GC_TYPE.xs - 1}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.faint;
    ctx.textAlign = 'left';

    let countX = rightX;
    for (const cnt of counts) {
      if (cnt.obs == null || cnt.exp == null) continue;
      const ratio = cnt.exp > 0 ? (cnt.obs / cnt.exp).toFixed(2) : '—';
      const text = `${cnt.label}: ${cnt.obs}/${cnt.exp!.toFixed(0)} (o/e=${ratio})`;
      ctx.fillText(text, countX, yPos);
      countX += ctx.measureText(text).width + 16;
      if (countX > W - 16) {
        countX = rightX;
        yPos += 14;
      }
    }
  }, [c, width]);

  useEffect(() => {
    function update() {
      if (containerRef.current) setWidth(containerRef.current.clientWidth);
    }
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { draw(); }, [draw, width]);

  return (
    <div ref={containerRef} style={{
      backgroundColor: COLOR.bg.track,
      border: `1px solid ${COLOR.border.subtle}`,
      overflow: 'hidden',
    }}>
      <div style={{ padding: `${SPACE[3]}px ${SPACE[4]}px`, borderBottom: `1px solid ${COLOR.border.subtle}` }}>
        <SectionHeader
          title="Evolutionary Constraint"
          subtitle={data.gnomad_version ? `gnomAD ${data.gnomad_version}` : 'gnomAD'}
        />
      </div>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: GAUGE_H, imageRendering: 'crisp-edges' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// M — Protein Abundance
// ---------------------------------------------------------------------------

export function ProteinAbundanceSection({ data }: { data: ProteinAbundanceData }) {
  const tissues = data.tissues;
  if (!tissues || tissues.length === 0) return null;

  const maxPpm = Math.max(...tissues.map(t => t.abundance_ppm ?? 0), 1);
  const sorted = [...tissues].sort((a, b) => (b.abundance_ppm ?? 0) - (a.abundance_ppm ?? 0));

  return (
    <SectionShell>
      <SectionHeader
        title="Protein Abundance"
        subtitle={`PaxDb · ${data.identity.uniprot_id ?? ''} · ${sorted.length} tissues`}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {sorted.map((t) => {
          const ppm = t.abundance_ppm ?? 0;
          const pct = (ppm / maxPpm) * 100;
          const isTop3 = sorted.indexOf(t) < 3;
          return (
            <div key={t.tissue} style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
              <span style={{
                color: COLOR.text.muted,
                fontSize: GC_TYPE.xs,
                fontFamily: FONT_FAMILY,
                width: 120,
                flexShrink: 0,
                textAlign: 'right' as const,
                textTransform: 'capitalize' as const,
              }}>
                {t.tissue.replace(/_/g, ' ')}
              </span>
              <div style={{
                flex: 1,
                height: 12,
                backgroundColor: COLOR.border.subtle,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: COLOR.accent.violet,
                  opacity: isTop3 ? 1 : 0.4,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <span style={{
                color: COLOR.text.tertiary,
                fontSize: GC_TYPE.xs,
                fontFamily: FONT_FAMILY,
                width: 70,
                textAlign: 'right' as const,
                flexShrink: 0,
              }}>
                {ppm >= 1 ? ppm.toFixed(0) : ppm.toFixed(2)} ppm
              </span>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// N — Protein Atlas (tissue + subcellular)
// ---------------------------------------------------------------------------

const HPA_LEVEL_COLORS: Record<string, string> = {
  'High': COLOR.accent.rose,
  'Medium': COLOR.accent.amber,
  'Low': COLOR.accent.teal,
  'Not detected': COLOR.border.default,
};

const HPA_LEVEL_ORDER = ['High', 'Medium', 'Low', 'Not detected'];

// Subcellular compartment conceptual groups
const COMPARTMENT_GROUPS: Record<string, string[]> = {
  'Nucleus': ['Nucleoplasm', 'Nuclear membrane', 'Nuclear bodies', 'Nuclear speckles', 'Nucleoli', 'Nucleoli fibrillar center'],
  'Cytoplasm': ['Cytosol', 'Cytoplasmic bodies', 'Rods & Rings', 'Aggresomes', 'Lipid droplets'],
  'Membrane': ['Plasma membrane', 'Cell Junctions', 'Focal adhesion sites'],
  'Organelles': ['Mitochondria', 'Endoplasmic reticulum', 'Golgi apparatus', 'Vesicles', 'Lysosomes', 'Peroxisomes', 'Endosomes'],
  'Cytoskeleton': ['Actin filaments', 'Microtubules', 'Intermediate filaments', 'Microtubule ends', 'Cytokinetic bridge', 'Midbody', 'Midbody ring', 'Centriolar satellite', 'Centrosome'],
};

export function ProteinAtlasSection({ data }: { data: ProteinAtlasData }) {
  const { tissue_expression, subcellular_location } = data;

  // Group tissues by expression level
  const levelCounts: Record<string, number> = {};
  for (const t of tissue_expression.tissues) {
    levelCounts[t.expression_level] = (levelCounts[t.expression_level] ?? 0) + 1;
  }

  // Unique tissues (deduplicate by tissue name, keep highest level)
  const tissueMap = new Map<string, string>();
  for (const t of tissue_expression.tissues) {
    const existing = tissueMap.get(t.tissue);
    if (!existing || HPA_LEVEL_ORDER.indexOf(t.expression_level) < HPA_LEVEL_ORDER.indexOf(existing)) {
      tissueMap.set(t.tissue, t.expression_level);
    }
  }
  const uniqueTissues = Array.from(tissueMap.entries()).sort(
    (a, b) => HPA_LEVEL_ORDER.indexOf(a[1]) - HPA_LEVEL_ORDER.indexOf(b[1])
  );

  // Subcellular — identify which compartments are lit
  const locSet = new Set(subcellular_location.locations.map(l => l.location));

  return (
    <SectionShell>
      <SectionHeader
        title="Protein Atlas"
        subtitle={`HPA · ${tissue_expression.n_tissues} entries · ${subcellular_location.n_locations} compartments`}
      />

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: SPACE[4], flexWrap: 'wrap' }}>
        {HPA_LEVEL_ORDER.map(level => {
          const count = levelCounts[level] ?? 0;
          if (count === 0) return null;
          return (
            <div key={level} style={{ display: 'flex', alignItems: 'center', gap: SPACE[1] }}>
              <div style={{ width: 8, height: 8, backgroundColor: HPA_LEVEL_COLORS[level], flexShrink: 0 }} />
              <span style={{
                color: COLOR.text.muted,
                fontSize: GC_TYPE.xs,
                fontFamily: FONT_FAMILY,
              }}>
                {level}: {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tissue grid */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 3,
      }}>
        {uniqueTissues.map(([tissue, level]) => (
          <div
            key={tissue}
            title={`${tissue}: ${level}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE[1],
              padding: `2px ${SPACE[2]}px`,
              backgroundColor: level === 'Not detected' ? 'transparent' : `${HPA_LEVEL_COLORS[level]}15`,
              border: `1px solid ${level === 'Not detected' ? COLOR.border.subtle : HPA_LEVEL_COLORS[level]}40`,
            }}
          >
            <div style={{
              width: 6,
              height: 6,
              backgroundColor: HPA_LEVEL_COLORS[level],
              flexShrink: 0,
            }} />
            <span style={{
              color: level === 'Not detected' ? COLOR.text.faint : COLOR.text.secondary,
              fontSize: GC_TYPE.xs - 1,
              fontFamily: FONT_FAMILY,
              textTransform: 'capitalize' as const,
            }}>
              {tissue.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
      </div>

      {/* Subcellular compartments */}
      {subcellular_location.locations.length > 0 && (
        <>
          <div style={{
            borderTop: `1px solid ${COLOR.border.subtle}`,
            paddingTop: SPACE[3],
            marginTop: SPACE[1],
          }}>
            <span style={{
              color: COLOR.accent.teal,
              fontSize: GC_TYPE.xs,
              fontFamily: FONT_FAMILY,
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
            }}>
              Subcellular Localization
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
            {Object.entries(COMPARTMENT_GROUPS).map(([group, compartments]) => {
              const active = compartments.filter(c => locSet.has(c));
              if (active.length === 0) return null;
              return (
                <div key={group} style={{ display: 'flex', alignItems: 'flex-start', gap: SPACE[2] }}>
                  <span style={{
                    color: COLOR.text.faint,
                    fontSize: GC_TYPE.xs - 1,
                    fontFamily: FONT_FAMILY,
                    width: 80,
                    flexShrink: 0,
                    textAlign: 'right' as const,
                    paddingTop: 2,
                  }}>
                    {group}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {active.map(loc => {
                      const locData = subcellular_location.locations.find(l => l.location === loc);
                      const isEnhanced = locData?.reliability === 'Enhanced';
                      return (
                        <span
                          key={loc}
                          title={`${loc} — ${locData?.reliability ?? 'unknown'}`}
                          style={{
                            display: 'inline-block',
                            padding: `1px ${SPACE[2]}px`,
                            backgroundColor: isEnhanced ? 'rgba(78,205,196,0.15)' : 'rgba(78,205,196,0.06)',
                            border: `1px solid ${isEnhanced ? COLOR.accent.teal : COLOR.border.strong}`,
                            color: isEnhanced ? COLOR.accent.teal : COLOR.text.tertiary,
                            fontSize: GC_TYPE.xs - 1,
                            fontFamily: FONT_FAMILY,
                          }}
                        >
                          {loc}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {/* Show any locations not in our known groups */}
            {subcellular_location.locations
              .filter(l => !Object.values(COMPARTMENT_GROUPS).flat().includes(l.location))
              .length > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: SPACE[2] }}>
                <span style={{
                  color: COLOR.text.faint,
                  fontSize: GC_TYPE.xs - 1,
                  fontFamily: FONT_FAMILY,
                  width: 80,
                  flexShrink: 0,
                  textAlign: 'right' as const,
                  paddingTop: 2,
                }}>
                  Other
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {subcellular_location.locations
                    .filter(l => !Object.values(COMPARTMENT_GROUPS).flat().includes(l.location))
                    .map(l => (
                      <span
                        key={l.location}
                        style={{
                          display: 'inline-block',
                          padding: `1px ${SPACE[2]}px`,
                          backgroundColor: 'rgba(78,205,196,0.06)',
                          border: `1px solid ${COLOR.border.strong}`,
                          color: COLOR.text.tertiary,
                          fontSize: GC_TYPE.xs - 1,
                          fontFamily: FONT_FAMILY,
                        }}
                      >
                        {l.location}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// O — Pathways (Reactome)
// ---------------------------------------------------------------------------

export function PathwaysSection({ data }: { data: GenePathwaysData }) {
  const { pathways } = data;
  if (!pathways || pathways.length === 0) return null;

  // Group by top-level hierarchy
  const groups = new Map<string, typeof pathways>();
  for (const p of pathways) {
    const topLevel = p.pathway_hierarchy?.split(' > ')[0] ?? 'Other';
    if (!groups.has(topLevel)) groups.set(topLevel, []);
    groups.get(topLevel)!.push(p);
  }

  // Sort groups by count descending
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);

  // Cycle through palette for hierarchy groups
  const HIERARCHY_COLORS = [
    COLOR.accent.teal,
    COLOR.accent.violet,
    COLOR.accent.amber,
    COLOR.accent.rose,
    '#10b981',
    '#3b82f6',
    '#ec4899',
    '#8b5cf6',
  ];

  return (
    <SectionShell>
      <SectionHeader
        title="Pathways"
        subtitle={`Reactome · ${pathways.length} pathways`}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }}>
        {sortedGroups.map(([hierarchy, members], gi) => {
          const color = HIERARCHY_COLORS[gi % HIERARCHY_COLORS.length];
          return (
            <div key={hierarchy}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE[2],
                marginBottom: SPACE[1],
              }}>
                <div style={{ width: 3, height: 12, backgroundColor: color, flexShrink: 0 }} />
                <span style={{
                  color: COLOR.text.muted,
                  fontSize: GC_TYPE.xs,
                  fontFamily: FONT_FAMILY,
                  fontWeight: 500,
                }}>
                  {hierarchy}
                </span>
                <span style={{
                  color: COLOR.text.faint,
                  fontSize: GC_TYPE.xs - 1,
                  fontFamily: FONT_FAMILY,
                }}>
                  ({members.length})
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: SPACE[3] }}>
                {members.map(p => (
                  <span
                    key={p.pathway_id}
                    title={`${p.pathway_id} · ${p.pathway_hierarchy ?? ''}`}
                    style={{
                      display: 'inline-block',
                      padding: `2px ${SPACE[2]}px`,
                      backgroundColor: `${color}10`,
                      border: `1px solid ${color}30`,
                      color: COLOR.text.secondary,
                      fontSize: GC_TYPE.xs - 1,
                      fontFamily: FONT_FAMILY,
                      lineHeight: 1.4,
                      maxWidth: 320,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' as const,
                    }}
                  >
                    {p.pathway_name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// P — Gene Sets (MSigDB Hallmark fingerprint)
// ---------------------------------------------------------------------------

// All 50 Hallmark gene set names for the full fingerprint
const ALL_HALLMARKS = [
  'ADIPOGENESIS', 'ALLOGRAFT_REJECTION', 'ANDROGEN_RESPONSE', 'ANGIOGENESIS',
  'APICAL_JUNCTION', 'APICAL_SURFACE', 'APOPTOSIS', 'BILE_ACID_METABOLISM',
  'CHOLESTEROL_HOMEOSTASIS', 'COAGULATION', 'COMPLEMENT', 'DNA_REPAIR',
  'E2F_TARGETS', 'EPITHELIAL_MESENCHYMAL_TRANSITION', 'ESTROGEN_RESPONSE_EARLY',
  'ESTROGEN_RESPONSE_LATE', 'FATTY_ACID_METABOLISM', 'G2M_CHECKPOINT',
  'GLYCOLYSIS', 'HEDGEHOG_SIGNALING', 'HEME_METABOLISM', 'HYPOXIA',
  'IL2_STAT5_SIGNALING', 'IL6_JAK_STAT3_SIGNALING', 'INFLAMMATORY_RESPONSE',
  'INTERFERON_ALPHA_RESPONSE', 'INTERFERON_GAMMA_RESPONSE', 'KRAS_SIGNALING_DN',
  'KRAS_SIGNALING_UP', 'MITOTIC_SPINDLE', 'MTORC1_SIGNALING', 'MYC_TARGETS_V1',
  'MYC_TARGETS_V2', 'NOTCH_SIGNALING', 'OXIDATIVE_PHOSPHORYLATION',
  'P53_PATHWAY', 'PANCREAS_BETA_CELLS', 'PEROXISOME', 'PI3K_AKT_MTOR_SIGNALING',
  'PROTEIN_SECRETION', 'REACTIVE_OXYGEN_SPECIES_PATHWAY', 'SPERMATOGENESIS',
  'TGF_BETA_SIGNALING', 'TNFA_SIGNALING_VIA_NFKB', 'UNFOLDED_PROTEIN_RESPONSE',
  'UV_RESPONSE_DN', 'UV_RESPONSE_UP', 'WNT_BETA_CATENIN_SIGNALING',
  'XENOBIOTIC_METABOLISM', 'MYOGENESIS',
];

// Functional category for color coding
const HALLMARK_CATEGORIES: Record<string, string> = {
  // Signaling
  KRAS_SIGNALING_DN: 'signaling', KRAS_SIGNALING_UP: 'signaling',
  PI3K_AKT_MTOR_SIGNALING: 'signaling', MTORC1_SIGNALING: 'signaling',
  NOTCH_SIGNALING: 'signaling', HEDGEHOG_SIGNALING: 'signaling',
  WNT_BETA_CATENIN_SIGNALING: 'signaling', TGF_BETA_SIGNALING: 'signaling',
  // Proliferation
  E2F_TARGETS: 'proliferation', G2M_CHECKPOINT: 'proliferation',
  MYC_TARGETS_V1: 'proliferation', MYC_TARGETS_V2: 'proliferation',
  MITOTIC_SPINDLE: 'proliferation',
  // Immune
  ALLOGRAFT_REJECTION: 'immune', COMPLEMENT: 'immune', COAGULATION: 'immune',
  IL2_STAT5_SIGNALING: 'immune', IL6_JAK_STAT3_SIGNALING: 'immune',
  INFLAMMATORY_RESPONSE: 'immune', INTERFERON_ALPHA_RESPONSE: 'immune',
  INTERFERON_GAMMA_RESPONSE: 'immune', TNFA_SIGNALING_VIA_NFKB: 'immune',
  // Metabolic
  ADIPOGENESIS: 'metabolic', BILE_ACID_METABOLISM: 'metabolic',
  CHOLESTEROL_HOMEOSTASIS: 'metabolic', FATTY_ACID_METABOLISM: 'metabolic',
  GLYCOLYSIS: 'metabolic', HEME_METABOLISM: 'metabolic',
  OXIDATIVE_PHOSPHORYLATION: 'metabolic', PEROXISOME: 'metabolic',
  XENOBIOTIC_METABOLISM: 'metabolic', REACTIVE_OXYGEN_SPECIES_PATHWAY: 'metabolic',
  // Stress/DNA
  APOPTOSIS: 'stress', DNA_REPAIR: 'stress', HYPOXIA: 'stress',
  P53_PATHWAY: 'stress', UNFOLDED_PROTEIN_RESPONSE: 'stress',
  UV_RESPONSE_DN: 'stress', UV_RESPONSE_UP: 'stress',
  // Development
  ANGIOGENESIS: 'development', EPITHELIAL_MESENCHYMAL_TRANSITION: 'development',
  MYOGENESIS: 'development', SPERMATOGENESIS: 'development',
  PANCREAS_BETA_CELLS: 'development', APICAL_JUNCTION: 'development',
  APICAL_SURFACE: 'development', PROTEIN_SECRETION: 'development',
  // Hormonal
  ANDROGEN_RESPONSE: 'hormonal', ESTROGEN_RESPONSE_EARLY: 'hormonal',
  ESTROGEN_RESPONSE_LATE: 'hormonal',
};

const CATEGORY_COLORS: Record<string, string> = {
  signaling: COLOR.accent.amber,
  proliferation: COLOR.accent.rose,
  immune: COLOR.accent.violet,
  metabolic: '#10b981',
  stress: '#ef4444',
  development: '#3b82f6',
  hormonal: '#ec4899',
};

export function GeneSetsSection({ data }: { data: GeneSetsData }) {
  const memberSet = new Set(
    data.gene_sets.map(gs => {
      // Strip "HALLMARK_" prefix if present
      const name = gs.gene_set_name.replace(/^HALLMARK_/, '');
      return name;
    })
  );

  const activeCount = ALL_HALLMARKS.filter(h => memberSet.has(h)).length;

  return (
    <SectionShell>
      <SectionHeader
        title="Hallmark Gene Sets"
        subtitle={`MSigDB · ${activeCount} of ${ALL_HALLMARKS.length} active`}
      />

      {/* Category legend */}
      <div style={{ display: 'flex', gap: SPACE[3], flexWrap: 'wrap', marginBottom: SPACE[1] }}>
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 6, height: 6, backgroundColor: color, flexShrink: 0 }} />
            <span style={{
              color: COLOR.text.faint,
              fontSize: GC_TYPE.xs - 1,
              fontFamily: FONT_FAMILY,
              textTransform: 'capitalize' as const,
            }}>
              {cat}
            </span>
          </div>
        ))}
      </div>

      {/* Fingerprint strip — all 50 Hallmarks */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 3,
      }}>
        {ALL_HALLMARKS.map(h => {
          const isActive = memberSet.has(h);
          const category = HALLMARK_CATEGORIES[h] ?? 'other';
          const catColor = CATEGORY_COLORS[category] ?? COLOR.text.faint;
          const displayName = h.replace(/_/g, ' ').toLowerCase();

          return (
            <div
              key={h}
              title={h.replace(/_/g, ' ')}
              style={{
                padding: `2px ${SPACE[2]}px`,
                backgroundColor: isActive ? `${catColor}18` : 'transparent',
                border: `1px solid ${isActive ? catColor : COLOR.border.subtle}`,
                color: isActive ? catColor : COLOR.text.faint,
                fontSize: GC_TYPE.xs - 1,
                fontFamily: FONT_FAMILY,
                opacity: isActive ? 1 : 0.3,
                transition: 'opacity 0.2s',
                lineHeight: 1.3,
                textTransform: 'capitalize' as const,
              }}
            >
              {displayName}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
