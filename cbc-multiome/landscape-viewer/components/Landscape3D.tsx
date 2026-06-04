"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Landscape, Layer, Metric, LNode } from "@/lib/types";
import { idwHeight, CtrlPt } from "@/lib/surface";

const HEIGHT = 6;   // vertical exaggeration — elevation_alt is 0–1, so HSC peak = 6 units
const SP = 3;       // horizontal spacing multiplier

const LINEAGE_COLOR: Record<string, string> = {
  stem: "#e0e0e0",
  multipotent: "#9c27b0",
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
      <meshStandardMaterial color="#ffe082" emissive="#7a5c00" />
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
}: {
  n: LNode;
  metric: Metric;
  cx: number;
  cz: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const [wx, wy, wz] = worldPos(n, metric, cx, cz);
  const color = LINEAGE_COLOR[n.lineage] ?? "#888888";
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
          roughness={0.4}
          metalness={0.2}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.5 : 0}
        />
      </mesh>
      <Text
        position={[0, 0.9, 0]}
        fontSize={0.55}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.05}
        outlineColor="#000000"
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

  // PlaneGeometry spans local X and local Y.
  // After rotation [-π/2, 0, 0]: local Y maps to world -Z.
  // So local Y for a node = -(node.y*SP - cz) = cz - node.y*SP
  //
  // ctrl.x = world X = node.x*SP - cx  (matches plane local X)
  // ctrl.y = plane local Y = cz - node.y*SP  (matches plane local Y after rotation)
  // ctrl.z = metric value (drives displacement)
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

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i); // plane local X = world X
      const ly = pos.getY(i); // plane local Y = -(world Z - cz) → i.e. cz - worldZ
      const h = idwHeight(lx, ly, ctrl);
      pos.setZ(i, h * HEIGHT); // local Z → world Y after rotation
      const c = new THREE.Color().setHSL(
        0.6 - 0.4 * h,       // blue (0.6) for valley → teal/green (0.2) for peak
        0.75,
        0.3 + 0.35 * h        // darker valleys, brighter peaks
      );
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
      style={{ height: "72vh", background: "#0b1020" }}
      onPointerMissed={() => onSelect?.(null)}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[15, 30, 10]} intensity={1.2} />
      <directionalLight position={[-10, 20, -10]} intensity={0.4} />

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

        const r = Math.round(isSelected ? 255 : 80 + 175 * mag);
        const g = Math.round(isSelected ? 220 : 120 - 80 * mag);
        const bV = Math.round(isSelected ? 50 : 160 - 120 * mag);

        const posA = worldPos(a, metric, cx, cz);
        const posB = worldPos(b, metric, cx, cz);

        return (
          <group key={i}>
            <Line
              points={[posA, posB]}
              color={`rgb(${r},${g},${bV})`}
              lineWidth={isSelected ? 4 : 1 + 3 * mag}
              dashed={dashed}
              dashSize={0.5}
              dashOffset={0}
              onClick={(ev) => {
                ev.stopPropagation();
                onSelect?.({ kind: "edge", id: edgeId });
              }}
            />
            {/* Only render flow markers for edges with data */}
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
          selected={selected?.kind === "node" && selected.id === n.id}
          onSelect={() => onSelect?.({ kind: "node", id: n.id })}
        />
      ))}

      <OrbitControls makeDefault />
    </Canvas>
  );
}
