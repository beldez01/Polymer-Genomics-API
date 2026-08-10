export function CanvasEmptyState({ onLoadDemo }: { onLoadDemo: () => void }) {
  const unavailable = 'Creation workflows arrive in Phase 3'
  return <section className="canvas-empty-state" aria-labelledby="empty-canvas-title">
    <span className="section-index">§ 01 / EMPTY WORKSPACE</span>
    <h2 id="empty-canvas-title">Start an RNA canvas</h2>
    <p>The document is empty. Choose a future creation route or load the local canvas demo.</p>
    <div className="creation-actions" aria-label="RNA creation options">
      <button type="button" disabled title={unavailable}>Add RNA <small>Unavailable</small></button>
      <button type="button" disabled title={unavailable}>Add target <small>Unavailable</small></button>
      <button type="button" disabled title={unavailable}>Load library item <small>Unavailable</small></button>
      <button type="button" disabled title={unavailable}>Start from template <small>Unavailable</small></button>
    </div>
    <button type="button" className="load-demo" onClick={onLoadDemo}>Load canvas demo</button>
    <small className="fixture-note">Optional local fixture · no validation claim</small>
  </section>
}
