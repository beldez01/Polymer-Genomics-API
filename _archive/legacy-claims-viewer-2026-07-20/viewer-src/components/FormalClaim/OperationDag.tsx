'use client';

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
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  FormalClaim,
  Operation,
  Premise,
  Statistic,
} from '@/config/formal_claims';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { opChrome, provenanceChrome, renderStatValue } from '@/lib/formalClaimsHelpers';

// ---------------------------------------------------------------------------
// Node / edge construction
// ---------------------------------------------------------------------------

type PremiseNodeData = { kind: 'premise'; premise: Premise };
type OpNodeData = { kind: 'operation'; operation: Operation };
type StatNodeData = { kind: 'statistic'; statistic: Statistic };
type DagNodeData = PremiseNodeData | OpNodeData | StatNodeData;

export type DagSelection =
  | { kind: 'premise'; id: string }
  | { kind: 'operation'; id: string }
  | { kind: 'statistic'; id: string }
  | null;

const NODE_W = 248;
const NODE_H = 88;

function buildGraph(claim: FormalClaim): {
  nodes: Node<DagNodeData>[];
  edges: Edge[];
  cycles: Set<string>;
} {
  const nodes: Node<DagNodeData>[] = [];
  const edges: Edge[] = [];

  // All premise ids, op ids, stat ids are distinct namespaces; prefix to be safe.
  const premiseId = (id: string) => `P:${id}`;
  const opId = (id: string) => `O:${id}`;
  const statId = (id: string) => `S:${id}`;

  // Nodes
  for (const p of claim.premises) {
    nodes.push({
      id: premiseId(p.id),
      type: 'premise',
      position: { x: 0, y: 0 },
      data: { kind: 'premise', premise: p },
    });
  }
  for (const op of claim.operations) {
    nodes.push({
      id: opId(op.id),
      type: 'operation',
      position: { x: 0, y: 0 },
      data: { kind: 'operation', operation: op },
    });
  }
  for (const s of claim.statistics) {
    nodes.push({
      id: statId(s.id),
      type: 'statistic',
      position: { x: 0, y: 0 },
      data: { kind: 'statistic', statistic: s },
    });
  }

  // Edges: inputs → operation
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const op of claim.operations) {
    for (const input of op.inputs) {
      const srcP = premiseId(input);
      const srcO = opId(input);
      const src = nodeIds.has(srcP) ? srcP : nodeIds.has(srcO) ? srcO : null;
      if (!src) continue;
      edges.push({
        id: `e:${src}->${opId(op.id)}`,
        source: src,
        target: opId(op.id),
      });
    }
  }
  // Edges: operation → statistic (produced_by)
  for (const s of claim.statistics) {
    const src = opId(s.produced_by);
    if (!nodeIds.has(src)) continue;
    edges.push({
      id: `e:${src}->${statId(s.id)}`,
      source: src,
      target: statId(s.id),
    });
  }

  const cycles = detectCycleNodes(nodes.map((n) => n.id), edges);
  return { nodes, edges, cycles };
}

/**
 * Minimal cycle detection — returns the set of node ids that participate in
 * a cycle. If the schema is valid this should always be empty; we surface it
 * anyway so the viewer can flag pathological fixtures loudly.
 */
function detectCycleNodes(nodeIds: string[], edges: Edge[]): Set<string> {
  const outgoing = new Map<string, string[]>();
  for (const id of nodeIds) outgoing.set(id, []);
  for (const e of edges) outgoing.get(e.source)?.push(e.target);

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodeIds) color.set(id, WHITE);
  const inCycle = new Set<string>();

  const stack: string[] = [];
  function dfs(u: string): void {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of outgoing.get(u) ?? []) {
      const c = color.get(v);
      if (c === GRAY) {
        // Found back-edge u→v; everything from v onward in the stack is in the cycle
        const idx = stack.indexOf(v);
        if (idx >= 0) for (let i = idx; i < stack.length; i++) inCycle.add(stack[i]);
      } else if (c === WHITE) {
        dfs(v);
      }
    }
    color.set(u, BLACK);
    stack.pop();
  }
  for (const id of nodeIds) if (color.get(id) === WHITE) dfs(id);
  return inCycle;
}

// ---------------------------------------------------------------------------
// Dagre layout
// ---------------------------------------------------------------------------

function layout(
  nodes: Node<DagNodeData>[],
  edges: Edge[],
): Node<DagNodeData>[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 72, marginx: 12, marginy: 12 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  return nodes.map((n) => {
    const { x, y } = g.node(n.id);
    return {
      ...n,
      position: { x: x - NODE_W / 2, y: y - NODE_H / 2 },
      // Source on right, target on left — LR layout.
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });
}

// ---------------------------------------------------------------------------
// Custom node components
// ---------------------------------------------------------------------------

function NodeFrame({
  borderColor,
  selected,
  flagged,
  children,
}: {
  borderColor: string;
  selected?: boolean;
  flagged?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: NODE_W,
        height: NODE_H,
        padding: `${SPACE[2]}px ${SPACE[3]}px`,
        backgroundColor: COLOR.bg.elevated,
        border: `1px solid ${flagged ? COLOR.accent.rose : borderColor}`,
        boxShadow: selected
          ? `0 0 0 2px ${borderColor} inset, 0 0 0 1px ${borderColor}`
          : 'none',
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: FONT_FAMILY,
        cursor: 'pointer',
        transition: 'box-shadow 120ms ease',
      }}
    >
      {children}
    </div>
  );
}

function KindLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        color,
        fontSize: TYPE.sm.fontSize,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        fontWeight: WEIGHT.medium,
      }}
    >
      {children}
    </span>
  );
}

function NodeTitle({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        color: COLOR.text.primary,
        fontSize: TYPE.base.fontSize,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function NodeMeta({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        color: COLOR.text.tertiary,
        fontSize: TYPE.sm.fontSize,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function PremiseNode({ data, selected }: NodeProps<Node<PremiseNodeData>>) {
  const p = data.premise;
  const prov = provenanceChrome(p.source.provenance_state);
  return (
    <>
      <NodeFrame borderColor={COLOR.accent.teal} selected={selected}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <KindLabel color={COLOR.accent.teal}>PREMISE</KindLabel>
          <KindLabel color={prov.color}>{prov.label}</KindLabel>
        </div>
        <NodeTitle>{p.id}</NodeTitle>
        <NodeMeta>
          {p.source.layer}@{p.source.version}
        </NodeMeta>
      </NodeFrame>
      <Handle type="source" position={Position.Right} style={{ background: COLOR.accent.teal }} />
    </>
  );
}

function OperationNode({ data, selected }: NodeProps<Node<OpNodeData>>) {
  const op = data.operation;
  const chrome = opChrome(op.kind);
  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: chrome.color }} />
      <NodeFrame borderColor={chrome.color} selected={selected}>
        <KindLabel color={chrome.color}>{chrome.label}</KindLabel>
        <NodeTitle>{op.id}</NodeTitle>
        <NodeMeta>{describeOp(op)}</NodeMeta>
      </NodeFrame>
      <Handle type="source" position={Position.Right} style={{ background: chrome.color }} />
    </>
  );
}

function StatisticNode({ data, selected }: NodeProps<Node<StatNodeData>>) {
  const s = data.statistic;
  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: COLOR.accent.amber }} />
      <NodeFrame borderColor={COLOR.accent.amber} selected={selected}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <KindLabel color={COLOR.accent.amber}>STAT · {s.evidence_class}</KindLabel>
        </div>
        <NodeTitle>{s.id}</NodeTitle>
        <NodeMeta>
          {s.name}: {renderStatValue(s.value)}
        </NodeMeta>
      </NodeFrame>
    </>
  );
}

function describeOp(op: Operation): string {
  switch (op.kind) {
    case 'filter':     return 'predicate';
    case 'project':    return `${op.cols.length} cols`;
    case 'join':       return `on ${op.on}`;
    case 'aggregate':  return `by ${op.by.join(', ')}`;
    case 'cv_split':   return op.scheme.kind;
    case 'estimator':  return `${op.estimator.name}`;
    case 'null_model': return op.spec.kind;
    case 'correct':    return op.method;
  }
}

const NODE_TYPES = {
  premise: PremiseNode,
  operation: OperationNode,
  statistic: StatisticNode,
} as const;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface OperationDagProps {
  claim: FormalClaim;
  selection: DagSelection;
  onSelect: (sel: DagSelection) => void;
  height?: number;
}

export function OperationDag({ claim, selection, onSelect, height = 520 }: OperationDagProps) {
  const { rawNodes, edges, cycles } = useMemo(() => {
    const { nodes, edges, cycles } = buildGraph(claim);
    return { rawNodes: nodes, edges, cycles };
  }, [claim]);

  const laidOut = useMemo(() => layout(rawNodes, edges), [rawNodes, edges]);

  // Mark selected + flagged
  const styledNodes = useMemo<Node<DagNodeData>[]>(() => {
    return laidOut.map((n) => {
      const isSelected =
        selection !== null &&
        ((selection.kind === 'premise' && n.id === `P:${selection.id}`) ||
          (selection.kind === 'operation' && n.id === `O:${selection.id}`) ||
          (selection.kind === 'statistic' && n.id === `S:${selection.id}`));
      return { ...n, selected: isSelected };
    });
  }, [laidOut, selection]);

  const styledEdges = useMemo<Edge[]>(() => {
    return edges.map((e) => {
      const cyc = cycles.has(e.source) && cycles.has(e.target);
      return {
        ...e,
        style: {
          stroke: cyc ? COLOR.accent.rose : COLOR.border.strong,
          strokeWidth: 1.25,
        },
        animated: cyc,
      };
    });
  }, [edges, cycles]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<DagNodeData>) => {
      const [prefix, id] = node.id.split(':', 2);
      if (prefix === 'P') onSelect({ kind: 'premise', id });
      else if (prefix === 'O') onSelect({ kind: 'operation', id });
      else if (prefix === 'S') onSelect({ kind: 'statistic', id });
    },
    [onSelect],
  );

  const handlePaneClick = useCallback(() => onSelect(null), [onSelect]);

  // Re-run layout when the canvas remounts (e.g. StrictMode double-mount)
  // ReactFlow needs a proxy for strict-mode; see below.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    // Avoid SSR mismatch on the first paint
    return <div style={{ height, backgroundColor: COLOR.bg.primary }} />;
  }

  return (
    <div
      style={{
        height,
        border: `1px solid ${COLOR.border.default}`,
        borderRadius: 3,
        backgroundColor: COLOR.bg.primary,
        overflow: 'hidden',
      }}
    >
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        nodeTypes={NODE_TYPES}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        zoomOnPinch
        zoomOnScroll={false}
        colorMode="dark"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color={COLOR.border.subtle}
        />
        <Controls
          showInteractive={false}
          style={{
            backgroundColor: COLOR.bg.elevated,
            border: `1px solid ${COLOR.border.default}`,
          }}
        />
      </ReactFlow>
    </div>
  );
}
