'use client';

import { useRef, useState, Suspense } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { CLAIMS, CLUSTER_COLORS, type Claim } from '@/config/claims';
import { COLOR, FONT_FAMILY } from '@/config/theme';

interface ClaimUniverseProps {
  selectedId: string | null;
  onSelect: (claim: Claim | null) => void;
  onHover: (claim: Claim | null) => void;
}

// ---------------------------------------------------------------------------
// Single claim sphere + label
// ---------------------------------------------------------------------------

interface ClaimNodeProps {
  claim: Claim;
  selected: boolean;
  onSelect: (claim: Claim) => void;
  onHover: (claim: Claim | null) => void;
}

function ClaimNode({ claim, selected, onSelect, onHover }: ClaimNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = CLUSTER_COLORS[claim.cluster];
  const targetScale = selected ? 1.5 : hovered ? 1.25 : 1.0;
  const targetScaleVec = useRef(new THREE.Vector3(1, 1, 1));

  useFrame(() => {
    if (meshRef.current) {
      targetScaleVec.current.setScalar(targetScale);
      meshRef.current.scale.lerp(targetScaleVec.current, 0.18);
    }
  });

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    onHover(claim);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    onHover(null);
    document.body.style.cursor = '';
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(claim);
  };

  return (
    <group position={claim.projection_3d}>
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <sphereGeometry args={[0.36, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 0.6 : hovered ? 0.35 : 0.15}
          metalness={0.25}
          roughness={0.45}
        />
      </mesh>

      {/* Selection ring */}
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.6, 0.68, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Ambient exp number tag (always visible, small) */}
      {!selected && !hovered && (
        <Html
          position={[0, 0.58, 0]}
          center
          distanceFactor={14}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontFamily: FONT_FAMILY,
            fontSize: 9,
            letterSpacing: '0.16em',
            color: COLOR.text.muted,
            textTransform: 'uppercase' as const,
          }}
        >
          {claim.exp_number.toString().padStart(2, '0')}
        </Html>
      )}

      {/* Full label (hover / selected only) */}
      {(hovered || selected) && (
        <Html
          position={[0, 0.72, 0]}
          center
          distanceFactor={9}
          zIndexRange={[100, 0]}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            fontFamily: FONT_FAMILY,
            fontSize: 11,
            letterSpacing: '0.1em',
            color: selected ? color : COLOR.text.primary,
            textTransform: 'uppercase' as const,
            padding: '2px 6px',
            backgroundColor: `${COLOR.bg.primary}CC`,
            border: `1px solid ${selected ? color : COLOR.border.strong}`,
          }}
        >
          {`${claim.exp_number.toString().padStart(2, '0')} · ${claim.title}`}
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Axes gizmo (thin rules with labels at the ends)
// ---------------------------------------------------------------------------

function Axes() {
  const L = 6;
  const axes: { dir: [number, number, number]; label: string; sub: string }[] = [
    { dir: [L, 0, 0], label: 'PC1', sub: 'Argument richness' },
    { dir: [0, L, 0], label: 'PC2', sub: 'Method rigor' },
    { dir: [0, 0, L], label: 'PC3', sub: 'Effect strength' },
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
              position={[dir[0] * 1.08, dir[1] * 1.08, dir[2] * 1.08]}
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

      {/* Origin marker */}
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color={COLOR.border.strong} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ambient auto-rotation (pauses when user interacts)
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

export default function ClaimUniverse({ selectedId, onSelect, onHover }: ClaimUniverseProps) {
  const [userInteracting, setUserInteracting] = useState(false);

  return (
    <Canvas
      camera={{ position: [12, 9, 14], fov: 45, near: 0.1, far: 100 }}
      style={{ background: COLOR.bg.primary, cursor: 'grab' }}
      onPointerMissed={() => onSelect(null)}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={[COLOR.bg.primary]} />
      <fog attach="fog" args={[COLOR.bg.primary, 18, 40]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[8, 12, 8]} intensity={0.9} color="#ffffff" />
      <directionalLight position={[-8, -4, -8]} intensity={0.25} color={COLOR.accent.teal} />

      <Suspense fallback={null}>
        <Axes />

        {CLAIMS.map((claim) => (
          <ClaimNode
            key={claim.id}
            claim={claim}
            selected={selectedId === claim.id}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}

        <SceneRotator enabled={!userInteracting && selectedId === null} />
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
