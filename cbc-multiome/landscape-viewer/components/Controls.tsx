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
  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        alignItems: "center",
        margin: "8px 0",
        flexWrap: "wrap",
      }}
    >
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Layer:</span>
        <select
          value={layer}
          onChange={(e) => setLayer(e.target.value as Layer)}
          style={{ fontSize: 13 }}
        >
          <option value="methylation">DNA methylation</option>
          <option value="atac">ATAC accessibility</option>
        </select>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Elevation:</span>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as Metric)}
          style={{ fontSize: 13 }}
        >
          <option value="elevation_alt">
            cumulative genomic change (HSC peak)
          </option>
          <option value="elevation">
            transcriptional entropy (peaks at progenitors)
          </option>
        </select>
      </label>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginLeft: "auto",
          fontSize: 11,
          color: "#666",
          flexWrap: "wrap",
        }}
      >
        {(
          [
            ["stem", "#e0e0e0", "HSC"],
            ["multipotent", "#9c27b0", "MPP"],
            ["lymphoid", "#4caf50", "Lymphoid"],
            ["myeloid", "#ff9800", "Myeloid"],
          ] as const
        ).map(([, color, label]) => (
          <span
            key={label}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: color,
                border: "1px solid #333",
              }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
