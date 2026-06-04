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

  return (
    <main style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 20 }}>
        Hematopoiesis Waddington Landscape
      </h1>
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
      <Landscape3D
        data={data}
        layer={layer}
        metric={metric}
        onSelect={setSelection}
        selected={selection}
      />
      <GenomicPanel data={data} selection={selection} layer={layer} />
    </main>
  );
}
