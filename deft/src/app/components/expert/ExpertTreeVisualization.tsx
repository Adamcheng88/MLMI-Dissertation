






import { useState, useMemo, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, ChevronDown, Check, Pencil, GitCompare, X, ExternalLink, BookOpen } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import DecisionTreeCanvas from '../DecisionTreeCanvas';
import AskAIBar from '../AskAIBar';
import TooltipIcon from '../TooltipIcon';
import ExpandableText from '../ExpandableText';
import { FeatureNode } from '../TreeData';
import { treeVersions } from '../TreeVersions';
import { useAdvice } from '../AdviceContext';
import { useParticipant } from '../../contexts/ParticipantContext';
import { useClassLabels } from '../../contexts/ClassLabelsContext';
import { useNodeVisitLogger } from '../../lib/visitLogging';
import { buildTreeOverview } from '../../lib/treeOverview';
import type { TreeJson } from '../jsonTreeConverter';
import { getLiteratureForNode } from './expertLiterature';
import { getSplitTaken } from '../pathSplit';

function sidebarTooltips(class1: string, class2: string) {
  return {
    nodeRationale: 'The AI agent\'s reasoning behind choosing this feature.',
    nodeDescription: 'The AI agent\'s explanation of what this feature measures or checks.',
    relevantLiterature: 'Research papers the model used as context when deciding the rationale for this node, including how each paper was judged relevant (with cited lines).',
    splittingThreshold: 'The cutoff value (τ) used to split data into left and right branches. Data points where the feature value is greater than τ go to the right; the rest go left.',
    class1Probability: `The estimated probability that a sample reaching this node belongs to ${class1} (the positive class). The green-to-red gradient is centered on your decision cutoff.`,
    sampleDistribution: `How many training samples reached this node and how they are split between ${class1} and ${class2}.`,
    totalSamples: 'Number of training samples that reached this node.',
    percentDataset: 'What fraction of the entire training dataset falls into this node.',
    class1Samples: `Count and percentage of samples at this node classified as ${class1}.`,
    class2Samples: `Count and percentage of samples at this node classified as ${class2}.`,
    splitPurity: 'Gini impurity measures how mixed the classes are at this node. Lower values mean purer (more homogeneous) splits; higher values mean more mixed.',
    pythonImplementation: 'The executable Python code that computes this node\'s feature value from the raw input data.',
    decisionPath: 'The sequence of decisions from the tree root to this node, showing how a sample would be routed here.',
  };
}

function SectionTitle({ children, tooltip, tooltipId, className = 'mb-2' }: { children: ReactNode; tooltip: string; tooltipId: string; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <h4 className="font-medium">{children}</h4>
      <TooltipIcon text={tooltip} side="left" align="start" tooltipId={tooltipId} location="sidebar" />
    </div>
  );
}

function GradientBar({
  value,
  min,
  max,
  leftLabel,
  rightLabel,
  formatValue,
  cutoff,
}: {
  value: number;
  min: number;
  max: number;
  leftLabel: string;
  rightLabel: string;
  formatValue: (v: number) => string;
  cutoff?: number;
}) {
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));

  const CIRCLE_R = 8;
  const gradientStyle = cutoff !== undefined
    ? `linear-gradient(to right, #16a34a, #e2e8f0 ${cutoff * 100}%, #dc2626)`
    : 'linear-gradient(to right, #16a34a, #dc2626)';
  return (
    <div className="px-1 py-2">
      {}
      <div className="relative" style={{ paddingTop: 28 }}>
        {}
        <div
          className="absolute flex flex-col items-center"
          style={{
            left: `calc(${pct * 100}%)`,
            top: 0,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bg-foreground text-background text-xs font-semibold px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap">
            {formatValue(value)}
          </div>
          {}
          <div className="w-px h-1.5 bg-foreground/40" />
        </div>

        {}
        <div
          className="relative rounded-full"
          style={{
            height: CIRCLE_R * 2,
            background: gradientStyle,
          }}
        >
          {}
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-foreground/20 shadow-md"
            style={{
              width: CIRCLE_R * 2,
              height: CIRCLE_R * 2,
              left: `calc(${pct * 100}% - ${CIRCLE_R}px)`,
            }}
          />
        </div>
      </div>

      {}
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

interface ExpertTreeVisualizationProps {
  tree: FeatureNode;
  title: string;
  subtitle: string;
  treeKey: string;
  showBackButton?: boolean;
  backPath?: string;
  reviewEditsPath?: string;
  comparePathBase?: string;
  headerExtras?: ReactNode;
  treeMeta?: TreeJson['meta'];
}

export default function ExpertTreeVisualization({
  tree,
  title,
  subtitle,
  treeKey,
  showBackButton = true,
  backPath = '/',
  reviewEditsPath = '/review-edits',
  comparePathBase = '/compare',
  headerExtras,
  treeMeta,
}: ExpertTreeVisualizationProps) {
  const navigate = useNavigate();
  const { versionNames, setVersionName } = useAdvice();
  const { logEvent } = useParticipant();
  const { class1, class2 } = useClassLabels();
  const SIDEBAR_TOOLTIPS = sidebarTooltips(class1, class2);
  const { recordNodeVisit } = useNodeVisitLogger();
  const [selectedNode, setSelectedNode] = useState<FeatureNode | null>(null);
  const [attachedNodes, setAttachedNodes] = useState<FeatureNode[]>([]);
  const [decisionCutoff, setDecisionCutoff] = useState(0.5);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isLeafNode = selectedNode?.prediction !== undefined;

  useEffect(() => {
    sidebarRef.current?.scrollTo(0, 0);
  }, [selectedNode?.id]);

  const getPositiveProb = (node: FeatureNode) => {
    if (node.probability !== undefined) return node.probability;
    if (node.prediction !== undefined) return node.prediction;
    return 0.5;
  };
  const getPositiveSamples = (node: FeatureNode) => {
    if (node.nPos !== undefined) return node.nPos;
    return Math.round(node.samples * getPositiveProb(node));
  };
  const getNegativeSamples = (node: FeatureNode) => {
    if (node.nNeg !== undefined) return node.nNeg;
    return node.samples - getPositiveSamples(node);
  };


  const versions = (treeVersions[treeKey] || []).map(v => ({
    ...v,
    name: versionNames[v.id] || v.name
  }));
  const [currentVersionId, setCurrentVersionId] = useState(versions[0]?.id || '');
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const currentVersion = versions.find(v => v.id === currentVersionId) || versions[0];
  const currentTree = currentVersion?.tree || tree;

  const treeOverview = useMemo(
    () => buildTreeOverview(currentTree, treeMeta),
    [currentTree, treeMeta]
  );

  const handleNodeSelect = (node: FeatureNode) => {
    setSelectedNode(node);
    recordNodeVisit(node, 'click');
  };

  const handleNodeAttach = (node: FeatureNode) => {
    const existingIndex = attachedNodes.findIndex(n => n.id === node.id);
    if (existingIndex !== -1) {

      setAttachedNodes(attachedNodes.filter(n => n.id !== node.id));
      logEvent('node_detach', { id: node.id });
    } else {

      setAttachedNodes([...attachedNodes, node]);
      logEvent('node_attach', { id: node.id, name: node.name });
    }
  };

  const handleRemoveNode = (nodeId: string) => {
    setAttachedNodes(attachedNodes.filter(n => n.id !== nodeId));
  };

  const handleAttachmentClick = (node: FeatureNode) => {
    setSelectedNode(node);
    recordNodeVisit(node, 'click');
  };

  const handleEditVersion = (versionId: string, currentName: string) => {
    setEditingVersionId(versionId);
    setEditingName(currentName);
  };

  const handleSaveVersionName = () => {
    if (editingVersionId && editingName.trim()) {
      setVersionName(editingVersionId, editingName.trim());
    }
    setEditingVersionId(null);
  };


  const getPathToNode = (targetId: string): FeatureNode[] => {
    const path: FeatureNode[] = [];

    function findPath(node: FeatureNode): boolean {
      path.push(node);

      if (node.id === targetId) return true;

      if (node.left && findPath(node.left)) return true;
      if (node.right && findPath(node.right)) return true;

      path.pop();
      return false;
    }

    findPath(currentTree);
    return path;
  };

  const pathToSelected = selectedNode ? getPathToNode(selectedNode.id) : [];
  const literature = selectedNode ? getLiteratureForNode(selectedNode.id) : [];

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {}
      <div className="border-b border-border bg-card">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {showBackButton && (
                <button
                  onClick={() => navigate(backPath)}
                  className="p-2 hover:bg-accent rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <h1 className="text-2xl font-medium">{title}</h1>
                {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {}
              {versions.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                    className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg hover:bg-accent transition-colors"
                  >
                    <span className="text-sm font-medium">{currentVersion?.name}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {showVersionDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowVersionDropdown(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-50">
                        <div className="p-2">
                          {versions.map((version) => (
                            <div
                              key={version.id}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md transition-colors"
                            >
                              {editingVersionId === version.id ? (
                                <input
                                  type="text"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onBlur={handleSaveVersionName}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveVersionName();
                                    if (e.key === 'Escape') setEditingVersionId(null);
                                  }}
                                  className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded"
                                  autoFocus
                                />
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setCurrentVersionId(version.id);
                                      setShowVersionDropdown(false);
                                    }}
                                    className="flex-1 flex items-center justify-between text-left"
                                  >
                                    <span className="text-sm">{version.name}</span>
                                    {currentVersionId === version.id && (
                                      <Check className="w-4 h-4 text-primary" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleEditVersion(version.id, version.name)}
                                    className="p-1 hover:bg-background rounded"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {}
              {versions.length > 1 && (
                <button
                  onClick={() => navigate(`${comparePathBase}/${treeKey}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg hover:bg-accent transition-colors"
                >
                  <GitCompare className="w-4 h-4" />
                  <span className="text-sm font-medium">Compare Trees</span>
                </button>
              )}

              {}
              <button
                onClick={() => navigate(reviewEditsPath)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
              >
                Review Edits
              </button>

              {headerExtras}
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="flex-1 flex min-h-0">
        {}
        <div className="flex-1 p-8 overflow-hidden relative">
          <DecisionTreeCanvas
            tree={currentTree}
            onNodeSelect={handleNodeSelect}
            selectedNodeId={selectedNode?.id}
            rootSampleCount={currentTree.samples}
            onNodeAttach={handleNodeAttach}
            attachedNodeIds={attachedNodes.map(n => n.id)}
            decisionCutoff={decisionCutoff}
            onDecisionCutoffChange={setDecisionCutoff}
            onNodeHoverDwell={(node) => recordNodeVisit(node, 'hover')}
          />
        </div>

        {}
        {selectedNode && (
          <div ref={sidebarRef} className="w-[450px] border-l border-border bg-card p-6 overflow-y-auto">
            <div className="space-y-6">
              {}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-medium mb-1">{selectedNode.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {}
              {selectedNode.rationale && (
                <div>
                  <SectionTitle tooltip={SIDEBAR_TOOLTIPS.nodeRationale} tooltipId="nodeRationale">Node Rationale</SectionTitle>
                  <ExpandableText text={selectedNode.rationale} />
                </div>
              )}

              {}
              <div>
                <SectionTitle tooltip={SIDEBAR_TOOLTIPS.nodeDescription} tooltipId="nodeDescription">Node Description</SectionTitle>
                <ExpandableText text={isLeafNode ? 'Leaf node prediction' : selectedNode.description} />
              </div>

              {}
              <div>
                <SectionTitle
                  tooltip={SIDEBAR_TOOLTIPS.relevantLiterature}
                  tooltipId="relevantLiterature"
                  className="mb-3"
                >
                  Potentially Relevant Literature
                </SectionTitle>
                {literature.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No literature was linked to this node.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {literature.map(paper => (
                      <div
                        key={paper.id}
                        className="p-3 bg-muted rounded-lg space-y-2"
                      >
                        <div className="flex items-start gap-2">
                          <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <a
                              href={paper.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-foreground hover:text-primary transition-colors inline-flex items-start gap-1"
                            >
                              <span>{paper.title}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0 mt-1 opacity-60" />
                            </a>
                            <p className="text-xs text-muted-foreground mt-1">
                              {paper.authors} ({paper.year})
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                          {paper.relevance}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {}
              <div>
                <SectionTitle tooltip={SIDEBAR_TOOLTIPS.splittingThreshold} tooltipId="splittingThreshold">Splitting Threshold (τ)</SectionTitle>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-lg font-medium">
                    {isLeafNode ? 'N/A' : (selectedNode.threshold !== undefined ? selectedNode.threshold.toFixed(2) : 'N/A')}
                  </div>
                </div>
              </div>

              {}
              <div>
                <SectionTitle tooltip={SIDEBAR_TOOLTIPS.class1Probability} tooltipId="class1Probability" className="mb-3">{class1} Probability</SectionTitle>
                <GradientBar
                  value={getPositiveProb(selectedNode)}
                  min={0}
                  max={1}
                  leftLabel={class2}
                  rightLabel={class1}
                  formatValue={(v) => `${(v * 100).toFixed(1)}%`}
                  cutoff={decisionCutoff}
                />
              </div>

              {}
              <div>
                <SectionTitle tooltip={SIDEBAR_TOOLTIPS.sampleDistribution} tooltipId="sampleDistribution" className="mb-3">Sample Distribution</SectionTitle>
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <span>Total Samples</span>
                        <TooltipIcon text={SIDEBAR_TOOLTIPS.totalSamples} side="left" align="start" tooltipId="totalSamples" location="sidebar" />
                      </div>
                      <div className="text-lg font-medium">n = {selectedNode.samples.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <span>% of Dataset</span>
                        <TooltipIcon text={SIDEBAR_TOOLTIPS.percentDataset} side="left" align="start" tooltipId="percentDataset" location="sidebar" />
                      </div>
                      <div className="text-lg font-medium">
                        {((selectedNode.samples / currentTree.samples) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1 text-xs text-red-600 font-medium mb-1">
                        <span>{class1}</span>
                        <TooltipIcon text={SIDEBAR_TOOLTIPS.class1Samples} side="left" align="start" tooltipId="class1Samples" location="sidebar" />
                      </div>
                      <div className="text-sm font-medium">{getPositiveSamples(selectedNode).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">
                        {(getPositiveProb(selectedNode) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-xs text-green-600 font-medium mb-1">
                        <span>{class2}</span>
                        <TooltipIcon text={SIDEBAR_TOOLTIPS.class2Samples} side="left" align="start" tooltipId="class2Samples" location="sidebar" />
                      </div>
                      <div className="text-sm font-medium">{getNegativeSamples(selectedNode).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">
                        {((1 - getPositiveProb(selectedNode)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {}
              <div>
                <SectionTitle tooltip={SIDEBAR_TOOLTIPS.splitPurity} tooltipId="splitPurity" className="mb-3">Split Purity (Gini Index)</SectionTitle>
                <GradientBar
                  value={selectedNode.giniScore}
                  min={0}
                  max={0.5}
                  leftLabel="Pure"
                  rightLabel="Impure"
                  formatValue={(v) => v.toFixed(3)}
                />
              </div>

              {}
              {selectedNode.code && (
                <div>
                  <SectionTitle tooltip={SIDEBAR_TOOLTIPS.pythonImplementation} tooltipId="pythonImplementation" className="mb-3">Python Implementation</SectionTitle>
                  <div className="rounded-lg overflow-hidden">
                    <SyntaxHighlighter
                      language="python"
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        fontSize: '0.75rem',
                        lineHeight: '1.5'
                      }}
                    >
                      {selectedNode.code}
                    </SyntaxHighlighter>
                  </div>
                </div>
              )}

              {}
              <div className="space-y-3">
                <SectionTitle tooltip={SIDEBAR_TOOLTIPS.decisionPath} tooltipId="decisionPath" className="mb-0">Decision Path</SectionTitle>
                <div className="space-y-3">
                  {pathToSelected.map((node, index) => {
                    const next = pathToSelected[index + 1];
                    const split = next ? getSplitTaken(node, next) : null;
                    return (
                      <div key={node.id} className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1 pb-3 border-b border-border last:border-b-0">
                          <h5 className="text-sm font-medium mb-1">{node.name}</h5>
                          {split && (
                            <p className="text-xs font-medium text-foreground/80 mb-1">
                              {split.label}{' '}
                              <span className="text-muted-foreground font-normal">
                                ({split.direction})
                              </span>
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {node.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {}
      <AskAIBar
        attachedNodes={attachedNodes}
        onRemoveNode={handleRemoveNode}
        onAttachmentClick={handleAttachmentClick}
        treeOverview={treeOverview}
      />
    </div>
  );
}
