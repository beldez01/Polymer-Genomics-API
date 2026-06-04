"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import { useMemo } from "react";
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

export default function Landscape3D({
  data,
  layer,
  metric,
}: {
  data: Landscape;
  layer: Layer;
  metric: Metric;
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
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[15, 30, 10]} intensity={1.2} />
      <directionalLight position={[-10, 20, -10]} intensity={0.4} />

      {/* Terrain mesh — PlaneGeometry lies in XY, rotation puts it in XZ */}
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial vertexColors flatShading />
      </mesh>

      {/* Edges */}
      {data.edges.map((e, i) => {
        const a = data.nodes.find((n) => n.id === e.from);
        const b = data.nodes.find((n) => n.id === e.to);
        if (!a || !b) return null;

        const mag = (e.layers[layer]?.n ?? 0) / maxN;
        const dashed =
          e.branch_nature === "soft-branch" ||
          e.branch_nature === "continuum";

        const r = Math.round(80 + 175 * mag);
        const g = Math.round(120 - 80 * mag);
        const bV = Math.round(160 - 120 * mag);

        return (
          <Line
            key={i}
            points={[
              worldPos(a, metric, cx, cz),
              worldPos(b, metric, cx, cz),
            ]}
            color={`rgb(${r},${g},${bV})`}
            lineWidth={1 + 3 * mag}
            dashed={dashed}
            dashSize={0.5}
            dashOffset={0}
          />
        );
      })}

      {/* Node spheres + labels */}
      {data.nodes.map((n) => {
        const [wx, wy, wz] = worldPos(n, metric, cx, cz);
        const color = LINEAGE_COLOR[n.lineage] ?? "#888888";
        return (
          <group key={n.id} position={[wx, wy, wz]}>
            <mesh>
              <sphereGeometry args={[0.42, 24, 24]} />
              <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
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
      })}

      <OrbitControls makeDefault />
    </Canvas>
  );
}
