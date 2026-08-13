import { FeatureNode } from './TreeData';
import type { TreeJson } from './jsonTreeConverter';

export interface NodeFlowMetrics {
  samples: number;
  nPos: number;
  nNeg: number;
}

export interface DatasetFlowState {
  label: string;
  metricsById: Map<string, NodeFlowMetrics>;
  rootSamples: number;
}

export type DatasetFlowView = 'A' | 'B' | 'both' | 'diff';

export const DATASET_FLOW_COLOR_A = '#2563eb';
export const DATASET_FLOW_COLOR_B = '#d97706';

function collectNodeIds(node: FeatureNode, ids: Set<string> = new Set()): Set<string> {
  ids.add(node.id);
  if (node.left) collectNodeIds(node.left, ids);
  if (node.right) collectNodeIds(node.right, ids);
  return ids;
}

function nodePositiveProb(node: FeatureNode): number {
  if (node.probability !== undefined) return node.probability;
  if (node.prediction !== undefined) return node.prediction;
  return 0.5;
}

function metricsFromNode(node: FeatureNode): NodeFlowMetrics {
  const samples = node.samples;
  const nPos = node.nPos !== undefined ? node.nPos : Math.round(samples * nodePositiveProb(node));
  const nNeg = node.nNeg !== undefined ? node.nNeg : samples - nPos;
  return { samples, nPos, nNeg };
}

export function extractFlowMetrics(tree: FeatureNode, label = 'Primary'): DatasetFlowState {
  const metricsById = new Map<string, NodeFlowMetrics>();

  function walk(node: FeatureNode) {
    metricsById.set(node.id, metricsFromNode(node));
    if (node.left) walk(node.left);
    if (node.right) walk(node.right);
  }

  walk(tree);
  return {
    label,
    metricsById,
    rootSamples: tree.samples,
  };
}

export function extractFlowMetricsFromJson(json: TreeJson, label: string): DatasetFlowState {
  const metricsById = new Map<string, NodeFlowMetrics>();
  for (const node of json.nodes) {
    metricsById.set(node.id, {
      samples: node.n,
      nPos: node.n_pos,
      nNeg: node.n_neg,
    });
  }
  const root = json.nodes.find((n) => n.id === json.root_id);
  return {
    label,
    metricsById,
    rootSamples: root?.n ?? 0,
  };
}

export function assertCompatibleFlowTopology(
  primary: FeatureNode,
  secondaryIds: Set<string>
): { ok: true } | { ok: false; message: string } {
  const primaryIds = collectNodeIds(primary);

  const missing: string[] = [];
  for (const id of primaryIds) {
    if (!secondaryIds.has(id)) missing.push(id);
  }
  const extra: string[] = [];
  for (const id of secondaryIds) {
    if (!primaryIds.has(id)) extra.push(id);
  }

  if (missing.length === 0 && extra.length === 0) {
    return { ok: true };
  }

  const parts: string[] = [];
  if (missing.length) {
    parts.push(`missing ${missing.length} node(s) from the primary tree (e.g. ${missing.slice(0, 3).join(', ')})`);
  }
  if (extra.length) {
    parts.push(`has ${extra.length} extra node id(s) (e.g. ${extra.slice(0, 3).join(', ')})`);
  }
  return {
    ok: false,
    message: `Comparison JSON does not match this tree's structure: ${parts.join('; ')}.`,
  };
}


function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function splitCounts(total: number, leftShare: number): { left: number; right: number } {
  const left = clamp(Math.round(total * leftShare), 0, total);
  return { left, right: total - left };
}

function splitClass(samples: number, posRate: number): { nPos: number; nNeg: number } {
  const nPos = clamp(Math.round(samples * posRate), 0, samples);
  return { nPos, nNeg: samples - nPos };
}


export function createMockSecondaryFlow(primary: FeatureNode): DatasetFlowState {
  const metricsById = new Map<string, NodeFlowMetrics>();
  const rootSamples = primary.samples;

  function walk(node: FeatureNode, samples: number, posRate: number) {
    const { nPos, nNeg } = splitClass(samples, posRate);
    metricsById.set(node.id, { samples, nPos, nNeg });

    if (!node.left && !node.right) return;

    const origLeft = node.left ? metricsFromNode(node.left).samples : 0;
    const origParent = Math.max(1, metricsFromNode(node).samples);
    const origLeftShare = node.left && node.right ? origLeft / origParent : node.left ? 1 : 0;


    let leftShare: number;
    if (node.left && node.right) {
      const invertStrength = 0.70 + hash01(node.id + ':inv') * 0.18;
      if (origLeftShare >= 0.5) {
        leftShare = 1 - invertStrength;
      } else {
        leftShare = invertStrength;
      }

      leftShare = clamp(leftShare + (hash01(node.id + ':wobble') - 0.5) * 0.12, 0.10, 0.90);
    } else {
      leftShare = node.left ? 1 : 0;
    }


    const posFlip = hash01(node.id + ':posflip') < 0.5 ? -1 : 1;
    const childPosBase = clamp(0.5 + posFlip * (0.22 + hash01(node.id + ':posmag') * 0.18), 0.08, 0.92);

    if (node.left && node.right) {
      const { left, right } = splitCounts(samples, leftShare);
      const leftPos = clamp(childPosBase - 0.12 - hash01(node.id + ':L') * 0.10, 0.05, 0.95);
      const rightPos = clamp(childPosBase + 0.12 + hash01(node.id + ':R') * 0.10, 0.05, 0.95);
      walk(node.left, left, leftPos);
      walk(node.right, right, rightPos);
    } else if (node.left) {
      walk(node.left, samples, childPosBase);
    } else if (node.right) {
      walk(node.right, samples, childPosBase);
    }
  }

  const rootPos = metricsFromNode(primary).samples > 0
    ? metricsFromNode(primary).nPos / metricsFromNode(primary).samples
    : 0.5;

  const mockRoot = Math.max(1, Math.round(rootSamples * (0.7 + hash01(primary.id + ':root') * 0.5)));
  const mockRootPos = clamp(1 - rootPos + (hash01(primary.id + ':rootpos') - 0.5) * 0.15, 0.12, 0.88);
  walk(primary, mockRoot, mockRootPos);

  return {
    label: 'Demo dataset B',
    metricsById,
    rootSamples: mockRoot,
  };
}

export function percentOfRoot(nodeSamples: number, rootSamples: number): number {
  if (rootSamples <= 0) return 0;
  return (nodeSamples / rootSamples) * 100;
}

export function percentOfParent(childSamples: number, parentSamples: number): number {
  if (parentSamples <= 0) return 0;
  return (childSamples / parentSamples) * 100;
}

export function class1Rate(m: NodeFlowMetrics): number {
  if (m.samples <= 0) return 0;
  return m.nPos / m.samples;
}


export function formatFlowDelta(aPct: number, bPct: number): string {
  const diff = bPct - aPct;
  const abs = Math.abs(diff);
  if (abs < 0.5) {
    return 'A and B send a similar share of their data here.';
  }
  const rounded = abs.toFixed(0);
  if (diff > 0) {
    return `B sends ${rounded}% more of its data here than A.`;
  }
  return `A sends ${rounded}% more of its data here than B.`;
}


export function formatCorrectClassificationDelta(
  metricsA: NodeFlowMetrics,
  metricsB: NodeFlowMetrics,
  probability: number,
  decisionCutoff: number
): string {
  const predictsClass1 = probability >= decisionCutoff;
  const correctA = predictsClass1 ? metricsA.nPos : metricsA.nNeg;
  const correctB = predictsClass1 ? metricsB.nPos : metricsB.nNeg;
  const accA = metricsA.samples > 0 ? correctA / metricsA.samples : 0;
  const accB = metricsB.samples > 0 ? correctB / metricsB.samples : 0;
  const diffPts = (accB - accA) * 100;
  const absPts = Math.abs(diffPts);

  if (absPts < 0.5) {
    return 'A and B data are classified with similar accuracy at this node.';
  }

  const x = absPts.toFixed(0);
  if (diffPts > 0) {
    return `B data is classified ${x}% more accurately at this node than A data.`;
  }
  return `A data is classified ${x}% more accurately at this node than B data.`;
}

export function edgeWidthFromProportion(
  childSamples: number,
  denomSamples: number,
  mode: 'absolute' | 'relative'
): { edgeWidth: number; splitPercentage: number } {
  if (mode === 'absolute') {
    const proportion = denomSamples > 0 ? childSamples / denomSamples : 0;
    return {
      splitPercentage: proportion * 100,
      edgeWidth: Math.max(4, proportion * 120),
    };
  }
  const splitPercentage = denomSamples > 0 ? (childSamples / denomSamples) * 100 : 0;
  return {
    splitPercentage,
    edgeWidth: Math.max(4, (splitPercentage / 100) * 40),
  };
}
