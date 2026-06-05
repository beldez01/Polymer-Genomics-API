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
      <p
        style={{
          padding: 24,
          fontFamily: "var(--font-sans)",
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        Loading…
      </p>
    );
  }

  const metricLabel =
    metric === "elevation_alt"
      ? "height = cumulative genomic change from HSC"
      : "height = transcriptional entropy";

  return (
    <main
      style={{
        maxWidth: 1440,
        margin: "0 auto",
        padding: "24px 24px 48px",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Header block */}
      <div style={{ marginBottom: 20 }}>
        <div className="section-marker" style={{ marginBottom: 8 }}>
          § HEMATOPOIESIS / MULTI-OMIC LANDSCAPE
        </div>
        <h1 style={{ marginBottom: 6 }}>
          Hematopoiesis Waddington Landscape
        </h1>
        <p
          style={{
            margin: "0 0 4px",
            color: "var(--text-muted)",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
          }}
        >
          Map: literature-grounded (deep-research 2026-06-04); terrain from
          cbc-multiome MAE. Progenitor methylation: Farlik 2016. See{" "}
          <span style={{ color: "var(--text-tertiary)" }}>
            map/hematopoiesis_map.md
          </span>
          .{" "}
          <em style={{ fontStyle: "italic", color: "var(--text-faint)" }}>
            CLP node ≈ Farlik MLP (multilymphoid progenitor) — approximate
            equivalence.
          </em>
        </p>
        <p
          style={{
            margin: "0",
            color: "var(--text-secondary)",
            fontSize: 13,
          }}
        >
          Valleys = cell-state attractors; ridges = fate barriers. Ball rolls from the HSC basin down branching valleys. Edge color/width = # cCREs changing on that transition.
        </p>
      </div>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid var(--border-subtle)",
          margin: "0 0 16px",
        }}
      />

      <Controls
        layer={layer}
        setLayer={setLayer}
        metric={metric}
        setMetric={setMetric}
      />

      {/* Canvas + legend wrapper */}
      <div style={{ position: "relative", marginTop: 12 }}>
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
            background: "rgba(250,250,250,0.92)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 2,
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.7,
            maxWidth: 280,
            fontFamily: "var(--font-mono)",
          }}
        >
          {/* Lineage colors */}
          <div style={{ marginBottom: 8 }}>
            {(
              [
                ["stem", "#71717A", "Stem (HSC)"],
                ["multipotent", "#7C3AED", "Multipotent progenitor"],
                ["lymphoid", "#4caf50", "Lymphoid"],
                ["myeloid", "#ff9800", "Myeloid"],
              ] as const
            ).map(([, color, label]) => (
              <div
                key={label}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
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
              </div>
            ))}
          </div>

          {/* Colorbar: valley (blue) → ridge (gray) */}
          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              paddingTop: 8,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                letterSpacing: "0.08em",
                marginBottom: 5,
              }}
            >
              TERRAIN COLOR
            </div>
            <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
              {/* Colorbar gradient strip: valley blue at top, ridge gray at bottom */}
              <div
                style={{
                  width: 14,
                  height: 80,
                  background:
                    "linear-gradient(to top, #D4D4D8 0%, #8AABDE 50%, #0F62FE 100%)",
                  border: "1px solid var(--border-subtle)",
                  flexShrink: 0,
                  borderRadius: 1,
                }}
              />
              {/* Labels */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: 80,
                  fontSize: 10,
                  color: "#52525B",
                }}
              >
                <span>valley</span>
                <span>↕</span>
                <span>ridge</span>
              </div>
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-tertiary)",
                marginTop: 3,
              }}
            >
              blue = attractor (creode); gray = fate barrier
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              paddingTop: 6,
              color: "var(--text-muted)",
              fontSize: 11,
            }}
          >
            <div>Edge width/brightness = # cCREs changing</div>
            <div>Dashed = blurry / continuum branch</div>
            <div>Dotted/faint edge = uncertain attachment (eosinophil)</div>
            <div style={{ marginTop: 4, color: "var(--text-tertiary)" }}>
              {metricLabel}
            </div>
            <div style={{ marginTop: 3, color: "var(--text-faint)", fontSize: 10 }}>
              Dimmed node = no data for selected layer
            </div>
            <div style={{ marginTop: 4, color: "var(--text-faint)", fontSize: 10, fontStyle: "italic" }}>
              Waddington topology: nodes sit in valleys (attractors); orange ball rolls downhill from HSC.
            </div>
          </div>
        </div>
      </div>

      <GenomicPanel data={data} selection={selection} layer={layer} />
    </main>
  );
}
