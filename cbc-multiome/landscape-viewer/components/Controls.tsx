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
        <span style={labelStyle}>Elevation</span>
        <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
          <option value="elevation_alt">cumulative genomic change (HSC peak)</option>
          <option value="elevation">transcriptional entropy (peaks at progenitors)</option>
        </select>
      </label>

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
