// src/lib/te-methylation/parse-betas.ts
// Parse CSV/TSV beta value files and auto-detect platform.

export type Platform = 'epic_v2' | 'epic_v1' | '450k' | '27k';

interface ParseResult {
  betas: Map<string, number>;
  platform: Platform;
  totalLines: number;
  validLines: number;
  errors: string[];
}

// Known probe counts per platform (approximate, for detection)
const PLATFORM_THRESHOLDS: [Platform, number, number][] = [
  ['epic_v2', 850_000, 950_000],
  ['epic_v1', 750_000, 870_000],
  ['450k',    400_000, 500_000],
  ['27k',      20_000,  30_000],
];

/**
 * Detect platform from the number of valid probes.
 * Falls back based on nearest match.
 */
function detectPlatform(nProbes: number): Platform {
  for (const [platform, low, high] of PLATFORM_THRESHOLDS) {
    if (nProbes >= low && nProbes <= high) return platform;
  }
  // Fallback: pick closest upper bound
  if (nProbes > 870_000) return 'epic_v2';
  if (nProbes > 500_000) return 'epic_v1';
  if (nProbes > 30_000) return '450k';
  return '27k';
}

/**
 * Parse a CSV or TSV string with probe_id + beta columns.
 *
 * Supports:
 * - Tab or comma delimited
 * - Header row (auto-detected via cg/ch prefix check)
 * - probe_id in column 0, beta in column 1 (or auto-detect)
 * - Values outside [0,1] are clipped with warning
 */
export function parseBetaFile(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: string[] = [];
  const betas = new Map<string, number>();

  if (lines.length === 0) {
    return { betas, platform: '450k', totalLines: 0, validLines: 0, errors: ['Empty file'] };
  }

  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  // Detect header
  const firstFields = firstLine.split(delimiter);
  let startLine = 0;
  let probeCol = 0;
  let betaCol = 1;

  // Check if first line is a header (no cg/ch prefix in first field)
  const firstVal = firstFields[0].trim().toLowerCase();
  if (!firstVal.startsWith('cg') && !firstVal.startsWith('ch.')) {
    startLine = 1;
    // Try to find column indices from header
    for (let i = 0; i < firstFields.length; i++) {
      const h = firstFields[i].trim().toLowerCase();
      if (h === 'probe_id' || h === 'cpg' || h === 'probeid' || h === 'name' || h === 'ilmnid') {
        probeCol = i;
      }
      if (h === 'beta' || h === 'beta_value' || h === 'avg_beta' || h === 'mean_beta') {
        betaCol = i;
      }
    }
  }

  let clipped = 0;
  for (let i = startLine; i < lines.length; i++) {
    const fields = lines[i].split(delimiter);
    if (fields.length <= Math.max(probeCol, betaCol)) continue;

    const probeId = fields[probeCol].trim();
    if (!probeId.startsWith('cg') && !probeId.startsWith('ch.')) continue;

    const raw = parseFloat(fields[betaCol].trim());
    if (isNaN(raw)) continue;

    let beta = raw;
    if (beta < 0 || beta > 1) {
      beta = Math.max(0, Math.min(1, beta));
      clipped++;
    }

    betas.set(probeId, beta);
  }

  if (clipped > 0) {
    errors.push(`${clipped} values clipped to [0, 1]`);
  }

  const platform = detectPlatform(betas.size);

  return {
    betas,
    platform,
    totalLines: lines.length - startLine,
    validLines: betas.size,
    errors,
  };
}
