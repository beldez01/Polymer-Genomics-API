"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line, Grid } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Landscape, Layer, Metric, LNode } from "@/lib/types";
import { idwHeight, waddingtonHeight, CtrlPt, Seg } from "@/lib/surface";

const HEIGHT = 6;   // vertical exaggeration — elevation_alt is 0–1
const SP = 3;       // horizontal spacing multiplier
const CONTOUR_BANDS = 12;  // number of discrete bands for topographic look

// Waddington valley parameters
const DEPTH = 0.65;   // fraction of full height range to carve (ridges clearly above valleys)
const SIGMA = 0.7;    // valley half-width in world units (node x/y * SP space)

// D2 lineage colors on light background
const LINEAGE_COLOR: Record<string, string> = {
  stem: "#71717A",
  multipotent: "#7C3AED",
  lymphoid: "#4caf50",
  myeloid: "#ff9800",
};

/** Build edge segments in world space (before centering — centering applied in geo loop) */
function buildSegs(
  nodes: LNode[],
  edges: { from: string; to: string }[],
  cx: number,
  cz: number
): Seg[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return edges.flatMap((e) => {
    const a = nodeMap.get(e.from);
    const b = nodeMap.get(e.to);
    if (!a || !b) return [];
    return [{
      ax: a.x * SP - cx,
      ay: cz - a.y * SP,   // note: plane geometry Y maps to -node.y (same sign convention as ctrl.y)
      bx: b.x * SP - cx,
      by: cz - b.y * SP,
    }];
  });
}

/** Waddington-corrected world-space position for a node.
 *  Nodes sit at the valley floor so the sphere rests in its attractor basin.
 */
function waddingtonWorldPos(
  n: LNode,
  ctrl: CtrlPt[],
  segs: Seg[],
  cx: number,
  cz: number
): [number, number, number] {
  const wx = n.x * SP - cx;
  const wz = n.y * SP - cz;
  // plane geometry coords: lx = node.x*SP - cx, ly = cz - node.y*SP
  const ply = cz - n.y * SP;
  const h = waddingtonHeight(wx, ply, ctrl, segs, { depth: DEPTH, sigma: SIGMA });
  return [wx, h * HEIGHT, wz];
}

/** Color a vertex by trough strength: ridge #D4D4D8 (trough≈0) → valley #0F62FE (trough≈1).
 *  Quantize into bands for a topographic-contour look.
 */
function valleyColor(trough: number): THREE.Color {
  const band = Math.floor(trough * CONTOUR_BANDS) / CONTOUR_BANDS;
  const t = Math.min(band, 1.0);
  const ridgeColor = new THREE.Color("#D4D4D8");
  const midColor   = new THREE.Color("#8AABDE");
  const valleyBlue = new THREE.Color("#0F62FE");
  const c = new THREE.Color();
  if (t < 0.5) {
    c.lerpColors(ridgeColor, midColor, t * 2);
  } else {
    c.lerpColors(midColor, valleyBlue, (t - 0.5) * 2);
  }
  return c;
}

// ─── Flow marker: animated sphere sliding from a→b in a loop ───────────────
function FlowMarker({ a, b }: { a: [number, number, number]; b: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(Math.random());
  useFrame((_, dt) => {
    t.current = (t.current + dt * 0.25) % 1;
    const m = ref.current;
    if (!m) return;
    m.position.set(
      a[0] + (b[0] - a[0]) * t.current,
      a[1] + (b[1] - a[1]) * t.current,
      a[2] + (b[2] - a[2]) * t.current
    );
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.15, 8, 8]} />
      <meshStandardMaterial color="#B45309" emissive="#7a3800" emissiveIntensity={0.3} />
    </mesh>
  );
}

// ─── Clickable node group ───────────────────────────────────────────────────
function NodeGroup({
  n,
  ctrl,
  segs,
  cx,
  cz,
  selected,
  onSelect,
  layer,
  metric,
}: {
  n: LNode;
  ctrl: CtrlPt[];
  segs: Seg[];
  cx: number;
  cz: number;
  selected: boolean;
  onSelect: () => void;
  layer: Layer;
  metric: Metric;
}) {
  const [wx, wy, wz] = waddingtonWorldPos(n, ctrl, segs, cx, cz);
  const baseColor = LINEAGE_COLOR[n.lineage] ?? "#71717A";
  const hasLayer = n.modalities.includes(layer);
  const color = hasLayer ? baseColor : "#A1A1AA";
  const opacity = hasLayer ? 1 : 0.35;
  // Metric value for the numeric label
  const metricVal = ((n as any)[metric] as number).toFixed(2);

  return (
    <group
      position={[wx, wy, wz]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <mesh scale={selected ? 1.5 : 1}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshStandardMaterial
          color={color}
          roughness={0.35}
          metalness={0.15}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.3 : 0}
          transparent={!hasLayer}
          opacity={opacity}
        />
      </mesh>
      {/* Node name label */}
      <Text
        position={[0, 0.9, 0]}
        fontSize={0.55}
        color={hasLayer ? "#18181B" : "#A1A1AA"}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.04}
        outlineColor="#FFFFFF"
      >
        {n.label}
      </Text>
      {/* Numeric metric value — metrological second line */}
      <Text
        position={[0, 0.35, 0]}
        fontSize={0.38}
        color="#52525B"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.025}
        outlineColor="#FFFFFF"
      >
        {metricVal}
      </Text>
    </group>
  );
}

// ─── Elevation axis with ticks ──────────────────────────────────────────────
function ElevationAxis({
  axisX,
  axisZ,
  maxY,
}: {
  axisX: number;
  axisZ: number;
  maxY: number;
}) {
  const ticks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <group position={[axisX, 0, axisZ]}>
      {/* Vertical axis line */}
      <Line
        points={[
          [0, 0, 0],
          [0, maxY, 0],
        ]}
        color="#A1A1AA"
        lineWidth={1}
      />
      {/* Tick marks + labels */}
      {ticks.map((t) => {
        const y = t * maxY;
        return (
          <group key={t} position={[0, y, 0]}>
            {/* Tick mark */}
            <Line
              points={[
                [-0.3, 0, 0],
                [0.3, 0, 0],
              ]}
              color="#A1A1AA"
              lineWidth={1}
            />
            {/* Numeric label */}
            <Text
              position={[-0.55, 0, 0]}
              fontSize={0.38}
              color="#52525B"
              anchorX="right"
              anchorY="middle"
            >
              {t.toFixed(2)}
            </Text>
          </group>
        );
      })}
      {/* "ELEVATION" axis label at top */}
      <Text
        position={[0, maxY + 0.7, 0]}
        fontSize={0.38}
        color="#52525B"
        anchorX="center"
        anchorY="bottom"
      >
        ELEVATION
      </Text>
    </group>
  );
}

export default function Landscape3D({
  data,
  layer,
  metric,
  onSelect,
  selected,
}: {
  data: Landscape;
  layer: Layer;
  metric: Metric;
  onSelect?: (sel: { kind: "node" | "edge"; id: string } | null) => void;
  selected?: { kind: "node" | "edge"; id: string } | null;
}) {
  // Bounding box in node coordinate space
  const nodeXs = data.nodes.map((n) => n.x * SP);
  const nodeZs = data.nodes.map((n) => n.y * SP);
  const xMin = Math.min(...nodeXs);
  const xMax = Math.max(...nodeXs);
  const zMin = Math.min(...nodeZs);
  const zMax = Math.max(...nodeZs);

  // Center: used to shift everything so origin is at the bounding-box centre
  const cx = (xMin + xMax) / 2;
  const cz = (zMin + zMax) / 2;

  // IDW control points (in plane-local coords): x = node.x*SP - cx, y = cz - node.y*SP
  const ctrl: CtrlPt[] = useMemo(
    () =>
      data.nodes.map((n) => ({
        x: n.x * SP - cx,
        y: cz - n.y * SP,
        z: (n as any)[metric] as number,
      })),
    [data.nodes, metric, cx, cz]
  );

  // Edge segments for valley carving (plane-local coords, same sign convention)
  const segs: Seg[] = useMemo(
    () => buildSegs(data.nodes, data.edges, cx, cz),
    [data.nodes, data.edges, cx, cz]
  );

  const planeW = xMax - xMin + 2 * SP;
  const planeH = zMax - zMin + 2 * SP;

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(planeW, planeH, 80, 80);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colorArr: number[] = [];

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const ly = pos.getY(i);

      // Baseline (developmental tilt)
      const B = idwHeight(lx, ly, ctrl);

      // Trough strength for this vertex
      let best = Infinity;
      for (const s of segs) {
        const dx = s.bx - s.ax, dy = s.by - s.ay;
        const L2 = dx * dx + dy * dy;
        let t2 = L2 > 0 ? ((lx - s.ax) * dx + (ly - s.ay) * dy) / L2 : 0;
        t2 = Math.max(0, Math.min(1, t2));
        const cx2 = s.ax + t2 * dx, cy2 = s.ay + t2 * dy;
        const d = Math.hypot(lx - cx2, ly - cy2);
        if (d < best) best = d;
      }
      const trough = segs.length > 0
        ? Math.exp(-(best * best) / (2 * SIGMA * SIGMA))
        : 0;
      const depthEff = DEPTH * (1 + 0.6 * (1 - B));
      const h = Math.max(0, B - depthEff * trough);

      pos.setZ(i, h * HEIGHT);

      // Color by trough strength: valleys glow electric blue, ridges are light gray
      const c = valleyColor(trough);
      colorArr.push(c.r, c.g, c.b);
    }

    g.setAttribute("color", new THREE.Float32BufferAttribute(colorArr, 3));
    g.computeVertexNormals();
    return g;
  }, [ctrl, segs, planeW, planeH]);

  // Elevation axis position: back-left corner of the terrain bounding box
  const axisX = -planeW / 2 - 1.2;
  const axisZ = -planeH / 2 - 1.2;
  const maxY = HEIGHT;

  // Grid dimensions (match terrain footprint)
  const gridW = planeW + 2;
  const gridH = planeH + 2;

  // Normalise edge layer n for color/width encoding
  const maxN = Math.max(
    1,
    ...data.edges.map((e) => e.layers[layer]?.n ?? 0)
  );

  return (
    <Canvas
      camera={{ position: [18, 22, 18], fov: 48 }}
      style={{ height: "72vh", background: "#EBEBED" }}
      onPointerMissed={() => onSelect?.(null)}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[15, 30, 10]} intensity={0.8} />
      <directionalLight position={[-10, 20, -10]} intensity={0.35} />

      {/* Ground reference grid — hairline gray, valley floor at y=0 */}
      <Grid
        args={[gridW, gridH]}
        position={[0, 0.01, 0]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#D4D4D8"
        sectionSize={3}
        sectionThickness={0.8}
        sectionColor="#C4C4C8"
        fadeDistance={80}
        fadeStrength={1.5}
        infiniteGrid={false}
      />

      {/* Terrain mesh — valley-blue creodes, gray ridges, topographic contour banding */}
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial vertexColors flatShading />
      </mesh>

      {/* Wireframe overlay — measurement grid on surface */}
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial wireframe transparent opacity={0.10} color="#A1A1AA" />
      </mesh>

      {/* Elevation axis with numeric ticks */}
      <ElevationAxis axisX={axisX} axisZ={axisZ} maxY={maxY} />

      {/* Edges + flow markers — flow balls roll along valley floors */}
      {data.edges.map((e, i) => {
        const a = data.nodes.find((n) => n.id === e.from);
        const b = data.nodes.find((n) => n.id === e.to);
        if (!a || !b) return null;

        const edgeId = `${e.from}->${e.to}`;
        const isSelected = selected?.kind === "edge" && selected.id === edgeId;
        const mag = (e.layers[layer]?.n ?? 0) / maxN;
        const dashed =
          e.branch_nature === "soft-branch" ||
          e.branch_nature === "continuum";
        const uncertain = e.from === "gmp" && e.to === "eosinophil";

        const edgeColor = isSelected
          ? "#0F62FE"
          : (() => {
              const base = new THREE.Color("#A1A1AA");
              const accent = new THREE.Color("#0F62FE");
              const c = new THREE.Color().lerpColors(base, accent, mag);
              return `#${c.getHexString()}`;
            })();

        const lineWidth = uncertain
          ? Math.max(0.5, (isSelected ? 4 : 1 + 3 * mag) * 0.5)
          : isSelected
          ? 4
          : 1 + 3 * mag;

        // Nodes now sit at valley-floor Y
        const posA = waddingtonWorldPos(a, ctrl, segs, cx, cz);
        const posB = waddingtonWorldPos(b, ctrl, segs, cx, cz);

        return (
          <group key={i}>
            <Line
              points={[posA, posB]}
              color={edgeColor}
              lineWidth={lineWidth}
              dashed={dashed || uncertain}
              dashSize={uncertain ? 0.25 : 0.5}
              dashOffset={0}
              onClick={(ev) => {
                ev.stopPropagation();
                onSelect?.({ kind: "edge", id: edgeId });
              }}
            />
            {(e.layers[layer]?.n ?? 0) > 0 && (
              <FlowMarker a={posA} b={posB} />
            )}
          </group>
        );
      })}

      {/* Node spheres + labels + numeric values — seated at valley floors */}
      {data.nodes.map((n) => (
        <NodeGroup
          key={n.id}
          n={n}
          ctrl={ctrl}
          segs={segs}
          cx={cx}
          cz={cz}
          layer={layer}
          metric={metric}
          selected={selected?.kind === "node" && selected.id === n.id}
          onSelect={() => onSelect?.({ kind: "node", id: n.id })}
        />
      ))}

      <OrbitControls makeDefault />
    </Canvas>
  );
}
