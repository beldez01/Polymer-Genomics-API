import { pairedRanges } from './duplexSync'
import type { Provenance } from './lint/types'
import type { Duplex, RnaStrand, Workspace } from './types'

/** cal/(mol K). */
export const GAS_CONSTANT = 1.9872
const ZERO_CELSIUS_IN_KELVIN = 273.15
/** 37 C — the temperature every published dG37 column below is quoted at. */
const REFERENCE_TEMPERATURE = 310.15

export type MoleculeType = 'DNA' | 'RNA'

export interface ThermoConditions {
  /** Total strand concentration Ct in mol/L, the two strands taken as equimolar. */
  strandConcentration: number
  /** Monovalent cation concentration in mol/L. */
  sodium: number
}

export interface NearestNeighborStep {
  /** kcal/mol */
  deltaH: number
  /** cal/(mol K) */
  deltaS: number
  /** The paper's own dG37 column, kept as a checksum on the two values above. */
  deltaG37: number
}

export interface SourcedSet {
  id: string
  provenance: Provenance
  source: string
}

/** A duplex of one polymer with itself: DNA:DNA or RNA:RNA. */
export interface DuplexNearestNeighborSet extends SourcedSet {
  molecule: MoleculeType
  /** Keyed by the top-strand dinucleotide, 5' to 3'. Ten of sixteen; the rest follow by symmetry. */
  steps: Record<string, NearestNeighborStep>
  /** Charged once per duplex. Zero in the DNA set, which folds initiation into its terminal terms. */
  initiation: NearestNeighborStep
  /** Charged once per terminal G.C pair. */
  initiationTerminalGC: NearestNeighborStep
  /** Charged once per terminal A.T or A.U pair. */
  initiationTerminalAT: NearestNeighborStep
  symmetry: NearestNeighborStep
}

export interface HybridNearestNeighborSet extends SourcedSet {
  /** Keyed by the RNA-strand dinucleotide, 5' to 3'. Hybrids are asymmetric, so all sixteen. */
  steps: Record<string, NearestNeighborStep>
  initiation: NearestNeighborStep
}

export interface SaltCorrectionSet extends SourcedSet {
  minSodium: number
  maxSodium: number
}

const step = (deltaH: number, deltaS: number, deltaG37: number): NearestNeighborStep =>
  ({ deltaH, deltaS, deltaG37 })

export const SANTALUCIA_1998: DuplexNearestNeighborSet = {
  id: 'santalucia-1998-unified',
  provenance: 'PRIMARY',
  molecule: 'DNA',
  source:
    'SantaLucia J Jr (1998) PNAS 95:1460-1465, "A unified view of polymer, dumbbell, and ' +
    'oligonucleotide DNA nearest-neighbor thermodynamics" — Table 1, unified DNA/DNA parameters at 1 M NaCl.',
  steps: {
    AA: step(-7.9, -22.2, -1.0),
    AT: step(-7.2, -20.4, -0.88),
    TA: step(-7.2, -21.3, -0.58),
    CA: step(-8.5, -22.7, -1.45),
    GT: step(-8.4, -22.4, -1.44),
    CT: step(-7.8, -21.0, -1.28),
    GA: step(-8.2, -22.2, -1.3),
    CG: step(-10.6, -27.2, -2.17),
    GC: step(-9.8, -24.4, -2.24),
    GG: step(-8.0, -19.9, -1.84),
  },
  initiation: step(0, 0, 0),
  initiationTerminalGC: step(0.1, -2.8, 0.98),
  initiationTerminalAT: step(2.3, 4.1, 1.03),
  symmetry: step(0, -1.4, 0.43),
}

export const XIA_1998: DuplexNearestNeighborSet = {
  id: 'xia-1998-rna',
  provenance: 'PRIMARY',
  molecule: 'RNA',
  source:
    'Xia T et al. (1998) Biochemistry 37:14719-14735, "Thermodynamic parameters for an expanded ' +
    'nearest-neighbor model for formation of RNA duplexes with Watson-Crick base pairs" — ten stacks, ' +
    'a single duplex initiation, and a terminal A.U penalty, at 1 M NaCl.',
  steps: {
    AA: step(-6.82, -19.0, -0.93),
    AU: step(-9.38, -26.7, -1.1),
    UA: step(-7.69, -20.5, -1.33),
    CA: step(-10.44, -26.9, -2.11),
    GU: step(-11.4, -29.5, -2.24),
    CU: step(-10.48, -27.1, -2.08),
    GA: step(-12.44, -32.5, -2.35),
    CG: step(-10.64, -26.7, -2.36),
    GC: step(-14.88, -36.9, -3.42),
    GG: step(-13.39, -32.7, -3.26),
  },
  initiation: step(3.61, -1.5, 4.09),
  initiationTerminalGC: step(0, 0, 0),
  initiationTerminalAT: step(3.72, 10.5, 0.45),
  symmetry: step(0, -1.4, 0.43),
}

export const SUGIMOTO_1995: HybridNearestNeighborSet = {
  id: 'sugimoto-1995-hybrid',
  provenance: 'PRIMARY',
  source:
    'Sugimoto N et al. (1995) Biochemistry 34:11211-11216, "Thermodynamic parameters to predict ' +
    'stability of RNA/DNA hybrid duplexes" — sixteen nearest neighbours plus initiation, at 1 M NaCl.',
  steps: {
    AA: step(-7.8, -21.9, -1.0),
    AC: step(-5.9, -12.3, -2.1),
    AG: step(-9.1, -23.5, -1.8),
    AU: step(-8.3, -23.9, -0.9),
    CA: step(-9.0, -26.1, -0.9),
    CC: step(-9.3, -23.2, -2.1),
    CG: step(-16.3, -47.1, -1.7),
    CU: step(-7.0, -19.7, -0.9),
    GA: step(-5.5, -13.5, -1.3),
    GC: step(-8.0, -17.1, -2.7),
    GG: step(-12.8, -31.9, -2.9),
    GU: step(-7.8, -21.6, -1.1),
    UA: step(-7.8, -23.2, -0.6),
    UC: step(-8.6, -22.9, -1.5),
    UG: step(-10.4, -28.4, -1.6),
    UU: step(-11.5, -36.4, -0.2),
  },
  initiation: step(1.9, -3.9, 3.1),
}

export const OWCZARZY_2004: SaltCorrectionSet = {
  id: 'owczarzy-2004-monovalent',
  provenance: 'PRIMARY',
  source:
    'Owczarzy R et al. (2004) Biochemistry 43:3537-3554, "Effects of sodium ions on DNA duplex ' +
    'oligomers" — GC-dependent monovalent correction, validated over 0.069-1.02 M Na+.',
  minSodium: 0.069,
  maxSodium: 1.02,
}

const SAME_POLYMER_SETS: Record<MoleculeType, DuplexNearestNeighborSet> = {
  DNA: SANTALUCIA_1998,
  RNA: XIA_1998,
}

export interface ThermoOk {
  status: 'ok'
  /** kcal/mol at 1 M Na+. */
  deltaH: number
  /** cal/(mol K) at 1 M Na+. */
  deltaS: number
  /** kcal/mol at 37 C, 1 M Na+. */
  deltaG37: number
  /** Celsius, at the conditions given. */
  tm: number
  /** Celsius, at the 1 M Na+ reference state, before any salt correction. */
  tmAtOneMolarSodium: number
  selfComplementary: boolean
  conditions: ThermoConditions
  parameterSet: SourcedSet
  saltCorrection: SourcedSet | null
  /** The weakest provenance of any step taken to reach these numbers. */
  provenance: Provenance
  notes: string[]
}

export interface ThermoUnverified {
  status: 'unverified'
  provenance: 'UNVERIFIED'
  reason: string
}

export type ThermoReport = ThermoOk | ThermoUnverified

const unverified = (reason: string): ThermoUnverified =>
  ({ status: 'unverified', provenance: 'UNVERIFIED', reason })

/** DNA if the sequence carries T, RNA if it carries U, null if it carries both or neither. */
export function inferMoleculeType(sequence: string): MoleculeType | null {
  const upper = sequence.toUpperCase()
  const hasT = upper.includes('T')
  const hasU = upper.includes('U')
  if (hasT === hasU) return null
  return hasT ? 'DNA' : 'RNA'
}

const WATSON_CRICK = new Set(['AT', 'TA', 'AU', 'UA', 'GC', 'CG'])
const WOBBLE = new Set(['GU', 'UG'])
const COMPLEMENT: Record<MoleculeType, Record<string, string>> = {
  DNA: { A: 'T', T: 'A', G: 'C', C: 'G' },
  RNA: { A: 'U', U: 'A', G: 'C', C: 'G' },
}

function duplexStep(set: DuplexNearestNeighborSet, pair: string): NearestNeighborStep {
  const direct = set.steps[pair]
  if (direct) return direct
  // The other six of sixteen: a stack read from the complementary strand is the same stack.
  const complement = COMPLEMENT[set.molecule]
  const flipped = set.steps[complement[pair[1]] + complement[pair[0]]]
  if (!flipped) throw new Error(`${set.id} has no nearest neighbour for ${pair}`)
  return flipped
}

const reverse = (sequence: string) => sequence.split('').reverse().join('')

export interface NearestNeighborInput {
  /** One strand, 5' to 3'. */
  top: string
  /** Its partner, 3' to 5', so that bottom[i] pairs with top[i]. */
  bottom: string
  molecules: { top: MoleculeType; bottom: MoleculeType }
  conditions: ThermoConditions
}

/**
 * Nearest-neighbour dH, dS, dG37 and Tm for a perfectly matched duplex.
 *
 * Everything the model cannot source is refused rather than approximated:
 * mismatches, wobbles, ambiguity codes, RNA:RNA duplexes, and sodium
 * concentrations outside the range Owczarzy 2004 was fitted over.
 */
export function nearestNeighborThermodynamics(input: NearestNeighborInput): ThermoReport {
  const top = input.top.toUpperCase()
  const bottom = input.bottom.toUpperCase()
  const { conditions, molecules } = input

  if (top.length !== bottom.length) {
    return unverified('The two aligned strands differ in length, so they are not a registered duplex.')
  }
  if (top.length < 2) {
    return unverified('Nearest-neighbour parameters describe stacks, so a duplex needs at least two base pairs.')
  }

  for (let i = 0; i < top.length; i += 1) {
    const pair = `${top[i]}${bottom[i]}`
    if (WOBBLE.has(pair)) {
      return unverified(
        `Position ${i} is a ${top[i]}-${bottom[i]} wobble. Neither parameter set covers wobble pairs, ` +
        'so no stability is reported for this duplex.',
      )
    }
    if (!WATSON_CRICK.has(pair)) {
      const ambiguous = !'ACGTU'.includes(top[i]) || !'ACGTU'.includes(bottom[i])
      return unverified(
        ambiguous
          ? `Position ${i} carries an ambiguity code (${top[i]}/${bottom[i]}); it has no nearest-neighbour value.`
          : `Position ${i} is a ${top[i]}-${bottom[i]} mismatch. Internal-mismatch parameters are not in ` +
            'this build, so no stability is reported for this duplex.',
      )
    }
  }

  if (conditions.strandConcentration <= 0) {
    return unverified('Tm needs a positive total strand concentration.')
  }

  const hybrid = molecules.top !== molecules.bottom
  const notes: string[] = []
  const selfComplementary = !hybrid && reverse(bottom) === top

  let deltaH = 0
  let deltaS = 0
  let parameterSet: SourcedSet

  if (hybrid) {
    // Sugimoto's stacks are named for the RNA strand read 5' to 3'.
    const rna = molecules.top === 'RNA' ? top : reverse(bottom)
    for (let i = 0; i + 1 < rna.length; i += 1) {
      const stack = SUGIMOTO_1995.steps[rna.slice(i, i + 2)]
      if (!stack) throw new Error(`${SUGIMOTO_1995.id} has no nearest neighbour for ${rna.slice(i, i + 2)}`)
      deltaH += stack.deltaH
      deltaS += stack.deltaS
    }
    deltaH += SUGIMOTO_1995.initiation.deltaH
    deltaS += SUGIMOTO_1995.initiation.deltaS
    parameterSet = SUGIMOTO_1995
  } else {
    const set = SAME_POLYMER_SETS[molecules.top]
    const strand = set.molecule === 'DNA' ? top.replace(/U/g, 'T') : top.replace(/T/g, 'U')
    for (let i = 0; i + 1 < strand.length; i += 1) {
      const stack = duplexStep(set, strand.slice(i, i + 2))
      deltaH += stack.deltaH
      deltaS += stack.deltaS
    }
    deltaH += set.initiation.deltaH
    deltaS += set.initiation.deltaS
    for (const terminal of [strand[0], strand[strand.length - 1]]) {
      const init = terminal === 'G' || terminal === 'C'
        ? set.initiationTerminalGC
        : set.initiationTerminalAT
      deltaH += init.deltaH
      deltaS += init.deltaS
    }
    if (selfComplementary) {
      deltaH += set.symmetry.deltaH
      deltaS += set.symmetry.deltaS
    }
    parameterSet = set
  }

  // Tm = dH / (dS + R ln(Ct/4)); a self-complementary duplex uses Ct, not Ct/4.
  const divisor = selfComplementary ? 1 : 4
  const denominator = deltaS + GAS_CONSTANT * Math.log(conditions.strandConcentration / divisor)
  const tmKelvinAtOneMolar = (deltaH * 1000) / denominator
  if (!Number.isFinite(tmKelvinAtOneMolar) || tmKelvinAtOneMolar <= 0) {
    return unverified('The nearest-neighbour sum gives no physical melting temperature at these conditions.')
  }

  let tmKelvin = tmKelvinAtOneMolar
  let saltCorrection: SourcedSet | null = null
  let provenance: Provenance = parameterSet.provenance

  if (conditions.sodium !== 1) {
    if (conditions.sodium < OWCZARZY_2004.minSodium || conditions.sodium > OWCZARZY_2004.maxSodium) {
      return unverified(
        `Sodium is ${conditions.sodium} M. The Owczarzy 2004 correction was validated over ` +
        `${OWCZARZY_2004.minSodium}-${OWCZARZY_2004.maxSodium} M Na+, and extrapolating past that ` +
        'range would be inventing a number.',
      )
    }
    const gcFraction = (top.match(/[GC]/g)?.length ?? 0) / top.length
    const lnSodium = Math.log(conditions.sodium)
    tmKelvin = 1 / (
      1 / tmKelvinAtOneMolar
      + (4.29 * gcFraction - 3.95) * 1e-5 * lnSodium
      + 9.4e-6 * lnSodium * lnSodium
    )
    saltCorrection = OWCZARZY_2004
    if (parameterSet !== SANTALUCIA_1998) {
      const kind = hybrid ? 'a DNA:RNA hybrid' : 'an RNA:RNA duplex'
      provenance = 'UNVERIFIED'
      notes.push(
        `Owczarzy 2004 was fitted on DNA:DNA duplexes. Applying it to ${kind} is not sourced, ` +
        'so the salt-corrected Tm is unverified. Only the 1 M Na+ figure rests on published parameters.',
      )
    }
  }

  return {
    status: 'ok',
    deltaH,
    deltaS,
    deltaG37: deltaH - REFERENCE_TEMPERATURE * (deltaS / 1000),
    tm: tmKelvin - ZERO_CELSIUS_IN_KELVIN,
    tmAtOneMolarSodium: tmKelvinAtOneMolar - ZERO_CELSIUS_IN_KELVIN,
    selfComplementary,
    conditions,
    parameterSet,
    saltCorrection,
    provenance,
    notes,
  }
}

/**
 * Thermodynamics of a duplex in the document. Registration is read the same way
 * evaluateDuplex reads it: a-side local i pairs with b-side local
 * (bLength - 1 - i + registration). Overhanging positions are not part of the
 * duplex and are excluded.
 */
export function duplexThermodynamics(
  duplex: Duplex,
  strands: readonly RnaStrand[],
  conditions: ThermoConditions,
): ThermoReport {
  const strandA = strands.find((strand) => strand.id === duplex.a.strandId)
  const strandB = strands.find((strand) => strand.id === duplex.b.strandId)
  if (!strandA || !strandB) {
    throw new Error(`duplex ${duplex.id} references a missing strand`)
  }

  const sequenceA = strandA.sequence.slice(duplex.a.start, duplex.a.end)
  const sequenceB = strandB.sequence.slice(duplex.b.start, duplex.b.end)
  const bLength = sequenceB.length

  let top = ''
  let bottom = ''
  for (let aIndex = 0; aIndex < sequenceA.length; aIndex += 1) {
    const bIndex = bLength - 1 - aIndex + duplex.registration
    if (bIndex < 0 || bIndex >= bLength) continue
    top += sequenceA[aIndex]
    bottom += sequenceB[bIndex]
  }

  // Molecule type is a property of the strand, not of the paired window, so a
  // window that happens to read ACG still knows which polymer it belongs to.
  const topMolecule = inferMoleculeType(strandA.sequence)
  const bottomMolecule = inferMoleculeType(strandB.sequence)
  if (!topMolecule || !bottomMolecule) {
    const unnamed = !topMolecule ? strandA.name : strandB.name
    return unverified(
      `"${unnamed}" cannot be typed as DNA or RNA from its sequence — it carries both T and U, or neither. ` +
      'Nearest-neighbour parameters are polymer-specific, so none is applied.',
    )
  }

  return nearestNeighborThermodynamics({
    top,
    bottom,
    molecules: { top: topMolecule, bottom: bottomMolecule },
    conditions,
  })
}

export interface SelectionThermoRow {
  duplexId: string
  /** Both partner strands, in the duplex's own a/b order. */
  label: string
  report: ThermoReport
}

/** Every duplex the given base range touches, each costed once. */
export function selectionThermodynamics(
  workspace: Workspace,
  range: { strandId: string; from: number; to: number } | null,
  conditions: ThermoConditions,
): SelectionThermoRow[] {
  if (!range) return []
  const nameById = new Map(workspace.strands.map((strand) => [strand.id, strand.name]))
  const seen = new Set<string>()
  const rows: SelectionThermoRow[] = []

  for (const paired of pairedRanges(workspace.duplexes, range.strandId, range.from, range.to)) {
    if (seen.has(paired.duplexId)) continue
    seen.add(paired.duplexId)
    const duplex = workspace.duplexes.find((candidate) => candidate.id === paired.duplexId)
    if (!duplex) continue
    rows.push({
      duplexId: duplex.id,
      label: `${nameById.get(duplex.a.strandId) ?? duplex.a.strandId} / ` +
        `${nameById.get(duplex.b.strandId) ?? duplex.b.strandId}`,
      report: duplexThermodynamics(duplex, workspace.strands, conditions),
    })
  }
  return rows
}
