import type { SearchMode, SearchOutcome, SearchRequest } from '../model/search'

const MODE_LABELS: Array<{ value: SearchMode; label: string }> = [
  { value: 'iupac', label: 'IUPAC motif' },
  { value: 'regex', label: 'Regex' },
  { value: 'complement', label: 'Complements of selection' },
]

export interface SequenceSearchProps {
  request: SearchRequest
  onRequestChange: (request: SearchRequest) => void
  outcome: SearchOutcome
  activeIndex: number
  onNavigate: (delta: number) => void
}

/**
 * Pattern, tolerance, count, navigation. Which control is live depends on the
 * mode: a motif search takes a pattern, a complement search takes the current
 * selection and a mismatch tolerance.
 */
export function SequenceSearch({
  request,
  onRequestChange,
  outcome,
  activeIndex,
  onNavigate,
}: SequenceSearchProps) {
  const complementMode = request.mode === 'complement'
  const count = outcome.hits.length
  const searching = complementMode || request.pattern.length > 0

  return <div className="sequence-search" role="search">
    <select
      aria-label="Search mode"
      value={request.mode}
      onChange={(event) => onRequestChange({ ...request, mode: event.target.value as SearchMode })}
    >
      {MODE_LABELS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <input
      aria-label="Search pattern"
      value={request.pattern}
      placeholder={complementMode ? 'Uses the selected range' : 'GCAUC, N, R…'}
      disabled={complementMode}
      onChange={(event) => onRequestChange({ ...request, pattern: event.target.value })}
    />
    <label className="search-tolerance">
      <span>Mismatches</span>
      <input
        type="number"
        aria-label="Mismatch tolerance"
        min={0}
        max={9}
        value={request.maxMismatches}
        disabled={!complementMode}
        onChange={(event) =>
          onRequestChange({ ...request, maxMismatches: Math.max(0, Number(event.target.value)) })}
      />
    </label>
    <span className="search-count" aria-live="polite">
      {outcome.error
        ? <span className="search-error">{outcome.error}</span>
        : outcome.notice
          ? <span className="search-notice">{outcome.notice}</span>
          : searching
            ? count === 0 ? 'No hits' : `${count} hits · ${activeIndex + 1} / ${count}`
            : ''}
    </span>
    <button type="button" aria-label="Previous hit" disabled={count === 0} onClick={() => onNavigate(-1)}>‹</button>
    <button type="button" aria-label="Next hit" disabled={count === 0} onClick={() => onNavigate(1)}>›</button>
  </div>
}
