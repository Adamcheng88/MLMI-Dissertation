




function buildHeader(meta = {}) {
  const lines = [];
  const input = meta.input || {};
  if (input.target_name) lines.push(`Outcome predicted: ${input.target_name}`);
  if (input.dataset_info) lines.push(`Dataset: ${input.dataset_info}`);
  const stats = [];
  if (meta.test_accuracy != null) stats.push(`accuracy ${(meta.test_accuracy * 100).toFixed(1)}%`);
  if (meta.test_auc != null) stats.push(`AUC ${Number(meta.test_auc).toFixed(3)}`);
  if (meta.max_depth != null) stats.push(`max depth ${meta.max_depth}`);
  if (meta.n_train != null) stats.push(`${meta.n_train.toLocaleString()} training examples`);
  if (stats.length) lines.push(`Tree quality: ${stats.join(', ')}`);
  return lines.join('\n');
}


function featureLabel(node) {
  if (node?.feature?.name) return node.feature.name;
  return null;
}

function nodeLine(node, byId) {
  const label = node.is_leaf
    ? `LEAF ${node.id}`
    : (featureLabel(node) || 'question');
  const parts = [`[${label}]`, `depth ${node.depth}`];
  if (node.parent_id) {
    const parent = byId.get(node.parent_id);
    const parentLabel = featureLabel(parent) || 'parent question';
    const branch = node.side === 'L' ? 'no/low branch' : node.side === 'R' ? 'yes/high branch' : 'branch';
    parts.push(`from ${parentLabel} (${branch})`);
  }
  if (node.is_leaf) {
    parts.push('final group');
  } else if (node.feature) {
    parts.push(`threshold ${node.feature.threshold}`);
  }
  const n = node.n ?? 0;
  parts.push(`${n} examples`);
  if (n > 0 && node.n_pos != null) {
    const posPct = ((node.n_pos / n) * 100).toFixed(0);
    parts.push(`${posPct}% positive`);
  }
  if (node.prediction != null) {
    parts.push(`predicted likelihood ${(node.prediction * 100).toFixed(0)}%`);
  }
  return '- ' + parts.join(' | ');
}

function buildTreeOverview(tree) {
  if (!tree || !Array.isArray(tree.nodes)) return 'No tree available.';
  const header = buildHeader(tree.meta);
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const byDepth = [...tree.nodes].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));
  const nodeLines = byDepth.map((node) => nodeLine(node, byId)).join('\n');
  return [
    header,
    '',
    'Tree structure (split nodes labeled by feature name; leaves labeled LEAF <id> with parent feature and branch):',
    nodeLines,
  ]
    .filter(Boolean)
    .join('\n');
}

module.exports = { buildTreeOverview };
