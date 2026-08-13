


async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch {

    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type StudyInterface = 'real' | 'baseline';
export type StudyCondition = StudyInterface;

export type StudyStep =
  | 'instructions'
  | 'info_sheet'
  | 'consent'
  | 'demographics'
  | 'tutorial'
  | 'task'
  | 'surveys'
  | 'complete';

export interface PublicSettings {
  timeLimitMinutes: number;
  landingText: string;
  instructionsText: string;
  finishingText: string;
}

export interface StudyQuestion {
  id: string;
  prompt: string;
  type: 'mcq' | 'text';
  options: string[] | null;
}

export interface Assignment {
  condition: StudyCondition;
  questionOrder: string[];
}

export interface ParticipantSummary {
  id: string;
  createdAt: string;
  status: string;
  condition?: StudyCondition;
  questionOrder?: string[];
  currentStep?: StudyStep;
}

export interface ParticipantState {
  advice: unknown[];
  submittedAdvice: unknown[];
  versionNames: Record<string, string>;
  uploadedTrees: unknown[];
  chatConversations: unknown[];
  uiPreferences: Record<string, unknown>;
}

export interface ParticipantRecord {
  id: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  condition: StudyCondition;
  questionOrder: string[];
  currentStep: StudyStep;
  studyData: Record<string, unknown>;
  state: ParticipantState;
}

export interface ProgressInfo {
  currentStep: StudyStep;
  condition: StudyCondition;
  questionOrder: string[];
  status: string;
}

export interface RemainingTime {
  remainingSeconds: number;
  status: string;
  started: boolean;
  expired: boolean;
}

export interface TaskResponse {
  questionId: string;
  answer: string;
  displayIndex: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface SurveyPayload {
  nasaTlx: Record<string, number>;
  sus?: number[];
  attentionCheck?: number;
  qualitativeFeedback?: string;
}

export interface StudyEvent {
  type: string;
  payload?: unknown;
  timestamp?: string;
}

export interface ChatRequest {
  mode: 'ask' | 'advise';
  message: string;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  attachedNodes: unknown[];
  treeOverview?: string;
}

export interface ChatResponse {
  reply: string;
  handoffSnippet?: string;
}

export const api = {
  getSettings: () => request<PublicSettings>('/settings'),
  getStudyTree: () => request<unknown>('/study-tree'),
  getExpertTree: () => request<unknown>('/expert-tree'),
  getQuestions: () => request<StudyQuestion[]>('/questions'),

  createParticipant: (metadata?: { prolificPid?: string }) =>
    request<ParticipantSummary>('/participants', {
      method: 'POST',
      body: JSON.stringify(metadata ?? {}),
    }),
  listParticipants: (q = '') =>
    request<ParticipantSummary[]>(`/participants${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getParticipant: (id: string) => request<ParticipantRecord>(`/participants/${id}`),
  getProgress: (id: string) => request<ProgressInfo>(`/participants/${id}/progress`),
  advanceProgress: (id: string, step: StudyStep, data?: Record<string, unknown>) =>
    request<{ ok: boolean; currentStep: StudyStep }>(`/participants/${id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ step, data }),
    }),
  startSession: (id: string) =>
    request<{ id: string; startedAt: string }>(`/participants/${id}/start`, { method: 'POST' }),
  saveTaskResponses: (id: string, responses: TaskResponse[]) =>
    request<{ ok: boolean; count: number }>(`/participants/${id}/task-responses`, {
      method: 'POST',
      body: JSON.stringify({ responses }),
    }),
  submitSurveys: (id: string, payload: SurveyPayload) =>
    request<{ ok: boolean; susScore: number | null; completedAt: string }>(
      `/participants/${id}/surveys`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  completeSession: (id: string) =>
    request<{ id: string; status: string; completedAt: string }>(`/participants/${id}/complete`, {
      method: 'POST',
    }),
  saveState: (id: string, partial: Partial<ParticipantState>) =>
    request<{ ok: boolean }>(`/participants/${id}/state`, {
      method: 'PUT',
      body: JSON.stringify(partial),
    }),
  logEvents: (id: string, events: StudyEvent[]) =>
    request<{ ok: boolean }>(`/participants/${id}/events`, {
      method: 'POST',
      body: JSON.stringify(events),
    }),
  getRemaining: (id: string) => request<RemainingTime>(`/participants/${id}/remaining`),


  adminLogin: (password: string) =>
    request<{ ok: boolean }>('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  adminLogout: () => request<{ ok: boolean }>('/admin/logout', { method: 'POST' }),
  adminMe: () => request<{ authenticated: boolean }>('/admin/me'),
  adminGetSettings: () => request<AdminSettings>('/admin/settings'),
  adminSaveSettings: (settings: AdminSettingsUpdate) =>
    request<{ ok: boolean }>('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  adminGetTree: () => request<unknown>('/admin/study-tree'),
  adminGetExpertTree: () => request<unknown>('/admin/expert-tree'),
  adminListParticipants: () => request<AdminParticipant[]>('/admin/participants'),
  adminDeleteParticipant: (id: string) =>
    request<{ ok: boolean }>(`/admin/participants/${id}`, { method: 'DELETE' }),


  adminListQuestions: () => request<AdminQuestion[]>('/admin/questions'),
  adminCreateQuestion: (q: QuestionInput) =>
    request<AdminQuestion>('/admin/questions', { method: 'POST', body: JSON.stringify(q) }),
  adminUpdateQuestion: (id: string, q: Partial<QuestionInput>) =>
    request<AdminQuestion>(`/admin/questions/${id}`, { method: 'PUT', body: JSON.stringify(q) }),
  adminDeleteQuestion: (id: string) =>
    request<{ ok: boolean }>(`/admin/questions/${id}`, { method: 'DELETE' }),
  adminReorderQuestions: (ids: string[]) =>
    request<{ ok: boolean }>('/admin/questions/reorder', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
};

export interface TaskMeta {
  rootId?: string;
  nodeCount?: number;
  error?: string;
}

export interface AdminSettings {
  timeLimitMinutes: number;
  landingText: string;
  instructionsText: string;
  finishingText: string;
  treeMeta: TaskMeta | null;
  expertTreeMeta: TaskMeta | null;
}

export interface AdminSettingsUpdate {
  timeLimitMinutes: number;
  landingText: string;
  instructionsText: string;
  finishingText: string;
}

export interface AdminParticipant {
  id: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  condition: StudyCondition | null;
  conditionLabel: string;
  currentStep: StudyStep;
  eventCount: number;
}

export interface AdminQuestion {
  id: string;
  prompt: string;
  type: 'mcq' | 'text';
  options: string[] | null;
  sortOrder: number;
  active: boolean;
}

export interface QuestionInput {
  prompt: string;
  type: 'mcq' | 'text';
  options?: string[] | null;
  active?: boolean;
}


export async function adminUploadStudyTree(file: File): Promise<{ ok: boolean; treeMeta: TaskMeta }> {
  const form = new FormData();
  form.append('tree', file);
  const res = await fetch('/api/admin/study-tree', {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch {

    }
    throw new ApiError(message, res.status);
  }
  return res.json();
}



export async function adminUploadExpertTree(file: File): Promise<{ ok: boolean; treeMeta: TaskMeta }> {
  const form = new FormData();
  form.append('tree', file);
  const res = await fetch('/api/admin/expert-tree', {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch {

    }
    throw new ApiError(message, res.status);
  }
  return res.json();
}




export async function chatStream(
  params: ChatRequest,
  onDelta: (full: string) => void
): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch {

    }
    throw new ApiError(message, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const evt of events) {
      const line = evt.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let parsed: { delta?: string; done?: boolean; error?: string };
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      if (parsed.error) throw new ApiError(parsed.error, 502);
      if (typeof parsed.delta === 'string') {
        full += parsed.delta;
        onDelta(full);
      }
    }
  }

  return full;
}

export interface ConfigureChatRequest {
  message: string;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  currentConfig?: Record<string, unknown>;
  submittedAdvice?: { message: string; handoffSnippet?: string }[];
}






export async function configureChatStream(
  params: ConfigureChatRequest,
  files: File[],
  onDelta: (full: string) => void,
  onStatus?: (status: string) => void
): Promise<string> {
  let res: Response;
  if (files.length > 0) {
    const form = new FormData();
    form.append('payload', JSON.stringify(params));
    for (const file of files) form.append('files', file);
    res = await fetch('/api/configure-chat', {
      method: 'POST',
      credentials: 'same-origin',
      body: form,
    });
  } else {
    res = await fetch('/api/configure-chat', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  }

  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch {

    }
    throw new ApiError(message, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const evt of events) {
      const line = evt.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let parsed: { delta?: string; done?: boolean; error?: string; status?: string };
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      if (parsed.error) throw new ApiError(parsed.error, 502);
      if (typeof parsed.status === 'string') onStatus?.(parsed.status);
      if (typeof parsed.delta === 'string') {
        full += parsed.delta;
        onDelta(full);
      }
    }
  }

  return full;
}


export function beaconEvents(id: string, events: StudyEvent[]): void {
  if (!events.length) return;
  const blob = new Blob([JSON.stringify(events)], { type: 'application/json' });
  navigator.sendBeacon(`/api/participants/${id}/events`, blob);
}
