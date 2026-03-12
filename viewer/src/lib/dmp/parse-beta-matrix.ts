/**
 * Beta matrix CSV parser for unsupervised clustering.
 *
 * Expects: rows = samples, columns = probes (cg...).
 * First column = sample_id, optional second column = group.
 */

export interface BetaSample {
  sampleId: string;
  group?: string;
  values: Float64Array;  // beta values for each probe
}

export interface BetaMatrix {
  samples: BetaSample[];
  probeIds: string[];
  nSamples: number;
  nProbes: number;
}

const GROUP_ALIASES = ['group', 'sample_group'];

function detectDelimiter(firstLine: string): string {
  const tab = (firstLine.match(/\t/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  return tab > comma ? '\t' : ',';
}

function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseBetaMatrix(text: string): BetaMatrix {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('File must contain a header row and at least one data row');
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter);

  if (headers.length < 2) {
    throw new Error('File must have at least a sample ID column and one probe column');
  }

  // Detect group column (second column only)
  const hasGroup =
    headers.length >= 3 &&
    GROUP_ALIASES.includes(headers[1].toLowerCase().trim());

  const probeStartIdx = hasGroup ? 2 : 1;
  const probeIds = headers.slice(probeStartIdx);

  if (probeIds.length === 0) {
    throw new Error('No probe columns found after sample ID / group columns');
  }

  const nProbes = probeIds.length;
  const samples: BetaSample[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseLine(lines[i], delimiter);
    const sampleId = fields[0];
    if (!sampleId) continue;

    const group = hasGroup ? fields[1] || undefined : undefined;
    const values = new Float64Array(nProbes);

    for (let j = 0; j < nProbes; j++) {
      const raw = fields[probeStartIdx + j];
      const val = raw !== undefined ? parseFloat(raw) : NaN;

      if (isNaN(val)) {
        values[j] = NaN;
      } else if (val < 0 || val > 1) {
        values[j] = NaN; // out-of-range beta values treated as missing
      } else {
        values[j] = val;
      }
    }

    samples.push({ sampleId, group, values });
  }

  if (samples.length === 0) {
    throw new Error('No valid sample rows found after parsing');
  }

  return {
    samples,
    probeIds,
    nSamples: samples.length,
    nProbes,
  };
}
