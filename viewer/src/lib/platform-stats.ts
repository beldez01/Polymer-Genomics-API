export interface PlatformStats {
  cpg: string;
  probes: string;
  transcripts: string;
  mcpTools: string;
}

export const MCP_REFERENCE_TOOL_COUNT = 42;
export const MCP_COMPUTE_TOOL_COUNT = 10;
export const MCP_TOOL_COUNT = MCP_REFERENCE_TOOL_COUNT + MCP_COMPUTE_TOOL_COUNT;

// Static counts — update when data is ingested. No API call needed.
const STATS: PlatformStats = {
  cpg: '29M',
  probes: '937K',
  transcripts: '63K',
  mcpTools: String(MCP_TOOL_COUNT),
};

export function usePlatformStats(): PlatformStats {
  return STATS;
}
