





import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import ExpertTreeVisualization from './ExpertTreeVisualization';
import { api } from '../../api/client';
import { convertJsonToFeatureNode, buildTreeTitle, type TreeJson } from '../jsonTreeConverter';
import { FeatureNode } from '../TreeData';

export default function ExpertTreePage() {
  const [tree, setTree] = useState<FeatureNode | null>(null);
  const [treeMeta, setTreeMeta] = useState<TreeJson['meta'] | undefined>(undefined);
  const [title, setTitle] = useState('Expert Decision Tree');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getExpertTree()
      .then(json => {
        if (cancelled) return;
        const tj = json as TreeJson;
        setTree(convertJsonToFeatureNode(tj));
        setTreeMeta(tj.meta || {});
        setTitle(buildTreeTitle(tj.meta || {}, 'Expert Decision Tree'));
      })
      .catch(() => {
        if (!cancelled) setError('The expert tree could not be loaded. Upload one from the admin settings page.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="flex items-center gap-3 px-5 py-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm max-w-md">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading tree…
        </div>
      </div>
    );
  }

  return (
    <ExpertTreeVisualization
      tree={tree}
      title={title}
      subtitle=""
      treeKey="expert"
      showBackButton={false}
      reviewEditsPath="/expert/review-edits"
      treeMeta={treeMeta}
    />
  );
}
