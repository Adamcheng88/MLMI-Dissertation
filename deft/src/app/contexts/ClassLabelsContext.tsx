import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

export const DEFAULT_CLASS1_NAME = 'Class 1';
export const DEFAULT_CLASS2_NAME = 'Class 2';

const STORAGE_KEY = 'deft.classLabels';

export interface ClassLabels {
  class1: string;
  class2: string;
}

interface ClassLabelsContextValue extends ClassLabels {
  setClass1: (name: string) => void;
  setClass2: (name: string) => void;
  setClassLabels: (labels: Partial<ClassLabels>) => void;
  resetClassLabels: () => void;
}

const ClassLabelsContext = createContext<ClassLabelsContextValue | undefined>(undefined);

function normalize(name: string | undefined, fallback: string): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed || fallback;
}

function loadStored(): ClassLabels {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { class1: DEFAULT_CLASS1_NAME, class2: DEFAULT_CLASS2_NAME };
    const parsed = JSON.parse(raw) as Partial<ClassLabels>;
    return {
      class1: normalize(parsed.class1, DEFAULT_CLASS1_NAME),
      class2: normalize(parsed.class2, DEFAULT_CLASS2_NAME),
    };
  } catch {
    return { class1: DEFAULT_CLASS1_NAME, class2: DEFAULT_CLASS2_NAME };
  }
}

function persist(labels: ClassLabels) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
  } catch {

  }
}

export function ClassLabelsProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<ClassLabels>(loadStored);

  const setClassLabels = useCallback((partial: Partial<ClassLabels>) => {
    setLabels(prev => {
      const next = {
        class1: partial.class1 !== undefined ? normalize(partial.class1, DEFAULT_CLASS1_NAME) : prev.class1,
        class2: partial.class2 !== undefined ? normalize(partial.class2, DEFAULT_CLASS2_NAME) : prev.class2,
      };
      persist(next);
      return next;
    });
  }, []);

  const setClass1 = useCallback((name: string) => setClassLabels({ class1: name }), [setClassLabels]);
  const setClass2 = useCallback((name: string) => setClassLabels({ class2: name }), [setClassLabels]);
  const resetClassLabels = useCallback(() => {
    const next = { class1: DEFAULT_CLASS1_NAME, class2: DEFAULT_CLASS2_NAME };
    persist(next);
    setLabels(next);
  }, []);

  return (
    <ClassLabelsContext.Provider
      value={{
        class1: labels.class1,
        class2: labels.class2,
        setClass1,
        setClass2,
        setClassLabels,
        resetClassLabels,
      }}
    >
      {children}
    </ClassLabelsContext.Provider>
  );
}

export function useClassLabels() {
  const ctx = useContext(ClassLabelsContext);
  if (!ctx) throw new Error('useClassLabels must be used within ClassLabelsProvider');
  return ctx;
}
