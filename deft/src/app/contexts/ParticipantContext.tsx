import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  api,
  beaconEvents,
  type ParticipantState,
  type StudyEvent,
  type StudyInterface,
  type StudyCondition,
  type StudyStep,
  type TaskResponse,
  type SurveyPayload,
} from '../api/client';

const STORAGE_KEY = 'deft.participantId';

function emptyState(): ParticipantState {
  return {
    advice: [],
    submittedAdvice: [],
    versionNames: {},
    uploadedTrees: [],
    chatConversations: [],
    uiPreferences: {},
  };
}

interface ParticipantContextValue {
  participantId: string | null;
  hydrated: boolean;
  serverState: ParticipantState;
  condition: StudyCondition | null;
  currentInterface: StudyInterface | null;
  currentStep: StudyStep;
  questionOrder: string[];
  createParticipant: (metadata?: { prolificPid?: string }) => Promise<string>;
  setReturningParticipant: (id: string) => Promise<void>;
  clearParticipant: () => void;
  advanceStep: (step: StudyStep, data?: Record<string, unknown>) => Promise<void>;
  startSession: () => Promise<void>;
  saveTaskResponses: (responses: TaskResponse[]) => Promise<void>;
  submitSurveys: (payload: SurveyPayload) => Promise<{ susScore: number | null }>;
  completeSession: () => Promise<void>;
  saveState: (partial: Partial<ParticipantState>) => void;
  logEvent: (type: string, payload?: unknown) => string | null;
  amendEvent: (clientId: string, payloadPatch: Record<string, unknown>) => boolean;
}




interface BufferedEvent extends StudyEvent {
  _clientId: string;
}

function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function stripClientIds(events: BufferedEvent[]): StudyEvent[] {
  return events.map(({ _clientId, ...rest }) => rest);
}

const ParticipantContext = createContext<ParticipantContextValue | undefined>(undefined);

export function ParticipantProvider({ children }: { children: ReactNode }) {
  const [participantId, setParticipantId] = useState<string | null>(
    () => sessionStorage.getItem(STORAGE_KEY)
  );
  const [serverState, setServerState] = useState<ParticipantState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [condition, setCondition] = useState<StudyCondition | null>(null);
  const [currentStep, setCurrentStep] = useState<StudyStep>('instructions');
  const [questionOrder, setQuestionOrder] = useState<string[]>([]);


  const pendingStateRef = useRef<Partial<ParticipantState>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventBufferRef = useRef<BufferedEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const participantIdRef = useRef<string | null>(participantId);
  participantIdRef.current = participantId;
  const conditionRef = useRef<StudyCondition | null>(condition);
  conditionRef.current = condition;

  const currentInterface: StudyInterface | null = condition;


  useEffect(() => {
    let cancelled = false;
    if (!participantId) {
      setServerState(emptyState());
      setCondition(null);
      setCurrentStep('instructions');
      setQuestionOrder([]);
      setHydrated(true);
      return;
    }
    setHydrated(false);
    api
      .getParticipant(participantId)
      .then(record => {
        if (cancelled) return;
        setServerState(record.state);
        setCondition(record.condition ?? null);
        setCurrentStep(record.currentStep ?? 'instructions');
        setQuestionOrder(record.questionOrder ?? []);
        setHydrated(true);
      })
      .catch(() => {
        if (cancelled) return;

        sessionStorage.removeItem(STORAGE_KEY);
        setParticipantId(null);
        setServerState(emptyState());
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [participantId]);

  const flushEvents = useCallback(() => {
    const id = participantIdRef.current;
    if (!id || eventBufferRef.current.length === 0) return;
    const batch = eventBufferRef.current;
    eventBufferRef.current = [];
    api.logEvents(id, stripClientIds(batch)).catch(() => {
      eventBufferRef.current = [...batch, ...eventBufferRef.current];
    });
  }, []);

  useEffect(() => {
    flushTimerRef.current = setInterval(flushEvents, 5000);
    const onUnload = () => {
      const id = participantIdRef.current;
      if (id && eventBufferRef.current.length) {
        beaconEvents(id, stripClientIds(eventBufferRef.current));
        eventBufferRef.current = [];
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [flushEvents]);

  const flushState = useCallback(() => {
    const id = participantIdRef.current;
    if (!id) return;
    const partial = pendingStateRef.current;
    if (Object.keys(partial).length === 0) return;
    pendingStateRef.current = {};
    api.saveState(id, partial).catch(() => {
      pendingStateRef.current = { ...partial, ...pendingStateRef.current };
    });
  }, []);

  const saveState = useCallback(
    (partial: Partial<ParticipantState>) => {
      if (!participantIdRef.current) return;
      pendingStateRef.current = { ...pendingStateRef.current, ...partial };
      setServerState(prev => ({ ...prev, ...partial }));
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(flushState, 1500);
    },
    [flushState]
  );

  const logEvent = useCallback((type: string, payload?: unknown): string | null => {
    if (!participantIdRef.current) return null;
    const ctx = { condition: conditionRef.current };
    const merged =
      payload && typeof payload === 'object'
        ? { ...ctx, ...(payload as Record<string, unknown>) }
        : payload === undefined
        ? ctx
        : { ...ctx, value: payload };
    const clientId = newClientId();
    eventBufferRef.current.push({
      _clientId: clientId,
      type,
      payload: merged,
      timestamp: new Date().toISOString(),
    });
    return clientId;
  }, []);



  const amendEvent = useCallback((clientId: string, payloadPatch: Record<string, unknown>): boolean => {
    const target = eventBufferRef.current.find(e => e._clientId === clientId);
    if (!target) return false;
    target.payload = { ...(target.payload as Record<string, unknown>), ...payloadPatch };
    return true;
  }, []);

  const createParticipant = useCallback(async (metadata?: { prolificPid?: string }) => {
    const summary = await api.createParticipant(metadata);
    sessionStorage.setItem(STORAGE_KEY, summary.id);
    setParticipantId(summary.id);
    setCondition(summary.condition ?? null);
    setQuestionOrder(summary.questionOrder ?? []);
    setCurrentStep(summary.currentStep ?? 'instructions');
    return summary.id;
  }, []);

  const setReturningParticipant = useCallback(async (id: string) => {
    const record = await api.getParticipant(id);
    sessionStorage.setItem(STORAGE_KEY, id);
    setParticipantId(id);
    setCondition(record.condition ?? null);
    setQuestionOrder(record.questionOrder ?? []);
    setCurrentStep(record.currentStep ?? 'instructions');
  }, []);

  const clearParticipant = useCallback(() => {
    flushEvents();
    flushState();
    sessionStorage.removeItem(STORAGE_KEY);
    setParticipantId(null);
    setServerState(emptyState());
    setCondition(null);
    setCurrentStep('instructions');
    setQuestionOrder([]);
  }, [flushEvents, flushState]);

  const advanceStep = useCallback(async (step: StudyStep, data?: Record<string, unknown>) => {
    const id = participantIdRef.current;
    if (!id) return;
    const res = await api.advanceProgress(id, step, data);
    setCurrentStep(res.currentStep);
  }, []);

  const startSession = useCallback(async () => {
    const id = participantIdRef.current;
    if (!id) return;
    await api.startSession(id);
    logEvent('session_start');
  }, [logEvent]);

  const saveTaskResponses = useCallback(async (responses: TaskResponse[]) => {
    const id = participantIdRef.current;
    if (!id) return;
    await api.saveTaskResponses(id, responses);
  }, []);

  const submitSurveys = useCallback(
    async (payload: SurveyPayload) => {
      const id = participantIdRef.current;
      if (!id) return { susScore: null };
      logEvent('surveys_submit');
      flushEvents();
      flushState();
      const res = await api.submitSurveys(id, payload);
      setCurrentStep('complete');
      return { susScore: res.susScore };
    },
    [logEvent, flushEvents, flushState]
  );

  const completeSession = useCallback(async () => {
    const id = participantIdRef.current;
    if (!id) return;
    logEvent('session_withdraw');
    flushEvents();
    flushState();
    await api.completeSession(id);
    setCurrentStep('complete');
  }, [logEvent, flushEvents, flushState]);

  return (
    <ParticipantContext.Provider
      value={{
        participantId,
        hydrated,
        serverState,
        condition,
        currentInterface,
        currentStep,
        questionOrder,
        createParticipant,
        setReturningParticipant,
        clearParticipant,
        advanceStep,
        startSession,
        saveTaskResponses,
        submitSurveys,
        completeSession,
        saveState,
        logEvent,
        amendEvent,
      }}
    >
      {children}
    </ParticipantContext.Provider>
  );
}

export function useParticipant() {
  const ctx = useContext(ParticipantContext);
  if (!ctx) throw new Error('useParticipant must be used within ParticipantProvider');
  return ctx;
}
