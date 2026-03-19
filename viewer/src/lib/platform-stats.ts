'use client';

import { useState, useEffect } from 'react';

export interface PlatformStats {
  cpg: string;
  probes: string;
  transcripts: string;
  mcpTools: string;
}

const FALLBACK: PlatformStats = {
  cpg: '29M',
  probes: '937K',
  transcripts: '63K',
  mcpTools: '41',
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function usePlatformStats(): PlatformStats {
  const [stats, setStats] = useState<PlatformStats>(FALLBACK);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/layers/summary/hg38');
        if (!res.ok) return;
        const data = await res.json();
        const counts = data.layer_counts ?? {};
        setStats({
          cpg: formatCount(counts.cpg_sites ?? 29_000_000),
          probes: formatCount(counts.probe_epic_v2 ?? 937_000),
          transcripts: formatCount(counts.gencode_v44 ?? 63_000),
          mcpTools: FALLBACK.mcpTools,
        });
      } catch {
        // Keep fallback
      }
    })();
  }, []);

  return stats;
}
