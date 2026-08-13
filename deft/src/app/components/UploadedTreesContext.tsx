import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { FeatureNode } from './TreeData';
import { useParticipant } from '../contexts/ParticipantContext';

export interface UploadedTree {
  id: string;
  name: string;
  description: string;
  tree: FeatureNode;
  meta: Record<string, unknown>;
}

interface UploadedTreesContextValue {
  trees: UploadedTree[];
  addTree: (tree: UploadedTree) => void;
  removeTree: (id: string) => void;
  getTree: (id: string) => UploadedTree | undefined;
}

const UploadedTreesContext = createContext<UploadedTreesContextValue>({
  trees: [],
  addTree: () => {},
  removeTree: () => {},
  getTree: () => undefined,
});

export function UploadedTreesProvider({ children }: { children: ReactNode }) {
  const { participantId, hydrated, serverState, saveState, logEvent } = useParticipant();
  const [trees, setTrees] = useState<UploadedTree[]>([]);

  const hydratedForRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!hydrated) return;
    if (hydratedForRef.current === participantId) return;
    hydratedForRef.current = participantId;
    setTrees((serverState.uploadedTrees as UploadedTree[]) ?? []);
  }, [hydrated, participantId, serverState]);

  const addTree = useCallback(
    (tree: UploadedTree) => {
      setTrees(prev => {
        const next = [...prev, tree];
        saveState({ uploadedTrees: next });
        return next;
      });
      logEvent('tree_upload', { id: tree.id, name: tree.name, meta: tree.meta });
    },
    [saveState, logEvent]
  );

  const removeTree = useCallback(
    (id: string) => {
      setTrees(prev => {
        const next = prev.filter(t => t.id !== id);
        saveState({ uploadedTrees: next });
        return next;
      });
      logEvent('tree_remove', { id });
    },
    [saveState, logEvent]
  );

  const getTree = useCallback((id: string) => trees.find(t => t.id === id), [trees]);

  return (
    <UploadedTreesContext.Provider value={{ trees, addTree, removeTree, getTree }}>
      {children}
    </UploadedTreesContext.Provider>
  );
}

export function useUploadedTrees() {
  return useContext(UploadedTreesContext);
}
