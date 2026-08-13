import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import BaselineTreeView from './BaselineTreeView';
import { api } from '../../api/client';
import { convertJsonToFeatureNode, buildTreeTitle, type TreeJson } from '../jsonTreeConverter';
import { FeatureNode } from '../TreeData';

export default function AdminBaselinePreview() {
  const [tree, setTree] = useState<FeatureNode | null>(null);
  const [title, setTitle] = useState('Decision Tree');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .adminGetTree()
      .then(json => {
        if (cancelled) return;
        const tj = json as TreeJson;
        setTree(convertJsonToFeatureNode(tj));
        setTitle(buildTreeTitle(tj.meta || {}, 'Decision Tree'));
      })
      .catch(() => {
        if (!cancelled) {
          setTree(null);
          setError('No study tree configured.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !tree) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6">
        <div className="flex items-center gap-3 px-5 py-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm max-w-md">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error || 'No tree available.'}
        </div>
      </div>
    );
  }

  return (
    <BaselineTreeView
      tree={tree}
      title={title}
      subtitle="Baseline interface preview"
      showBackButton
      backPath="/admin/settings"
    />
  );
}
