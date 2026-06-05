"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Landscape, Layer, Metric, LNode } from "@/lib/types";
import { idwHeight, CtrlPt } from "@/lib/surface";

const HEIGHT = 6;   // vertical exaggeration — elevation_alt is 0–1, so HSC peak = 6 units
const SP = 3;       // horizontal spacing multiplier

// D2 lineage colors on light background
// stem: neutral mid-gray (was white/light — invisible on light bg)
// multipotent: violet (aligns with D2 accent-violet)
// lymphoid/myeloid: kept as-is (readable on light)
const LINEAGE_COLOR: Record<string, string> = {
  stem: "#71717A",
  multipotent: "#7C3AED",
  lymphoid: "#4caf50",
  myeloid: "#ff9800",
};

/** World-space position for a node.
 *  Coordinate layout (after PlaneGeometry rotation [-π/2, 0, 0]):
 *    world X = node.x * SP - cx
 *    world Y = node[metric] * HEIGHT   (height above ground)
 *    world Z = node.y * SP - cz
 */
function worldPos(
  n: LNode,
  metric: Metric,
  cx: number,
  cz: number
): [number, number, number] {
  return [n.x * SP - cx, (n as any)[metric] * HEIGHT, n.y * SP - cz];
}

// ─── Flow marker: animated sphere sliding from a→b in a loop ───────────────
// Amber flow markers — D2 accent-amber, readable on light terrain
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
      {/* Amber: #B45309 D2 accent */}
      <meshStandardMaterial color="#B45309" emissive="#7a3800" emissiveIntensity={0.3} />
    </mesh>
  );
}

// ─── Clickable node group ───────────────────────────────────────────────────
function NodeGroup({
  n,
  metric,
  cx,
  cz,
  selected,
  onSelect,
  layer,
}: {
  n: LNode;
  metric: Metric;
  cx: number;
  cz: number;
  selected: boolean;
  onSelect: () => void;
  layer: Layer;
}) {
  const [wx, wy, wz] = worldPos(n, metric, cx, cz);
  const baseColor = LINEAGE_COLOR[n.lineage] ?? "#71717A";
  const hasLayer = n.modalities.includes(layer);
  // No-data nodes: faint gray, lower opacity
  const color = hasLayer ? baseColor : "#A1A1AA";
  const opacity = hasLayer ? 1 : 0.35;

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
      {/* Dark labels — readable on light terrain */}
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

  const ctrl: CtrlPt[] = useMemo(
    () =>
      data.nodes.map((n) => ({
        x: n.x * SP - cx,
        y: cz - n.y * SP,
        z: (n as any)[metric] as number,
      })),
    [data.nodes, metric, cx, cz]
  );

  const planeW = xMax - xMin + 2 * SP;
  const planeH = zMax - zMin + 2 * SP;

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(planeW, planeH, 60, 60);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colorArr: number[] = [];

    // D2 light terrain colormap:
    // Valleys (h≈0): light neutral gray-blue (#D4D4D8 family)
    // Mid slopes: gray-blue transitioning toward electric blue
    // Peaks (h≈1): electric blue #0F62FE — the HSC peak is the most saturated
    const valleyColor = new THREE.Color("#C8CDD8");  // light gray-blue
    const peakColor = new THREE.Color("#0F62FE");    // electric blue

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const ly = pos.getY(i);
      const h = idwHeight(lx, ly, ctrl);
      pos.setZ(i, h * HEIGHT);

      // Lerp from valley gray-blue → electric blue peak
      // Add a slight lightness boost at mid range so the topography reads well
      const c = new THREE.Color();
      if (h < 0.5) {
        // valley → mid: neutral gray-blue to a lighter blue
        const midColor = new THREE.Color("#8AABDE");
        c.lerpColors(valleyColor, midColor, h * 2);
      } else {
        // mid → peak: lighter blue to electric blue
        const midColor = new THREE.Color("#8AABDE");
        c.lerpColors(midColor, peakColor, (h - 0.5) * 2);
      }

      colorArr.push(c.r, c.g, c.b);
    }

    g.setAttribute("color", new THREE.Float32BufferAttribute(colorArr, 3));
    g.computeVertexNormals();
    return g;
  }, [ctrl, planeW, planeH]);

  // Normalise edge layer n for color/width encoding
  const maxN = Math.max(
    1,
    ...data.edges.map((e) => e.layers[layer]?.n ?? 0)
  );

  return (
    <Canvas
      camera={{ position: [20, 18, 20], fov: 50 }}
      style={{ height: "72vh", background: "#EBEBED" }}
      onPointerMissed={() => onSelect?.(null)}
    >
      {/* Bumped ambient for light terrain — prevents flat/washed look */}
      <ambientLight intensity={0.9} />
      <directionalLight position={[15, 30, 10]} intensity={0.8} />
      <directionalLight position={[-10, 20, -10]} intensity={0.35} />

      {/* Terrain mesh — PlaneGeometry lies in XY, rotation puts it in XZ */}
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial vertexColors flatShading />
      </mesh>

      {/* Edges + flow markers */}
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

        // D2 edge coloring: light neutral (#A1A1AA border-strong) → electric blue (#0F62FE)
        // lerp based on mag; selected = electric blue full
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

        const posA = worldPos(a, metric, cx, cz);
        const posB = worldPos(b, metric, cx, cz);

        return (
          <group key={i}>
            <Line
              points={[posA, posB]}
              color={uncertain ? edgeColor : edgeColor}
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

      {/* Node spheres + labels */}
      {data.nodes.map((n) => (
        <NodeGroup
          key={n.id}
          n={n}
          metric={metric}
          cx={cx}
          cz={cz}
          layer={layer}
          selected={selected?.kind === "node" && selected.id === n.id}
          onSelect={() => onSelect?.({ kind: "node", id: n.id })}
        />
      ))}

      <OrbitControls makeDefault />
    </Canvas>
  );
}
