export const RNA_ALPHABET = 'ACGU'
export const DNA_ALPHABET = 'ACGT'
export const IUPAC_AMBIGUITY = 'RYSWKMBDHVN'

const ALLOWED = new Set((RNA_ALPHABET + 'T' + IUPAC_AMBIGUITY).split(''))
const RNA_ALPHABET_SET = new Set(RNA_ALPHABET.split(''))
const IUPAC_AMBIGUITY_SET = new Set(IUPAC_AMBIGUITY.split(''))

export interface ParseSuccess {
  ok: true
  sequence: string
  caseMask?: Uint8Array
  hasThymine: boolean
  ambiguousPositions: number[]
  fastaHeader?: string
}

export interface ParseFailure {
  ok: false
  invalid: { index: number; char: string }[]
}

export type ParseResult = ParseSuccess | ParseFailure

export function isCanonical(ch: string): boolean {
  return ch.length === 1 && RNA_ALPHABET_SET.has(ch)
}

export function isAmbiguous(ch: string): boolean {
  return ch.length === 1 && IUPAC_AMBIGUITY_SET.has(ch)
}

/**
 * The single input boundary for user-supplied sequence.
 * Whitespace is formatting and is removed. Everything else that is not a
 * recognised base is an ERROR reported with its position — never stripped.
 */
export function parseSequenceInput(raw: string): ParseResult {
  let body = raw
  let fastaHeader: string | undefined

  if (body.startsWith('>')) {
    const newline = body.indexOf('\n')
    fastaHeader = (newline === -1 ? body.slice(1) : body.slice(1, newline)).trim()
    body = newline === -1 ? '' : body.slice(newline + 1)
  }

  const cleaned = body.replace(/\s+/g, '')
  const upper = cleaned.toUpperCase()

  const invalid: { index: number; char: string }[] = []
  const ambiguousPositions: number[] = []
  let hasThymine = false
  let anyLower = false

  for (let i = 0; i < upper.length; i += 1) {
    const ch = upper[i]
    if (!ALLOWED.has(ch)) {
      invalid.push({ index: i, char: cleaned[i] })
      continue
    }
    if (ch === 'T') hasThymine = true
    if (isAmbiguous(ch)) ambiguousPositions.push(i)
    if (cleaned[i] !== ch) anyLower = true
  }

  if (invalid.length > 0) return { ok: false, invalid }

  let caseMask: Uint8Array | undefined
  if (anyLower) {
    caseMask = new Uint8Array(upper.length)
    for (let i = 0; i < upper.length; i += 1) {
      caseMask[i] = cleaned[i] !== upper[i] ? 1 : 0
    }
  }

  return { ok: true, sequence: upper, caseMask, hasThymine, ambiguousPositions, fastaHeader }
}

/** Explicit, user-invoked T→U. Callers must record this as an EditOp. */
export function applyDnaToRna(sequence: string): string {
  return sequence.replace(/T/g, 'U')
}

/** Builds a case mask for a raw string with no validation. */
export function packCaseMask(raw: string): Uint8Array {
  const mask = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    mask[i] = raw[i] !== raw[i].toUpperCase() ? 1 : 0
  }
  return mask
}
