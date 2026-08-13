



export interface LiteratureItem {
  id: string;
  title: string;
  authors: string;
  year: number;
  url: string;
  relevance: string;
}

const PAPER_POOL: Omit<LiteratureItem, 'id' | 'relevance'>[] = [
  {
    title: 'Nascent RNA sequencing reveals widespread pausing and divergent initiation at human promoters',
    authors: 'Core LJ, Waterfall JJ, Lis JT',
    year: 2008,
    url: 'https://doi.org/10.1126/science.1162228',
  },
  {
    title: 'RNA polymerase is poised for activation across the genome',
    authors: 'Muse GW, Gilchrist DA, Nechaev S, et al.',
    year: 2007,
    url: 'https://doi.org/10.1038/ng.2007.21',
  },
  {
    title: 'Promoter-proximal pausing of RNA polymerase II: emerging roles in metazoans',
    authors: 'Adelman K, Lis JT',
    year: 2012,
    url: 'https://doi.org/10.1038/nrg3293',
  },
  {
    title: 'A unifying model for the selective regulation of inducible transcription by CpG islands and nucleosome remodeling',
    authors: 'Ramirez-Carrozzi VR, Braas D, Bhatt DM, et al.',
    year: 2009,
    url: 'https://doi.org/10.1016/j.cell.2009.04.020',
  },
  {
    title: 'Nucleosome-mediated cooperativity between transcription factors',
    authors: 'Mirny LA',
    year: 2010,
    url: 'https://doi.org/10.1073/pnas.0913805107',
  },
  {
    title: 'GC-rich sequence elements recruit PRC2 in mammalian ES cells',
    authors: 'Mendenhall EM, Koche RP, Truong T, et al.',
    year: 2010,
    url: 'https://doi.org/10.1371/journal.pgen.1001244',
  },
  {
    title: 'DNA sequence-dependent deformability deduced from protein–DNA crystal complexes',
    authors: 'Olson WK, Gorin AA, Lu XJ, Hock LM, Zhurkin VB',
    year: 1998,
    url: 'https://doi.org/10.1073/pnas.95.19.11163',
  },
  {
    title: 'Effects of DNA sequence and histone–histone interactions on in vitro assembly of nucleosomes',
    authors: 'Thåström A, Lowary PT, Widlund HR, et al.',
    year: 1999,
    url: 'https://doi.org/10.1006/jmbi.1999.2996',
  },
];


const LITERATURE_BY_NODE_ID: Record<string, LiteratureItem[]> = {
  root: [
    {
      id: 'root-1',
      ...PAPER_POOL[0],
      relevance:
        'Supports focusing on the pause-site / +1 dinucleotide as a local predictor of pausing. The model cited lines noting that "Pol II frequently stalls immediately downstream of the transcription start site" (p. 1612, col. 2) when choosing this split.',
    },
    {
      id: 'root-2',
      ...PAPER_POOL[1],
      relevance:
        'Used to justify treating the pause→+1 transition as biologically meaningful. Relevant passage: "genome-wide mapping reveals polymerase enrichment a short distance downstream of promoters" (Fig. 1 legend / p. 812).',
    },
    {
      id: 'root-3',
      ...PAPER_POOL[2],
      relevance:
        'Background for promoter-proximal pausing as a regulatory step. The agent referenced "pausing provides a checkpoint after initiation" (p. 321) when arguing that a purine→pyrimidine check at this locus is mechanistically motivated.',
    },
  ],
  rootL: [
    {
      id: 'rootL-1',
      ...PAPER_POOL[3],
      relevance:
        'Links GC-rich upstream tracts to chromatin state and inducible expression. Cited: "CpG islands and GC content modulate nucleosome occupancy near the TSS" (p. 548–549).',
    },
    {
      id: 'rootL-2',
      ...PAPER_POOL[5],
      relevance:
        'Reinforces that local GC enrichment can mark regulatory DNA. The model highlighted "GC-rich DNA is sufficient to recruit PRC2 in ES cells" (abstract / p. 1) as analogous support for an upstream GC-rich window.',
    },
  ],
  rootR: [
    {
      id: 'rootR-1',
      ...PAPER_POOL[4],
      relevance:
        'Motivates counting GC content in a short upstream window. Passage used: "sequence composition near the promoter alters transcription-factor cooperativity on nucleosomal DNA" (p. 14690).',
    },
  ],
  rootLL: [
    {
      id: 'rootLL-1',
      ...PAPER_POOL[0],
      relevance:
        'Supports checking identity at the +1 position (here, T). The agent pointed to "pausing is enriched when the downstream base favors a particular sequence context" (p. 1613).',
    },
    {
      id: 'rootLL-2',
      ...PAPER_POOL[6],
      relevance:
        'Structural rationale for a single-nucleotide identity check. Cited lines discuss "base-step parameters that influence helix deformability at the start of elongation" (Table 1 / p. 11165).',
    },
  ],
  rootLR: [
    {
      id: 'rootLR-1',
      ...PAPER_POOL[7],
      relevance:
        'Used when arguing that the base immediately upstream of the pause site matters. Relevant text: "sequence preferences for nucleosome positioning concentrate within a few base pairs of the dyad" (p. 891)—treated as analogy for local sequence checks.',
    },
  ],
  rootRL: [
    {
      id: 'rootRL-1',
      ...PAPER_POOL[1],
      relevance:
        'Supports testing whether the pause site itself is G. Cited: "paused polymerases show characteristic sequence signatures at the pause position" (Results, p. 813).',
    },
    {
      id: 'rootRL-2',
      ...PAPER_POOL[2],
      relevance:
        'Frames G at the pause site as a candidate kinetic determinant. Passage: "the identity of nucleotides at the active site can affect dwell time" (Box 1, p. 323).',
    },
    {
      id: 'rootRL-3',
      ...PAPER_POOL[6],
      relevance:
        'Provides biophysical context for G-rich contacts. The model referenced "purine–pyrimidine steps differ in stacking energy and flexibility" (p. 11164) when preferring this feature over composition windows.',
    },
  ],
  rootLLL: [
    {
      id: 'rootLLL-1',
      ...PAPER_POOL[3],
      relevance:
        'Justifies a short central GC-rich window spanning −3 to +1. Cited: "GC content in the immediate TSS vicinity correlates with promoter architecture" (p. 550).',
    },
  ],
  rootRRL: [
    {
      id: 'rootRRL-1',
      ...PAPER_POOL[0],
      relevance:
        'Supports inspecting bases a few positions upstream of the pause. Relevant line: "sequence determinants of pausing extend a short distance upstream of the stall site" (Discussion, p. 1615).',
    },
    {
      id: 'rootRRL-2',
      ...PAPER_POOL[7],
      relevance:
        'Used as secondary context for a single-base identity feature (pos 48 = T). Cited assembly/sequence preference discussion on p. 889–890.',
    },
  ],
  rootLLLL: [
    {
      id: 'rootLLLL-1',
      ...PAPER_POOL[5],
      relevance:
        'Supports a G-enrichment window just upstream of the pause. The agent cited "GC-rich elements are sufficient to mark regulatory regions" (p. 2) when ranking this feature.',
    },
  ],
  rootRRLL: [
    {
      id: 'rootRRLL-1',
      ...PAPER_POOL[4],
      relevance:
        'Motivates a farther downstream GC-count window (+20 to +30). Passage used: "cooperativity depends on sequence composition over a longer footprint than a single motif" (p. 14692).',
    },
    {
      id: 'rootRRLL-2',
      ...PAPER_POOL[2],
      relevance:
        'Secondary support that features beyond the immediate pause site can still matter for elongation. Cited summary on distal sequence effects (p. 325).',
    },
  ],
};


export function getLiteratureForNode(nodeId: string): LiteratureItem[] {
  return LITERATURE_BY_NODE_ID[nodeId] ?? [];
}
