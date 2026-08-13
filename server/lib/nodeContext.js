





function formatNode(node, index) {
  const isLeaf = node.prediction !== undefined && !node.left && !node.right;
  const lines = [
    isLeaf
      ? `Attached node ${index + 1}: LEAF id "${node.id}"`
      : `Attached node ${index + 1}: ${node.name}`,
  ];
  if (isLeaf) {
    lines.push(
      'This is a final group (leaf), not a question. Refer to it by this id, and situate it with the parent feature name and which yes/high vs no/low branch leads here (see tree overview and Split rule below).',
    );
    if (node.splitCriteria) {
      const direction = String(node.splitCriteria).trim().startsWith('>')
        ? 'yes/high branch'
        : 'no/low branch';
      lines.push(`Branch from parent: ${node.splitCriteria} (${direction})`);
    }
  } else {
    if (node.splitCriteria) lines.push(`Split rule: ${node.splitCriteria}`);
    if (node.threshold != null) lines.push(`Threshold: ${node.threshold}`);
    if (node.description) lines.push(`What the rule computes: ${node.description}`);
    if (node.rationale) lines.push(`Why this rule was chosen: ${node.rationale}`);
    if (node.code) lines.push(`Code:\n${node.code}`);
  }

  const samples = node.samples;
  if (samples != null) {
    const balance = [];
    if (node.nPos != null) balance.push(`${node.nPos} positive`);
    if (node.nNeg != null) balance.push(`${node.nNeg} negative`);
    lines.push(`Examples here: ${samples}${balance.length ? ` (${balance.join(', ')})` : ''}`);
  }
  const likelihood = node.probability ?? node.prediction;
  if (likelihood != null) lines.push(`Predicted likelihood of the outcome: ${(likelihood * 100).toFixed(0)}%`);
  if (node.giniScore != null) lines.push(`Gini impurity (how mixed the two outcomes are here, 0 = pure): ${node.giniScore.toFixed(3)}`);

  return lines.join('\n');
}

function buildNodeContext(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return '';
  return nodes.map(formatNode).join('\n\n');
}

module.exports = { buildNodeContext };
