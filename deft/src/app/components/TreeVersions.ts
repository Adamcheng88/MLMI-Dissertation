import { FeatureNode } from './TreeData';
import { polIIPausingTree, enhancedPausingTree } from './TreeData';

export interface TreeVersion {
  id: string;
  name: string;
  tree: FeatureNode;
  createdAt: Date;
}


const polIIPausingTreeV2: FeatureNode = {
  id: 'root',
  name: 'upstream_G_content_20_49',
  description: 'Calculate the proportion of guanine (G) nucleotides in the upstream region from positions 20 to 49',
  rationale: 'GC-rich regions often indicate regulatory elements and can influence polymerase pausing stability',
  code: `def upstream_G_content_20_49(X):
  return X['raw_sequence'].apply(
    lambda seq: seq[20:50].count('G') / 30
  )`,
  threshold: 0.28,
  giniScore: 0.185,
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
    splitCriteria: '<= 0.28',
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
      prediction: 0.08,
      splitCriteria: '<= 0.5'
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
      prediction: 0.86,
      splitCriteria: '> 0.5'
    }
  },
  right: {
    id: 'right_1',
    name: 'downstream_C_content',
    description: 'Check cytosine content in downstream region',
    rationale: 'Cytosine-rich downstream regions affect pause duration and stability',
    code: `def downstream_C_content(X):
  return X['raw_sequence'].apply(
    lambda seq: seq[51:80].count('C') / 29
  )`,
    threshold: 0.35,
    giniScore: 0.092,
    samples: 2356,
    splitCriteria: '> 0.28',
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
      prediction: 0.62,
      splitCriteria: '<= 0.35'
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
      prediction: 0.95,
      splitCriteria: '> 0.35'
    }
  }
};


const enhancedPausingTreeV2: FeatureNode = {
  id: 'root',
  name: 'G_TC_at_50_51',
  description: 'Check if position 50 is G and position 51 is T or C',
  rationale: 'G followed by T/C at the pause site is a strong indicator of RNA polymerase pausing events',
  code: `def G_TC_at_50_51(X):
  return X['raw_sequence'].apply(
    lambda seq: 1 if seq[50] == 'G' and seq[51] in ['T', 'C'] else 0
  )`,
  threshold: 0.5,
  giniScore: 0.142,
  samples: 100000,
  left: {
    id: 'left_branch',
    name: 'Gs_in_0_49_and_50G_51CT',
    description: 'Count G nucleotides in positions 0-49 when position 50 is G and 51 is C or T',
    rationale: 'Upstream G density combined with specific pause site nucleotides affects pausing probability',
    code: `def Gs_in_0_49_and_50G_51CT(X):
  return X['raw_sequence'].apply(
    lambda seq: seq[0:50].count('G') if seq[50] == 'G' and seq[51] in ['C', 'T'] else 0
  )`,
    threshold: 7.5,
    giniScore: 0.089,
    samples: 8250,
    splitCriteria: '<= 0.5',
    left: {
      id: 'left_left',
      name: 'Gs_in_0_49',
      description: 'Count total G nucleotides in positions 0-49',
      rationale: 'Overall G content in upstream region influences DNA stability and polymerase dynamics',
      code: `def Gs_in_0_49(X):
  return X['raw_sequence'].apply(
    lambda seq: seq[0:50].count('G')
  )`,
      threshold: 14.5,
      giniScore: 0.045,
      samples: 6550,
      splitCriteria: '<= 7.5',
      left: {
        id: 'left_left_left',
        name: 'leaf_2_2',
        description: 'Leaf node prediction - Low pause probability',
        rationale: 'Terminal classification based on feature path',
        code: '',
        threshold: 0,
        giniScore: 0,
        samples: 4200,
        prediction: 0.019,
        splitCriteria: '<= 14.5'
      },
      right: {
        id: 'left_left_right',
        name: 'pos_51_is_pyrimidine',
        description: 'Check if position 51 is a pyrimidine (C or T)',
        rationale: 'Pyrimidine at +1 position is associated with stronger pause signals',
        code: `def pos_51_is_pyrimidine(X):
  return X['raw_sequence'].apply(
    lambda seq: 1 if seq[51] in ['C', 'T'] else 0
  )`,
        threshold: 0.5,
        giniScore: 0.018,
        samples: 2350,
        splitCriteria: '> 14.5',
        left: {
          id: 'left_left_right_left',
          name: 'leaf_12_3',
          description: 'Leaf node prediction - Low-medium pause probability',
          rationale: 'Terminal classification based on feature path',
          code: '',
          threshold: 0,
          giniScore: 0,
          samples: 950,
          prediction: 0.123,
          splitCriteria: '<= 0.5'
        },
        right: {
          id: 'left_left_right_right',
          name: 'leaf_32_1',
          description: 'Leaf node prediction - Medium pause probability',
          rationale: 'Terminal classification based on feature path',
          code: '',
          threshold: 0,
          giniScore: 0,
          samples: 1400,
          prediction: 0.358,
          splitCriteria: '> 0.5'
        }
      }
    },
    right: {
      id: 'left_right',
      name: 'ATs_in_20_49',
      description: 'Count A and T nucleotides in positions 20-49',
      rationale: 'AT-rich regions in the upstream area correlate with reduced polymerase processivity',
      code: `def ATs_in_20_49(X):
  return X['raw_sequence'].apply(
    lambda seq: seq[20:50].count('A') + seq[20:50].count('T')
  )`,
      threshold: 17.5,
      giniScore: 0.067,
      samples: 1700,
      prediction: 0.214,
      splitCriteria: '> 7.5'
    }
  },
  right: {
    id: 'right_branch',
    name: 'ATs_in_20_49_v2',
    description: 'Count A and T nucleotides in positions 20-49',
    rationale: 'AT content in mid-upstream region affects DNA bendability and pause formation',
    code: `def ATs_in_20_49_v2(X):
  return X['raw_sequence'].apply(
    lambda seq: seq[20:50].count('A') + seq[20:50].count('T')
  )`,
    threshold: 17.5,
    giniScore: 0.098,
    samples: 91750,
    splitCriteria: '> 0.5',
    left: {
      id: 'right_left',
      name: 'Gs_minus_AT_dinucleotides',
      description: 'Count Gs in 0-49 minus count of AT dinucleotides in full sequence',
      rationale: 'Balance between G content and AT dinucleotide frequency indicates structural complexity',
      code: `def Gs_minus_AT_dinucleotides(X):
  def calc(seq):
    g_count = seq[0:50].count('G')
    at_dinuc = sum(1 for i in range(len(seq)-1) if seq[i:i+2] == 'AT')
    return g_count - at_dinuc
  return X['raw_sequence'].apply(calc)`,
      threshold: 9.5,
      giniScore: 0.056,
      samples: 84500,
      splitCriteria: '<= 17.5',
      left: {
        id: 'right_left_left',
        name: 'leaf_23_8',
        description: 'Leaf node prediction - Low-medium pause probability',
        rationale: 'Terminal classification based on feature path',
        code: '',
        threshold: 0,
        giniScore: 0,
        samples: 52000,
        prediction: 0.238,
        splitCriteria: '<= 9.5'
      },
      right: {
        id: 'right_left_right',
        name: 'leaf_6_2',
        description: 'Leaf node prediction - Very low pause probability',
        rationale: 'Terminal classification based on feature path',
        code: '',
        threshold: 0,
        giniScore: 0,
        samples: 32500,
        prediction: 0.072,
        splitCriteria: '> 9.5'
      }
    },
    right: {
      id: 'right_right',
      name: 'CTs_in_39_48',
      description: 'Count C and T nucleotides in positions 39-48',
      rationale: 'Pyrimidine content immediately upstream of pause site influences local DNA structure',
      code: `def CTs_in_39_48(X):
  return X['raw_sequence'].apply(
    lambda seq: seq[39:49].count('C') + seq[39:49].count('T')
  )`,
      threshold: 6.5,
      giniScore: 0.034,
      samples: 7250,
      splitCriteria: '> 17.5',
      left: {
        id: 'right_right_left',
        name: 'leaf_17_3',
        description: 'Leaf node prediction - Low-medium pause probability',
        rationale: 'Terminal classification based on feature path',
        code: '',
        threshold: 0,
        giniScore: 0,
        samples: 4100,
        prediction: 0.173,
        splitCriteria: '<= 6.5'
      },
      right: {
        id: 'right_right_right',
        name: 'leaf_61_4',
        description: 'Leaf node prediction - High pause probability',
        rationale: 'Terminal classification based on feature path',
        code: '',
        threshold: 0,
        giniScore: 0,
        samples: 3150,
        prediction: 0.614,
        splitCriteria: '> 6.5'
      }
    }
  }
};

export const treeVersions: Record<string, TreeVersion[]> = {
  'pol-ii': [
    {
      id: 'pol-ii-v1',
      name: 'Version 1',
      tree: polIIPausingTree,
      createdAt: new Date('2026-05-20')
    },
    {
      id: 'pol-ii-v2',
      name: 'Version 2',
      tree: polIIPausingTreeV2,
      createdAt: new Date('2026-05-28')
    }
  ],
  'enhanced': [
    {
      id: 'enhanced-v1',
      name: 'Version 1',
      tree: enhancedPausingTree,
      createdAt: new Date('2026-05-20')
    },
    {
      id: 'enhanced-v2',
      name: 'Version 2',
      tree: enhancedPausingTreeV2,
      createdAt: new Date('2026-05-28')
    }
  ]
};
