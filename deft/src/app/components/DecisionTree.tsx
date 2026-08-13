import { useEffect, useRef, useState } from 'react';

interface FeatureNode {
  id: string;
  name: string;
  description: string;
  rationale: string;
  code: string;
  threshold: number;
  giniScore: number;
  samples: number;
  left?: FeatureNode;
  right?: FeatureNode;
  prediction?: number;
}

interface DecisionTreeProps {
  tree: FeatureNode;
  onNodeSelect: (node: FeatureNode) => void;
  selectedNodeId?: string;
}

type FeatureType = 'Position Check' | 'Composition Window' | 'Motif' | 'Layout/Spacing' | 'Physics/Epigenetics' | 'Leaf';

const FEATURE_COLORS: Record<FeatureType, { bg: string; border: string; text: string }> = {
  'Position Check': { bg: '#e0f2fe', border: '#0ea5e9', text: '#075985' },
  'Composition Window': { bg: '#ddd6fe', border: '#8b5cf6', text: '#5b21b6' },
  'Motif': { bg: '#fce7f3', border: '#ec4899', text: '#9f1239' },
  'Layout/Spacing': { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  'Physics/Epigenetics': { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  'Leaf': { bg: '#f3f3f5', border: '#9ca3af', text: '#4b5563' }
};

function getFeatureType(node: FeatureNode): FeatureType {
  if (node.prediction !== undefined) return 'Leaf';

  const name = node.name.toLowerCase();

  if (name.includes('pos_') || name.includes('position')) return 'Position Check';
  if (name.includes('content') || name.includes('density') || name.includes('proportion')) return 'Composition Window';
  if (name.includes('motif') || name.includes('palindrom')) return 'Motif';
  if (name.includes('transition') || name.includes('spacing') || name.includes('boundary')) return 'Layout/Spacing';
  if (name.includes('energy') || name.includes('methylation') || name.includes('stacking')) return 'Physics/Epigenetics';

  return 'Composition Window';
}

interface TreeLayout {
  x: number;
  y: number;
  node: FeatureNode;
}

export default function DecisionTree({ tree, onNodeSelect, selectedNodeId }: DecisionTreeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<{ node: FeatureNode; x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;


    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);


    const nodeWidth = 200;
    const nodeHeight = 80;
    const verticalGap = 120;
    const horizontalGap = 50;


    function calculateLayout(node: FeatureNode, depth: number, leftBound: number, rightBound: number): TreeLayout {
      const x = (leftBound + rightBound) / 2;
      const y = 50 + depth * verticalGap;

      return { x, y, node };
    }

    function getTreeWidth(node: FeatureNode | undefined, depth: number): number {
      if (!node) return 0;
      if (!node.left && !node.right) return nodeWidth;

      const leftWidth = getTreeWidth(node.left, depth + 1);
      const rightWidth = getTreeWidth(node.right, depth + 1);

      return leftWidth + rightWidth + horizontalGap;
    }

    function layoutTree(node: FeatureNode, depth: number, leftBound: number, rightBound: number): TreeLayout[] {
      const layouts: TreeLayout[] = [];
      const x = (leftBound + rightBound) / 2;
      const y = 50 + depth * verticalGap;

      layouts.push({ x, y, node });

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

    const totalWidth = getTreeWidth(tree, 0);
    const startX = Math.max(50, (rect.width - totalWidth) / 2);
    const layouts = layoutTree(tree, 0, startX, startX + totalWidth);


    ctx.clearRect(0, 0, rect.width, rect.height);


    layouts.forEach(layout => {
      if (layout.node.left) {
        const leftLayout = layouts.find(l => l.node.id === layout.node.left!.id);
        if (leftLayout) {
          const parentSamples = layout.node.samples;
          const childSamples = leftLayout.node.samples;
          const splitPercentage = (childSamples / parentSamples) * 100;
          const edgeWidth = Math.max(3, (splitPercentage / 100) * 24);

          ctx.beginPath();
          ctx.moveTo(layout.x, layout.y + nodeHeight / 2);
          ctx.lineTo(leftLayout.x, leftLayout.y - nodeHeight / 2);
          ctx.strokeStyle = 'rgba(113, 113, 130, 0.25)';
          ctx.lineWidth = edgeWidth;
          ctx.stroke();


          const midX = (layout.x + leftLayout.x) / 2;
          const midY = (layout.y + nodeHeight / 2 + leftLayout.y - nodeHeight / 2) / 2;
          ctx.fillStyle = '#717182';
          ctx.font = '600 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${splitPercentage.toFixed(0)}%`, midX, midY - 5);
        }
      }

      if (layout.node.right) {
        const rightLayout = layouts.find(l => l.node.id === layout.node.right!.id);
        if (rightLayout) {
          const parentSamples = layout.node.samples;
          const childSamples = rightLayout.node.samples;
          const splitPercentage = (childSamples / parentSamples) * 100;
          const edgeWidth = Math.max(3, (splitPercentage / 100) * 24);

          ctx.beginPath();
          ctx.moveTo(layout.x, layout.y + nodeHeight / 2);
          ctx.lineTo(rightLayout.x, rightLayout.y - nodeHeight / 2);
          ctx.strokeStyle = 'rgba(113, 113, 130, 0.25)';
          ctx.lineWidth = edgeWidth;
          ctx.stroke();


          const midX = (layout.x + rightLayout.x) / 2;
          const midY = (layout.y + nodeHeight / 2 + rightLayout.y - nodeHeight / 2) / 2;
          ctx.fillStyle = '#717182';
          ctx.font = '600 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${splitPercentage.toFixed(0)}%`, midX, midY - 5);
        }
      }
    });


    layouts.forEach(layout => {
      const isSelected = layout.node.id === selectedNodeId;
      const featureType = getFeatureType(layout.node);
      const colors = FEATURE_COLORS[featureType];

      const x = layout.x - nodeWidth / 2;
      const y = layout.y - nodeHeight / 2;


      if (isSelected) {
        ctx.fillStyle = '#030213';
        ctx.strokeStyle = '#030213';
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


      ctx.fillStyle = isSelected ? '#ffffff' : colors.text;
      ctx.font = '600 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(featureType, layout.x, layout.y - 5);


      ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.7)' : colors.text;
      ctx.font = '11px sans-serif';
      ctx.fillText(`n=${layout.node.samples}`, layout.x, layout.y + 15);
    });


    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      for (const layout of layouts) {
        const nodeX = layout.x - nodeWidth / 2;
        const nodeY = layout.y - nodeHeight / 2;

        if (x >= nodeX && x <= nodeX + nodeWidth && y >= nodeY && y <= nodeY + nodeHeight) {
          onNodeSelect(layout.node);
          break;
        }
      }
    };


    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let foundNode = false;
      for (const layout of layouts) {
        const nodeX = layout.x - nodeWidth / 2;
        const nodeY = layout.y - nodeHeight / 2;

        if (x >= nodeX && x <= nodeX + nodeWidth && y >= nodeY && y <= nodeY + nodeHeight) {
          setHoveredNode({ node: layout.node, x: layout.x, y: layout.y });
          setMousePos({ x: e.clientX, y: e.clientY });
          foundNode = true;
          break;
        }
      }

      if (!foundNode) {
        setHoveredNode(null);
        setMousePos(null);
      }
    };

    const handleMouseLeave = () => {
      setHoveredNode(null);
      setMousePos(null);
    };

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [tree, onNodeSelect, selectedNodeId]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[600px] bg-background relative">
      <canvas ref={canvasRef} className="cursor-pointer" />

      {}
      {hoveredNode && mousePos && (
        <div
          className="absolute pointer-events-none z-50"
          style={{
            left: `${mousePos.x + 15}px`,
            top: `${mousePos.y + 15}px`,
          }}
        >
          <div className="bg-card border border-border rounded-lg shadow-lg p-4 max-w-sm">
            <h4 className="font-medium text-sm mb-2">{hoveredNode.node.name}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {hoveredNode.node.description}
            </p>
            {hoveredNode.node.prediction !== undefined && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground">Prediction</div>
                <div className="text-lg font-medium">
                  {(hoveredNode.node.prediction * 100).toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
