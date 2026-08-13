import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { FeatureNode } from './TreeData';
import { useParticipant } from '../contexts/ParticipantContext';

export interface AdviceItem {
  id: string;
  message: string;
  handoffSnippet?: string;
  contextNodes: FeatureNode[];
  timestamp: Date | string;
}

interface AdviceContextType {
  adviceItems: AdviceItem[];
  addAdvice: (message: string, contextNodes: FeatureNode[], handoffSnippet?: string) => void;
  removeAdvice: (id: string) => void;
  selectedAdviceIds: string[];
  setSelectedAdviceIds: (ids: string[]) => void;
  submittedAdvice: AdviceItem[];
  submitSelectedAdvice: () => void;
  removeSubmittedAdvice: (id: string) => void;
  versionNames: Record<string, string>;
  setVersionName: (versionId: string, name: string) => void;
}

const AdviceContext = createContext<AdviceContextType | undefined>(undefined);

export function AdviceProvider({ children }: { children: ReactNode }) {
  const { participantId, hydrated, serverState, saveState, logEvent } = useParticipant();

  const [adviceItems, setAdviceItems] = useState<AdviceItem[]>([]);
  const [selectedAdviceIds, setSelectedAdviceIds] = useState<string[]>([]);
  const [submittedAdvice, setSubmittedAdvice] = useState<AdviceItem[]>([]);
  const [versionNames, setVersionNames] = useState<Record<string, string>>({});


  const hydratedForRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!hydrated) return;
    if (hydratedForRef.current === participantId) return;
    hydratedForRef.current = participantId;
    setAdviceItems((serverState.advice as AdviceItem[]) ?? []);
    setSubmittedAdvice((serverState.submittedAdvice as AdviceItem[]) ?? []);
    setVersionNames((serverState.versionNames as Record<string, string>) ?? {});
    setSelectedAdviceIds([]);
  }, [hydrated, participantId, serverState]);

  const addAdvice = (message: string, contextNodes: FeatureNode[], handoffSnippet?: string) => {
    const newAdvice: AdviceItem = {
      id: Date.now().toString(),
      message,
      handoffSnippet,
      contextNodes,
      timestamp: new Date().toISOString(),
    };
    const next = [...adviceItems, newAdvice];
    setAdviceItems(next);
    saveState({ advice: next });
    logEvent('advice_add', { message, handoffSnippet, contextNodeIds: contextNodes.map(n => n.id) });
  };

  const removeAdvice = (id: string) => {
    const next = adviceItems.filter(item => item.id !== id);
    setAdviceItems(next);
    setSelectedAdviceIds(selectedAdviceIds.filter(selectedId => selectedId !== id));
    saveState({ advice: next });
    logEvent('advice_remove', { id });
  };

  const submitSelectedAdvice = () => {
    const selected = adviceItems.filter(item => selectedAdviceIds.includes(item.id));
    const nextSubmitted = [...submittedAdvice, ...selected];
    const nextAdvice = adviceItems.filter(item => !selectedAdviceIds.includes(item.id));
    setSubmittedAdvice(nextSubmitted);
    setAdviceItems(nextAdvice);
    setSelectedAdviceIds([]);
    saveState({ advice: nextAdvice, submittedAdvice: nextSubmitted });
    logEvent('advice_submit', { ids: selected.map(s => s.id) });
  };

  const removeSubmittedAdvice = (id: string) => {
    const next = submittedAdvice.filter(item => item.id !== id);
    setSubmittedAdvice(next);
    saveState({ submittedAdvice: next });
    logEvent('advice_submitted_remove', { id });
  };

  const setVersionName = (versionId: string, name: string) => {
    const next = { ...versionNames, [versionId]: name };
    setVersionNames(next);
    saveState({ versionNames: next });
    logEvent('version_rename', { versionId, name });
  };

  return (
    <AdviceContext.Provider
      value={{
        adviceItems,
        addAdvice,
        removeAdvice,
        selectedAdviceIds,
        setSelectedAdviceIds,
        submittedAdvice,
        submitSelectedAdvice,
        removeSubmittedAdvice,
        versionNames,
        setVersionName,
      }}
    >
      {children}
    </AdviceContext.Provider>
  );
}

export function useAdvice() {
  const context = useContext(AdviceContext);
  if (!context) {
    throw new Error('useAdvice must be used within AdviceProvider');
  }
  return context;
}
