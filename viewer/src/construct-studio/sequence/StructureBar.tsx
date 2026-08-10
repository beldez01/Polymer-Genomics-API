import { useState } from 'react'

export interface StructureBarProps {
  /** Applies the structure and returns an error to show, or null on success. */
  onApply: (dotBracket: string) => string | null
  /** The strand's current pairing as dot-bracket, or an error to show. */
  onRead: () => { ok: true; dotBracket: string; note: string | null } | { ok: false; error: string }
  disabled?: boolean
}

/**
 * Dot-bracket in, duplexes out. This is the folding feature that works with no
 * engine installed: paste what an external folder produced and the prediction
 * becomes duplexes you can edit by hand.
 */
export function StructureBar({ onApply, onRead, disabled }: StructureBarProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const apply = () => {
    if (!text) return
    setNote(null)
    setError(onApply(text))
  }

  const read = () => {
    const result = onRead()
    if (!result.ok) {
      setError(result.error)
      return
    }
    setText(result.dotBracket)
    setError(null)
    setNote(result.note)
  }

  return <div className="structure-bar">
    <input
      aria-label="Dot-bracket structure"
      value={text}
      placeholder="((((....))))  from RNAfold, forna, …"
      disabled={disabled}
      onChange={(event) => {
        setText(event.target.value.replace(/\s+/g, ''))
        setError(null)
        setNote(null)
      }}
    />
    <button type="button" onClick={read} disabled={disabled}>Read</button>
    <button type="button" onClick={apply} disabled={disabled || !text}>Apply structure</button>
    {error && <span className="structure-error">{error}</span>}
    {!error && note && <span className="structure-note">{note}</span>}
  </div>
}
