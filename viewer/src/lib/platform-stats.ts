export interface PlatformStats {
  cpg: string;
  probes: string;
  transcripts: string;
  mcpTools: string;
}

// Static counts — update when data is ingested. No API call needed.
const STATS: PlatformStats = {
  cpg: '29M',
  probes: '937K',
  transcripts: '63K',
  mcpTools: '45',
};

export function usePlatformStats(): PlatformStats {
  return STATS;
}
