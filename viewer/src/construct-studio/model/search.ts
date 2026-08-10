import { canPair } from './duplex'
import type { RnaStrand, Workspace } from './types'

export type MotifMode = 'iupac' | 'regex'

export interface MotifHit {
  strandId: string
  /** Half-open, in strand coordinates. */
  from: number
  to: number
}

export type MotifResult =
  | { ok: true; hits: MotifHit[] }
  | { ok: false; error: string }

/**
 * IUPAC degenerate codes, as the set of RNA bases each stands for.
 * T is accepted on input and read as U.
 */
const IUPAC_EXPANSION: Record<string, string> = {
  A: 'A', C: 'C', G: 'G', U: 'U', T: 'U',
  R: 'AG', Y: 'CU', S: 'GC', W: 'AU', K: 'GU', M: 'AC',
  B: 'CGU', D: 'AGU', H: 'ACU', V: 'ACG', N: 'ACGU',
}

const asRna = (base: string) => (base === 'T' ? 'U' : base)
const asRnaSequence = (sequence: string) => sequence.toUpperCase().replace(/T/g, 'U')

/**
 * A pattern code is satisfied only if every base the sequence letter could be
 * is one the pattern allows. So pattern N matches a concrete A, but pattern A
 * does not match a sequence N — an unknown base is not a confirmed match.
 */
function codeMatches(patternCode: string, sequenceLetter: string): boolean {
  const allowed = IUPAC_EXPANSION[patternCode]
  const actual = IUPAC_EXPANSION[asRna(sequenceLetter)]
  if (!allowed || !actual) return false
  for (const base of actual) {
    if (!allowed.includes(base)) return false
  }
  return true
}

function findIupac(strand: RnaStrand, pattern: string): MotifResult {
  const codes = pattern.toUpperCase()
  for (let i = 0; i < codes.length; i += 1) {
    if (!IUPAC_EXPANSION[codes[i]]) {
      return { ok: false, error: `"${codes[i]}" at position ${i} is not an IUPAC nucleotide code.` }
    }
  }

  const hits: MotifHit[] = []
  const sequence = strand.sequence.toUpperCase()
  for (let start = 0; start + codes.length <= sequence.length; start += 1) {
    let matched = true
    for (let offset = 0; offset < codes.length; offset += 1) {
      if (!codeMatches(codes[offset], sequence[start + offset])) {
        matched = false
        break
      }
    }
    if (matched) hits.push({ strandId: strand.id, from: start, to: start + codes.length })
  }
  return { ok: true, hits }
}

function findRegex(strand: RnaStrand, pattern: string): MotifResult {
  let sticky: RegExp
  try {
    // Sticky, tried at every index, so regex hits may overlap exactly as IUPAC hits do.
    sticky = new RegExp(pattern, 'iy')
  } catch (error) {
    return { ok: false, error: `Invalid regular expression: ${(error as Error).message}` }
  }

  const hits: MotifHit[] = []
  const sequence = strand.sequence.toUpperCase()
  for (let start = 0; start < sequence.length; start += 1) {
    sticky.lastIndex = start
    const match = sticky.exec(sequence)
    // A zero-length match matches everywhere and locates nothing.
    if (!match || match[0].length === 0) continue
    hits.push({ strandId: strand.id, from: start, to: start + match[0].length })
  }
  return { ok: true, hits }
}

/** Occurrences of `pattern` in one strand. An empty pattern finds nothing. */
export function findMotif(strand: RnaStrand, pattern: string, mode: MotifMode): MotifResult {
  if (pattern.length === 0) return { ok: true, hits: [] }
  return mode === 'regex' ? findRegex(strand, pattern) : findIupac(strand, pattern)
}

export interface ComplementHit {
  strandId: string
  /** Half-open, in that strand's coordinates. */
  from: number
  to: number
  /** Canonical and wobble pairs together. */
  pairs: number
  wobbles: number
  mismatches: number
}

/**
 * Every region in `targets` that could pair with `query[from, to)`.
 *
 * Pairing is antiparallel, following the same convention as evaluateDuplex:
 * query base i pairs with the candidate window's base (length - 1 - i). A G-U
 * wobble counts as a pair, not a mismatch; an ambiguity code counts as a
 * mismatch, since it cannot be confirmed to pair. A window overlapping the
 * query on the query's own strand is never reported — a region cannot pair
 * with itself — which leaves hairpin arms findable and self-hits excluded.
 *
 * Best first: fewest mismatches, then most canonical pairs.
 */
export function findComplements(
  query: RnaStrand,
  from: number,
  to: number,
  targets: readonly RnaStrand[],
  maxMismatches: number,
): ComplementHit[] {
  // canPair speaks RNA, so a DNA strand's T is read as the U it stands in for.
  const probe = asRnaSequence(query.sequence.slice(from, to))
  const length = probe.length
  if (length === 0) return []

  const hits: ComplementHit[] = []
  for (const target of targets) {
    const sequence = asRnaSequence(target.sequence)
    for (let start = 0; start + length <= sequence.length; start += 1) {
      if (target.id === query.id && start < to && start + length > from) continue

      let mismatches = 0
      let wobbles = 0
      let pairs = 0
      for (let i = 0; i < length; i += 1) {
        const kind = canPair(probe[i], sequence[start + length - 1 - i])
        if (kind === 'canonical') pairs += 1
        else if (kind === 'wobble') {
          pairs += 1
          wobbles += 1
        } else {
          mismatches += 1
          if (mismatches > maxMismatches) break
        }
      }
      if (mismatches > maxMismatches) continue
      hits.push({ strandId: target.id, from: start, to: start + length, pairs, wobbles, mismatches })
    }
  }

  return hits.sort((a, b) =>
    a.mismatches - b.mismatches || (b.pairs - b.wobbles) - (a.pairs - a.wobbles))
}

export type SearchMode = MotifMode | 'complement'

export interface SearchRequest {
  mode: SearchMode
  /** The motif pattern. Unused in complement mode, which reads the selection instead. */
  pattern: string
  maxMismatches: number
}

export interface SearchHit {
  strandId: string
  from: number
  to: number
}

export interface SearchOutcome {
  hits: SearchHit[]
  /** The request was malformed — a bad pattern. */
  error: string | null
  /** The request was well-formed but had nothing to act on yet. */
  notice: string | null
}

/** Complements of a single base are noise, so a range is required. */
const MIN_COMPLEMENT_QUERY = 2

const nothing = (notice: string | null = null): SearchOutcome => ({ hits: [], error: null, notice })

const NEEDS_RANGE = 'Select a range of at least two bases to find complements for.'
const NEEDS_STRAND = 'Select a strand to search.'

/**
 * One entry point behind the search bar. Motif modes read the selected strand;
 * complement mode reads the selected range and searches the whole workspace.
 * A request with nothing to act on returns a notice rather than empty silence.
 */
export function runSearch(
  workspace: Workspace,
  request: SearchRequest,
  selection: { strandId: string; from: number; to: number } | null,
): SearchOutcome {
  const strand = selection
    ? workspace.strands.find((candidate) => candidate.id === selection.strandId)
    : undefined

  if (request.mode === 'complement') {
    if (!selection || !strand || selection.to - selection.from < MIN_COMPLEMENT_QUERY) {
      return nothing(NEEDS_RANGE)
    }
    const found = findComplements(
      strand,
      selection.from,
      selection.to,
      workspace.strands,
      request.maxMismatches,
    )
    return {
      hits: found.map((hit) => ({ strandId: hit.strandId, from: hit.from, to: hit.to })),
      error: null,
      notice: null,
    }
  }

  if (request.pattern.length === 0) return nothing()
  if (!strand) return nothing(NEEDS_STRAND)

  const result = findMotif(strand, request.pattern, request.mode)
  if (!result.ok) return { hits: [], error: result.error, notice: null }
  return { hits: result.hits, error: null, notice: null }
}
