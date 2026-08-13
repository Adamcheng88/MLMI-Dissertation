import type { FeatureNode } from './TreeData';


export function getSplitTaken(
  parent: FeatureNode,
  child: FeatureNode
): { direction: 'left' | 'right'; label: string } | null {
  let direction: 'left' | 'right' | null = null;
  if (parent.left?.id === child.id) direction = 'left';
  else if (parent.right?.id === child.id) direction = 'right';
  if (!direction) return null;

  const isBinary = parent.threshold === 0.5;
  let label: string;
  if (isBinary) {
    label = direction === 'left' ? 'NO' : 'YES';
  } else if (child.splitCriteria) {
    label = child.splitCriteria;
  } else if (parent.threshold !== undefined) {
    label = direction === 'left' ? `≤ ${parent.threshold}` : `> ${parent.threshold}`;
  } else {
    label = direction === 'left' ? 'left branch' : 'right branch';
  }

  return { direction, label };
}
