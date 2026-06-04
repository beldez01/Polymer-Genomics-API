"use client";
import { useEffect, useState } from "react";
import Landscape3D from "@/components/Landscape3D";
import Controls from "@/components/Controls";
import GenomicPanel from "@/components/GenomicPanel";
import { Landscape, Layer, Metric } from "@/lib/types";

type Selection = { kind: "node" | "edge"; id: string } | null;

export default function Page() {
  const [data, setData] = useState<Landscape | null>(null);
  const [layer, setLayer] = useState<Layer>("methylation");
  const [metric, setMetric] = useState<Metric>("elevation_alt");
  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => {
    fetch("/landscape.json")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <p style={{ padding: 16, fontFamily: "system-ui" }}>loading…</p>
    );
  }

  const metricLabel =
    metric === "elevation_alt"
      ? "height = cumulative genomic change from HSC"
      : "height = transcriptional entropy";

  return (
    <main style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ margin: "0 0 2px", fontSize: 20 }}>
        Hematopoiesis Waddington Landscape
      </h1>
      <p style={{ margin: "0 0 2px", color: "#888", fontSize: 11 }}>
        Map: literature-grounded (deep-research 2026-06-04); terrain from
        cbc-multiome MAE. Progenitor methylation: Farlik 2016. See{" "}
        <span style={{ fontFamily: "monospace" }}>
          map/hematopoiesis_map.md
        </span>
        .{" "}
        <em>
          CLP node ≈ Farlik MLP (multilymphoid progenitor) — approximate
          equivalence.
        </em>
      </p>
      <p
        style={{ margin: "0 0 8px", color: "#666", fontSize: 13 }}
      >
        HSC peak → canalized lineage valleys; edge color/width = # cCREs
        changing on that transition.
      </p>
      <Controls
        layer={layer}
        setLayer={setLayer}
        metric={metric}
        setMetric={setMetric}
      />
      {/* Canvas + legend wrapper */}
      <div style={{ position: "relative" }}>
        <Landscape3D
          data={data}
          layer={layer}
          metric={metric}
          onSelect={setSelection}
          selected={selection}
        />
        {/* Legend overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            background: "rgba(8, 12, 28, 0.82)",
            border: "1px solid #1e2d4a",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 11,
            color: "#b0c4de",
            lineHeight: 1.7,
            maxWidth: 260,
            backdropFilter: "blur(2px)",
          }}
        >
          {/* Lineage colors */}
          <div style={{ marginBottom: 6 }}>
            {(
              [
                ["stem", "#e0e0e0", "Stem (HSC)"],
                ["multipotent", "#9c27b0", "Multipotent progenitor"],
                ["lymphoid", "#4caf50", "Lymphoid"],
                ["myeloid", "#ff9800", "Myeloid"],
              ] as const
            ).map(([, color, label]) => (
              <div
                key={label}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: color,
                    border: "1px solid #333",
                    flexShrink: 0,
                  }}
                />
                {label}
              </div>
            ))}
          </div>
          <div
            style={{
              borderTop: "1px solid #1e2d4a",
              paddingTop: 5,
              color: "#8a9db8",
            }}
          >
            <div>Edge width/brightness = # cCREs changing</div>
            <div>Dashed = blurry / continuum branch</div>
            <div>Dotted/faint edge = uncertain attachment (eosinophil)</div>
            <div style={{ marginTop: 3, color: "#6a7d94" }}>{metricLabel}</div>
            <div style={{ marginTop: 3, color: "#5a7090", fontSize: 10 }}>
              Dimmed node = no data for selected layer
            </div>
          </div>
        </div>
      </div>
      <GenomicPanel data={data} selection={selection} layer={layer} />
    </main>
  );
}
