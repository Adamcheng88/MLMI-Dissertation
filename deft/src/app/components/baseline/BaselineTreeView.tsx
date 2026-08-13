import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, X } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import BaselineTreeCanvas from './BaselineTreeCanvas';
import ExpandableText from '../ExpandableText';
import { FeatureNode } from '../TreeData';
import { useNodeVisitLogger } from '../../lib/visitLogging';
import { useClassLabels } from '../../contexts/ClassLabelsContext';

interface BaselineTreeViewProps {
  tree: FeatureNode;
  title: string;
  subtitle?: string;
  headerExtras?: ReactNode;
  showBackButton?: boolean;
  backPath?: string;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-2.5 py-1.5 bg-muted rounded-md">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

export default function BaselineTreeView({
  tree,
  title,
  subtitle,
  headerExtras,
  showBackButton = false,
  backPath = '/',
}: BaselineTreeViewProps) {
  const navigate = useNavigate();
  const { recordNodeVisit } = useNodeVisitLogger();
  const { class1, class2 } = useClassLabels();
  const [selectedNode, setSelectedNode] = useState<FeatureNode | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isLeaf = selectedNode?.prediction !== undefined;

  useEffect(() => {
    sidebarRef.current?.scrollTo(0, 0);
  }, [selectedNode?.id]);

  const handleNodeSelect = useCallback(
    (node: FeatureNode) => {
      setSelectedNode(node);
      recordNodeVisit(node, 'click');
    },
    [recordNodeVisit]
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      {}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {showBackButton && (
              <button
                onClick={() => navigate(backPath)}
                className="p-1.5 hover:bg-accent rounded-lg transition-colors flex-shrink-0"
                title="Back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-medium truncate">{title}</h1>
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
          </div>
          {headerExtras}
        </div>
      </div>

      {}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 p-6 overflow-hidden relative">
          <BaselineTreeCanvas
            tree={tree}
            onNodeSelect={handleNodeSelect}
            selectedNodeId={selectedNode?.id}
          />
        </div>

        {selectedNode && (
          <div ref={sidebarRef} className="w-[450px] border-l border-border bg-card p-6 overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xl font-medium break-words">{selectedNode.name}</h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1.5 hover:bg-accent rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {}
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Depth" value={selectedNode.depth != null ? String(selectedNode.depth) : '—'} />
                <Stat label="N" value={selectedNode.samples.toLocaleString()} />
                <Stat
                  label={`P(${class1})`}
                  value={(selectedNode.probability ?? selectedNode.prediction ?? 0).toFixed(4)}
                />
                <Stat label={class1} value={(selectedNode.nPos ?? 0).toLocaleString()} />
                <Stat label={class2} value={(selectedNode.nNeg ?? 0).toLocaleString()} />
                <Stat
                  label="Threshold"
                  value={isLeaf || selectedNode.threshold == null ? '—' : selectedNode.threshold.toFixed(2)}
                />
                <Stat
                  label="Score"
                  value={isLeaf || selectedNode.score == null ? '—' : selectedNode.score.toFixed(4)}
                />
              </div>

              {}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Description
                </h4>
                <ExpandableText
                  text={isLeaf ? 'Leaf node prediction.' : selectedNode.description || '—'}
                  className="text-sm text-foreground/90 leading-relaxed"
                />
              </div>

              {}
              {selectedNode.rationale && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Rationale
                  </h4>
                  <ExpandableText
                    text={selectedNode.rationale}
                    className="text-sm text-foreground/90 leading-relaxed"
                  />
                </div>
              )}

              {}
              {selectedNode.code && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Generated Python
                  </h4>
                  <div className="rounded-lg overflow-hidden">
                    <SyntaxHighlighter
                      language="python"
                      style={vscDarkPlus}
                      customStyle={{ margin: 0, fontSize: '0.75rem', lineHeight: '1.5' }}
                    >
                      {selectedNode.code}
                    </SyntaxHighlighter>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
