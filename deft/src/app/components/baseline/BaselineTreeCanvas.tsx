import { useEffect, useRef, useCallback } from 'react';
import { FeatureNode } from '../TreeData';
import { getWheelZoomMultiplier } from '../../lib/wheelZoom';





const NODE_WIDTH = 172;
const NODE_HEIGHT = 66;
const VERTICAL_GAP = 116;
const HORIZONTAL_GAP = 44;

const NODE_BG = '#ffffff';
const NODE_BORDER = '#cbd5e1';
const NODE_BORDER_SELECTED = '#475569';
const NODE_BG_SELECTED = '#f1f5f9';
const TEXT_PRIMARY = '#1e293b';
const TEXT_SECONDARY = '#64748b';
const EDGE_COLOR = '#cbd5e1';
const EDGE_LABEL = '#94a3b8';

interface TreeLayout {
  x: number;
  y: number;
  depth: number;
  node: FeatureNode;
}

interface BaselineTreeCanvasProps {
  tree: FeatureNode;
  onNodeSelect: (node: FeatureNode) => void;
  selectedNodeId?: string;
}

function buildLayout(tree: FeatureNode): TreeLayout[] {
  function getTreeWidth(node: FeatureNode | undefined): number {
    if (!node) return 0;
    if (!node.left && !node.right) return NODE_WIDTH;
    return getTreeWidth(node.left) + getTreeWidth(node.right) + HORIZONTAL_GAP;
  }

  function layout(node: FeatureNode, depth: number, left: number, right: number): TreeLayout[] {
    const out: TreeLayout[] = [];
    const x = (left + right) / 2;
    const y = 50 + depth * VERTICAL_GAP;
    out.push({ x, y, depth, node });

    if (node.left && node.right) {
      const total = right - left;
      const lw = getTreeWidth(node.left);
      const rw = getTreeWidth(node.right);
      const childWidth = lw + rw + HORIZONTAL_GAP;
      const lCenter = left + (total - childWidth) / 2 + lw / 2;
      const rCenter = lCenter + lw / 2 + HORIZONTAL_GAP + rw / 2;
      out.push(...layout(node.left, depth + 1, left, lCenter + lw / 2));
      out.push(...layout(node.right, depth + 1, rCenter - rw / 2, right));
    } else if (node.left) {
      out.push(...layout(node.left, depth + 1, left, right));
    } else if (node.right) {
      out.push(...layout(node.right, depth + 1, left, right));
    }
    return out;
  }

  const width = getTreeWidth(tree);
  return layout(tree, 0, 0, width);
}

export default function BaselineTreeCanvas({ tree, onNodeSelect, selectedNodeId }: BaselineTreeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const offsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const isDraggingRef = useRef(false);
  const draggedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const didInitRef = useRef(false);

  const layouts = buildLayout(tree);

  const drawFitText = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      text: string,
      cx: number,
      cy: number,
      maxWidth: number,
      maxFontSize: number,
      minFontSize: number,
      weight = '600'
    ) => {
      for (let size = maxFontSize; size >= minFontSize; size--) {
        ctx.font = `${weight} ${size}px sans-serif`;
        if (ctx.measureText(text).width <= maxWidth) {
          ctx.textAlign = 'center';
          ctx.fillText(text, cx, cy);
          return;
        }
      }

      ctx.font = `${weight} ${minFontSize}px sans-serif`;
      ctx.textAlign = 'center';
      const parts = text.split('_');
      const lines: string[] = [];
      let cur = '';
      for (const p of parts) {
        const cand = cur ? `${cur}_${p}` : p;
        if (ctx.measureText(cand).width <= maxWidth) cur = cand;
        else {
          if (cur) lines.push(cur);
          cur = p;
        }
      }
      if (cur) lines.push(cur);
      const lh = minFontSize + 2;
      const firstY = cy - ((lines.length - 1) / 2) * lh;
      lines.forEach((line, i) => ctx.fillText(line, cx, firstY + i * lh));
    },
    []
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(offsetRef.current.x, offsetRef.current.y);
    ctx.scale(zoomRef.current, zoomRef.current);


    const byId = new Map(layouts.map(l => [l.node.id, l]));
    layouts.forEach(l => {
      [l.node.left, l.node.right].forEach(child => {
        if (!child) return;
        const cl = byId.get(child.id);
        if (!cl) return;
        const x1 = l.x;
        const y1 = l.y + NODE_HEIGHT / 2;
        const x2 = cl.x;
        const y2 = cl.y - NODE_HEIGHT / 2;
        const cp = Math.abs(y2 - y1) * 0.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(x1, y1 + cp, x2, y2 - cp, x2, y2);
        ctx.strokeStyle = EDGE_COLOR;
        ctx.lineWidth = 1.5;
        ctx.stroke();


        const pct = l.node.samples > 0 ? (cl.node.samples / l.node.samples) * 100 : 0;
        ctx.fillStyle = EDGE_LABEL;
        ctx.font = '600 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${pct.toFixed(0)}%`, (x1 + x2) / 2, (y1 + y2) / 2 - 3);
      });
    });


    layouts.forEach(l => {
      const isLeaf = l.node.prediction !== undefined;
      const isSelected = l.node.id === selectedNodeId;
      const x = l.x - NODE_WIDTH / 2;
      const y = l.y - NODE_HEIGHT / 2;

      ctx.fillStyle = isSelected ? NODE_BG_SELECTED : NODE_BG;
      ctx.strokeStyle = isSelected ? NODE_BORDER_SELECTED : NODE_BORDER;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, NODE_WIDTH, NODE_HEIGHT, 8);
      ctx.fill();
      ctx.stroke();

      const pos = l.node.nPos ?? Math.round(l.node.samples * (l.node.probability ?? 0.5));
      const neg = l.node.nNeg ?? l.node.samples - pos;
      const ratio = `C1 ${pos.toLocaleString()} / C2 ${neg.toLocaleString()}`;

      if (isLeaf) {
        ctx.fillStyle = TEXT_PRIMARY;
        drawFitText(ctx, `pred = ${(l.node.prediction ?? 0).toFixed(3)}`, l.x, l.y - 12, NODE_WIDTH - 20, 12, 9);
        ctx.fillStyle = TEXT_SECONDARY;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`n = ${l.node.samples.toLocaleString()}`, l.x, l.y + 6);
        ctx.fillText(ratio, l.x, l.y + 21);
      } else {
        ctx.fillStyle = TEXT_PRIMARY;
        drawFitText(ctx, l.node.name, l.x, l.y - 12, NODE_WIDTH - 20, 12, 8);
        ctx.fillStyle = TEXT_SECONDARY;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`n = ${l.node.samples.toLocaleString()}`, l.x, l.y + 6);
        ctx.fillText(ratio, l.x, l.y + 21);
      }
    });

    ctx.restore();
  }, [layouts, selectedNodeId, drawFitText]);


  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);


      if (!didInitRef.current && layouts.length) {
        const xs = layouts.map(l => l.x);
        const minX = Math.min(...xs) - NODE_WIDTH / 2;
        const maxX = Math.max(...xs) + NODE_WIDTH / 2;
        const treeW = maxX - minX;
        offsetRef.current = { x: (rect.width - treeW) / 2 - minX, y: 20 };
        didInitRef.current = true;
      }
      redraw();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [redraw, layouts]);

  useEffect(() => {
    redraw();
  }, [redraw]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const hitTest = (clientX: number, clientY: number): FeatureNode | null => {
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      for (const l of layouts) {
        const nx = l.x * zoomRef.current + offsetRef.current.x - (NODE_WIDTH * zoomRef.current) / 2;
        const ny = l.y * zoomRef.current + offsetRef.current.y - (NODE_HEIGHT * zoomRef.current) / 2;
        if (
          px >= nx &&
          px <= nx + NODE_WIDTH * zoomRef.current &&
          py >= ny &&
          py <= ny + NODE_HEIGHT * zoomRef.current
        ) {
          return l.node;
        }
      }
      return null;
    };

    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      draggedRef.current = false;
      dragStartRef.current = { x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const nx = e.clientX - dragStartRef.current.x;
      const ny = e.clientY - dragStartRef.current.y;
      if (Math.abs(nx - offsetRef.current.x) > 2 || Math.abs(ny - offsetRef.current.y) > 2) {
        draggedRef.current = true;
      }
      offsetRef.current = { x: nx, y: ny };
      redraw();
    };
    const onMouseUp = (e: MouseEvent) => {
      const wasDragging = draggedRef.current;
      isDraggingRef.current = false;
      if (!wasDragging) {
        const node = hitTest(e.clientX, e.clientY);
        if (node) onNodeSelect(node);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = (mx - offsetRef.current.x) / zoomRef.current;
      const worldY = (my - offsetRef.current.y) / zoomRef.current;
      const delta = getWheelZoomMultiplier(e);
      zoomRef.current = Math.min(Math.max(0.3, zoomRef.current * delta), 3);
      offsetRef.current = { x: mx - worldX * zoomRef.current, y: my - worldY * zoomRef.current };
      redraw();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [layouts, onNodeSelect, redraw]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[600px] relative bg-background">
      <canvas ref={canvasRef} className="cursor-grab active:cursor-grabbing" />
    </div>
  );
}
