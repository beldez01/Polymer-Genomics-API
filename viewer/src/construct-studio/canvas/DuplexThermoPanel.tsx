import type { SelectionThermoRow, ThermoConditions } from '../model/thermo'

export interface DuplexThermoPanelProps {
  rows: SelectionThermoRow[]
  conditions: ThermoConditions
  onConditionsChange: (conditions: ThermoConditions) => void
}

/** Drop float noise from a unit conversion without pinning a decimal count. */
const trim = (value: number) => Number(value.toPrecision(12))

/**
 * Stability of every duplex the selection touches. The conditions are inputs on
 * the panel rather than constants in the model: a Tm without its salt and strand
 * concentration is not a number a designer can act on.
 */
export function DuplexThermoPanel({ rows, conditions, onConditionsChange }: DuplexThermoPanelProps) {
  if (rows.length === 0) return null

  return <section className="duplex-thermo" aria-label="Duplex thermodynamics">
    <span className="section-index">DUPLEX STABILITY</span>
    <div className="thermo-conditions">
      <label>
        <span>Na<sup>+</sup> (mM)</span>
        <input
          type="number"
          min={0}
          step={10}
          value={trim(conditions.sodium * 1000)}
          onChange={(event) =>
            onConditionsChange({ ...conditions, sodium: Number(event.target.value) / 1000 })}
        />
      </label>
      <label>
        <span>Ct (µM)</span>
        <input
          type="number"
          min={0}
          step={0.05}
          value={trim(conditions.strandConcentration * 1e6)}
          onChange={(event) =>
            onConditionsChange({ ...conditions, strandConcentration: Number(event.target.value) / 1e6 })}
        />
      </label>
    </div>
    {rows.map((row) => <article key={row.duplexId} className="thermo-row">
      <h3>{row.label}</h3>
      {row.report.status === 'ok'
        ? <>
            <dl>
              <div><dt>ΔG°37</dt><dd>{row.report.deltaG37.toFixed(2)} kcal/mol</dd></div>
              <div><dt>Tm</dt><dd>{row.report.tm.toFixed(1)} °C</dd></div>
              {row.report.saltCorrection && <div>
                <dt>Tm at 1 M Na<sup>+</sup></dt>
                <dd>{row.report.tmAtOneMolarSodium.toFixed(1)} °C</dd>
              </div>}
              <div><dt>ΔH</dt><dd>{row.report.deltaH.toFixed(1)} kcal/mol</dd></div>
              <div><dt>ΔS</dt><dd>{row.report.deltaS.toFixed(1)} cal/(mol·K)</dd></div>
            </dl>
            <p className="thermo-source">
              <span className={`provenance-tag ${row.report.provenance.toLowerCase()}`}>
                {row.report.provenance}
              </span>
              {row.report.parameterSet.source}
              {row.report.saltCorrection ? ` ${row.report.saltCorrection.source}` : ''}
            </p>
            {row.report.notes.map((note) => <p key={note} className="thermo-note">{note}</p>)}
          </>
        : <p className="thermo-note">
            <span className="provenance-tag unverified">UNVERIFIED</span>
            {row.report.reason}
          </p>}
    </article>)}
  </section>
}
