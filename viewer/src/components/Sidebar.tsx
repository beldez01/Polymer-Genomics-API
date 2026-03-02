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

const LAYER_COLORS: Record<string, string> = {
  gencode_v44: COLOR.layer.gencode_v44,
  cpg_sites: COLOR.layer.cpg_sites,
  probe_epic_v2: COLOR.layer.probe_epic_v2,
  isochores: COLOR.layer.isochores,
};

const ZOOM_PRESETS = [
  { label: '1 bp', width: 50 },
  { label: '1 kb', width: 1_000 },
  { label: '10 kb', width: 10_000 },
  { label: '100 kb', width: 100_000 },
  { label: '1 Mb', width: 1_000_000 },
  { label: '10 Mb', width: 10_000_000 },
];

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
}: SidebarProps) {
  const [layers, setLayers] = useState<LayerInfo[]>([]);

  useEffect(() => {
    fetchLayers(build).then(setLayers).catch(() => {});
  }, [build]);

  const displayLayers = layers.length > 0
    ? layers.filter((l) => l.type !== 'genome')
    : [
        { layer_key: 'gencode_v44', name: 'GENCODE v44', type: 'gene_model', row_count: null },
        { layer_key: 'cpg_sites', name: 'CpG Sites', type: 'cpg', row_count: null },
        { layer_key: 'probe_epic_v2', name: 'EPIC v2 Probes', type: 'probe', row_count: null },
        { layer_key: 'isochores', name: 'Isochores', type: 'isochore', row_count: null },
      ];

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
          padding: `${SPACE[2]}px ${SPACE[3]}px`,
          borderBottom: `2px solid ${COLOR.border.default}`,
          backgroundColor: COLOR.bg.elevated,
        }}>
          <span style={COMPONENT.sectionHeader}>ANNOTATIONS</span>
        </div>

        <div style={{ borderBottom: `1px solid ${COLOR.border.subtle}` }}>
          {displayLayers.map((l) => {
            const active = activeLayers.includes(l.layer_key);
            const color = LAYER_COLORS[l.layer_key] || '#666';
            return (
              <button
                key={l.layer_key}
                onClick={() => onToggleLayer(l.layer_key)}
                className="w-full flex flex-col items-start"
                style={{
                  padding: `${SPACE[2]}px ${SPACE[3]}px`,
                  backgroundColor: active ? COLOR.bg.track : 'transparent',
                  cursor: 'pointer',
                  border: 'none',
                  borderBlockEnd: `1px solid ${COLOR.bg.track}`,
                  borderLeft: `2px solid ${active ? color : color + '4D'}`,
                  transition: 'background-color 0.15s, border-color 0.15s',
                }}>
                <span style={{
                  color: active ? COLOR.text.secondary : COLOR.text.tertiary,
                  fontSize: TYPE.sm.fontSize,
                  fontFamily: FONT_FAMILY,
                  textAlign: 'left',
                }}>
                  {l.name || l.layer_key}
                </span>
                {l.row_count != null && (
                  <span style={{
                    color: COLOR.text.faint,
                    fontSize: TYPE.xs.fontSize,
                    fontFamily: FONT_FAMILY,
                    marginTop: 1,
                  }}>
                    {formatCount(l.row_count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Navigation ─── */}
      <div style={{ padding: `${SPACE[3]}px ${SPACE[3]}px`, borderBottom: `1px solid ${COLOR.border.subtle}` }}>
        <div style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          marginBottom: SPACE[2],
          letterSpacing: '0.08em',
          fontWeight: WEIGHT.medium,
        }}>
          NAVIGATION
        </div>
        <div className="flex gap-1" style={{ marginBottom: SPACE[2] }}>
          <button onClick={onPanLeft}  style={COMPONENT.button.small} title="Pan left 25%">&larr;</button>
          <button onClick={onPanRight} style={COMPONENT.button.small} title="Pan right 25%">&rarr;</button>
          <div style={{ width: SPACE[2] }} />
          <button onClick={onZoomIn}  style={COMPONENT.button.small} title="Zoom in 2x">+</button>
          <button onClick={onZoomOut} style={COMPONENT.button.small} title="Zoom out 2x">&minus;</button>
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

      {/* ─── Gene Options ─── */}
      <div style={{ padding: `${SPACE[3]}px ${SPACE[3]}px`, borderBottom: `1px solid ${COLOR.border.subtle}` }}>
        <div style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          marginBottom: SPACE[2],
          letterSpacing: '0.08em',
          fontWeight: WEIGHT.medium,
        }}>
          GENE OPTIONS
        </div>
        <div className="flex gap-1">
          <button
            onClick={onToggleCodons}
            style={showCodons ? COMPONENT.button.smallActive : COMPONENT.button.small}
            title="Show codon reading frame coloring on CDS regions">
            Codons
          </button>
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
          <div style={{ color: COLOR.text.faint }}>+/\u2212: zoom &middot; i: context</div>
        </div>
      </div>
    </div>
  );
}
