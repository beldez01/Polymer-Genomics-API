/**
 * Hierarchical agglomerative clustering — pure JS implementation.
 *
 * Supports correlation / euclidean distance and ward / complete / average linkage.
 */

import type { BetaMatrix } from './parse-beta-matrix';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DistanceMetric = 'correlation' | 'euclidean';
export type LinkageMethod = 'ward' | 'complete' | 'average';

export interface DendrogramNode {
  id: number;            // leaf: sample/probe index; internal: nLeaves + mergeOrder
  left: DendrogramNode | null;
  right: DendrogramNode | null;
  height: number;        // merge distance
  size: number;          // number of leaves
  x?: number;            // layout position (assigned by layoutDendrogram)
}

export interface ClusterResult {
  rowTree: DendrogramNode;    // sample dendrogram
  colTree: DendrogramNode;    // probe dendrogram
  rowOrder: number[];         // reordered sample indices
  colOrder: number[];         // reordered probe indices
  matrix: number[][];         // reordered beta matrix [samples x probes]
}

// ---------------------------------------------------------------------------
// Probe selection
// ---------------------------------------------------------------------------

export function selectTopVariableProbes(
  matrix: BetaMatrix,
  topN: number,
): { probeIndices: number[]; subMatrix: number[][] } {
  const { samples, nProbes } = matrix;
  const n = samples.length;

  // Compute variance for each probe across samples
  const variances: { idx: number; variance: number }[] = [];
  for (let j = 0; j < nProbes; j++) {
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      const v = samples[i].values[j];
      if (!isNaN(v)) {
        sum += v;
        sumSq += v * v;
        count++;
      }
    }
    if (count > 1) {
      const mean = sum / count;
      const variance = (sumSq - count * mean * mean) / (count - 1);
      variances.push({ idx: j, variance });
    }
  }

  // Sort descending by variance, take top N
  variances.sort((a, b) => b.variance - a.variance);
  const selected = variances.slice(0, Math.min(topN, variances.length));
  const probeIndices = selected.map(v => v.idx);

  // Build sub-matrix [samples x selectedProbes]
  const subMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = new Array(probeIndices.length);
    for (let j = 0; j < probeIndices.length; j++) {
      const val = samples[i].values[probeIndices[j]];
      row[j] = isNaN(val) ? 0 : val; // impute NaN as 0 for clustering
    }
    subMatrix.push(row);
  }

  return { probeIndices, subMatrix };
}

// ---------------------------------------------------------------------------
// Distance computation
// ---------------------------------------------------------------------------

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length;
  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
    sumAB += a[i] * b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
  }
  const denom = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  if (denom === 0) return 0;
  return (n * sumAB - sumA * sumB) / denom;
}

function euclideanDist(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function computeDistanceMatrix(
  data: number[][],
  metric: DistanceMetric,
  byRow: boolean,
): number[][] {
  // If byRow=false, transpose first
  let vectors: number[][];
  if (byRow) {
    vectors = data;
  } else {
    const nRows = data.length;
    const nCols = data[0]?.length || 0;
    vectors = [];
    for (let j = 0; j < nCols; j++) {
      const col: number[] = new Array(nRows);
      for (let i = 0; i < nRows; i++) {
        col[i] = data[i][j];
      }
      vectors.push(col);
    }
  }

  const n = vectors.length;
  const dist: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let d: number;
      if (metric === 'correlation') {
        d = 1 - pearsonCorrelation(vectors[i], vectors[j]);
      } else {
        d = euclideanDist(vectors[i], vectors[j]);
      }
      dist[i][j] = d;
      dist[j][i] = d;
    }
  }

  return dist;
}

// ---------------------------------------------------------------------------
// Hierarchical clustering
// ---------------------------------------------------------------------------

export function hierarchicalCluster(
  distMatrix: number[][],
  method: LinkageMethod,
): DendrogramNode {
  const n = distMatrix.length;
  if (n === 0) {
    throw new Error('Cannot cluster empty distance matrix');
  }
  if (n === 1) {
    return { id: 0, left: null, right: null, height: 0, size: 1 };
  }

  // Initialize: each item is a leaf node
  const nodes: (DendrogramNode | null)[] = [];
  for (let i = 0; i < n; i++) {
    nodes.push({ id: i, left: null, right: null, height: 0, size: 1 });
  }

  // Copy distance matrix (will be modified)
  const dist: number[][] = distMatrix.map(row => [...row]);

  // Track cluster sizes for Ward's method
  const clusterSize: number[] = new Array(n).fill(1);

  // Active cluster indices
  const active = new Set<number>();
  for (let i = 0; i < n; i++) active.add(i);

  let nextId = n;

  for (let step = 0; step < n - 1; step++) {
    // Find closest pair
    let minDist = Infinity;
    let mergeA = -1;
    let mergeB = -1;
    const activeArr = Array.from(active);

    for (let ii = 0; ii < activeArr.length; ii++) {
      const i = activeArr[ii];
      for (let jj = ii + 1; jj < activeArr.length; jj++) {
        const j = activeArr[jj];
        if (dist[i][j] < minDist) {
          minDist = dist[i][j];
          mergeA = i;
          mergeB = j;
        }
      }
    }

    // Create merged node
    const newNode: DendrogramNode = {
      id: nextId++,
      left: nodes[mergeA]!,
      right: nodes[mergeB]!,
      height: minDist,
      size: clusterSize[mergeA] + clusterSize[mergeB],
    };

    // Update distances using Lance-Williams formula
    const sA = clusterSize[mergeA];
    const sB = clusterSize[mergeB];
    const sAB = sA + sB;

    for (const k of active) {
      if (k === mergeA || k === mergeB) continue;

      let newDist: number;
      const dAK = dist[mergeA][k];
      const dBK = dist[mergeB][k];
      const dAB = dist[mergeA][mergeB];
      const sK = clusterSize[k];

      if (method === 'ward') {
        // Ward's formula
        newDist = ((sA + sK) * dAK + (sB + sK) * dBK - sK * dAB) / (sAB + sK);
      } else if (method === 'complete') {
        newDist = Math.max(dAK, dBK);
      } else {
        // average
        newDist = (sA * dAK + sB * dBK) / sAB;
      }

      dist[mergeA][k] = newDist;
      dist[k][mergeA] = newDist;
    }

    // mergeA becomes the merged cluster, mergeB is removed
    nodes[mergeA] = newNode;
    clusterSize[mergeA] = sAB;
    active.delete(mergeB);
  }

  // Return the last remaining node
  const rootIdx = Array.from(active)[0];
  return nodes[rootIdx]!;
}

// ---------------------------------------------------------------------------
// Dendrogram layout
// ---------------------------------------------------------------------------

export function layoutDendrogram(root: DendrogramNode): void {
  let leafPos = 0;

  function traverse(node: DendrogramNode): void {
    if (!node.left && !node.right) {
      // Leaf
      node.x = leafPos++;
      return;
    }
    if (node.left) traverse(node.left);
    if (node.right) traverse(node.right);
    // Internal node x = midpoint of children
    const leftX = node.left?.x ?? 0;
    const rightX = node.right?.x ?? 0;
    node.x = (leftX + rightX) / 2;
  }

  traverse(root);
}

export function getLeafOrder(root: DendrogramNode): number[] {
  const order: number[] = [];

  function traverse(node: DendrogramNode): void {
    if (!node.left && !node.right) {
      order.push(node.id);
      return;
    }
    if (node.left) traverse(node.left);
    if (node.right) traverse(node.right);
  }

  traverse(root);
  return order;
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

export function clusterBetaMatrix(
  matrix: BetaMatrix,
  options: {
    topN?: number;
    distMetric?: DistanceMetric;
    linkage?: LinkageMethod;
  } = {},
): ClusterResult {
  const topN = options.topN ?? 500;
  const distMetric = options.distMetric ?? 'correlation';
  const linkage = options.linkage ?? 'ward';

  // 1. Select top variable probes
  const { probeIndices, subMatrix } = selectTopVariableProbes(matrix, topN);

  // 2. Compute distance matrices
  const rowDist = computeDistanceMatrix(subMatrix, distMetric, true);
  const colDist = computeDistanceMatrix(subMatrix, distMetric, false);

  // 3. Cluster
  const rowTree = hierarchicalCluster(rowDist, linkage);
  const colTree = hierarchicalCluster(colDist, linkage);

  // 4. Layout dendrograms
  layoutDendrogram(rowTree);
  layoutDendrogram(colTree);

  // 5. Get leaf orders
  const rowOrder = getLeafOrder(rowTree);
  const colOrder = getLeafOrder(colTree);

  // 6. Reorder matrix
  const reorderedMatrix: number[][] = [];
  for (const ri of rowOrder) {
    const row: number[] = new Array(colOrder.length);
    for (let j = 0; j < colOrder.length; j++) {
      row[j] = subMatrix[ri][colOrder[j]];
    }
    reorderedMatrix.push(row);
  }

  return {
    rowTree,
    colTree,
    rowOrder,
    colOrder,
    matrix: reorderedMatrix,
  };
}
