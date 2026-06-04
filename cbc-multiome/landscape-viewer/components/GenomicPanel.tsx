"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { Landscape, Layer } from "@/lib/types";

const CHR_ORDER = [...Array(22)].map((_, i) => `chr${i + 1}`).concat(["chrX", "chrY"]);

const ALL_MODALITIES = [
  "methylation",
  "rnaseq",
  "atac",
  "dnase",
  "h3k4me1",
  "h3k4me3",
  "h3k27ac",
  "h3k27me3",
  "h3k36me3",
  "h3k9me3",
];

// ─── Reusable D3 bar chart ──────────────────────────────────────────────────
function Bar({
  counts,
  title,
  order,
  highlight,
}: {
  counts: Record<string, number>;
  title: string;
  order?: string[];
  highlight?: string[];
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const keys = order
      ? order.filter((k) => k in counts)
      : Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    const W = 560, H = 240, m = { t: 28, r: 12, b: 68, l: 56 };

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("width", W).attr("height", H);

    const x = d3.scaleBand().domain(keys).range([m.l, W - m.r]).padding(0.15);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(keys, (k) => counts[k]) || 1])
      .nice()
      .range([H - m.b, m.t]);

    // X axis
    svg
      .append("g")
      .attr("transform", `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-55)")
      .style("text-anchor", "end")
      .style("font-size", "9px")
      .style("fill", "#ccc");

    // X axis line
    svg.select<SVGGElement>("g").select(".domain").style("stroke", "#555");

    // Y axis
    svg
      .append("g")
      .attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format(".2s")))
      .call((g) => g.select(".domain").style("stroke", "#555"))
      .call((g) => g.selectAll("text").style("fill", "#ccc").style("font-size", "10px"));

    // Title
    svg
      .append("text")
      .attr("x", m.l)
      .attr("y", 16)
      .style("font-size", "12px")
      .style("font-weight", "600")
      .style("fill", "#e0e0e0")
      .text(title);

    // Bars
    svg
      .append("g")
      .selectAll("rect")
      .data(keys)
      .join("rect")
      .attr("x", (k) => x(k)!)
      .attr("y", (k) => y(counts[k]))
      .attr("width", x.bandwidth())
      .attr("height", (k) => H - m.b - y(counts[k]))
      .attr("fill", (k) =>
        highlight && highlight.includes(k) ? "#ef8f2a" : "#4a78c0"
      )
      .attr("rx", 2);
  }, [counts, title, order, highlight]);

  return (
    <svg
      ref={ref}
      style={{ display: "block", maxWidth: "100%", background: "transparent" }}
    />
  );
}

// ─── Main panel ─────────────────────────────────────────────────────────────
export default function GenomicPanel({
  data,
  selection,
  layer,
}: {
  data: Landscape;
  selection: { kind: string; id: string } | null;
  layer: Layer;
}) {
  const panelStyle: React.CSSProperties = {
    marginTop: 16,
    padding: "16px 20px",
    background: "#0f1829",
    border: "1px solid #1e2d4a",
    borderRadius: 8,
    fontFamily: "system-ui, sans-serif",
    color: "#c8d6ec",
    minHeight: 120,
  };

  // ── Null state ─────────────────────────────────────────────────────────────
  if (!selection) {
    return (
      <div style={panelStyle}>
        <p style={{ margin: 0, color: "#5a7090", fontSize: 14 }}>
          Click a transition (edge) or cell (node) in the 3D terrain to explore
          genomic detail.
        </p>
      </div>
    );
  }

  // ── Node selection ─────────────────────────────────────────────────────────
  if (selection.kind === "node") {
    const node = data.nodes.find((n) => n.id === selection.id);
    if (!node) return null;

    return (
      <div style={panelStyle}>
        <h2 style={{ margin: "0 0 4px", fontSize: 16, color: "#ffffff" }}>
          {node.label}
        </h2>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#7a9cc0" }}>
          {node.compartment} · {node.lineage} lineage
        </p>
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <strong style={{ display: "block", marginBottom: 6, color: "#a0b8d8" }}>
            Modality coverage
          </strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
            {ALL_MODALITIES.map((mod) => {
              const has = node.modalities.includes(mod);
              return (
                <span
                  key={mod}
                  style={{
                    color: has ? "#7ecf8f" : "#4a5a6a",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}
                >
                  {has ? "✓" : "✗"} {mod}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Edge selection ─────────────────────────────────────────────────────────
  if (selection.kind === "edge") {
    // id format: "from->to"
    const [fromId, toId] = selection.id.split("->");
    const edge = data.edges.find(
      (e) => e.from === fromId && e.to === toId
    );

    if (!edge) {
      return (
        <div style={panelStyle}>
          <p style={{ margin: 0, color: "#c04040", fontSize: 13 }}>
            Edge not found: {selection.id}
          </p>
        </div>
      );
    }

    const fromNode = data.nodes.find((n) => n.id === fromId);
    const toNode = data.nodes.find((n) => n.id === toId);
    const fromLabel = fromNode?.label ?? fromId;
    const toLabel = toNode?.label ?? toId;

    const el = edge.layers[layer];

    if (!el || el.n === 0) {
      return (
        <div style={panelStyle}>
          <h2 style={{ margin: "0 0 8px", fontSize: 16, color: "#ffffff" }}>
            {fromLabel} → {toLabel}
          </h2>
          <p style={{ margin: 0, color: "#7a9cc0", fontSize: 13 }}>
            No {layer} change data for this transition.
          </p>
        </div>
      );
    }

    // Highlighted classes: distal enhancers (dELS, pELS)
    const DISTAL_HIGHLIGHT = ["dELS", "pELS"];

    return (
      <div style={panelStyle}>
        <h2 style={{ margin: "0 0 4px", fontSize: 16, color: "#ffffff" }}>
          {fromLabel} → {toLabel}
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#7a9cc0" }}>
          Transition · layer = {layer} · n = {el.n.toLocaleString()} changed cCREs
        </p>

        {/* Chromosome bar chart */}
        {el.by_chrom && Object.keys(el.by_chrom).length > 0 && (
          <div style={{ marginBottom: 20, overflowX: "auto" }}>
            <Bar
              counts={el.by_chrom}
              title={`Where: changed cCREs by chromosome (n=${el.n.toLocaleString()})`}
              order={CHR_ORDER}
            />
          </div>
        )}

        {/* cCRE class bar chart */}
        {el.by_class && Object.keys(el.by_class).length > 0 && (
          <div style={{ marginBottom: 20, overflowX: "auto" }}>
            <Bar
              counts={el.by_class}
              title="What: changed cCREs by SCREEN class (orange = distal enhancers)"
              highlight={DISTAL_HIGHLIGHT}
            />
            <p style={{ fontSize: 11, color: "#5a7090", margin: "4px 0 0 56px" }}>
              Distal enhancers (dELS + pELS) highlighted in orange. Promoter elements (PLS) in blue.
            </p>
          </div>
        )}

        {/* Top loci table */}
        {el.top && el.top.length > 0 && (
          <div>
            <strong
              style={{
                display: "block",
                marginBottom: 8,
                fontSize: 13,
                color: "#a0b8d8",
              }}
            >
              Top changed loci (first {Math.min(el.top.length, 15)} of {el.top.length})
            </strong>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  fontSize: 11,
                  width: "100%",
                  fontFamily: "monospace",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e2d4a" }}>
                    {["Locus", "Class", "Δ"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "4px 12px 4px 0",
                          color: "#6080a0",
                          fontWeight: 600,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {el.top.slice(0, 15).map((locus, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: "1px solid #0e1a2a",
                        background: i % 2 === 0 ? "transparent" : "#0a1220",
                      }}
                    >
                      <td style={{ padding: "3px 12px 3px 0", color: "#8baed0" }}>
                        {locus.chr}:{locus.start.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "3px 12px 3px 0",
                          color: DISTAL_HIGHLIGHT.includes(locus.class)
                            ? "#ef8f2a"
                            : "#c8d6ec",
                        }}
                      >
                        {locus.class}
                      </td>
                      <td
                        style={{
                          padding: "3px 0",
                          color: locus.delta > 0 ? "#7ecf8f" : "#ef5858",
                          textAlign: "right",
                        }}
                      >
                        {locus.delta > 0 ? "+" : ""}
                        {locus.delta.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11, color: "#5a7090", marginTop: 8 }}>
              Caption: Transition {fromLabel} → {toLabel}, layer={layer}. Δ = per-cell-type
              methylation/accessibility delta. Green = gain, red = loss.
            </p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
