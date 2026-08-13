import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { GripVertical, Minus, ClipboardList, Loader2, ArrowRight, Send } from 'lucide-react';
import { api, type StudyQuestion, type TaskResponse } from '../../api/client';
import { useParticipant } from '../../contexts/ParticipantContext';

interface PanelGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
}

const MIN_WIDTH = 300;
const MIN_HEIGHT = 260;

function defaultGeometry(): PanelGeometry {
  const width = 380;
  const height = 460;
  const x = typeof window !== 'undefined' ? Math.max(16, window.innerWidth - width - 24) : 24;
  const y = 88;
  return { x, y, width, height, minimized: false };
}

export default function TaskQuestionPanel() {
  const navigate = useNavigate();
  const { questionOrder, serverState, saveState, saveTaskResponses, advanceStep, logEvent } =
    useParticipant();

  const [questions, setQuestions] = useState<StudyQuestion[] | null>(null);
  const [geometry, setGeometry] = useState<PanelGeometry>(defaultGeometry);
  const geometryHydrated = useRef(false);


  const orderedQuestions = useMemo(() => {
    if (!questions) return [];
    const byId = new Map(questions.map(q => [q.id, q]));
    const ordered = questionOrder.map(id => byId.get(id)).filter((q): q is StudyQuestion => !!q);

    const seen = new Set(ordered.map(q => q.id));
    for (const q of questions) if (!seen.has(q.id)) ordered.push(q);
    return ordered;
  }, [questions, questionOrder]);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<TaskResponse[]>([]);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const questionStartRef = useRef<string>(new Date().toISOString());


  useEffect(() => {
    api
      .getQuestions()
      .then(setQuestions)
      .catch(() => setQuestions([]));
  }, []);


  useEffect(() => {
    if (geometryHydrated.current) return;
    const prefs = serverState.uiPreferences || {};
    const panel = prefs.taskPanel as PanelGeometry | undefined;
    if (panel && typeof panel.x === 'number') {
      setGeometry({ ...defaultGeometry(), ...panel });
    }
    const savedAnswers = prefs.taskAnswers as TaskResponse[] | undefined;
    const savedIndex = prefs.taskIndex as number | undefined;
    if (Array.isArray(savedAnswers)) setAnswers(savedAnswers);
    if (typeof savedIndex === 'number') setIndex(savedIndex);
    geometryHydrated.current = true;
  }, [serverState.uiPreferences]);


  useEffect(() => {
    questionStartRef.current = new Date().toISOString();
    setDraft('');
  }, [index]);

  const persistPrefs = useCallback(
    (patch: Record<string, unknown>) => {
      const prefs = { ...(serverState.uiPreferences || {}), ...patch };
      saveState({ uiPreferences: prefs });
    },
    [serverState.uiPreferences, saveState]
  );


  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  const onDragPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: geometry.x, origY: geometry.y };
  };
  const onDragPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    const maxX = window.innerWidth - 80;
    const maxY = window.innerHeight - 60;
    setGeometry(g => ({
      ...g,
      x: Math.min(maxX, Math.max(0, dragState.current!.origX + dx)),
      y: Math.min(maxY, Math.max(0, dragState.current!.origY + dy)),
    }));
  };
  const onDragPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragState.current = null;
    setGeometry(g => {
      persistPrefs({ taskPanel: g });
      return g;
    });
  };


  const resizeState = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(
    null
  );
  const onResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: geometry.width,
      origH: geometry.height,
    };
  };
  const onResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeState.current) return;
    const dw = e.clientX - resizeState.current.startX;
    const dh = e.clientY - resizeState.current.startY;
    setGeometry(g => ({
      ...g,
      width: Math.max(MIN_WIDTH, resizeState.current!.origW + dw),
      height: Math.max(MIN_HEIGHT, resizeState.current!.origH + dh),
    }));
  };
  const onResizePointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    resizeState.current = null;
    setGeometry(g => {
      persistPrefs({ taskPanel: g });
      return g;
    });
  };

  const setMinimized = (minimized: boolean) => {
    setGeometry(g => {
      const next = { ...g, minimized };
      persistPrefs({ taskPanel: next });
      return next;
    });
  };

  const total = orderedQuestions.length;
  const current = orderedQuestions[index];
  const isLast = index >= total - 1;
  const answered = draft.trim().length > 0;

  const recordCurrent = useCallback((): TaskResponse[] => {
    const now = new Date().toISOString();
    const response: TaskResponse = {
      questionId: current.id,
      answer: draft.trim(),
      displayIndex: index,
      startedAt: questionStartRef.current,
      completedAt: now,
      durationMs: new Date(now).getTime() - new Date(questionStartRef.current).getTime(),
    };
    return [...answers, response];
  }, [answers, current, draft, index]);

  const handleNext = () => {
    if (!answered || !current) return;
    const updated = recordCurrent();
    setAnswers(updated);
    const nextIndex = index + 1;
    setIndex(nextIndex);
    logEvent('task_question_answered', { questionId: current.id, displayIndex: index });
    persistPrefs({ taskAnswers: updated, taskIndex: nextIndex });
  };

  const handleSubmit = async () => {
    if (!answered || !current) return;
    setSubmitting(true);
    const updated = recordCurrent();
    setAnswers(updated);
    try {
      await saveTaskResponses(updated);
      logEvent('task_questions_complete', { count: updated.length });
      await advanceStep('surveys');
      navigate('/surveys');
    } catch {
      setSubmitting(false);
    }
  };


  const handleSkipToSurveys = async () => {
    setSubmitting(true);
    try {
      await saveTaskResponses([]);
      await advanceStep('surveys');
      navigate('/surveys');
    } catch {
      setSubmitting(false);
    }
  };

  if (geometry.minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 50 }}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-full shadow-lg text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <ClipboardList className="w-4 h-4" />
        Questions {total > 0 && `(${Math.min(index + 1, total)}/${total})`}
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
        zIndex: 50,
      }}
      className="flex flex-col bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
    >
      {}
      <div
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b border-border cursor-move select-none touch-none"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
          Task Questions
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.min(index + 1, total)} / {total}
            </span>
          )}
          <button
            onClick={() => setMinimized(true)}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Minimise"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {}
      <div className="flex-1 overflow-y-auto p-4">
        {questions == null ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : total === 0 ? (
          <div className="text-sm text-muted-foreground">
            There are no questions to answer for this task.
          </div>
        ) : !current ? (
          <div className="text-sm text-muted-foreground">All questions answered.</div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium leading-relaxed">{current.prompt}</p>
            {current.type === 'mcq' && current.options ? (
              <div className="space-y-2">
                {current.options.map(opt => (
                  <label
                    key={opt}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      draft === opt ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${current.id}`}
                      value={opt}
                      checked={draft === opt}
                      onChange={() => setDraft(opt)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={5}
                placeholder="Type your answer here…"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            )}
          </div>
        )}
      </div>

      {}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">You cannot return to previous questions.</span>
        {total === 0 ? (
          <button
            onClick={handleSkipToSurveys}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Continue
          </button>
        ) : isLast ? (
          <button
            onClick={handleSubmit}
            disabled={!answered || submitting}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={!answered}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {}
      <div
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize touch-none"
        style={{
          background:
            'linear-gradient(135deg, transparent 0 50%, var(--border, #d4d4d8) 50% 60%, transparent 60% 70%, var(--border, #d4d4d8) 70% 80%, transparent 80%)',
        }}
      />
    </div>
  );
}
