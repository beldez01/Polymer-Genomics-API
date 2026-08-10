import type { LintFinding } from '../model/lint'

export interface LintPanelProps {
  findings: readonly LintFinding[]
  collapsed: boolean
  onToggle: () => void
}

/**
 * Design lint, on the canvas rather than in a report tab.
 *
 * Every finding shows its provenance tag beside its message, because a rule
 * resting on a vendor page and a rule resting on a measured study should not
 * read identically — that is the whole point of the tagged rule pack.
 */
export function LintPanel({ findings, collapsed, onToggle }: LintPanelProps) {
  if (findings.length === 0) return null

  return <aside className={`lint-panel ${collapsed ? 'collapsed' : ''}`} aria-label="Design lint">
    <div>
      <span className="section-index">DESIGN LINT · {findings.length}</span>
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand design lint' : 'Minimize design lint'}
        aria-expanded={!collapsed}
      >{collapsed ? '+' : '–'}</button>
    </div>
    {!collapsed && <ul>
      {findings.map((finding, index) => <li key={`${finding.ruleId}-${index}`} className={finding.severity}>
        <span className="lint-rule">{finding.ruleId}</span>
        <span className={`provenance-tag ${finding.provenance.toLowerCase()}`}>{finding.provenance}</span>
        <p className="lint-message">{finding.message}</p>
        <p className="lint-source">{finding.source}</p>
      </li>)}
    </ul>}
  </aside>
}
