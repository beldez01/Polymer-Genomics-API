import { nextId } from './factories'
import { IUPAC_AMBIGUITY } from './sequence'
import type { Provenance } from './lint/types'
import type { Duplex, EditOp, RnaStrand, Workspace } from './types'

/**
 * Standard dot-bracket. Each class pairs only with itself, so a second or third
 * class can express a helix that crosses another — a pseudoknot, which the rope
 * model can lay out because it assumes no planarity.
 */
const BRACKET_CLASSES: Array<{ open: string; close: string }> = [
  { open: '(', close: ')' },
  { open: '[', close: ']' },
  { open: '{', close: '}' },
]

export type ParsedStructure =
  | { ok: true; pairTable: number[] }
  | { ok: false; error: string }

/** `pairTable[i]` is the index base i pairs with, or -1 when it is unpaired. */
export function parseDotBracket(dotBracket: string): ParsedStructure {
  const pairTable = new Array<number>(dotBracket.length).fill(-1)
  const stacks = BRACKET_CLASSES.map(() => [] as number[])

  for (let index = 0; index < dotBracket.length; index += 1) {
    const character = dotBracket[index]
    if (character === '.') continue

    const opening = BRACKET_CLASSES.findIndex((bracket) => bracket.open === character)
    if (opening !== -1) {
      stacks[opening].push(index)
      continue
    }

    const closing = BRACKET_CLASSES.findIndex((bracket) => bracket.close === character)
    if (closing === -1) {
      return { ok: false, error: `"${character}" at position ${index} is not dot-bracket notation.` }
    }
    const partner = stacks[closing].pop()
    if (partner === undefined) {
      return { ok: false, error: `"${character}" at position ${index} closes a pair that was never opened.` }
    }
    pairTable[partner] = index
    pairTable[index] = partner
  }

  for (let classIndex = 0; classIndex < stacks.length; classIndex += 1) {
    const unclosed = stacks[classIndex][0]
    if (unclosed !== undefined) {
      return {
        ok: false,
        error: `"${BRACKET_CLASSES[classIndex].open}" at position ${unclosed} is never closed.`,
      }
    }
  }

  return { ok: true, pairTable }
}

const crosses = (a: [number, number], b: [number, number]) =>
  (a[0] < b[0] && b[0] < a[1] && a[1] < b[1]) || (b[0] < a[0] && a[0] < b[1] && b[1] < a[1])

/**
 * Null when the structure needs more bracket classes than dot-bracket carries.
 * Crossing pairs are pushed to the next class, so a pseudoknot round-trips
 * instead of being flattened into a different structure that happens to parse.
 */
export function toDotBracket(pairTable: readonly number[]): string | null {
  const assigned: Array<Array<[number, number]>> = BRACKET_CLASSES.map(() => [])
  const classOf = new Map<number, number>()

  for (let index = 0; index < pairTable.length; index += 1) {
    const partner = pairTable[index]
    if (partner === -1 || partner < index) continue
    const pair: [number, number] = [index, partner]
    const free = assigned.findIndex((pairs) => pairs.every((other) => !crosses(pair, other)))
    if (free === -1) return null
    assigned[free].push(pair)
    classOf.set(index, free)
    classOf.set(partner, free)
  }

  let out = ''
  for (let index = 0; index < pairTable.length; index += 1) {
    const partner = pairTable[index]
    if (partner === -1) {
      out += '.'
      continue
    }
    const bracket = BRACKET_CLASSES[classOf.get(index)!]
    out += partner > index ? bracket.open : bracket.close
  }
  return out
}

export interface Helix {
  /** Half-open, the 5' side of the helix. */
  from: number
  to: number
  /** Half-open, the 3' side, which runs antiparallel to it. */
  partnerFrom: number
  partnerTo: number
}

/**
 * Maximal stacked runs of pairs. A bulge, an internal loop or a junction ends a
 * run, so each helix maps onto exactly one duplex with a clean registration.
 */
export function helicesOf(pairTable: readonly number[]): Helix[] {
  const helices: Helix[] = []
  let index = 0
  while (index < pairTable.length) {
    const partner = pairTable[index]
    // Only walk each helix from its 5' side, so it is reported once.
    if (partner === -1 || partner < index) {
      index += 1
      continue
    }
    let length = 1
    while (
      pairTable[index + length] === partner - length
      && index + length < partner - length
    ) length += 1

    helices.push({
      from: index,
      to: index + length,
      partnerFrom: partner - length + 1,
      partnerTo: partner + 1,
    })
    index += length
  }
  return helices
}

/**
 * A folding result is a set of proposed duplexes, which is a thing this model
 * already has. Registration is zero by construction: helix base from+k pairs
 * with partnerTo-1-k, exactly what evaluateDuplex reads off a duplex.
 */
export function foldToDuplexes(strandId: string, pairTable: readonly number[]): Duplex[] {
  return helicesOf(pairTable).map((helix) => ({
    id: nextId('fold'),
    a: { strandId, start: helix.from, end: helix.to },
    b: { strandId, start: helix.partnerFrom, end: helix.partnerTo },
    role: 'predicted' as const,
    registration: 0,
  }))
}

/** AUP: the mean per-base unpaired probability. Null when there is no ensemble. */
export function averageUnpairedProbability(profile: readonly number[]): number | null {
  if (profile.length === 0) return null
  return profile.reduce((sum, value) => sum + value, 0) / profile.length
}

export type StructureOps =
  | { ok: true; operations: EditOp[] }
  | { ok: false; error: string }

/**
 * The edit that puts a structure onto a strand, as one undoable gesture.
 *
 * Useful with no engine at all: paste the dot-bracket an external folder
 * produced and the prediction becomes duplexes you can then edit by hand, which
 * is the thing a folding tool will not let you do. Re-applying replaces the
 * previous prediction rather than stacking on it, and never touches a duplex
 * the user drew.
 */
export function applyStructureOps(
  workspace: Workspace,
  strandId: string,
  dotBracket: string,
): StructureOps {
  const strand = workspace.strands.find((candidate) => candidate.id === strandId)
  if (!strand) return { ok: false, error: `No strand ${strandId} in this workspace.` }

  if (dotBracket.length !== strand.sequence.length) {
    return {
      ok: false,
      error: `"${strand.name}" is ${strand.sequence.length} nt but the structure is `
        + `${dotBracket.length} characters. A structure describes every base.`,
    }
  }

  const parsed = parseDotBracket(dotBracket)
  if (!parsed.ok) return { ok: false, error: parsed.error }

  const superseded = workspace.duplexes.filter(
    (duplex) => duplex.role === 'predicted' && duplex.a.strandId === strandId,
  )
  return {
    ok: true,
    operations: [
      ...superseded.map((duplex): EditOp => ({ op: 'unpair', duplexId: duplex.id })),
      ...foldToDuplexes(strandId, parsed.pairTable).map((duplex): EditOp => ({ op: 'pair', duplex })),
    ],
  }
}

export type StructureRead =
  | { ok: true; dotBracket: string; omittedPartners: string[] }
  | { ok: false; error: string }

/**
 * The strand's current pairing, written as dot-bracket.
 *
 * The other half of the paste path: draw or predict a structure here, read it
 * out, and hand it to whatever external tool you want to compare against.
 * Dot-bracket describes one molecule, so a pairing to a different strand cannot
 * be written — those are omitted and the partner strands named, rather than
 * dropped silently.
 */
export function structureOf(workspace: Workspace, strandId: string): StructureRead {
  const strand = workspace.strands.find((candidate) => candidate.id === strandId)
  if (!strand) return { ok: false, error: `No strand ${strandId} in this workspace.` }

  const pairTable = new Array<number>(strand.sequence.length).fill(-1)
  const omitted = new Set<string>()

  for (const duplex of workspace.duplexes) {
    const touchesA = duplex.a.strandId === strandId
    const touchesB = duplex.b.strandId === strandId
    if (!touchesA && !touchesB) continue
    if (duplex.a.strandId !== duplex.b.strandId) {
      const partnerId = touchesA ? duplex.b.strandId : duplex.a.strandId
      const partner = workspace.strands.find((candidate) => candidate.id === partnerId)
      omitted.add(partner?.name ?? partnerId)
      continue
    }

    const bLength = duplex.b.end - duplex.b.start
    for (let aIndex = 0; aIndex < duplex.a.end - duplex.a.start; aIndex += 1) {
      const bIndex = bLength - 1 - aIndex + duplex.registration
      if (bIndex < 0 || bIndex >= bLength) continue
      const left = duplex.a.start + aIndex
      const right = duplex.b.start + bIndex
      if (left >= pairTable.length || right >= pairTable.length) continue
      pairTable[left] = right
      pairTable[right] = left
    }
  }

  const dotBracket = toDotBracket(pairTable)
  if (dotBracket === null) {
    return {
      ok: false,
      error: `"${strand.name}" has more crossing helices than dot-bracket can express.`,
    }
  }
  return { ok: true, dotBracket, omittedPartners: [...omitted] }
}

export interface FoldParameters {
  /** Celsius. Folding free energies are temperature-dependent. */
  temperature: number
}

/** What an engine hands back. Everything derived from it is added downstream. */
export interface EngineFoldResult {
  engineId: string
  engineVersion: string
  /** The model and parameter set behind the prediction, named. */
  source: string
  provenance: Provenance
  parameters: FoldParameters
  dotBracket: string
  pairTable: number[]
  /** kcal/mol, when the engine reports a minimum free energy. */
  mfe?: number
  /** Per-base probability of being unpaired, from a partition function. */
  unpairedProbability?: number[]
  ensembleDiversity?: number
}

export interface FoldPrediction extends EngineFoldResult {
  averageUnpairedProbability: number | null
}

export interface FoldingEngine {
  id: string
  name: string
  version: string
  source: string
  provenance: Provenance
  fold(sequence: string, parameters: FoldParameters): Promise<EngineFoldResult>
}

export type FoldOutcome =
  | { status: 'ok'; prediction: FoldPrediction; duplexes: Duplex[] }
  | { status: 'unavailable'; provenance: 'UNVERIFIED'; reason: string }

const unavailable = (reason: string): FoldOutcome =>
  ({ status: 'unavailable', provenance: 'UNVERIFIED', reason })

/**
 * Fold one strand through whichever engine is installed.
 *
 * There is no built-in engine and no fallback: with none installed this reports
 * UNVERIFIED rather than inventing a structure. An engine that returns a
 * structure inconsistent with the sequence it was given throws, because a
 * silently wrong structure would be drawn on the canvas as though it were real.
 */
export async function foldStrand(
  strand: RnaStrand,
  engine: FoldingEngine | null,
  parameters: FoldParameters,
): Promise<FoldOutcome> {
  if (!engine) {
    return unavailable(
      'No folding engine is installed, so no structure is predicted. '
      + 'Nothing here is a substitute for one.',
    )
  }
  if (strand.sequence.length === 0) return unavailable(`"${strand.name}" has no sequence to fold.`)

  const ambiguous = strand.sequence.split('').findIndex((base) => IUPAC_AMBIGUITY.includes(base))
  if (ambiguous !== -1) {
    return unavailable(
      `"${strand.name}" carries the ambiguity code ${strand.sequence[ambiguous]} at position `
      + `${ambiguous + 1}. Folding models are defined over concrete bases only.`,
    )
  }

  const result = await engine.fold(strand.sequence, parameters)

  if (result.pairTable.length !== strand.sequence.length) {
    throw new Error(
      `folding engine ${engine.id} returned a structure of length ${result.pairTable.length} `
      + `for a sequence of length ${strand.sequence.length}`,
    )
  }
  for (let index = 0; index < result.pairTable.length; index += 1) {
    const partner = result.pairTable[index]
    if (partner === -1) continue
    if (result.pairTable[partner] !== index) {
      throw new Error(
        `folding engine ${engine.id} returned an asymmetric pair table: `
        + `${index} pairs with ${partner}, which pairs with ${result.pairTable[partner]}`,
      )
    }
  }
  if (result.unpairedProbability && result.unpairedProbability.length !== strand.sequence.length) {
    throw new Error(
      `folding engine ${engine.id} returned an unpaired profile of length `
      + `${result.unpairedProbability.length} for a sequence of length ${strand.sequence.length}`,
    )
  }

  return {
    status: 'ok',
    prediction: {
      ...result,
      averageUnpairedProbability: result.unpairedProbability
        ? averageUnpairedProbability(result.unpairedProbability)
        : null,
    },
    duplexes: foldToDuplexes(strand.id, result.pairTable),
  }
}
