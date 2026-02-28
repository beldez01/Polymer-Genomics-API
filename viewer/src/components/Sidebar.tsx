'use client';

import { useEffect, useState } from 'react';
import { fetchLayers, type LayerInfo } from '@/lib/api';
import { COLORS } from '@/config/colors';
import type { GenomeBuild } from '@/stores/viewport';

const LAYER_COLORS: Record<string, string> = {
  gencode_v44: COLORS.layer.gencode_v44,
  cpg_sites: COLORS.layer.cpg_sites,
  probe_epic_v2: COLORS.layer.probe_epic_v2,
  isochores: COLORS.layer.isochores,
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

  const btnStyle = (active = false): React.CSSProperties => ({
    backgroundColor: active ? '#1a2a28' : '#111111',
    color: active ? '#4ECDC4' : '#666',
    border: active ? '1px solid #4ECDC4' : '1px solid #1a1a1a',
    padding: '3px 8px',
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    cursor: 'pointer',
  });

  return (
    <div className="h-full overflow-y-auto flex-shrink-0 flex flex-col"
         style={{ width: 240, backgroundColor: '#0A0A0A', borderRight: '1px solid #1a1a1a' }}>

      {/* Annotation layers */}
      <div>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #1a1a1a', backgroundColor: '#0D0D0D' }}>
          <span style={{ color: '#4ECDC4', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
            ANNOTATIONS
          </span>
        </div>
        <div style={{ borderBottom: '1px solid #1a1a1a' }}>
          {displayLayers.map((l) => {
            const active = activeLayers.includes(l.layer_key);
            const color = LAYER_COLORS[l.layer_key] || '#666';
            return (
              <button
                key={l.layer_key}
                onClick={() => onToggleLayer(l.layer_key)}
                className="w-full flex items-center gap-2"
                style={{
                  padding: '6px 12px',
                  backgroundColor: active ? '#111111' : 'transparent',
                  borderBottom: '1px solid #111111',
                  cursor: 'pointer',
                  border: 'none',
                  borderBlockEnd: '1px solid #111111',
                }}>
                <div style={{
                  width: 12, height: 12, flexShrink: 0,
                  border: `1px solid ${active ? color : '#333'}`,
                  backgroundColor: active ? color : 'transparent',
                }} />
                <span style={{
                  color: active ? '#CCC' : '#555',
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  textAlign: 'left',
                }}>
                  {l.name || l.layer_key}
                </span>
                {l.row_count != null && (
                  <span style={{ color: '#444', fontSize: 9, fontFamily: "'JetBrains Mono', monospace", marginLeft: 'auto' }}>
                    {(l.row_count / 1_000_000).toFixed(1)}M
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ color: '#666', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>
          NAVIGATION
        </div>
        <div className="flex gap-1" style={{ marginBottom: 6 }}>
          <button onClick={onPanLeft} style={btnStyle()} title="Pan left 25%">&larr;</button>
          <button onClick={onPanRight} style={btnStyle()} title="Pan right 25%">&rarr;</button>
          <div style={{ width: 8 }} />
          <button onClick={onZoomIn} style={btnStyle()} title="Zoom in 2x">+</button>
          <button onClick={onZoomOut} style={btnStyle()} title="Zoom out 2x">&minus;</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {ZOOM_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => onZoomPreset(p.width)}
              style={btnStyle(Math.abs(viewportWidth - p.width) < p.width * 0.2)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px', marginTop: 'auto' }}>
        <div style={{ color: '#444', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.8 }}>
          <div>{viewportWidth.toLocaleString()} bp viewport</div>
          <div>{resolution === 1 ? 'Base-pair resolution' : `${resolution?.toLocaleString() ?? '—'} bp tiles`}</div>
          <div style={{ marginTop: 4, color: '#333' }}>Arrow keys: pan</div>
          <div style={{ color: '#333' }}>+/−: zoom</div>
        </div>
      </div>
    </div>
  );
}
