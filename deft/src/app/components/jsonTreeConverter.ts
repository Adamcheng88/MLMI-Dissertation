import { FeatureNode } from './TreeData';

interface JsonFeature {
  name: string;
  description: string;
  rationale: string;
  code: string;
  threshold: number;
  score: number;
}

interface JsonNode {
  id: string;
  depth: number;
  parent_id: string | null;
  side: string | null;
  is_leaf: boolean;
  prediction: number;
  n: number;
  n_pos: number;
  n_neg: number;
  feature: JsonFeature | null;
  left?: string;
  right?: string;
}

export interface TreeJson {
  meta: {
    dataset_csv?: string;
    sequence_column?: string;
    target_column?: string;
    max_depth?: number;
    n_train?: number;
    n_test?: number;
    n_pos_train?: number;
    n_neg_train?: number;
    test_size?: number;
    random_state?: number;
    test_accuracy?: number;
    test_auc?: number;
    fit_seconds?: number;
    input?: {
      target_name?: string;
      dataset_info?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  nodes: JsonNode[];
  root_id: string;
}

export function convertJsonToFeatureNode(json: TreeJson): FeatureNode {
  const nodeMap = new Map<string, JsonNode>();
  for (const node of json.nodes) {
    nodeMap.set(node.id, node);
  }

  function buildNode(jn: JsonNode, parentFeature?: JsonFeature | null, side?: string | null): FeatureNode {
    const isLeaf = jn.is_leaf;



    const n = jn.n;
    const p1 = n > 0 ? jn.n_pos / n : 0;
    const p2 = n > 0 ? jn.n_neg / n : 0;
    const giniScore = 1 - (p1 * p1 + p2 * p2);

    const node: FeatureNode = {
      id: jn.id,
      name: isLeaf ? jn.id : (jn.feature?.name ?? jn.id),
      description: jn.feature?.description ?? '',
      rationale: jn.feature?.rationale ?? '',
      code: jn.feature?.code ?? '',
      threshold: jn.feature?.threshold ?? 0,
      giniScore,
      samples: n,
      probability: jn.prediction,
      nPos: jn.n_pos,
      nNeg: jn.n_neg,
      depth: jn.depth,
      score: jn.feature?.score,
    };

    if (isLeaf) {
      node.prediction = jn.prediction;
    }

    if (parentFeature && side) {
      node.splitCriteria = side === 'L'
        ? `≤ ${parentFeature.threshold}`
        : `> ${parentFeature.threshold}`;
    }

    if (jn.left) {
      const left = nodeMap.get(jn.left);
      if (left) node.left = buildNode(left, jn.feature, 'L');
    }

    if (jn.right) {
      const right = nodeMap.get(jn.right);
      if (right) node.right = buildNode(right, jn.feature, 'R');
    }

    return node;
  }

  const root = nodeMap.get(json.root_id);
  if (!root) throw new Error(`Root node "${json.root_id}" not found in nodes array`);

  return buildNode(root);
}

export function buildTreeDescription(meta: TreeJson['meta']): string {
  const parts: string[] = [];
  if (meta.test_accuracy != null) parts.push(`Accuracy: ${(meta.test_accuracy * 100).toFixed(1)}%`);
  if (meta.test_auc != null) parts.push(`AUC: ${meta.test_auc.toFixed(3)}`);
  if (meta.n_train != null) parts.push(`${meta.n_train.toLocaleString()} training samples`);
  if (meta.max_depth != null) parts.push(`depth ${meta.max_depth}`);
  return parts.join(' · ') || 'Uploaded decision tree';
}

export function buildTreeTitle(meta: TreeJson['meta'], filename: string): string {
  if (meta.input?.target_name) {
    return meta.input.target_name
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  return filename
    .replace(/\.json$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
