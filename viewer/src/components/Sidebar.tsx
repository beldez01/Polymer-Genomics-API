'use client';

import { useEffect, useState } from 'react';
import { fetchLayers, type LayerInfo } from '@/lib/api';
import { COLOR, FONT_FAMILY, TYPE, WEIGHT, SPACE, LAYOUT, COMPONENT } from '@/config/theme';
import type { GenomeBuild } from '@/stores/viewport';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M rows`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K rows`;
  return `${n} rows`;
}

/** Strip " (hg38)" / " (hg37)" suffixes from API-returned names. */
function cleanName(name: string): string {
  return name.replace(/\s*\(hg\d+\)\s*/i, '').trim();
}

const LAYER_COLORS: Record<string, string> = {
  sequence:         '#444444',
  codons:           COLOR.accent.teal,
  gencode_v44:      COLOR.layer.gencode_v44,
  cpg_sites:        COLOR.layer.cpg_sites,
  probe_epic_v2:    COLOR.layer.probe_epic_v2,
  probe_epic_v1:    '#d97706',
  probe_450k:       '#92400e',
  isochores:        COLOR.layer.isochores,
  methylation_atlas:COLOR.layer.methylation_atlas,
  gc:               '#94a3b8',
};

/** Layers that show a "build mapping" sub-line (methylation arrays). */
const PROBE_LAYER_KEYS = new Set(['probe_epic_v2', 'probe_epic_v1', 'probe_450k']);

/** Canonical display order for API layers (between Codons and GC%). — cpg_sites handled separately. */
const LAYER_ORDER = ['gencode_v44', 'probe_epic_v2', 'probe_epic_v1', 'probe_450k'];

const CELL_TYPE_KEYS = [
  { key: 'Gran',  label: 'Gran' },
  { key: 'Mono',  label: 'Mono' },
  { key: 'NK',    label: 'NK' },
  { key: 'Bcell', label: 'B' },
  { key: 'CD4T',  label: 'CD4T' },
  { key: 'CD8T',  label: 'CD8T' },
] as const;

const ZOOM_PRESETS = [
  { label: '1 bp',   width: 50 },
  { label: '1 kb',   width: 1_000 },
  { label: '10 kb',  width: 10_000 },
  { label: '100 kb', width: 100_000 },
  { label: '1 Mb',   width: 1_000_000 },
  { label: '10 Mb',  width: 10_000_000 },
];

/** Teal color for all toggle indicators. */
const TOGGLE_TEAL = COLOR.accent.teal;
const TOGGLE_TEAL_DIM = COLOR.accent.teal + '4D';

interface SidebarProps {
  build: GenomeBuild;
  activeLayers: string[];
  onToggleLayer: (layerKey: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPanLeft: () => void;
  onPanRight: () => void;
  onZoomPreset: (width: number) => void;
  viewportWidth: number;
  resolution: number | null;
  showCodons: boolean;
  onToggleCodons: () => void;
  showGC: boolean;
  onToggleGC: () => void;
  visibleCellTypes: string[];
  onToggleCellType: (cellType: string) => void;
}

export function Sidebar({
  build,
  activeLayers,
  onToggleLayer,
  onZoomIn,
  onZoomOut,
  onPanLeft,
  onPanRight,
  onZoomPreset,
  viewportWidth,
  resolution,
  showCodons,
  onToggleCodons,
  showGC,
  onToggleGC,
  visibleCellTypes,
  onToggleCellType,
}: SidebarProps) {
  const [layers, setLayers] = useState<LayerInfo[]>([]);

  useEffect(() => {
    fetchLayers(build).then(setLayers).catch(() => {});
  }, [build]);

  const displayList: { layer_key: string; name: string; type: string; row_count: number | null }[] =
    layers.length > 0
      ? layers.filter((l) => l.type !== 'genome')
      : [
          { layer_key: 'gencode_v44',   name: 'GENCODE v44',    type: 'gene_model', row_count: null },
          { layer_key: 'cpg_sites',     name: 'CpG Sites',      type: 'cpg',        row_count: null },
          { layer_key: 'probe_epic_v2', name: 'EPIC v2 Probes', type: 'probe',      row_count: null },
          { layer_key: 'isochores',     name: 'Isochores',      type: 'isochore',   row_count: null },
        ];
  const apiLayerMap = new Map(displayList.map((l) => [l.layer_key, l]));

  /** Render a single annotation row — all toggle squares use unified teal. */
  function AnnotationRow({
    active,
    name,
    subLine,
    onClick,
    placeholder,
  }: {
    active: boolean;
    name: string;
    subLine?: React.ReactNode;
    onClick?: () => void;
    placeholder?: boolean;
  }) {
    const Tag = placeholder ? 'div' : 'button';
    return (
      <Tag
        onClick={placeholder ? undefined : onClick}
        className="w-full flex items-center gap-1.5"
        style={{
          padding: `3px ${SPACE[2]}px`,
          backgroundColor: active ? COLOR.bg.track : 'transparent',
          cursor: placeholder ? 'default' : 'pointer',
          border: 'none',
          borderBlockEnd: `1px solid ${COLOR.bg.track}`,
          transition: 'background-color 0.15s',
          width: '100%',
          textAlign: 'left',
        } as React.CSSProperties}
      >
        <span style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          backgroundColor: active ? TOGGLE_TEAL : TOGGLE_TEAL_DIM,
          flexShrink: 0,
        }} />
        <span style={{
          color: active ? COLOR.text.secondary : COLOR.text.tertiary,
          fontSize: 12,
          fontFamily: FONT_FAMILY,
          textAlign: 'left',
          lineHeight: 1.2,
        }}>
          {name}
        </span>
        {subLine && <span style={{ color: COLOR.text.faint, fontSize: TYPE.sm.fontSize, fontFamily: FONT_FAMILY, marginLeft: 2 }}>
          {subLine}
        </span>}
      </Tag>
    );
  }

  /** Teal checkbox used by probe and cell type groups. */
  function TealCheckbox({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5"
        style={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
        }}
      >
        <span style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          border: `1.5px solid ${active ? TOGGLE_TEAL : COLOR.text.faint}`,
          backgroundColor: active ? TOGGLE_TEAL : 'transparent',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {active && (
            <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
              <path d="M1.5 4L3.2 5.7L6.5 2.3" stroke={COLOR.bg.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
        <span style={{
          color: active ? COLOR.text.secondary : COLOR.text.faint,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
        }}>
          {label}
        </span>
      </button>
    );
  }

  /** Render the probe group with checkboxes. */
  function ProbeGroup() {
    const probeKeys = ['probe_epic_v2', 'probe_epic_v1', 'probe_450k'] as const;
    const probeLabels: Record<string, string> = {
      probe_epic_v2: 'EPIC v2',
      probe_epic_v1: 'EPIC v1',
      probe_450k: '450K',
    };
    const anyActive = probeKeys.some((k) => activeLayers.includes(k));

    return (
      <div style={{
        padding: `3px ${SPACE[2]}px`,
        backgroundColor: anyActive ? COLOR.bg.track : 'transparent',
        borderBlockEnd: `1px solid ${COLOR.bg.track}`,
      }}>
        <div className="flex items-center gap-1.5">
          <span style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: anyActive ? TOGGLE_TEAL : TOGGLE_TEAL_DIM,
            flexShrink: 0,
          }} />
          <span style={{
            color: anyActive ? COLOR.text.secondary : COLOR.text.tertiary,
            fontSize: 12,
            fontFamily: FONT_FAMILY,
          }}>
            Methylation Probes
          </span>
        </div>
        <div style={{ paddingLeft: 14, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {probeKeys.map((key) => {
            const l = apiLayerMap.get(key);
            const active = activeLayers.includes(key);
            const suffix = l?.row_count != null ? ` \u00b7 ${formatCount(l.row_count)}` : '';
            return (
              <TealCheckbox
                key={key}
                active={active}
                label={probeLabels[key] + suffix}
                onClick={() => onToggleLayer(key)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  /** Render the methylation atlas cell type group with checkboxes. */
  function CellTypeGroup() {
    const anyActive = visibleCellTypes.length > 0;

    return (
      <div style={{
        padding: `3px ${SPACE[2]}px`,
        backgroundColor: anyActive ? COLOR.bg.track : 'transparent',
        borderBlockEnd: `1px solid ${COLOR.bg.track}`,
      }}>
        <div className="flex items-center gap-1.5">
          <span style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: anyActive ? TOGGLE_TEAL : TOGGLE_TEAL_DIM,
            flexShrink: 0,
          }} />
          <span style={{
            color: anyActive ? COLOR.text.secondary : COLOR.text.tertiary,
            fontSize: 12,
            fontFamily: FONT_FAMILY,
          }}>
            Methylation Atlas
          </span>
        </div>
        <div style={{ paddingLeft: 14, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {CELL_TYPE_KEYS.map((ct) => (
            <TealCheckbox
              key={ct.key}
              active={visibleCellTypes.includes(ct.key)}
              label={ct.label}
              onClick={() => onToggleCellType(ct.key)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto flex-shrink-0 flex flex-col"
         style={{
           width: LAYOUT.sidebarWidth,
           backgroundColor: COLOR.bg.primary,
           borderRight: `1px solid ${COLOR.border.subtle}`,
         }}>

      {/* ─── Annotation Layers ─── */}
      <div>
        <div style={{
          padding: `${SPACE[1]}px ${SPACE[2]}px`,
          borderBottom: `2px solid ${COLOR.border.default}`,
          backgroundColor: COLOR.bg.elevated,
        }}>
          <span style={COMPONENT.sectionHeader}>ANNOTATIONS</span>
        </div>

        <div style={{ borderBottom: `1px solid ${COLOR.border.subtle}` }}>

          {/* 1. Isochores — above sequence */}
          {(() => {
            const l = apiLayerMap.get('isochores');
            const active = activeLayers.includes('isochores');
            const subLine = l?.row_count != null ? formatCount(l.row_count) : undefined;
            return (
              <AnnotationRow
                active={active}
                name={l ? cleanName(l.name || 'Isochores') : 'Isochores'}
                subLine={subLine}
                onClick={() => onToggleLayer('isochores')}
              />
            );
          })()}

          {/* 2. Sequence — placeholder, always active */}
          <AnnotationRow
            active
            name="Sequence"
            placeholder
          />

          {/* 3. CpG Sites — overlay toggle, right after Sequence */}
          {(() => {
            const l = apiLayerMap.get('cpg_sites');
            const active = activeLayers.includes('cpg_sites');
            const subLine = l?.row_count != null ? formatCount(l.row_count) : undefined;
            return (
              <AnnotationRow
                active={active}
                name={l ? cleanName(l.name || 'CpG Sites') : 'CpG Sites'}
                subLine={subLine}
                onClick={() => onToggleLayer('cpg_sites')}
              />
            );
          })()}

          {/* 4. Codons — toggle */}
          <AnnotationRow
            active={showCodons}
            name="Codons"
            onClick={onToggleCodons}
          />

          {/* 5. GENCODE — from API layer order */}
          {(() => {
            const l = apiLayerMap.get('gencode_v44');
            if (!l) return null;
            const active = activeLayers.includes('gencode_v44');
            const subLine = l.row_count != null ? formatCount(l.row_count) : undefined;
            return (
              <AnnotationRow
                active={active}
                name={cleanName(l.name || 'gencode_v44')}
                subLine={subLine}
                onClick={() => onToggleLayer('gencode_v44')}
              />
            );
          })()}

          {/* 6. Methylation Probes group */}
          <ProbeGroup />

          {/* 7. Methylation Atlas cell type group */}
          <CellTypeGroup />

          {/* 8. GC% — toggle, always last */}
          <AnnotationRow
            active={showGC}
            name="GC%"
            onClick={onToggleGC}
          />

        </div>
      </div>

      {/* ─── Navigation ─── */}
      <div style={{ padding: `${SPACE[2]}px ${SPACE[2]}px`, borderBottom: `1px solid ${COLOR.border.subtle}` }}>
        <div style={{
          color: COLOR.text.tertiary,
          fontSize: 9,
          fontFamily: FONT_FAMILY,
          marginBottom: SPACE[1],
          letterSpacing: '0.08em',
          fontWeight: WEIGHT.medium,
        }}>
          NAVIGATION
        </div>
        <div className="flex gap-1" style={{ marginBottom: SPACE[1] }}>
          <button onClick={() => onPanLeft()}  style={COMPONENT.button.small} title="Pan left 25%">&larr;</button>
          <button onClick={() => onPanRight()} style={COMPONENT.button.small} title="Pan right 25%">&rarr;</button>
          <div style={{ width: SPACE[1] }} />
          <button onClick={() => onZoomIn()}  style={COMPONENT.button.small} title="Zoom in 2x">+</button>
          <button onClick={() => onZoomOut()} style={COMPONENT.button.small} title="Zoom out 2x">&minus;</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {ZOOM_PRESETS.map((p) => {
            const isActive = Math.abs(viewportWidth - p.width) < p.width * 0.2;
            return (
              <button
                key={p.label}
                onClick={() => onZoomPreset(p.width)}
                style={isActive ? COMPONENT.button.smallActive : COMPONENT.button.small}>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Info ─── */}
      <div style={{
        padding: `${SPACE[3]}px ${SPACE[3]}px`,
        marginTop: 'auto',
        borderTop: `1px solid ${COLOR.border.subtle}`,
      }}>
        <div style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          lineHeight: 1.8,
        }}>
          <div>{viewportWidth.toLocaleString()} bp viewport</div>
          <div>{resolution === 1 ? 'Base-pair resolution' : `${resolution?.toLocaleString() ?? '\u2014'} bp tiles`}</div>
          <div style={{ marginTop: SPACE[1], color: COLOR.text.faint }}>Arrow keys: pan</div>
          <div style={{ color: COLOR.text.faint }}>+/&#x2212;: zoom &middot; i: context</div>
        </div>
      </div>
    </div>
  );
}
