'use client';

/**
 * 3D visualization of the FormalClaim corpus.
 *
 * Forked from `viewer/src/components/claims/ClaimUniverse.tsx`. Differences:
 *  - Reads from `viewer/src/config/formal_projection.ts` (PCA on a 48-dim
 *    structural feature vector) instead of v2 21-feature vector.
 *  - Color by outcome (5-color palette) instead of cluster.
 *  - Renders depends_on edges as faint undirected lines.
 *  - Click fires an onSelect callback; the host page renders the inline DAG
 *    body (FormalClaimBody) below the canvas.
 */

import { useRef, useState, Suspense } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';

import {
  EDGES,
  OUTCOME_COLORS,
  PROJECTION,
  type FormalProjectionClaim,
} from '@/config/formal_projection';
import { COLOR, FONT_FAMILY } from '@/config/theme';

interface FormalClaimUniverseProps {
  hoveredId: string | null;
  selectedId?: string | null;
  onHover: (claim: FormalProjectionClaim | null) => void;
  onSelect?: (claim: FormalProjectionClaim) => void;
}

// ---------------------------------------------------------------------------
// Single claim node
// ---------------------------------------------------------------------------

interface NodeProps {
  claim: FormalProjectionClaim;
  hovered: boolean;
  selected: boolean;
  onHover: (claim: FormalProjectionClaim | null) => void;
  onSelect?: (claim: FormalProjectionClaim) => void;
}

function ClaimNode({ claim, hovered, selected, onHover, onSelect }: NodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [localHover, setLocalHover] = useState(false);

  const color = OUTCOME_COLORS[claim.outcome];
  const active = hovered || localHover || selected;
  const targetScale = selected ? 1.55 : hovered || localHover ? 1.35 : 1.0;
  const targetVec = useRef(new THREE.Vector3(1, 1, 1));

  useFrame(() => {
    if (meshRef.current) {
      targetVec.current.setScalar(targetScale);
      meshRef.current.scale.lerp(targetVec.current, 0.18);
    }
  });

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setLocalHover(true);
    onHover(claim);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setLocalHover(false);
    onHover(null);
    document.body.style.cursor = '';
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect?.(claim);
  };

  return (
    <group position={claim.projection_3d}>
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <sphereGeometry args={[0.32, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 0.55 : 0.18}
          metalness={0.25}
          roughness={0.45}
        />
      </mesh>

      {(localHover || hovered) && (
        <Html
          position={[0, 0.55, 0]}
          center
          distanceFactor={9}
          zIndexRange={[100, 0]}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontFamily: FONT_FAMILY,
            fontSize: 11,
            letterSpacing: '0.06em',
            color: COLOR.text.primary,
            padding: '3px 8px',
            backgroundColor: `${COLOR.bg.primary}E6`,
            border: `1px solid ${color}`,
            maxWidth: 320,
          }}
        >
          {claim.id}
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Dependency edges (faint undirected lines)
// ---------------------------------------------------------------------------

function DependsOnEdges() {
  return (
    <group>
      {EDGES.map((edge, i) => (
        <Line
          key={`${edge.source.id}->${edge.target.id}-${i}`}
          points={[edge.source.projection_3d, edge.target.projection_3d]}
          color={COLOR.text.muted}
          lineWidth={1}
          transparent
          opacity={0.25}
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Axes gizmo (PC1/PC2/PC3 with explained-variance ratios)
// ---------------------------------------------------------------------------

function Axes() {
  const L = Math.max(
    ...PROJECTION.claims.map((c) =>
      Math.max(Math.abs(c.projection_3d[0]), Math.abs(c.projection_3d[1]), Math.abs(c.projection_3d[2])),
    ),
  ) * 1.15;
  const evr = PROJECTION.explained_variance;

  const axes: { dir: [number, number, number]; label: string; sub: string }[] = [
    { dir: [L, 0, 0], label: 'PC1', sub: `${(evr[0] * 100).toFixed(1)}%` },
    { dir: [0, L, 0], label: 'PC2', sub: `${(evr[1] * 100).toFixed(1)}%` },
    { dir: [0, 0, L], label: 'PC3', sub: `${(evr[2] * 100).toFixed(1)}%` },
  ];

  return (
    <group>
      {axes.map(({ dir, label, sub }, i) => {
        const neg: [number, number, number] = [-dir[0], -dir[1], -dir[2]];
        return (
          <group key={i}>
            <Line
              points={[neg, dir]}
              color={COLOR.border.strong}
              lineWidth={1}
              transparent
              opacity={0.5}
            />
            <Html
              position={[dir[0] * 1.06, dir[1] * 1.06, dir[2] * 1.06]}
              center
              distanceFactor={12}
              style={{
                pointerEvents: 'none',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                fontFamily: FONT_FAMILY,
                color: COLOR.text.muted,
                fontSize: 9,
                letterSpacing: '0.14em',
                textTransform: 'uppercase' as const,
                textAlign: 'center' as const,
              }}
            >
              <div style={{ color: COLOR.accent.teal }}>{label}</div>
              <div style={{ fontSize: 7, marginTop: 1 }}>{sub}</div>
            </Html>
          </group>
        );
      })}

      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color={COLOR.border.strong} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ambient rotation
// ---------------------------------------------------------------------------

function SceneRotator({ enabled }: { enabled: boolean }) {
  useFrame((state) => {
    if (!enabled) return;
    const t = state.clock.getElapsedTime();
    state.camera.position.x = Math.cos(t * 0.06) * 16;
    state.camera.position.z = Math.sin(t * 0.06) * 16;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

// ---------------------------------------------------------------------------
// Main canvas
// ---------------------------------------------------------------------------

export default function FormalClaimUniverse({
  hoveredId,
  selectedId,
  onHover,
  onSelect,
}: FormalClaimUniverseProps) {
  const [userInteracting, setUserInteracting] = useState(false);

  return (
    <Canvas
      camera={{ position: [12, 9, 14], fov: 45, near: 0.1, far: 100 }}
      style={{ background: COLOR.bg.primary, cursor: 'grab' }}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={[COLOR.bg.primary]} />
      <fog attach="fog" args={[COLOR.bg.primary, 18, 40]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[8, 12, 8]} intensity={0.9} color="#ffffff" />
      <directionalLight position={[-8, -4, -8]} intensity={0.25} color={COLOR.accent.teal} />

      <Suspense fallback={null}>
        <Axes />
        <DependsOnEdges />

        {PROJECTION.claims.map((claim) => (
          <ClaimNode
            key={claim.id}
            claim={claim}
            hovered={hoveredId === claim.id}
            selected={selectedId === claim.id}
            onHover={onHover}
            onSelect={onSelect}
          />
        ))}

        <SceneRotator enabled={!userInteracting && hoveredId === null} />
      </Suspense>

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={32}
        onStart={() => setUserInteracting(true)}
      />
    </Canvas>
  );
}
