/** Original explanatory diagrams. No coordinates represent experimental data. */
export function PhysicalFoundationFigure({ kind }: { kind: 'mechanics' | 'evidence' }) {
  if (kind === 'evidence') {
    const steps = [
      ['Prediction', 'A model gives a value.', 'Does an independent assay measure the same quantity?'],
      ['Measurement', 'An assay supplies an observable.', 'What do its conditions and resolution allow us to infer?'],
      ['Association', 'Two quantities vary together.', 'Could sequence covariates or sampling explain the pattern?'],
      ['Intervention', 'A controlled change alters an outcome.', 'Was the proposed route isolated from indirect effects?'],
      ['Mechanism', 'An account links the steps.', 'Which competing account makes a different prediction?'],
    ];
    return <figure className="library-figure library-evidence-figure">
      <div className="library-figure-kicker">From annotation to a testable explanation</div>
      <ol className="library-evidence-steps">{steps.map(([title, description, question], index) => <li key={title}>
        <span className="library-stage-number">0{index + 1} / {title}</span>
        <strong>{description}</strong><p>{question}</p>
      </li>)}</ol>
      <figcaption>Conceptual evidence ladder, not a score or automatic progression toward proof. Every step adds a question; later steps do not erase uncertainty in earlier ones. The same project may move back and forth between them.</figcaption>
    </figure>;
  }
  const panels = [
    { title: 'Bend', detail: 'Change the direction of the axis.', observable: 'Curvature / looping / elastic-chain fit', drawing: <><path d="M20 69 Q90 -8 160 69" /><path d="M20 76 Q90 -1 160 76" /></> },
    { title: 'Twist', detail: 'Control rotation about the axis.', observable: 'Torque versus twist, at stated force', drawing: <><path d="M15 42 Q35 12 55 42 T95 42 T135 42 T175 42 M15 42 Q35 72 55 42 T95 42 T135 42 T175 42" /><path d="M82 9 Q109 0 116 20 M108 16 L116 20 L118 11" /></> },
    { title: 'Stretch', detail: 'Pull the ends along a direction.', observable: 'Force versus end-to-end extension', drawing: <><path d="M35 40 Q50 23 65 40 T95 40 T125 40 T155 40 M35 47 Q50 30 65 47 T95 47 T125 47 T155 47" /><path d="M28 44 H7 L15 36 M7 44 L15 52 M162 44 H183 L175 36 M183 44 L175 52" /></> },
    { title: 'Melt', detail: 'Change duplex association.', observable: 'Duplex fraction versus temperature', drawing: <><path d="M15 40 H80 Q115 40 172 12 M15 48 H80 Q115 48 172 76" /><path d="M30 40 V48 M45 40 V48 M60 40 V48 M75 40 V48" /></> },
  ];
  return <figure className="library-figure library-mechanics-figure">
    <div className="library-figure-kicker">One substrate / four experimental questions</div>
    <div className="library-mechanics-panels">{panels.map(panel => <div key={panel.title}>
      <strong>{panel.title}</strong>
      <svg viewBox="0 0 190 90" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{panel.drawing}</g></svg>
      <p>{panel.detail}</p><span>{panel.observable}</span>
    </div>)}</div>
    <figcaption>Schematic deformations and experiment types, not measurements or a quantitative simulation. The drawings separate questions for explanation; actual responses may be coupled. Each panel has a text equivalent. Conditions and model assumptions belong with every reported value.</figcaption>
  </figure>;
}
