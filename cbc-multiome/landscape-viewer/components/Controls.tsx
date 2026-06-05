"use client";
import { Layer, Metric } from "@/lib/types";

export default function Controls({
  layer,
  setLayer,
  metric,
  setMetric,
}: {
  layer: Layer;
  setLayer: (l: Layer) => void;
  metric: Metric;
  setMetric: (m: Metric) => void;
}) {
  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-tertiary)",
    marginBottom: 4,
    display: "block",
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        alignItems: "flex-end",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 2,
        padding: "10px 16px",
        flexWrap: "wrap",
        marginBottom: 0,
      }}
    >
      <label style={{ display: "flex", flexDirection: "column" }}>
        <span style={labelStyle}>Layer</span>
        <select value={layer} onChange={(e) => setLayer(e.target.value as Layer)}>
          <option value="methylation">DNA methylation</option>
          <option value="atac">ATAC accessibility</option>
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column" }}>
        <span style={labelStyle}>Surface height</span>
        <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
          <option value="elevation_alt">differentiation potential (fate entropy)</option>
          <option value="elevation">transcriptional entropy (legacy)</option>
        </select>
      </label>

      <div style={{ display: "flex", flexDirection: "column", opacity: 0.45 }}
           title="Enabled in P1: methylation / TET2 deformation of the landscape">
        <span style={labelStyle}>Perturbation (P1)</span>
        <input type="range" min={0} max={1} step={0.01} defaultValue={0} disabled
               aria-label="perturbation (disabled in P0)" />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
          inert — no deformation in P0
        </span>
      </div>

      {/* Lineage legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          marginLeft: "auto",
          flexWrap: "wrap",
        }}
      >
        {(
          [
            ["stem", "#71717A", "HSC"],
            ["multipotent", "#7C3AED", "MPP"],
            ["lymphoid", "#4caf50", "Lymphoid"],
            ["myeloid", "#ff9800", "Myeloid"],
          ] as const
        ).map(([, color, label]) => (
          <span
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-tertiary)",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: color,
                border: "1px solid var(--border-strong)",
                flexShrink: 0,
              }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
