import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { FeatureNode } from './TreeData';
import TooltipIcon from './TooltipIcon';
import { useParticipant } from '../contexts/ParticipantContext';
import { useClassLabels, DEFAULT_CLASS1_NAME, DEFAULT_CLASS2_NAME } from '../contexts/ClassLabelsContext';
import { VISIT_DWELL_MS } from '../lib/visitLogging';
import { getWheelZoomMultiplier } from '../lib/wheelZoom';
import {
  edgeWidthFromProportion,
  type DatasetFlowView,
  type NodeFlowMetrics,
} from './datasetFlow';

const CANVAS_TOOLTIPS = {
  viewingDepth: 'How many levels of the tree are shown. Nodes beyond this depth are collapsed into summary "virtual leaves." Double-click the slider to show the full tree.',
  displayMode: 'Normal mode shows compact node labels with hover details. Advanced mode shows richer node cards with descriptions, predictions, and sample counts directly on the tree.',
  connectorWidth: 'How branch thickness is calculated. Absolute scales connector width by each branch\'s share of the total dataset. Relative scales by each branch\'s share of its parent\'s samples.',
  classNames: 'Custom display names for the two outcome classes. These labels are used across the tree canvas, hover details, and sidebar.',
};

function getMaxDepth(node: FeatureNode): number {
  if (!node.left && !node.right) return 0;
  return 1 + Math.max(
    node.left ? getMaxDepth(node.left) : 0,
    node.right ? getMaxDepth(node.right) : 0
  );
}

type FeatureType = 'Position Check' | 'Composition Window' | 'Motif' | 'Layout/Spacing' | 'Physics/Epigenetics' | 'Class 1' | 'Class 2';

const FEATURE_COLORS: Record<FeatureType, { bg: string; border: string; text: string }> = {
  'Position Check': { bg: '#e0f2fe', border: '#0ea5e9', text: '#075985' },
  'Composition Window': { bg: '#ddd6fe', border: '#8b5cf6', text: '#5b21b6' },
  'Motif': { bg: '#fce7f3', border: '#ec4899', text: '#9f1239' },
  'Layout/Spacing': { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  'Physics/Epigenetics': { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  'Class 1': { bg: '#fca5a5', border: '#dc2626', text: '#7f1d1d' },
  'Class 2': { bg: '#86efac', border: '#16a34a', text: '#14532d' }
};

function getLeafColor(probability: number, cutoff: number = 0.5): { bg: string; border: string; text: string } {
  const isPositiveClass = probability >= cutoff;
  if (isPositiveClass) {
    const range = 1 - cutoff;
    const intensity = range > 0 ? Math.pow((probability - cutoff) / range, 1.5) : 1;
    const lightness = 90 - (intensity * 50);
    const saturation = 40 + (intensity * 55);
    return {
      bg: `hsl(0, ${saturation}%, ${lightness}%)`,
      border: `hsl(0, ${saturation + 5}%, ${lightness - 15}%)`,
      text: `hsl(0, ${saturation}%, ${Math.max(10, lightness - 65)}%)`
    };
  } else {
    const range = cutoff;
    const intensity = range > 0 ? Math.pow((cutoff - probability) / range, 1.5) : 1;
    const lightness = 90 - (intensity * 50);
    const saturation = 40 + (intensity * 55);
    return {
      bg: `hsl(142, ${saturation}%, ${lightness}%)`,
      border: `hsl(142, ${saturation + 5}%, ${lightness - 15}%)`,
      text: `hsl(142, ${saturation}%, ${Math.max(10, lightness - 65)}%)`
    };
  }
}


function getProbColor(prob: number, cutoff: number): string {
  type RGB = [number, number, number];
  const GREEN:   RGB = [22,  163, 74];
  const NEUTRAL: RGB = [156, 163, 175];
  const RED:     RGB = [220, 38,  38];
  let t: number, a: RGB, b: RGB;
  if (prob <= cutoff) {
    t = cutoff > 0 ? prob / cutoff : 0;
    [a, b] = [GREEN, NEUTRAL];
  } else {
    t = cutoff < 1 ? (prob - cutoff) / (1 - cutoff) : 1;
    [a, b] = [NEUTRAL, RED];
  }
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function getConnectorSplitLabel(
  parentNode: FeatureNode,
  childNode: FeatureNode,
  direction: 'left' | 'right'
): string {
  const isBinary = parentNode.threshold === 0.5;
  if (isBinary) {
    return direction === 'left' ? 'NO' : 'YES';
  }

  if (childNode.splitCriteria) {
    return childNode.splitCriteria;
  }

  return direction === 'left'
    ? `≤ ${parentNode.threshold}`
    : `> ${parentNode.threshold}`;
}

function getFeatureType(node: FeatureNode, cutoff: number = 0.5): FeatureType {
  if (node.prediction !== undefined) {
    return node.prediction >= cutoff ? 'Class 1' : 'Class 2';
  }

  const name = node.name.toLowerCase();

  if (name.includes('pos_') || name.includes('position') || name.includes('at_50') || name.includes('at_51')) return 'Position Check';
  if (name.includes('content') || name.includes('density') || name.includes('proportion') || name.includes('count') || name.includes('_in_')) return 'Composition Window';
  if (name.includes('motif') || name.includes('palindrom')) return 'Motif';
  if (name.includes('transition') || name.includes('spacing') || name.includes('boundary') || name.includes('before')) return 'Layout/Spacing';
  if (name.includes('energy') || name.includes('methylation') || name.includes('stacking') || name.includes('minus')) return 'Physics/Epigenetics';

  return 'Composition Window';
}

export interface DatasetFlowModeProps {
  view: DatasetFlowView;
  metricsA: Map<string, NodeFlowMetrics>;
  metricsB: Map<string, NodeFlowMetrics>;
  rootSamplesA: number;
  rootSamplesB: number;
  colorA: string;
  colorB: string;
}

interface DecisionTreeCanvasProps {
  tree: FeatureNode;
  onNodeSelect: (node: FeatureNode) => void;
  selectedNodeId?: string;
  rootSampleCount?: number;
  onNodeAttach?: (node: FeatureNode) => void;
  attachedNodeIds?: string[];
  comparisonMode?: {
    changedNodeIds: string[];
    baseTree?: FeatureNode;
  };
  datasetFlowMode?: DatasetFlowModeProps;
  decisionCutoff?: number;
  onDecisionCutoffChange?: (v: number) => void;
  onNodeHoverDwell?: (node: FeatureNode) => void;
}

interface TreeLayout {
  x: number;
  y: number;
  depth: number;
  node: FeatureNode;
}

export default function DecisionTreeCanvas({ tree, onNodeSelect, selectedNodeId, rootSampleCount, onNodeAttach, attachedNodeIds = [], comparisonMode, datasetFlowMode, decisionCutoff = 0.5, onDecisionCutoffChange, onNodeHoverDwell }: DecisionTreeCanvasProps) {
  const { logEvent } = useParticipant();
  const { class1, class2, setClass1, setClass2, resetClassLabels } = useClassLabels();
  const [class1Draft, setClass1Draft] = useState(class1);
  const [class2Draft, setClass2Draft] = useState(class2);
  useEffect(() => { setClass1Draft(class1); }, [class1]);
  useEffect(() => { setClass2Draft(class2); }, [class2]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<{ node: FeatureNode; x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [connectorWidthMode, setConnectorWidthMode] = useState<'absolute' | 'relative'>('absolute');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  const displayClassLabel = useCallback((featureType: FeatureType | string) => {
    if (featureType === 'Class 1') return class1;
    if (featureType === 'Class 2') return class2;
    return featureType;
  }, [class1, class2]);

  const decisionCutoffTooltip =
    `The probability threshold for classifying a sample as ${class1}. Leaf nodes at or above this value appear red (${class1}) and below appear green (${class2}).`;

  const maxTreeDepth = useMemo(() => getMaxDepth(tree), [tree]);

  const [viewingDepth, setViewingDepth] = useState(() => getMaxDepth(tree));
  useEffect(() => { setViewingDepth(maxTreeDepth); }, [maxTreeDepth]);
  const depthSliderPct = maxTreeDepth === 0 ? 100 : (viewingDepth / maxTreeDepth) * 100;

  const [editingViewDepth, setEditingViewDepth] = useState(false);
  const [viewDepthInput, setViewDepthInput] = useState('');
  const [editingCutoff, setEditingCutoff] = useState(false);
  const [cutoffInputStr, setCutoffInputStr] = useState('');


  const onNodeHoverDwellRef = useRef(onNodeHoverDwell);
  onNodeHoverDwellRef.current = onNodeHoverDwell;
  const dwellNodeIdRef = useRef<string | null>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const viewingDepthLoggedRef = useRef(false);
  const cutoffLoggedRef = useRef(false);
  const displayModeLoggedRef = useRef(false);
  const connectorWidthLoggedRef = useRef(false);

  const logFirstDepthChange = useCallback((value: number) => {
    if (viewingDepthLoggedRef.current) return;
    viewingDepthLoggedRef.current = true;
    logEvent('viewing_depth_adjust', { value });
  }, [logEvent]);

  const logFirstCutoffChange = useCallback((value: number) => {
    if (cutoffLoggedRef.current) return;
    cutoffLoggedRef.current = true;
    logEvent('decision_cutoff_adjust', { value });
  }, [logEvent]);

  const logFirstDisplayModeChange = useCallback((mode: 'normal' | 'advanced') => {
    if (displayModeLoggedRef.current) return;
    if ((mode === 'advanced') === advancedMode) return;
    displayModeLoggedRef.current = true;
    logEvent('display_mode_change', { mode });
  }, [logEvent, advancedMode]);

  const logFirstConnectorWidthChange = useCallback((mode: 'absolute' | 'relative') => {
    if (connectorWidthLoggedRef.current) return;
    if (mode === connectorWidthMode) return;
    connectorWidthLoggedRef.current = true;
    logEvent('connector_width_change', { mode });
  }, [logEvent, connectorWidthMode]);


  const offsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [, forceUpdate] = useState({});


  const findNodeById = useCallback((node: FeatureNode, id: string): FeatureNode | null => {
    if (node.id === id) return node;
    if (node.left) {
      const found = findNodeById(node.left, id);
      if (found) return found;
    }
    if (node.right) {
      const found = findNodeById(node.right, id);
      if (found) return found;
    }
    return null;
  }, []);


  const isNodeCollapsed = useCallback((nodeId: string): boolean => {
    const checkAncestors = (node: FeatureNode, targetId: string, ancestors: string[]): boolean => {
      if (node.id === targetId) {
        return ancestors.some(ancestorId => collapsedNodes.has(ancestorId));
      }

      if (node.left) {
        if (checkAncestors(node.left, targetId, [...ancestors, node.id])) return true;
      }
      if (node.right) {
        if (checkAncestors(node.right, targetId, [...ancestors, node.id])) return true;
      }

      return false;
    };

    return checkAncestors(tree, nodeId, []);
  }, [tree, collapsedNodes]);


  const getPathToNode = useCallback((targetId: string | undefined): Set<string> => {
    if (!targetId) return new Set();

    const path = new Set<string>();

    function findPath(node: FeatureNode): boolean {
      path.add(node.id);

      if (node.id === targetId) return true;

      if (node.left && findPath(node.left)) return true;
      if (node.right && findPath(node.right)) return true;

      path.delete(node.id);
      return false;
    }

    findPath(tree);
    return path;
  }, [tree]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();


    const nodeWidth = advancedMode ? 280 : 180;
    const nodeHeight = advancedMode ? 140 : 70;
    const verticalGap = advancedMode ? 180 : 120;
    const horizontalGap = advancedMode ? 80 : 50;


    const selectedNode = selectedNodeId ? findNodeById(tree, selectedNodeId) : null;
    const isLeafSelected = selectedNode?.prediction !== undefined;

    const nodeAllChildrenCollapsed = (node: FeatureNode | null | undefined): boolean => {
      if (!node) return false;
      const hasLeft = !!node.left;
      const hasRight = !!node.right;
      if (!hasLeft && !hasRight) return false;
      const leftCollapsed = !hasLeft || collapsedNodes.has(`${node.id}-left`);
      const rightCollapsed = !hasRight || collapsedNodes.has(`${node.id}-right`);
      return leftCollapsed && rightCollapsed;
    };

    const isCollapsedLeafSelected = !isLeafSelected && nodeAllChildrenCollapsed(selectedNode);


    const getNodeDepth = (targetId: string): number => {
      function traverse(node: FeatureNode, d: number): number {
        if (node.id === targetId) return d;
        if (node.left) { const r = traverse(node.left, d + 1); if (r >= 0) return r; }
        if (node.right) { const r = traverse(node.right, d + 1); if (r >= 0) return r; }
        return -1;
      }
      return traverse(tree, 0);
    };
    const selectedDepth = selectedNodeId ? getNodeDepth(selectedNodeId) : -1;
    const isVirtualLeafSelected = !isLeafSelected && !isCollapsedLeafSelected &&
      selectedNode && (selectedNode.left || selectedNode.right) &&
      selectedDepth === viewingDepth;

    const pathToSelected = (isLeafSelected || isCollapsedLeafSelected || isVirtualLeafSelected)
      ? getPathToNode(selectedNodeId) : new Set<string>();


    const selectedProb = selectedNode
      ? (selectedNode.probability ?? selectedNode.prediction ?? 0.5)
      : 0.5;
    const pathHighlightColor =
      (isLeafSelected || isCollapsedLeafSelected || isVirtualLeafSelected) &&
      selectedProb < decisionCutoff
        ? '#16a34a'
        : '#dc2626';


    const isVirtualLeafNode = (node: FeatureNode, depth: number): boolean =>
      depth === viewingDepth && !!(node.left || node.right);

    function getTreeWidth(node: FeatureNode | undefined, depth: number = 0): number {
      if (!node) return 0;
      if (!node.left && !node.right) return nodeWidth;
      if (depth >= viewingDepth) return nodeWidth;

      const leftWidth = getTreeWidth(node.left, depth + 1);
      const rightWidth = getTreeWidth(node.right, depth + 1);

      return leftWidth + rightWidth + horizontalGap;
    }

    function layoutTree(node: FeatureNode, depth: number, leftBound: number, rightBound: number): TreeLayout[] {
      const layouts: TreeLayout[] = [];
      const x = (leftBound + rightBound) / 2;
      const y = 50 + depth * verticalGap;

      layouts.push({ x, y, depth, node });


      if (depth >= viewingDepth) return layouts;


      const leftCollapsed = collapsedNodes.has(`${node.id}-left`);
      const rightCollapsed = collapsedNodes.has(`${node.id}-right`);

      if (node.left && node.right) {
        const totalWidth = rightBound - leftBound;
        const leftWidth = getTreeWidth(node.left, depth + 1);
        const rightWidth = getTreeWidth(node.right, depth + 1);
        const totalChildWidth = leftWidth + rightWidth + horizontalGap;

        const leftCenter = leftBound + (totalWidth - totalChildWidth) / 2 + leftWidth / 2;
        const rightCenter = leftCenter + leftWidth / 2 + horizontalGap + rightWidth / 2;

        if (!leftCollapsed) {
          layouts.push(...layoutTree(node.left, depth + 1, leftBound, leftCenter + leftWidth / 2));
        }
        if (!rightCollapsed) {
          layouts.push(...layoutTree(node.right, depth + 1, rightCenter - rightWidth / 2, rightBound));
        }
      }

      return layouts;
    }

    const totalWidth = getTreeWidth(tree);
    const startX = Math.max(50, (rect.width - totalWidth) / 2);
    const layouts = layoutTree(tree, 0, startX, startX + totalWidth);


    ctx.clearRect(0, 0, rect.width, rect.height);


    ctx.save();
    ctx.translate(offsetRef.current.x, offsetRef.current.y);
    ctx.scale(zoomRef.current, zoomRef.current);


    const drawSmoothConnector = (
      x1: number, y1: number,
      x2: number, y2: number,
      width: number,
      color: string,
      alpha: number = 0.5,
      xOffset: number = 0
    ) => {
      const controlPointOffset = Math.abs(y2 - y1) * 0.5;
      const ox1 = x1 + xOffset;
      const ox2 = x2 + xOffset;


      ctx.save();
      ctx.globalAlpha = alpha;


      ctx.beginPath();
      ctx.moveTo(ox1 - width / 2, y1);


      ctx.bezierCurveTo(
        ox1 - width / 2, y1 + controlPointOffset,
        ox2 - width / 2, y2 - controlPointOffset,
        ox2 - width / 2, y2
      );


      ctx.lineTo(ox2 + width / 2, y2);


      ctx.bezierCurveTo(
        ox2 + width / 2, y2 - controlPointOffset,
        ox1 + width / 2, y1 + controlPointOffset,
        ox1 + width / 2, y1
      );

      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      ctx.restore();
    };

    const samplesFor = (
      metrics: Map<string, NodeFlowMetrics> | undefined,
      nodeId: string,
      fallback: number
    ) => metrics?.get(nodeId)?.samples ?? fallback;

    const drawFlowEdge = (
      parentLayout: TreeLayout,
      childLayout: TreeLayout,
      direction: 'left' | 'right'
    ) => {
      const x1 = parentLayout.x;
      const y1 = parentLayout.y + nodeHeight / 2;
      const x2 = childLayout.x;
      const y2 = childLayout.y - nodeHeight / 2;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      const isOnPath =
        (isLeafSelected || isCollapsedLeafSelected || isVirtualLeafSelected) &&
        pathToSelected.has(parentLayout.node.id) &&
        pathToSelected.has(childLayout.node.id);

      const isChanged = comparisonMode &&
        (comparisonMode.changedNodeIds.includes(parentLayout.node.id) ||
         comparisonMode.changedNodeIds.includes(childLayout.node.id));

      const splitLabel = advancedMode
        ? (childLayout.node.splitCriteria ?? getConnectorSplitLabel(parentLayout.node, childLayout.node, direction))
        : getConnectorSplitLabel(parentLayout.node, childLayout.node, direction);


      if (datasetFlowMode && !comparisonMode) {
        const { view, metricsA, metricsB, rootSamplesA, rootSamplesB, colorA, colorB } = datasetFlowMode;
        const parentA = samplesFor(metricsA, parentLayout.node.id, parentLayout.node.samples);
        const childA = samplesFor(metricsA, childLayout.node.id, childLayout.node.samples);
        const parentB = samplesFor(metricsB, parentLayout.node.id, parentLayout.node.samples);
        const childB = samplesFor(metricsB, childLayout.node.id, childLayout.node.samples);

        const denomA = connectorWidthMode === 'absolute' ? rootSamplesA : parentA;
        const denomB = connectorWidthMode === 'absolute' ? rootSamplesB : parentB;
        const wA = edgeWidthFromProportion(childA, denomA, connectorWidthMode);
        const wB = edgeWidthFromProportion(childB, denomB, connectorWidthMode);
        const pathBoost = isOnPath ? 0.25 : 0;

        if (view === 'A' || view === 'B') {
          const w = view === 'A' ? wA : wB;
          const color = view === 'A' ? colorA : colorB;
          drawSmoothConnector(x1, y1, x2, y2, w.edgeWidth, color, 0.35 + pathBoost);
          ctx.fillStyle = color;
          ctx.font = '600 11px sans-serif';
          ctx.textAlign = 'center';
          if (advancedMode) {
            ctx.fillText(splitLabel, midX, midY - 5);
          } else {
            ctx.fillText(`${w.splitPercentage.toFixed(0)}%`, midX, midY - 8);
            ctx.fillText(splitLabel, midX, midY + 10);
          }
          return;
        }

        if (view === 'both') {
          const offset = Math.max(6, (wA.edgeWidth + wB.edgeWidth) / 4);
          drawSmoothConnector(x1, y1, x2, y2, wA.edgeWidth, colorA, 0.4 + pathBoost, -offset);
          drawSmoothConnector(x1, y1, x2, y2, wB.edgeWidth, colorB, 0.4 + pathBoost, offset);
          ctx.font = '600 10px sans-serif';
          ctx.textAlign = 'center';
          if (advancedMode) {
            ctx.fillStyle = '#717182';
            ctx.fillText(splitLabel, midX, midY - 12);
          }
          ctx.fillStyle = colorA;
          ctx.fillText(`A ${wA.splitPercentage.toFixed(0)}%`, midX, midY - (advancedMode ? 0 : 8));
          ctx.fillStyle = colorB;
          ctx.fillText(`B ${wB.splitPercentage.toFixed(0)}%`, midX, midY + 8);
          if (!advancedMode) {
            ctx.fillStyle = '#717182';
            ctx.fillText(splitLabel, midX, midY + 22);
          }
          return;
        }


        const deltaPct = Math.abs(wA.splitPercentage - wB.splitPercentage);
        const maxScale = connectorWidthMode === 'absolute' ? 120 : 40;
        const edgeWidth = Math.max(3, (deltaPct / 100) * maxScale);
        const aLarger = wA.splitPercentage >= wB.splitPercentage;
        const color = aLarger ? colorA : colorB;
        const alpha = 0.45 + pathBoost;
        drawSmoothConnector(x1, y1, x2, y2, edgeWidth, color, alpha);
        ctx.fillStyle = color;
        ctx.font = '600 11px sans-serif';
        ctx.textAlign = 'center';
        if (advancedMode) {
          ctx.fillText(splitLabel, midX, midY - 5);
        } else {
          ctx.fillText(`Δ${deltaPct.toFixed(0)}%`, midX, midY - 8);
          ctx.fillText(splitLabel, midX, midY + 10);
        }
        return;
      }


      const parentSamples = parentLayout.node.samples;
      const childSamples = childLayout.node.samples;
      const rootSamples = tree.samples;
      let edgeWidth: number;
      let splitPercentage: number;

      if (connectorWidthMode === 'absolute') {
        const proportion = childSamples / rootSamples;
        splitPercentage = proportion * 100;
        edgeWidth = Math.max(4, proportion * 120);
      } else {
        splitPercentage = (childSamples / parentSamples) * 100;
        edgeWidth = Math.max(4, (splitPercentage / 100) * 40);
      }

      let color: string;
      let alpha: number;
      if (comparisonMode) {
        color = isChanged ? '#dc2626' : '#717182';
        alpha = isChanged ? 0.6 : 0.15;
      } else {
        color = isOnPath ? pathHighlightColor : '#717182';
        alpha = isOnPath ? 0.6 : 0.3;
      }

      drawSmoothConnector(x1, y1, x2, y2, edgeWidth, color, alpha);

      if (comparisonMode) {
        ctx.fillStyle = isChanged ? '#dc2626' : 'rgba(113, 113, 130, 0.4)';
      } else {
        ctx.fillStyle = isOnPath ? pathHighlightColor : '#717182';
      }
      ctx.font = '600 11px sans-serif';
      ctx.textAlign = 'center';

      if (advancedMode) {
        ctx.fillText(splitLabel, midX, midY - 5);
      } else {
        ctx.fillText(`${splitPercentage.toFixed(0)}%`, midX, midY - 8);
        ctx.fillText(splitLabel, midX, midY + 10);
      }
    };


    layouts.forEach(layout => {
      const leftCollapsed = collapsedNodes.has(`${layout.node.id}-left`);
      const rightCollapsed = collapsedNodes.has(`${layout.node.id}-right`);

      if (layout.node.left) {
        const leftLayout = layouts.find(l => l.node.id === layout.node.left!.id);
        if (leftLayout && !leftCollapsed) {
          drawFlowEdge(layout, leftLayout, 'left');
        }
      }

      if (layout.node.right) {
        const rightLayout = layouts.find(l => l.node.id === layout.node.right!.id);
        if (rightLayout && !rightCollapsed) {
          drawFlowEdge(layout, rightLayout, 'right');
        }
      }
    });


    layouts.forEach(layout => {

      if (isVirtualLeafNode(layout.node, layout.depth)) return;

      const leftCollapsed = collapsedNodes.has(`${layout.node.id}-left`);
      const rightCollapsed = collapsedNodes.has(`${layout.node.id}-right`);
      const indicatorY = layout.y + nodeHeight / 2;
      const indicatorRadius = 10;

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#717182';
      ctx.lineWidth = 2;


      if (layout.node.left) {
        const leftX = layout.x - 20;

        ctx.beginPath();
        ctx.arc(leftX, indicatorY, indicatorRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();


        ctx.strokeStyle = '#717182';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';


        ctx.beginPath();
        ctx.moveTo(leftX - 4, indicatorY);
        ctx.lineTo(leftX + 4, indicatorY);
        ctx.stroke();


        if (leftCollapsed) {
          ctx.beginPath();
          ctx.moveTo(leftX, indicatorY - 4);
          ctx.lineTo(leftX, indicatorY + 4);
          ctx.stroke();
        }
      }


      if (layout.node.right) {
        const rightX = layout.x + 20;

        ctx.beginPath();
        ctx.arc(rightX, indicatorY, indicatorRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();


        ctx.strokeStyle = '#717182';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';


        ctx.beginPath();
        ctx.moveTo(rightX - 4, indicatorY);
        ctx.lineTo(rightX + 4, indicatorY);
        ctx.stroke();


        if (rightCollapsed) {
          ctx.beginPath();
          ctx.moveTo(rightX, indicatorY - 4);
          ctx.lineTo(rightX, indicatorY + 4);
          ctx.stroke();
        }
      }

      ctx.restore();
    });



    const drawFitText = (
      text: string,
      cx: number,
      cy: number,
      maxWidth: number,
      bold: boolean = true,
      maxFontSize: number = 13,
      minFontSize: number = 8
    ): number => {
      const weight = bold ? '600' : '400';


      for (let size = maxFontSize; size >= minFontSize; size--) {
        ctx.font = `${weight} ${size}px sans-serif`;
        if (ctx.measureText(text).width <= maxWidth) {
          ctx.textAlign = 'center';
          ctx.fillText(text, cx, cy);
          return size;
        }
      }


      ctx.font = `${weight} ${minFontSize}px sans-serif`;
      ctx.textAlign = 'center';
      const parts = text.split('_');
      const lines: string[] = [];
      let cur = '';
      for (const p of parts) {
        const candidate = cur ? `${cur}_${p}` : p;
        if (ctx.measureText(candidate).width <= maxWidth) {
          cur = candidate;
        } else {
          if (cur) lines.push(cur);
          cur = p;
        }
      }
      if (cur) lines.push(cur);

      const lh = minFontSize + 3;

      const firstBaseline = cy - ((lines.length - 1) / 2) * lh;
      lines.forEach((line, i) => ctx.fillText(line, cx, firstBaseline + i * lh));
      return (lines.length - 1) * lh + minFontSize;
    };


    layouts.forEach(layout => {
      const isSelected = layout.node.id === selectedNodeId;
      const isAttached = attachedNodeIds.includes(layout.node.id);
      const featureType = getFeatureType(layout.node, decisionCutoff);
      const isLeaf = layout.node.prediction !== undefined;
      const isCollapsedLeaf = !isLeaf && nodeAllChildrenCollapsed(layout.node);
      const isVirtualLeaf = isVirtualLeafNode(layout.node, layout.depth);

      const isLeafLike = isLeaf || isCollapsedLeaf || isVirtualLeaf;
      const isOnPath = pathToSelected.has(layout.node.id);
      const shouldGrey = (isLeafSelected || isCollapsedLeafSelected || isVirtualLeafSelected) && !isOnPath;


      const isChanged = comparisonMode && comparisonMode.changedNodeIds.includes(layout.node.id);
      const shouldGreyInComparison = comparisonMode && !isChanged;


      const effectivePrediction = layout.node.prediction ?? layout.node.probability ?? 0.5;

      const colors = isLeafLike && !isSelected
        ? getLeafColor(effectivePrediction, decisionCutoff)
        : FEATURE_COLORS[featureType];

      const x = layout.x - nodeWidth / 2;
      const y = layout.y - nodeHeight / 2;

      if (isSelected) {
        ctx.fillStyle = '#030213';
        ctx.strokeStyle = '#030213';
        ctx.lineWidth = 2;
      } else if (comparisonMode && isChanged) {

        ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3;
      } else if (shouldGreyInComparison) {

        ctx.fillStyle = 'rgba(200, 200, 200, 0.2)';
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.3)';
        ctx.lineWidth = 2;
      } else if (shouldGrey) {

        ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = colors.bg;
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 2;
      }

      ctx.beginPath();
      ctx.roundRect(x, y, nodeWidth, nodeHeight, 8);
      ctx.fill();
      ctx.stroke();


      if (isAttached && !comparisonMode) {
        ctx.save();
        ctx.fillStyle = '#8b5cf6';
        ctx.beginPath();
        ctx.arc(layout.x + nodeWidth / 2 - 10, layout.y - nodeHeight / 2 + 10, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (shouldGreyInComparison) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.4)';
      } else if (shouldGrey) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
      } else if (comparisonMode && isChanged) {
        ctx.fillStyle = '#dc2626';
      } else {
        ctx.fillStyle = isSelected ? '#ffffff' : colors.text;
      }

      if (advancedMode) {

        const textColor = isSelected ? '#ffffff' : (shouldGreyInComparison || shouldGrey) ? 'rgba(100, 100, 100, 0.5)' : colors.text;


        let positiveSamples: number;
        let negativeSamples: number;

        if (layout.node.nPos !== undefined && layout.node.nNeg !== undefined) {
          positiveSamples = layout.node.nPos;
          negativeSamples = layout.node.nNeg;
        } else if (layout.node.prediction !== undefined) {
          positiveSamples = Math.round(layout.node.samples * layout.node.prediction);
          negativeSamples = layout.node.samples - positiveSamples;
        } else {
          positiveSamples = Math.round(layout.node.samples * effectivePrediction);
          negativeSamples = layout.node.samples - positiveSamples;
        }


        let currentY = layout.y - nodeHeight / 2 + 18;


        ctx.fillStyle = textColor;
        const nameHeight = drawFitText(
          isLeaf ? displayClassLabel(featureType) : layout.node.name,
          layout.x, currentY, nodeWidth - 24, true, 12, 8
        );
        currentY += Math.max(18, nameHeight + 4);


        if (layout.node.description && !isLeaf) {
          ctx.font = '10px sans-serif';
          ctx.fillStyle = shouldGreyInComparison || shouldGrey ? 'rgba(100, 100, 100, 0.4)' : (isSelected ? 'rgba(255, 255, 255, 0.8)' : 'rgba(100, 100, 100, 0.8)');
          const words = layout.node.description.split(' ');
          let line = '';
          const maxWidth = nodeWidth - 24;
          const MAX_DESC_LINES = 4;
          const descriptionLines: string[] = [];
          let truncated = false;

          for (const word of words) {
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && line !== '') {
              descriptionLines.push(line.trim());
              line = word + ' ';
              if (descriptionLines.length >= MAX_DESC_LINES) {
                truncated = true;
                break;
              }
            } else {
              line = testLine;
            }
          }
          if (!truncated && line.trim()) {
            if (descriptionLines.length >= MAX_DESC_LINES) {
              truncated = true;
            } else {
              descriptionLines.push(line.trim());
            }
          }

          if (truncated && descriptionLines.length > 0) {

            let last = descriptionLines[descriptionLines.length - 1];
            while (last.length > 0 && ctx.measureText(last + '…').width > maxWidth) {
              last = last.slice(0, -1).trimEnd();
            }
            descriptionLines[descriptionLines.length - 1] = last + '…';
          }


          for (const descLine of descriptionLines) {
            ctx.fillText(descLine, layout.x, currentY);
            currentY += 13;
          }
          currentY += 8;
        }


        ctx.font = '600 11px sans-serif';
        ctx.fillStyle = textColor;
        ctx.fillText(`pred = ${effectivePrediction.toFixed(3)}`, layout.x, currentY);
        currentY += 18;


        ctx.font = '11px sans-serif';
        ctx.fillStyle = textColor;
        ctx.fillText(`n = ${layout.node.samples.toLocaleString()}`, layout.x, currentY);
        currentY += 18;


        ctx.font = '600 10px sans-serif';
        ctx.textAlign = 'center';
        const splitText = `${positiveSamples.toLocaleString()} / ${negativeSamples.toLocaleString()}`;


        const totalWidth = ctx.measureText(splitText).width;
        const positiveText = positiveSamples.toLocaleString();
        const negativeText = negativeSamples.toLocaleString();
        const positiveWidth = ctx.measureText(positiveText).width;
        const slashWidth = ctx.measureText(' / ').width;

        const startX = layout.x - totalWidth / 2;


        if (!shouldGreyInComparison && !shouldGrey && !isSelected) {
          const padX = 6;
          const padY = 3;
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
          ctx.beginPath();
          ctx.roundRect(startX - padX, currentY - 10 - padY, totalWidth + padX * 2, 10 + padY * 2, 4);
          ctx.fill();
          ctx.restore();
        }


        ctx.fillStyle = shouldGreyInComparison || shouldGrey ? 'rgba(100, 100, 100, 0.5)' : '#dc2626';
        ctx.textAlign = 'left';
        ctx.fillText(positiveText, startX, currentY);


        ctx.fillStyle = shouldGreyInComparison || shouldGrey ? textColor : '#374151';
        ctx.fillText(' / ', startX + positiveWidth, currentY);


        ctx.fillStyle = shouldGreyInComparison || shouldGrey ? 'rgba(100, 100, 100, 0.5)' : '#16a34a';
        ctx.fillText(negativeText, startX + positiveWidth + slashWidth, currentY);

      } else {

        ctx.font = '600 13px sans-serif';
        ctx.textAlign = 'center';

        if (isLeafLike) {

          if (isLeaf) {
            drawFitText(displayClassLabel(featureType), layout.x, layout.y - 18, nodeWidth - 24, true, 13, 9);
          } else if (isVirtualLeaf) {

            const vLabel = effectivePrediction >= decisionCutoff ? class1 : class2;
            drawFitText(vLabel, layout.x, layout.y - 18, nodeWidth - 24, true, 13, 9);
          } else {
            drawFitText(layout.node.name, layout.x, layout.y - 18, nodeWidth - 24, true, 13, 7);
          }


          ctx.font = '11px sans-serif';
          if (shouldGreyInComparison) {
            ctx.fillStyle = 'rgba(100, 100, 100, 0.4)';
          } else if (shouldGrey) {
            ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
          } else if (comparisonMode && isChanged) {
            ctx.fillStyle = '#dc2626';
          } else {
            ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.7)' : colors.text;
          }
          ctx.fillText(`n=${layout.node.samples.toLocaleString()}`, layout.x, layout.y - 2);


          const splitPositiveSamples = layout.node.nPos ?? Math.round(layout.node.samples * effectivePrediction);
          const splitNegativeSamples = layout.node.nNeg ?? (layout.node.samples - splitPositiveSamples);

          ctx.font = '600 10px sans-serif';
          ctx.textAlign = 'center';
          const splitTextNormal = `${splitPositiveSamples.toLocaleString()} / ${splitNegativeSamples.toLocaleString()}`;
          const totalSplitWidth = ctx.measureText(splitTextNormal).width;
          const positiveTextN = splitPositiveSamples.toLocaleString();
          const negativeTextN = splitNegativeSamples.toLocaleString();
          const positiveWidthN = ctx.measureText(positiveTextN).width;
          const slashWidthN = ctx.measureText(' / ').width;
          const startXN = layout.x - totalSplitWidth / 2;
          const splitY = layout.y + 15;


          if (!shouldGreyInComparison && !shouldGrey && !isSelected) {
            const padX = 6;
            const padY = 3;
            const pillX = startXN - padX;
            const pillY = splitY - 10 - padY;
            const pillW = totalSplitWidth + padX * 2;
            const pillH = 10 + padY * 2;
            const pillR = 4;
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
            ctx.beginPath();
            ctx.roundRect(pillX, pillY, pillW, pillH, pillR);
            ctx.fill();
            ctx.restore();
          }

          ctx.fillStyle = shouldGreyInComparison || shouldGrey ? 'rgba(100, 100, 100, 0.5)' : (isSelected ? 'rgba(255, 150, 150, 0.9)' : '#dc2626');
          ctx.textAlign = 'left';
          ctx.fillText(positiveTextN, startXN, splitY);
          ctx.fillStyle = shouldGreyInComparison || shouldGrey ? 'rgba(100, 100, 100, 0.5)' : (isSelected ? 'rgba(255, 255, 255, 0.7)' : '#374151');
          ctx.fillText(' / ', startXN + positiveWidthN, splitY);
          ctx.fillStyle = shouldGreyInComparison || shouldGrey ? 'rgba(100, 100, 100, 0.5)' : (isSelected ? 'rgba(150, 255, 150, 0.9)' : '#16a34a');
          ctx.fillText(negativeTextN, startXN + positiveWidthN + slashWidthN, splitY);
          ctx.textAlign = 'center';
        } else {

          drawFitText(layout.node.name, layout.x, layout.y, nodeWidth - 24, true, 13, 8);
        }
      }
    });

    ctx.restore();
  }, [tree, selectedNodeId, getPathToNode, findNodeById, attachedNodeIds, comparisonMode, datasetFlowMode, connectorWidthMode, advancedMode, collapsedNodes, viewingDepth, decisionCutoff, class1, class2, displayClassLabel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    redraw();
  }, [redraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const nodeWidth = advancedMode ? 280 : 180;
    const nodeHeight = advancedMode ? 140 : 70;
    const verticalGap = advancedMode ? 180 : 120;
    const horizontalGap = advancedMode ? 80 : 50;

    function getTreeWidth(node: FeatureNode | undefined, depth: number = 0): number {
      if (!node) return 0;
      if (!node.left && !node.right) return nodeWidth;
      if (depth >= viewingDepth) return nodeWidth;
      const leftWidth = getTreeWidth(node.left, depth + 1);
      const rightWidth = getTreeWidth(node.right, depth + 1);
      return leftWidth + rightWidth + horizontalGap;
    }

    function layoutTree(node: FeatureNode, depth: number, leftBound: number, rightBound: number): TreeLayout[] {
      const layouts: TreeLayout[] = [];
      const x = (leftBound + rightBound) / 2;
      const y = 50 + depth * verticalGap;
      layouts.push({ x, y, depth, node });

      if (depth >= viewingDepth) return layouts;

      if (node.left && node.right) {
        const totalWidth = rightBound - leftBound;
        const leftWidth = getTreeWidth(node.left, depth + 1);
        const rightWidth = getTreeWidth(node.right, depth + 1);
        const totalChildWidth = leftWidth + rightWidth + horizontalGap;
        const leftCenter = leftBound + (totalWidth - totalChildWidth) / 2 + leftWidth / 2;
        const rightCenter = leftCenter + leftWidth / 2 + horizontalGap + rightWidth / 2;
        layouts.push(...layoutTree(node.left, depth + 1, leftBound, leftCenter + leftWidth / 2));
        layouts.push(...layoutTree(node.right, depth + 1, rightCenter - rightWidth / 2, rightBound));
      }
      return layouts;
    }

    const rect = canvas.getBoundingClientRect();
    const totalWidth = getTreeWidth(tree);
    const startX = Math.max(50, (rect.width - totalWidth) / 2);
    const layouts = layoutTree(tree, 0, startX, startX + totalWidth);

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;


      let clickedCollapseIndicator = false;
      for (const layout of layouts) {
        const indicatorY = (layout.y * zoomRef.current) + offsetRef.current.y + (nodeHeight * zoomRef.current) / 2;
        const indicatorRadius = 10 * zoomRef.current;


        if (layout.node.left) {
          const leftX = (layout.x * zoomRef.current) + offsetRef.current.x - (20 * zoomRef.current);
          const distance = Math.sqrt(
            Math.pow(x - leftX, 2) + Math.pow(y - indicatorY, 2)
          );

          if (distance <= indicatorRadius) {

            setCollapsedNodes(prev => {
              const newSet = new Set(prev);
              const leftKey = `${layout.node.id}-left`;
              if (newSet.has(leftKey)) {
                newSet.delete(leftKey);
              } else {
                newSet.add(leftKey);
              }
              return newSet;
            });
            clickedCollapseIndicator = true;
            break;
          }
        }


        if (layout.node.right) {
          const rightX = (layout.x * zoomRef.current) + offsetRef.current.x + (20 * zoomRef.current);
          const distance = Math.sqrt(
            Math.pow(x - rightX, 2) + Math.pow(y - indicatorY, 2)
          );

          if (distance <= indicatorRadius) {

            setCollapsedNodes(prev => {
              const newSet = new Set(prev);
              const rightKey = `${layout.node.id}-right`;
              if (newSet.has(rightKey)) {
                newSet.delete(rightKey);
              } else {
                newSet.add(rightKey);
              }
              return newSet;
            });
            clickedCollapseIndicator = true;
            break;
          }
        }
      }

      if (clickedCollapseIndicator) {
        return;
      }

      let clickedNode: FeatureNode | null = null;
      for (const layout of layouts) {
        const nodeX = (layout.x * zoomRef.current) + offsetRef.current.x - (nodeWidth * zoomRef.current) / 2;
        const nodeY = (layout.y * zoomRef.current) + offsetRef.current.y - (nodeHeight * zoomRef.current) / 2;

        if (x >= nodeX && x <= nodeX + (nodeWidth * zoomRef.current) &&
            y >= nodeY && y <= nodeY + (nodeHeight * zoomRef.current)) {
          clickedNode = layout.node;
          break;
        }
      }

      if (clickedNode) {

        if (e.shiftKey && onNodeAttach) {
          onNodeAttach(clickedNode);
        } else {
          onNodeSelect(clickedNode);
        }
      } else {
        isDraggingRef.current = true;

        if (dwellTimerRef.current) {
          clearTimeout(dwellTimerRef.current);
          dwellTimerRef.current = null;
        }
        dwellNodeIdRef.current = null;
        dragStartRef.current = {
          x: e.clientX - offsetRef.current.x,
          y: e.clientY - offsetRef.current.y
        };
        forceUpdate({});
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        offsetRef.current = {
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y
        };
        redraw();
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;



      let nodeUnder: TreeLayout | null = null;
      for (const layout of layouts) {
        const nodeX = (layout.x * zoomRef.current) + offsetRef.current.x - (nodeWidth * zoomRef.current) / 2;
        const nodeY = (layout.y * zoomRef.current) + offsetRef.current.y - (nodeHeight * zoomRef.current) / 2;

        if (x >= nodeX && x <= nodeX + (nodeWidth * zoomRef.current) &&
            y >= nodeY && y <= nodeY + (nodeHeight * zoomRef.current)) {
          nodeUnder = layout;
          break;
        }
      }


      const underId = nodeUnder ? nodeUnder.node.id : null;
      if (underId !== dwellNodeIdRef.current) {
        dwellNodeIdRef.current = underId;
        if (dwellTimerRef.current) {
          clearTimeout(dwellTimerRef.current);
          dwellTimerRef.current = null;
        }
        if (nodeUnder) {
          const dwellNode = nodeUnder.node;
          dwellTimerRef.current = setTimeout(() => {
            onNodeHoverDwellRef.current?.(dwellNode);
            dwellTimerRef.current = null;
          }, VISIT_DWELL_MS);
        }
      }


      if (!advancedMode) {
        if (nodeUnder) {
          setHoveredNode({ node: nodeUnder.node, x: nodeUnder.x, y: nodeUnder.y });
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        } else {
          setHoveredNode(null);
          setMousePos(null);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;


      const worldX = (mouseX - offsetRef.current.x) / zoomRef.current;
      const worldY = (mouseY - offsetRef.current.y) / zoomRef.current;


      const zoomDelta = getWheelZoomMultiplier(e);
      const newZoom = Math.min(Math.max(0.3, zoomRef.current * zoomDelta), 3);
      zoomRef.current = newZoom;
      setZoomLevel(Math.round(newZoom * 100));


      offsetRef.current = {
        x: mouseX - worldX * zoomRef.current,
        y: mouseY - worldY * zoomRef.current
      };

      redraw();
      forceUpdate({});
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      forceUpdate({});
    };

    const handleMouseLeave = () => {
      setHoveredNode(null);
      setMousePos(null);
      isDraggingRef.current = false;
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
      dwellNodeIdRef.current = null;
      forceUpdate({});
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('wheel', handleWheel);
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
    };
  }, [tree, onNodeSelect, redraw, onNodeAttach, advancedMode, collapsedNodes, viewingDepth, decisionCutoff]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[600px] bg-background relative">
      <canvas
        ref={canvasRef}
        className={isDraggingRef.current ? 'cursor-grabbing' : 'cursor-grab'}
      />

      {}
      {!comparisonMode && (
        <div className="absolute top-4 left-4 w-40 flex flex-col gap-4">
          {}
          <div>
          <div className="flex items-center gap-1 mb-1">
            <div className="text-xs text-muted-foreground">Viewing Depth</div>
            <TooltipIcon text={CANVAS_TOOLTIPS.viewingDepth} side="right" align="start" tooltipId="viewingDepth" location="canvas" />
          </div>
          <div className="relative" style={{ paddingTop: 22 }}>
            {}
            {editingViewDepth ? (
              <input
                className="absolute text-xs font-semibold bg-foreground text-background rounded shadow-sm text-center w-10 px-1 py-0.5 focus:outline-none"
                style={{ left: `calc(${depthSliderPct}%)`, top: 0, transform: 'translateX(-50%)' }}
                value={viewDepthInput}
                onChange={e => setViewDepthInput(e.target.value)}
                onBlur={() => {
                  const v = viewDepthInput.toLowerCase() === 'all' ? maxTreeDepth : parseInt(viewDepthInput);
                  if (!isNaN(v) && v >= 0 && v <= maxTreeDepth) { setViewingDepth(v); logFirstDepthChange(v); }
                  setEditingViewDepth(false);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setEditingViewDepth(false);
                }}
                autoFocus
              />
            ) : (
              <div
                className="absolute flex flex-col items-center cursor-pointer"
                style={{ left: `calc(${depthSliderPct}%)`, top: 0, transform: 'translateX(-50%)' }}
                onClick={() => { setViewDepthInput(String(viewingDepth)); setEditingViewDepth(true); }}
              >
                <div className="bg-foreground text-background text-xs font-semibold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap hover:opacity-75 transition-opacity">
                  {String(viewingDepth)}
                </div>
                <div className="w-px h-1 bg-foreground/40" />
              </div>
            )}
            <div className="relative h-3 flex items-center">
              <div className="absolute left-0 right-0 h-1 rounded-full bg-border" />
              <div className="absolute h-1 rounded-full bg-primary" style={{ width: `${depthSliderPct}%` }} />
              <input
                type="range"
                min={0}
                max={maxTreeDepth}
                step={1}
                value={viewingDepth}
                onChange={e => { const v = Number(e.target.value); setViewingDepth(v); logFirstDepthChange(v); }}
                onDoubleClick={() => { setViewingDepth(maxTreeDepth); logFirstDepthChange(maxTreeDepth); }}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
              <div
                className="absolute w-3 h-3 bg-white border border-border rounded-full shadow-sm pointer-events-none"
                style={{ left: `calc(${depthSliderPct}% - 6px)` }}
              />
            </div>
          </div>
          </div>{}

          {}
          <div>
              <div className="flex items-center gap-1 mb-1">
              <div className="text-xs text-muted-foreground">Decision Cutoff</div>
              <TooltipIcon text={decisionCutoffTooltip} side="right" align="start" tooltipId="decisionCutoff" location="canvas" />
            </div>
            <div className="relative" style={{ paddingTop: 22 }}>
              {}
              {editingCutoff ? (
                <input
                  className="absolute text-xs font-semibold bg-foreground text-background rounded shadow-sm text-center w-12 px-1 py-0.5 focus:outline-none"
                  style={{ left: `calc(${decisionCutoff * 100}%)`, top: 0, transform: 'translateX(-50%)' }}
                  value={cutoffInputStr}
                  onChange={e => setCutoffInputStr(e.target.value)}
                  onBlur={() => {
                    const parsed = parseFloat(cutoffInputStr);
                    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                      onDecisionCutoffChange?.(parsed / 100);
                      logFirstCutoffChange(parsed / 100);
                    }
                    setEditingCutoff(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') setEditingCutoff(false);
                  }}
                  autoFocus
                />
              ) : (
                <div
                  className="absolute flex flex-col items-center cursor-pointer"
                  style={{ left: `calc(${decisionCutoff * 100}%)`, top: 0, transform: 'translateX(-50%)' }}
                  onClick={() => { setCutoffInputStr((decisionCutoff * 100).toFixed(1)); setEditingCutoff(true); }}
                >
                  <div className="bg-foreground text-background text-xs font-semibold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap hover:opacity-75 transition-opacity">
                    {(decisionCutoff * 100).toFixed(1)}%
                  </div>
                  <div className="w-px h-1 bg-foreground/40" />
                </div>
              )}
              <div className="relative h-3 flex items-center">
                <div className="absolute left-0 right-0 h-1 rounded-full" style={{ background: 'linear-gradient(to right, #16a34a, #dc2626)' }} />
                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={1}
                  value={Math.round(decisionCutoff * 1000)}
                  onChange={e => { const v = Number(e.target.value) / 1000; onDecisionCutoffChange?.(v); logFirstCutoffChange(v); }}
                  onDoubleClick={() => { onDecisionCutoffChange?.(0.5); logFirstCutoffChange(0.5); }}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                />
                <div
                  className="absolute w-3 h-3 bg-white border border-border rounded-full shadow-sm pointer-events-none"
                  style={{ left: `calc(${decisionCutoff * 100}% - 6px)` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md">
          <div className="text-xs text-muted-foreground">Zoom</div>
          <div className="text-sm font-medium">{zoomLevel}%</div>
        </div>

        {!comparisonMode && (
          <>
            <div className="bg-card border border-border rounded-lg p-2 shadow-md">
              <div className="flex items-center gap-1 mb-2">
                <div className="text-xs text-muted-foreground">Display Mode</div>
                <TooltipIcon text={CANVAS_TOOLTIPS.displayMode} side="right" align="start" tooltipId="displayMode" location="canvas" />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => { logFirstDisplayModeChange('normal'); setAdvancedMode(false); }}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    !advancedMode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  Normal
                </button>
                <button
                  onClick={() => { logFirstDisplayModeChange('advanced'); setAdvancedMode(true); }}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    advancedMode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  Advanced
                </button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-2 shadow-md">
              <div className="flex items-center gap-1 mb-2">
                <div className="text-xs text-muted-foreground">Connector Width</div>
                <TooltipIcon text={CANVAS_TOOLTIPS.connectorWidth} side="right" align="start" tooltipId="connectorWidth" location="canvas" />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => { logFirstConnectorWidthChange('relative'); setConnectorWidthMode('relative'); }}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    connectorWidthMode === 'relative'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  Relative
                </button>
                <button
                  onClick={() => { logFirstConnectorWidthChange('absolute'); setConnectorWidthMode('absolute'); }}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    connectorWidthMode === 'absolute'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  Absolute
                </button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-2 shadow-md w-40">
              <div className="flex items-center gap-1 mb-2">
                <div className="text-xs text-muted-foreground">Class Names</div>
                <TooltipIcon text={CANVAS_TOOLTIPS.classNames} side="right" align="start" tooltipId="classNames" location="canvas" />
              </div>
              <div className="space-y-1.5">
                <label className="block">
                  <span className="text-[10px] font-medium text-red-600">Positive</span>
                  <input
                    type="text"
                    value={class1Draft}
                    onChange={e => setClass1Draft(e.target.value)}
                    onBlur={() => setClass1(class1Draft)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="mt-0.5 w-full px-1.5 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={DEFAULT_CLASS1_NAME}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-medium text-green-600">Negative</span>
                  <input
                    type="text"
                    value={class2Draft}
                    onChange={e => setClass2Draft(e.target.value)}
                    onBlur={() => setClass2(class2Draft)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="mt-0.5 w-full px-1.5 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={DEFAULT_CLASS2_NAME}
                  />
                </label>
                {(class1 !== DEFAULT_CLASS1_NAME || class2 !== DEFAULT_CLASS2_NAME) && (
                  <button
                    type="button"
                    onClick={resetClassLabels}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline"
                  >
                    Reset defaults
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {hoveredNode && mousePos && !isDraggingRef.current && !advancedMode && (
        <div
          className="absolute pointer-events-none z-50"
          style={{
            left: `${mousePos.x + 12}px`,
            top: `${mousePos.y + 12}px`,
          }}
        >
          <div className="bg-card border border-border rounded-lg shadow-lg p-4 max-w-sm">
            <h4 className="font-medium text-sm mb-2">{hoveredNode.node.name}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {hoveredNode.node.prediction !== undefined ? 'Leaf node prediction' : hoveredNode.node.description}
            </p>
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground mb-0.5">P({class1})</div>
              {(() => {
                const prob = hoveredNode.node.probability ?? hoveredNode.node.prediction ?? 0.5;
                return (
                  <div className="text-lg font-medium" style={{ color: getProbColor(prob, decisionCutoff) }}>
                    {(prob * 100).toFixed(1)}%
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
