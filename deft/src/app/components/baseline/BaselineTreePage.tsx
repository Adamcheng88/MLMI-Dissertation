import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import BaselineTreeView from './BaselineTreeView';
import TaskControls from '../study/TaskControls';
import { api } from '../../api/client';
import { convertJsonToFeatureNode, buildTreeTitle, type TreeJson } from '../jsonTreeConverter';
import { FeatureNode } from '../TreeData';
import { useParticipant } from '../../contexts/ParticipantContext';

export default function BaselineTreePage() {
  const { participantId, startSession, logEvent } = useParticipant();
  const [tree, setTree] = useState<FeatureNode | null>(null);
  const [title, setTitle] = useState('Decision Tree');
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getStudyTree()
      .then(json => {
        if (cancelled) return;
        const tj = json as TreeJson;
        setTree(convertJsonToFeatureNode(tj));
        setTitle(buildTreeTitle(tj.meta || {}, 'Decision Tree'));
      })
      .catch(() => {
        if (!cancelled)
          setError('The study tree could not be loaded. Please contact the study administrator.');
      });
    return () => {
      cancelled = true;
    };
  }, [participantId]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startSession().catch(() => {});
    logEvent('page_view', { page: 'task' });
  }, [startSession, logEvent]);

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

  return <BaselineTreeView tree={tree} title={title} headerExtras={<TaskControls />} />;
}
