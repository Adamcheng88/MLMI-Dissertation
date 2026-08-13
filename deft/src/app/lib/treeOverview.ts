import { FeatureNode } from '../components/TreeData';
import type { TreeJson } from '../components/jsonTreeConverter';







function buildHeader(meta?: TreeJson['meta']): string {
  if (!meta) return '';
  const lines: string[] = [];
  const input = meta.input || {};
  if (input.target_name) lines.push(`Outcome predicted: ${input.target_name}`);
  if (input.dataset_info) lines.push(`Dataset: ${input.dataset_info}`);
  const stats: string[] = [];
  if (meta.test_accuracy != null) stats.push(`accuracy ${(meta.test_accuracy * 100).toFixed(1)}%`);
  if (meta.test_auc != null) stats.push(`AUC ${Number(meta.test_auc).toFixed(3)}`);
  if (meta.max_depth != null) stats.push(`max depth ${meta.max_depth}`);
  if (meta.n_train != null) stats.push(`${meta.n_train.toLocaleString()} training examples`);
  if (stats.length) lines.push(`Tree quality: ${stats.join(', ')}`);
  return lines.join('\n');
}

function featureLabel(node: FeatureNode, isLeaf: boolean): string {
  if (isLeaf) return `LEAF ${node.id}`;
  return node.name || 'question';
}

function nodeLine(node: FeatureNode, depth: number, parentLabel: string | null, side: 'L' | 'R' | null): string {
  const isLeaf = !node.left && !node.right;
  const parts: string[] = [`[${featureLabel(node, isLeaf)}]`, `depth ${depth}`];
  if (parentLabel) {
    const branch = side === 'L' ? 'no/low branch' : side === 'R' ? 'yes/high branch' : 'branch';
    parts.push(`from ${parentLabel} (${branch})`);
  }
  if (isLeaf) {
    parts.push('final group');
  } else {
    parts.push(`threshold ${node.threshold}`);
  }
  const n = node.samples ?? 0;
  parts.push(`${n} examples`);
  if (n > 0 && node.nPos != null) {
    parts.push(`${Math.round((node.nPos / n) * 100)}% positive`);
  }
  const likelihood = node.probability ?? node.prediction;
  if (likelihood != null) parts.push(`predicted likelihood ${Math.round(likelihood * 100)}%`);
  return '- ' + parts.join(' | ');
}

export function buildTreeOverview(tree: FeatureNode, meta?: TreeJson['meta']): string {
  const lines: string[] = [];
  function walk(node: FeatureNode, depth: number, parentLabel: string | null, side: 'L' | 'R' | null) {
    const isLeaf = !node.left && !node.right;
    lines.push(nodeLine(node, depth, parentLabel, side));

    const thisLabel = isLeaf ? node.id : (node.name || 'question');
    if (node.left) walk(node.left, depth + 1, thisLabel, 'L');
    if (node.right) walk(node.right, depth + 1, thisLabel, 'R');
  }
  walk(tree, 0, null, null);

  const header = buildHeader(meta);
  return [
    header,
    header ? '' : '',
    'Tree structure (split nodes labeled by feature name; leaves labeled LEAF <id> with parent feature and branch):',
    lines.join('\n'),
  ]
    .filter(s => s !== '')
    .join('\n');
}
