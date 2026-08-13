import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronLeft, Code, Info, Lightbulb } from 'lucide-react';
import DecisionTree from './DecisionTree';
import ExpandableText from './ExpandableText';
import { useClassLabels } from '../contexts/ClassLabelsContext';

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


const sampleTree: FeatureNode = {
  id: 'root',
  name: 'upstream_G_content_20_49',
  description: 'Calculate the proportion of guanine (G) nucleotides in the upstream region from positions 20 to 49',
  rationale: 'GC-rich regions often indicate regulatory elements and can influence polymerase pausing stability',
  code: `def upstream_G_content_20_49(X):
  return X['raw_sequence'].apply(
    lambda seq: seq[20:50].count('G') / 30
  )`,
  threshold: 0.25,
  giniScore: 0.195,
  samples: 4000,
  left: {
    id: 'left_1',
    name: 'pos_50_is_G_and_pos_51_is_T',
    description: 'Check if position 50 is G and position 51 is T',
    rationale: 'GT dinucleotide at pause site correlates with polymerase stalling',
    code: `def pos_50_is_G_and_pos_51_is_T(X):
  return X['raw_sequence'].apply(
    lambda seq: 1 if seq[50] == 'G' and seq[51] == 'T' else 0
  )`,
    threshold: 0.5,
    giniScore: 0.086,
    samples: 1644,
    left: {
      id: 'left_1_left',
      name: 'AT_content_0_100',
      description: 'Calculate AT content across full sequence',
      rationale: 'AT-rich regions are associated with lower polymerase processivity',
      code: `def AT_content_0_100(X):
  return X['raw_sequence'].apply(
    lambda seq: (seq.count('A') + seq.count('T')) / 101
  )`,
      threshold: 0.43,
      giniScore: 0.051,
      samples: 822,
      prediction: 0.06
    },
    right: {
      id: 'left_1_right',
      name: 'upstream_stacking_energy',
      description: 'Calculate base pair stacking energy in upstream region',
      rationale: 'DNA structural stability affects polymerase kinetics',
      code: `def upstream_stacking_energy(X):
  # Simplified stacking energy calculation
  return X['raw_sequence'].apply(
    lambda seq: calculate_stacking(seq[10:50])
  )`,
      threshold: -1.77,
      giniScore: 0.033,
      samples: 822,
      prediction: 0.86
    }
  },
  right: {
    id: 'right_1',
    name: 'pos_50_purine_and_51_pyrimidine',
    description: 'Check if position 50 is purine (A/G) and 51 is pyrimidine (C/T)',
    rationale: 'Purine-pyrimidine transitions create structural changes affecting pause likelihood',
    code: `def pos_50_purine_and_51_pyrimidine(X):
  purines = {'A', 'G'}
  pyrimidines = {'C', 'T'}
  return X['raw_sequence'].apply(
    lambda seq: 1 if seq[50] in purines and seq[51] in pyrimidines else 0
  )`,
    threshold: 0.5,
    giniScore: 0.078,
    samples: 2356,
    left: {
      id: 'right_1_left',
      name: 'pos_51_is_pyrimidine',
      description: 'Check if position 51 is pyrimidine',
      rationale: 'Pyrimidine at +1 position influences pause duration',
      code: `def pos_51_is_pyrimidine(X):
  pyrimidines = {'C', 'T'}
  return X['raw_sequence'].apply(
    lambda seq: 1 if seq[51] in pyrimidines else 0
  )`,
      threshold: 0.5,
      giniScore: 0.013,
      samples: 1178,
      prediction: 0.55
    },
    right: {
      id: 'right_1_right',
      name: 'Central_GC_content_49_51',
      description: 'Calculate GC content around pause site',
      rationale: 'Local GC content affects DNA melting and pause stability',
      code: `def Central_GC_content_49_51(X):
  return X['raw_sequence'].apply(
    lambda seq: (seq[49:52].count('G') + seq[49:52].count('C')) / 3
  )`,
      threshold: 0.5,
      giniScore: 0.078,
      samples: 1178,
      prediction: 0.95
    }
  }
};

export default function VisualizationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { class1 } = useClassLabels();
  const [selectedNode, setSelectedNode] = useState<FeatureNode | null>(null);
  const [detailLevel, setDetailLevel] = useState<'macro' | 'intermediate' | 'micro'>('intermediate');
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sidebarRef.current?.scrollTo(0, 0);
  }, [selectedNode?.id]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {}
      <div className="border-b border-border bg-card">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-medium">Decision Tree Visualization</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Interactive exploration of DEFT-generated features
                </p>
              </div>
            </div>

            {}
            <div className="flex gap-2 bg-muted rounded-lg p-1">
              {(['macro', 'intermediate', 'micro'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setDetailLevel(level)}
                  className={`px-4 py-2 rounded-md text-sm capitalize transition-all ${
                    detailLevel === level
                      ? 'bg-background shadow-sm'
                      : 'hover:bg-background/50'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="flex-1 flex">
        {}
        <div className="flex-1 p-8 overflow-auto">
          <DecisionTree
            tree={sampleTree}
            onNodeSelect={setSelectedNode}
            selectedNodeId={selectedNode?.id}
          />
        </div>

        {}
        {selectedNode && (
          <div ref={sidebarRef} className="w-[450px] border-l border-border bg-card p-6 overflow-y-auto">
            <div className="space-y-6">
              {}
              <div>
                <h3 className="text-xl font-medium mb-2">{selectedNode.name}</h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{selectedNode.samples} samples</span>
                  <span>•</span>
                  <span>Gini: {selectedNode.giniScore.toFixed(3)}</span>
                  {selectedNode.threshold !== undefined && (
                    <>
                      <span>•</span>
                      <span>τ = {selectedNode.threshold}</span>
                    </>
                  )}
                </div>
              </div>

              {}
              {detailLevel === 'macro' && (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <h4 className="font-medium mb-2">Feature Type</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedNode.name.includes('content') ? 'Composition Window' :
                           selectedNode.name.includes('pos_') ? 'Position Check' :
                           selectedNode.name.includes('energy') ? 'Physics/Epigenetics' :
                           'Motif Detection'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {}
              {detailLevel === 'intermediate' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Node Description</h4>
                    <ExpandableText text={selectedNode.description} />
                  </div>

                  <div className="p-4 bg-accent/50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium mb-2">Node Rationale</h4>
                        <ExpandableText text={selectedNode.rationale} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {}
              {detailLevel === 'micro' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Node Description</h4>
                    <ExpandableText text={selectedNode.description} />
                  </div>

                  <div className="p-4 bg-accent/50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium mb-2">Node Rationale</h4>
                        <ExpandableText text={selectedNode.rationale} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <Code className="w-5 h-5 text-muted-foreground" />
                      <h4 className="font-medium">Python Implementation</h4>
                    </div>
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                      <code>{selectedNode.code}</code>
                    </pre>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Gini Score</div>
                      <div className="text-lg font-medium">{selectedNode.giniScore.toFixed(3)}</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Samples</div>
                      <div className="text-lg font-medium">{selectedNode.samples}</div>
                    </div>
                  </div>
                </div>
              )}

              {}
              {selectedNode.prediction !== undefined && (
                <div className="p-4 bg-primary/10 rounded-lg">
                  <h4 className="font-medium mb-2">Leaf Prediction</h4>
                  <div className="text-2xl font-medium">
                    {(selectedNode.prediction * 100).toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Probability of {class1}
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
