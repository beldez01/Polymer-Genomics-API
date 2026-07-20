'use client';

/**
 * /portal/graph — claim-graph projection.
 *
 * v0 ships `depends_on` edges across the merged corpus, laid out with
 * dagre (TB hierarchy). Color-by-outcome matches the latent3D view.
 * Click a node → opens the inline FormalClaimBody. Future v0.x:
 * `extends`, `contradicts`, `supersedes`, `latent-near` edge types as the
 * IR `relations` field lands and the corpus carries them.
 */

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useMemo, useRef, useState } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { FormalClaimBody } from '@/components/FormalClaim/FormalClaimView';
import {
  EDGES,
  OUTCOME_COLORS,
  PROJECTION,
  type FormalProjectionClaim,
} from '@/config/formal_projection';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';

const NODE_W = 240;
const NODE_H = 64;

type ClaimNodeData = { claim: FormalProjectionClaim };
type ClaimNode = Node<ClaimNodeData>;

function buildGraph(): { nodes: ClaimNode[]; edges: Edge[] } {
  const nodes: ClaimNode[] = PROJECTION.claims.map((claim) => ({
    id: claim.id,
    type: 'claim',
    position: { x: 0, y: 0 },
    data: { claim },
  }));
  const edges: Edge[] = EDGES.map((e, i) => ({
    id: `${e.source.id}->${e.target.id}-${i}`,
    source: e.target.id, // dagre 'depends_on' = target is upstream
    target: e.source.id,
    type: 'smoothstep',
    style: { stroke: '#7BC4FF', strokeWidth: 1.4, opacity: 0.65 },
    label: 'depends_on',
    labelStyle: {
      fill: COLOR.text.muted,
      fontSize: 9,
      letterSpacing: '0.16em',
      textTransform: 'uppercase' as const,
    },
    labelBgStyle: { fill: COLOR.bg.elevated, opacity: 0.9 },
    labelBgPadding: [3, 4],
  }));

  // Dagre layout: top-to-bottom, leaf claims at bottom, foundational at top.
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 32, ranksep: 56, marginx: 32, marginy: 32 });
  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);
  for (const node of nodes) {
    const pos = g.node(node.id);
    if (pos) {
      node.position = { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 };
    }
  }
  return { nodes, edges };
}

function ClaimNodeView({ data, selected }: NodeProps<ClaimNode>) {
  const { claim } = data;
  const fill = OUTCOME_COLORS[claim.outcome];
  return (
    <div
      style={{
        width: NODE_W,
        minHeight: NODE_H,
        backgroundColor: COLOR.bg.elevated,
        border: `2px solid ${selected ? COLOR.accent.teal : COLOR.border.default}`,
        borderRadius: 4,
        padding: SPACE[2],
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#7BC4FF', width: 6, height: 6 }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[1],
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: COLOR.text.muted,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: fill,
            display: 'inline-block',
          }}
        />
        {claim.topic}
      </div>
      <div
        style={{
          color: COLOR.text.primary,
          fontSize: TYPE.xs.fontSize,
          fontWeight: WEIGHT.medium,
          lineHeight: 1.35,
          fontFamily: FONT_FAMILY,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
        title={claim.id}
      >
        {claim.id}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#7BC4FF', width: 6, height: 6 }} />
    </div>
  );
}

const NODE_TYPES = { claim: ClaimNodeView };

export default function GraphProjectionPage() {
  const [selected, setSelected] = useState<FormalProjectionClaim | null>(null);
  const inlineRef = useRef<HTMLDivElement>(null);

  const { nodes, edges } = useMemo(() => buildGraph(), []);

  function handleNodeClick(_evt: unknown, node: ClaimNode) {
    setSelected(node.data.claim);
    requestAnimationFrame(() => {
      inlineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <main
      style={{
        backgroundColor: COLOR.bg.primary,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT_FAMILY,
      }}
    >
      <BrandBar subtitle="Claim Graph" sticky />

      <section
        style={{
          maxWidth: 1600,
          width: '100%',
          margin: '0 auto',
          padding: `${SPACE[5]}px ${SPACE[6]}px ${SPACE[3]}px`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3], marginBottom: SPACE[2] }}>
          <span
            style={{
              color: COLOR.accent.teal,
              fontSize: TYPE.xs.fontSize,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              fontWeight: WEIGHT.medium,
            }}
          >
            Graph projection · v0
          </span>
          <div style={{ flex: 1, height: 1, backgroundColor: COLOR.border.strong }} />
          <span
            style={{
              color: COLOR.text.muted,
              fontSize: TYPE.xs.fontSize,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            {PROJECTION.n_claims} nodes · {EDGES.length} depends_on edges
          </span>
        </div>
        <p
          style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.sm.fontSize,
            lineHeight: 1.6,
            margin: 0,
            maxWidth: 720,
          }}
        >
          Hierarchical layout: foundational measurement claims sit at the top,
          leaf inferences at the bottom. Edges trace <code>depends_on</code>
          across the corpus. Click a node to inspect its 5-tuple DAG below.
          Future versions will overlay <code>extends</code> · <code>contradicts</code>{' '}
          · <code>supersedes</code> · <code>latent-near</code> edges as the
          relations field lands.
        </p>
      </section>

      <div
        style={{
          maxWidth: 1600,
          width: '100%',
          margin: '0 auto',
          border: `1px solid ${COLOR.border.subtle}`,
          height: 640,
          position: 'relative',
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          minZoom={0.2}
          maxZoom={1.6}
          onNodeClick={handleNodeClick}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={COLOR.border.subtle} />
          <Controls position="bottom-right" showInteractive={false} />
        </ReactFlow>
      </div>

      <section
        ref={inlineRef}
        style={{
          maxWidth: 1280,
          width: '100%',
          margin: '0 auto',
          padding: `${SPACE[6]}px ${SPACE[6]}px ${SPACE[8]}px`,
        }}
      >
        {selected ? (
          selected.fixture ? (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE[3],
                  marginBottom: SPACE[4],
                }}
              >
                <span
                  style={{
                    color: COLOR.accent.teal,
                    fontSize: TYPE.xs.fontSize,
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    fontWeight: WEIGHT.medium,
                    flexShrink: 0,
                  }}
                >
                  Selected claim
                </span>
                <div style={{ flex: 1, height: 1, backgroundColor: COLOR.border.strong }} />
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  style={{
                    background: 'none',
                    border: `1px solid ${COLOR.border.default}`,
                    color: COLOR.text.tertiary,
                    fontFamily: FONT_FAMILY,
                    fontSize: TYPE.sm.fontSize,
                    padding: `${SPACE[1]}px ${SPACE[3]}px`,
                    borderRadius: 3,
                    cursor: 'pointer',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  Close ×
                </button>
              </div>
              <FormalClaimBody claim={selected.fixture} />
            </>
          ) : (
            <div
              style={{
                color: COLOR.text.muted,
                fontSize: TYPE.sm.fontSize,
                padding: SPACE[4],
                border: `1px dashed ${COLOR.border.default}`,
              }}
            >
              No fixture payload attached to this projection entry. Rebuild via{' '}
              <code>make projection</code>.
            </div>
          )
        ) : (
          <div
            style={{
              color: COLOR.text.muted,
              fontSize: TYPE.xs.fontSize,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              textAlign: 'center',
              padding: `${SPACE[4]}px 0`,
            }}
          >
            Click a node above to inspect its DAG
          </div>
        )}
      </section>
    </main>
  );
}
