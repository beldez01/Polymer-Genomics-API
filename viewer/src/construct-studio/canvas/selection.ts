export interface BaseRange {
  strandId: string
  anchor: number
  focus: number
}

export interface CanvasSelection {
  strandIds: string[]
  primaryStrandId: string | null
  baseRange: BaseRange | null
}

export const EMPTY_SELECTION: CanvasSelection = {
  strandIds: [],
  primaryStrandId: null,
  baseRange: null,
}

export type SelectionAction =
  | { type: 'strand-click'; strandId: string; shift: boolean }
  | { type: 'marquee'; strandIds: readonly string[]; additive: boolean }
  | { type: 'base-click'; strandId: string; index: number; shift: boolean }
  | { type: 'base-step'; direction: -1 | 1; extend: boolean; strandLength: number }
  | { type: 'escape' }
  | { type: 'clear' }
  | { type: 'prune'; validStrandIds: readonly string[] }

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

export function selectionReducer(
  state: CanvasSelection,
  action: SelectionAction,
): CanvasSelection {
  switch (action.type) {
    case 'strand-click': {
      if (!action.shift) {
        return {
          strandIds: [action.strandId],
          primaryStrandId: action.strandId,
          baseRange: null,
        }
      }
      const selected = state.strandIds.includes(action.strandId)
      const strandIds = selected
        ? state.strandIds.filter((id) => id !== action.strandId)
        : [...state.strandIds, action.strandId]
      return {
        strandIds,
        primaryStrandId: selected
          ? (strandIds.at(-1) ?? null)
          : action.strandId,
        baseRange: null,
      }
    }
    case 'marquee': {
      const strandIds = unique(action.additive
        ? [...state.strandIds, ...action.strandIds]
        : action.strandIds)
      return {
        strandIds,
        primaryStrandId: strandIds.at(-1) ?? null,
        baseRange: null,
      }
    }
    case 'base-click': {
      const extend = action.shift
        && state.baseRange?.strandId === action.strandId
      return {
        strandIds: [action.strandId],
        primaryStrandId: action.strandId,
        baseRange: {
          strandId: action.strandId,
          anchor: extend ? state.baseRange!.anchor : action.index,
          focus: action.index,
        },
      }
    }
    case 'base-step': {
      if (!state.baseRange || action.strandLength <= 0) return state
      const focus = Math.max(
        0,
        Math.min(action.strandLength - 1, state.baseRange.focus + action.direction),
      )
      return {
        ...state,
        baseRange: {
          ...state.baseRange,
          anchor: action.extend ? state.baseRange.anchor : focus,
          focus,
        },
      }
    }
    case 'escape':
      if (state.baseRange) {
        return { ...state, baseRange: null }
      }
      return state.strandIds.length > 0 ? EMPTY_SELECTION : state
    case 'clear':
      return state.strandIds.length > 0 || state.baseRange
        ? EMPTY_SELECTION
        : state
    case 'prune': {
      const valid = new Set(action.validStrandIds)
      const strandIds = state.strandIds.filter((id) => valid.has(id))
      const primaryStrandId = state.primaryStrandId && valid.has(state.primaryStrandId)
        ? state.primaryStrandId
        : (strandIds.at(-1) ?? null)
      return {
        strandIds,
        primaryStrandId,
        baseRange: state.baseRange && valid.has(state.baseRange.strandId)
          ? state.baseRange
          : null,
      }
    }
  }
}
