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

// Distal-enhancer classes get amber; everything else gets electric blue
const DISTAL_HIGHLIGHT = ["dELS", "pELS"];

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

    const W = 560, H = 240, m = { t: 36, r: 12, b: 68, l: 56 };

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
      .call((g) => g.select(".domain").style("stroke", "#A1A1AA"))
      .call((g) =>
        g
          .selectAll("text")
          .attr("transform", "rotate(-55)")
          .style("text-anchor", "end")
          .style("font-size", "9px")
          .style("fill", "#52525B")
          .style("font-family", "var(--font-mono, monospace)")
      )
      .call((g) =>
        g.selectAll(".tick line").style("stroke", "#A1A1AA")
      );

    // Y axis
    svg
      .append("g")
      .attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format(".2s")))
      .call((g) => g.select(".domain").style("stroke", "#A1A1AA"))
      .call((g) =>
        g
          .selectAll("text")
          .style("fill", "#52525B")
          .style("font-size", "10px")
          .style("font-family", "var(--font-mono, monospace)")
      )
      .call((g) =>
        g.selectAll(".tick line").style("stroke", "#E4E4E7")
      );

    // Section-marker style title
    svg
      .append("text")
      .attr("x", m.l)
      .attr("y", 20)
      .style("font-size", "11px")
      .style("font-weight", "500")
      .style("letter-spacing", "0.08em")
      .style("text-transform", "uppercase")
      .style("fill", "#52525B")
      .style("font-family", "var(--font-mono, monospace)")
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
        highlight && highlight.includes(k) ? "#B45309" : "#0F62FE"
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
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-subtle)",
    borderRadius: 2,
    minHeight: 80,
  };

  const sectionMarkerStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-tertiary)",
    display: "block",
    marginBottom: 10,
  };

  // ── Null state ─────────────────────────────────────────────────────────────
  if (!selection) {
    return (
      <div style={panelStyle}>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
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
        <span style={sectionMarkerStyle}>Cell State</span>
        <h2
          style={{
            margin: "0 0 4px",
            fontSize: 17,
            fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          {node.label}
        </h2>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 12,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {node.compartment} · {node.lineage} lineage
        </p>
        <div>
          <span style={sectionMarkerStyle}>Modality Coverage</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
            {ALL_MODALITIES.map((mod) => {
              const has = (node.modalities ?? []).includes(mod);
              return (
                <span
                  key={mod}
                  style={{
                    color: has ? "#0F62FE" : "var(--text-faint)",
                    fontFamily: "var(--font-mono)",
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
    const [fromId, toId] = selection.id.split("->");
    const edge = data.edges.find((e) => e.from === fromId && e.to === toId);

    if (!edge) {
      return (
        <div style={panelStyle}>
          <p style={{ margin: 0, color: "var(--accent-rose)", fontSize: 13 }}>
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
          <span style={sectionMarkerStyle}>Transition</span>
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: 17,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {fromLabel} → {toLabel}
          </h2>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
            No {layer} change data for this transition.
          </p>
        </div>
      );
    }

    return (
      <div style={panelStyle}>
        <span style={sectionMarkerStyle}>Transition</span>
        <h2
          style={{
            margin: "0 0 4px",
            fontSize: 17,
            fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          {fromLabel} → {toLabel}
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 12,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          layer = {layer} · n ={" "}
          <span style={{ color: "var(--primary)", fontWeight: 500 }}>
            {el.n.toLocaleString()}
          </span>{" "}
          changed cCREs
        </p>

        {/* Chromosome bar chart */}
        {el.by_chrom && Object.keys(el.by_chrom).length > 0 && (
          <div style={{ marginBottom: 24, overflowX: "auto" }}>
            <span style={sectionMarkerStyle}>
              Where: Changed cCREs by Chromosome
            </span>
            <Bar
              counts={el.by_chrom}
              title={`n = ${el.n.toLocaleString()} total`}
              order={CHR_ORDER}
            />
          </div>
        )}

        {/* cCRE class bar chart */}
        {el.by_class && Object.keys(el.by_class).length > 0 && (
          <div style={{ marginBottom: 24, overflowX: "auto" }}>
            <span style={sectionMarkerStyle}>cCRE Class</span>
            <Bar
              counts={el.by_class}
              title="Amber = dELS / pELS (distal enhancers)"
              highlight={DISTAL_HIGHLIGHT}
            />
            <p
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                margin: "6px 0 0 56px",
                fontFamily: "var(--font-mono)",
              }}
            >
              Distal enhancers (dELS + pELS) in amber. Promoter elements (PLS)
              in electric blue.
            </p>
          </div>
        )}

        {/* Top loci table */}
        {el.top && el.top.length > 0 && (
          <div>
            <span style={sectionMarkerStyle}>
              Top Loci (first {Math.min(el.top.length, 15)} of{" "}
              {el.top.length})
            </span>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  fontSize: 12,
                  width: "100%",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <thead>
                  <tr>
                    {["Locus", "Class", "Δ"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "4px 16px 6px 0",
                          color: "var(--text-tertiary)",
                          fontWeight: 500,
                          fontSize: 11,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          borderBottom: "1px solid var(--border-default)",
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
                        borderBottom: "1px solid var(--border-default)",
                      }}
                    >
                      <td
                        style={{
                          padding: "4px 16px 4px 0",
                          color: "var(--text-secondary)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {locus.chr}:{locus.start.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "4px 16px 4px 0",
                          color: DISTAL_HIGHLIGHT.includes(locus.class)
                            ? "#B45309"
                            : "var(--text-primary)",
                          fontWeight: DISTAL_HIGHLIGHT.includes(locus.class)
                            ? 500
                            : 400,
                        }}
                      >
                        {locus.class}
                      </td>
                      <td
                        style={{
                          padding: "4px 0",
                          color:
                            locus.delta > 0 ? "#0F62FE" : "var(--accent-rose)",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
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
            <p
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginTop: 10,
                fontFamily: "var(--font-mono)",
              }}
            >
              Transition {fromLabel} → {toLabel}, layer={layer}. Δ = per-cell-type
              methylation/accessibility delta. Blue = gain, rose = loss.
            </p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
