import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronLeft, ChevronDown, ArrowRight, X } from 'lucide-react';
import DecisionTreeCanvas from './DecisionTreeCanvas';
import { FeatureNode } from './TreeData';
import { treeVersions, TreeVersion } from './TreeVersions';
import { useAdvice } from './AdviceContext';

interface NodeDiff {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  node: FeatureNode;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export default function CompareTreesPage() {
  const navigate = useNavigate();
  const { treeKey } = useParams<{ treeKey: string }>();
  const { versionNames } = useAdvice();
  const versions = (treeVersions[treeKey || ''] || []).map(v => ({
    ...v,
    name: versionNames[v.id] || v.name
  }));

  const [versionA, setVersionA] = useState(versions[0]?.id || '');
  const [versionB, setVersionB] = useState(versions[1]?.id || versions[0]?.id || '');
  const [showDropdownA, setShowDropdownA] = useState(false);
  const [showDropdownB, setShowDropdownB] = useState(false);
  const [selectedNode, setSelectedNode] = useState<FeatureNode | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sidebarRef.current?.scrollTo(0, 0);
  }, [selectedNode?.id]);

  const treeA = versions.find(v => v.id === versionA)?.tree;
  const treeB = versions.find(v => v.id === versionB)?.tree;
  const versionAName = versions.find(v => v.id === versionA)?.name || 'Version A';
  const versionBName = versions.find(v => v.id === versionB)?.name || 'Version B';


  const buildNodeMap = (tree: FeatureNode | undefined): Map<string, FeatureNode> => {
    const map = new Map<string, FeatureNode>();
    if (!tree) return map;

    const traverse = (node: FeatureNode) => {
      map.set(node.id, node);
      if (node.left) traverse(node.left);
      if (node.right) traverse(node.right);
    };

    traverse(tree);
    return map;
  };

  const nodesA = buildNodeMap(treeA);
  const nodesB = buildNodeMap(treeB);


  const getNodeDiff = (nodeId: string): NodeDiff | null => {
    const nodeInA = nodesA.get(nodeId);
    const nodeInB = nodesB.get(nodeId);

    if (!nodeInA && nodeInB) {
      return { type: 'added', node: nodeInB };
    }

    if (nodeInA && !nodeInB) {
      return { type: 'removed', node: nodeInA };
    }

    if (nodeInA && nodeInB) {
      const changes: { field: string; oldValue: any; newValue: any }[] = [];


      if (nodeInA.name !== nodeInB.name) {
        changes.push({ field: 'name', oldValue: nodeInA.name, newValue: nodeInB.name });
      }
      if (nodeInA.description !== nodeInB.description) {
        changes.push({ field: 'description', oldValue: nodeInA.description, newValue: nodeInB.description });
      }
      if (nodeInA.rationale !== nodeInB.rationale) {
        changes.push({ field: 'rationale', oldValue: nodeInA.rationale, newValue: nodeInB.rationale });
      }
      if (nodeInA.code !== nodeInB.code) {
        changes.push({ field: 'code', oldValue: nodeInA.code, newValue: nodeInB.code });
      }
      if (nodeInA.threshold !== nodeInB.threshold) {
        changes.push({ field: 'threshold', oldValue: nodeInA.threshold, newValue: nodeInB.threshold });
      }
      if (nodeInA.giniScore !== nodeInB.giniScore) {
        changes.push({ field: 'giniScore', oldValue: nodeInA.giniScore, newValue: nodeInB.giniScore });
      }
      if (nodeInA.prediction !== nodeInB.prediction) {
        changes.push({ field: 'prediction', oldValue: nodeInA.prediction, newValue: nodeInB.prediction });
      }
      if (nodeInA.splitCriteria !== nodeInB.splitCriteria) {
        changes.push({ field: 'splitCriteria', oldValue: nodeInA.splitCriteria, newValue: nodeInB.splitCriteria });
      }

      if (changes.length > 0) {
        return { type: 'modified', node: nodeInB, changes };
      }

      return { type: 'unchanged', node: nodeInB };
    }

    return null;
  };


  const changedNodeIds = new Set<string>();
  [...nodesA.keys(), ...nodesB.keys()].forEach(nodeId => {
    const diff = getNodeDiff(nodeId);
    if (diff && diff.type !== 'unchanged') {
      changedNodeIds.add(nodeId);
    }
  });

  const selectedNodeDiff = selectedNode ? getNodeDiff(selectedNode.id) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {}
      <div className="border-b border-border bg-card">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-medium">Compare Trees</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  View differences between tree versions
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-background border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium"
            >
              Exit Comparison
            </button>
          </div>

          {}
          <div className="mt-6 flex items-center gap-4">
            {}
            <div className="relative flex-1">
              <label className="block text-xs text-muted-foreground mb-2">From</label>
              <button
                onClick={() => setShowDropdownA(!showDropdownA)}
                className="w-full flex items-center justify-between px-4 py-2 bg-background border border-border rounded-lg hover:bg-accent transition-colors"
              >
                <span className="text-sm font-medium">{versionAName}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showDropdownA && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDropdownA(false)} />
                  <div className="absolute left-0 top-full mt-2 w-full bg-card border border-border rounded-lg shadow-lg z-50">
                    <div className="p-2">
                      {versions.map((version) => (
                        <button
                          key={version.id}
                          onClick={() => {
                            setVersionA(version.id);
                            setShowDropdownA(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors ${
                            versionA === version.id ? 'bg-accent' : ''
                          }`}
                        >
                          <span className="text-sm">{version.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <ArrowRight className="w-5 h-5 text-muted-foreground mt-6" />

            {}
            <div className="relative flex-1">
              <label className="block text-xs text-muted-foreground mb-2">To</label>
              <button
                onClick={() => setShowDropdownB(!showDropdownB)}
                className="w-full flex items-center justify-between px-4 py-2 bg-background border border-border rounded-lg hover:bg-accent transition-colors"
              >
                <span className="text-sm font-medium">{versionBName}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showDropdownB && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDropdownB(false)} />
                  <div className="absolute left-0 top-full mt-2 w-full bg-card border border-border rounded-lg shadow-lg z-50">
                    <div className="p-2">
                      {versions.map((version) => (
                        <button
                          key={version.id}
                          onClick={() => {
                            setVersionB(version.id);
                            setShowDropdownB(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors ${
                            versionB === version.id ? 'bg-accent' : ''
                          }`}
                        >
                          <span className="text-sm">{version.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="flex-1 flex">
        {}
        <div className="flex-1 p-8 overflow-hidden">
          {treeB && (
            <DecisionTreeCanvas
              tree={treeB}
              onNodeSelect={setSelectedNode}
              selectedNodeId={selectedNode?.id}
              rootSampleCount={treeB.samples}
              comparisonMode={{
                changedNodeIds: Array.from(changedNodeIds),
                baseTree: treeA
              }}
            />
          )}
        </div>

        {}
        {selectedNode && selectedNodeDiff && (
          <div ref={sidebarRef} className="w-[450px] border-l border-border bg-card p-6 overflow-y-auto">
            <div className="space-y-6">
              {}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-medium mb-2">{selectedNode.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {}
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
                  selectedNodeDiff.type === 'unchanged'
                    ? 'bg-green-500/10 text-green-600 border-green-500/20'
                    : 'bg-red-500/10 text-red-600 border-red-500/20'
                }`}
              >
                {selectedNodeDiff.type === 'added' && 'Added'}
                {selectedNodeDiff.type === 'removed' && 'Removed'}
                {selectedNodeDiff.type === 'modified' && 'Modified'}
                {selectedNodeDiff.type === 'unchanged' && 'Unchanged'}
              </div>

              {}
              {selectedNodeDiff.type === 'modified' && selectedNodeDiff.changes && (
                <div className="space-y-4">
                  <h4 className="font-medium">Changes</h4>
                  {selectedNodeDiff.changes.map((change, index) => (
                    <div key={index} className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase">
                        {change.field}
                      </div>
                      <div className="space-y-2">
                        <div className="p-3 bg-muted rounded-lg border-l-4 border-red-500">
                          <div className="text-xs text-red-600 font-medium mb-1">Before</div>
                          <div className="text-sm text-foreground">
                            {typeof change.oldValue === 'number'
                              ? change.oldValue.toFixed(3)
                              : change.oldValue}
                          </div>
                        </div>
                        <div className="p-3 bg-muted rounded-lg border-l-4 border-green-500">
                          <div className="text-xs text-green-600 font-medium mb-1">After</div>
                          <div className="text-sm text-foreground">
                            {typeof change.newValue === 'number'
                              ? change.newValue.toFixed(3)
                              : change.newValue}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedNodeDiff.type === 'added' && (
                <div className="p-4 bg-muted rounded-lg border-l-4 border-green-500">
                  <p className="text-sm text-muted-foreground">
                    This node was added in {versionBName}
                  </p>
                </div>
              )}

              {selectedNodeDiff.type === 'removed' && (
                <div className="p-4 bg-muted rounded-lg border-l-4 border-red-500">
                  <p className="text-sm text-muted-foreground">
                    This node was removed in {versionBName}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
