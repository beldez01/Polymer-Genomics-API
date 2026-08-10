import { SCHEMA_VERSION, type Workspace } from './types'
import { createPathMetric } from './layout'

const TYPE_KEY = '__rnaConstructStudioType'
const UINT8_ARRAY = 'Uint8Array'

function encodeBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBytes(encoded: string): Uint8Array {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function encodeTypedArrays(_key: string, value: unknown): unknown {
  if (!(value instanceof Uint8Array)) return value
  return { [TYPE_KEY]: UINT8_ARRAY, data: encodeBytes(value) }
}

function decodeTypedArrays(_key: string, value: unknown): unknown {
  if (
    typeof value === 'object' &&
    value !== null &&
    TYPE_KEY in value &&
    (value as Record<string, unknown>)[TYPE_KEY] === UINT8_ARRAY &&
    typeof (value as Record<string, unknown>).data === 'string'
  ) {
    return decodeBytes((value as Record<string, string>).data)
  }
  return value
}

/** Keyed by the schema version being migrated from. */
export const MIGRATIONS: Record<number, (raw: any) => any> = {
  1: (raw) => {
    let nextAutoY = 64
    const strands = Array.isArray(raw.strands)
      ? raw.strands.map((strand: any) => {
          if (strand?.placement) return strand
          if (strand?.layout?.mode === 'manual') {
            return { ...strand, placement: { x: 0, y: 0 } }
          }

          const placement = { x: 64, y: nextAutoY }
          const length = typeof strand?.sequence === 'string' ? strand.sequence.length : 0
          const rows = strand?.renderMode === 'serpentine'
            ? Math.max(1, Math.ceil(length / 60))
            : 1
          nextAutoY += Math.max(24, rows * 24) + 96
          return { ...strand, placement }
        })
      : raw.strands

    const history = Array.isArray(raw.history)
      ? raw.history.map((entry: any) =>
          Array.isArray(entry?.steps) ? entry : { steps: [entry] },
        )
      : raw.history

    return { ...raw, schemaVersion: 2, strands, history }
  },
  2: (raw) => ({
    ...raw,
    schemaVersion: 3,
    history: [],
    historyIndex: 0,
    strands: Array.isArray(raw.strands)
      ? raw.strands.map((strand: any) => {
          const renderMode = strand?.renderMode === 'free' ? 'linear' : strand?.renderMode
          if (strand?.layout?.mode !== 'manual') return { ...strand, renderMode }
          // Old manual paths are strand-local bezier anchors; sample the path
          // directly instead of seeding from a live strand (the `manual` mode
          // no longer exists on RnaStrand, only in this migration's raw data).
          const metric = createPathMetric(strand.layout.path)
          const length = typeof strand.sequence === 'string' ? strand.sequence.length : 0
          const spacing = metric.totalLength / Math.max(1, length - 1)
          const points = Array.from({ length }, (_, index) => metric.pointAt(index * spacing))
          return { ...strand, renderMode, layout: { mode: 'rope', points } }
        })
      : raw.strands,
  }),
}

export function serialize(workspace: Workspace): string {
  return JSON.stringify(
    { ...workspace, schemaVersion: SCHEMA_VERSION },
    encodeTypedArrays,
    2,
  )
}

export function deserialize(json: string): Workspace {
  let raw: any = JSON.parse(json, decodeTypedArrays)

  if (!raw || typeof raw !== 'object' || typeof raw.schemaVersion !== 'number') {
    throw new Error('workspace file has no schemaVersion; refusing to guess its format')
  }
  if (raw.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `workspace was written by a newer version of the studio ` +
        `(schema ${raw.schemaVersion} > ${SCHEMA_VERSION}); refusing to open it`,
    )
  }
  while (raw.schemaVersion < SCHEMA_VERSION) {
    const migrate = MIGRATIONS[raw.schemaVersion]
    if (!migrate) throw new Error(`no migration from schema ${raw.schemaVersion}`)
    raw = migrate(raw)
  }

  if (!Array.isArray(raw.strands)) {
    throw new Error('workspace file has no strands array')
  }
  return raw as Workspace
}
