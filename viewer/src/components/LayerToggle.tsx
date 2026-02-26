'use client';
import { useEffect, useState } from 'react';
import { useViewport } from '@/stores/viewport';
import { fetchLayers, type LayerInfo } from '@/lib/api';

const LAYER_COLORS: Record<string, string> = {
  gencode_v44: '#3b82f6',
  cpg_sites: '#22c55e',
  probe_epic_v2: '#f59e0b',
  isochores: '#8b5cf6',
};

export function LayerToggle() {
  const { build, activeLayers, toggleLayer } = useViewport();
  const [layers, setLayers] = useState<LayerInfo[]>([]);

  useEffect(() => {
    fetchLayers(build).then(setLayers).catch(() => {});
  }, [build]);

  // If API didn't return layers, show hardcoded defaults
  const displayLayers =
    layers.length > 0
      ? layers.filter((l) => l.type !== 'genome')
      : [
          { layer_key: 'gencode_v44', name: 'GENCODE v44', type: 'gene_model', row_count: null },
          { layer_key: 'cpg_sites', name: 'CpG Sites', type: 'cpg', row_count: null },
          { layer_key: 'probe_epic_v2', name: 'EPIC v2 Probes', type: 'probe', row_count: null },
          { layer_key: 'isochores', name: 'Isochores', type: 'isochore', row_count: null },
        ];

  return (
    <div className="flex items-center gap-3 px-4 py-1 bg-gray-900/50 border-b border-gray-800">
      <span className="text-xs text-gray-500 font-medium">Layers:</span>
      {displayLayers.map((l) => {
        const active = activeLayers.includes(l.layer_key);
        const color = LAYER_COLORS[l.layer_key] || '#6b7280';
        return (
          <label
            key={l.layer_key}
            className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
          >
            <input
              type="checkbox"
              checked={active}
              onChange={() => toggleLayer(l.layer_key)}
              className="sr-only"
            />
            <span
              className={`w-2.5 h-2.5 rounded-sm border transition-colors ${
                active ? 'border-transparent' : 'border-gray-600 bg-transparent'
              }`}
              style={active ? { backgroundColor: color } : {}}
            />
            <span className={active ? 'text-gray-200' : 'text-gray-500'}>
              {l.name || l.layer_key}
            </span>
            {l.row_count != null && (
              <span className="text-gray-600 text-[10px]">
                ({(l.row_count / 1_000_000).toFixed(1)}M)
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
