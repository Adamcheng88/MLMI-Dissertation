import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Upload,
  Trash2,
  Download,
  Loader2,
  Check,
  AlertCircle,
  RefreshCw,
  Eye,
  Plus,
  Pencil,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  api,
  adminUploadStudyTree,
  adminUploadExpertTree,
  type AdminParticipant,
  type AdminQuestion,
  type TaskMeta,
} from '../../api/client';

export default function ExperimentSettingsPage() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const expertFileInput = useRef<HTMLInputElement>(null);

  const [timeLimit, setTimeLimit] = useState(30);
  const [landingText, setLandingText] = useState('');
  const [instructionsText, setInstructionsText] = useState('');
  const [finishingText, setFinishingText] = useState('');
  const [treeMeta, setTreeMeta] = useState<TaskMeta | null>(null);
  const [expertTreeMeta, setExpertTreeMeta] = useState<TaskMeta | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [expertUploadMsg, setExpertUploadMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const [participants, setParticipants] = useState<AdminParticipant[]>([]);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);

  const loadSettings = useCallback(() => {
    setLoading(true);
    api
      .adminGetSettings()
      .then(s => {
        setTimeLimit(s.timeLimitMinutes);
        setLandingText(s.landingText);
        setInstructionsText(s.instructionsText);
        setFinishingText(s.finishingText);
        setTreeMeta(s.treeMeta);
        setExpertTreeMeta(s.expertTreeMeta);
      })
      .finally(() => setLoading(false));
  }, []);

  const loadParticipants = useCallback(() => {
    api.adminListParticipants().then(setParticipants).catch(() => setParticipants([]));
  }, []);

  const loadQuestions = useCallback(() => {
    api.adminListQuestions().then(setQuestions).catch(() => setQuestions([]));
  }, []);

  useEffect(() => {
    loadSettings();
    loadParticipants();
    loadQuestions();
  }, [loadSettings, loadParticipants, loadQuestions]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.adminSaveSettings({ timeLimitMinutes: timeLimit, landingText, instructionsText, finishingText });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadMsg(null);
    try {
      const res = await adminUploadStudyTree(file);
      setTreeMeta(res.treeMeta);
      setUploadMsg({ kind: 'ok', text: `Uploaded "${file.name}" successfully.` });
    } catch (err) {
      setUploadMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Upload failed.' });
    }
  };

  const handleExpertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setExpertUploadMsg(null);
    try {
      const res = await adminUploadExpertTree(file);
      setExpertTreeMeta(res.treeMeta);
      setExpertUploadMsg({ kind: 'ok', text: `Uploaded "${file.name}" successfully.` });
    } catch (err) {
      setExpertUploadMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Upload failed.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete participant ${id} and all of their data? This cannot be undone.`)) return;
    await api.adminDeleteParticipant(id);
    loadParticipants();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10 pb-24 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium">Experiment Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure the single-session, between-subjects study. Each participant is
              alternately assigned to one interface condition (Effective, Baseline, Effective, …)
              and works through the same shared study tree.
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/visualize/baseline')}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors flex-shrink-0"
          >
            <Eye className="w-4 h-4" />
            Preview baseline
          </button>
        </div>

        {}
        <section className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h2 className="font-medium">Study configuration</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Task time limit</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={timeLimit}
                onChange={e => setTimeLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-28 px-3 py-2 bg-background border border-border rounded-lg text-sm"
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Landing page text</label>
            <textarea
              value={landingText}
              onChange={e => setLandingText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Instructions text</label>
            <textarea
              value={instructionsText}
              onChange={e => setInstructionsText(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Finishing text</label>
            <textarea
              value={finishingText}
              onChange={e => setFinishingText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Study tree</label>
            {treeMeta && !treeMeta.error && (
              <p className="text-sm mb-3">
                Current tree: <span className="font-medium">{treeMeta.nodeCount}</span> nodes (root{' '}
                <code className="px-1 py-0.5 bg-muted rounded text-xs">{treeMeta.rootId}</code>)
              </p>
            )}
            {treeMeta?.error && <p className="text-sm text-destructive mb-3">Stored tree is invalid.</p>}
            <button
              onClick={() => fileInput.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Upload className="w-4 h-4" />
              Upload tree JSON
            </button>
            <input ref={fileInput} type="file" accept=".json" className="hidden" onChange={handleUpload} />
            {uploadMsg && (
              <div
                className={`mt-3 flex items-center gap-2 text-sm ${
                  uploadMsg.kind === 'ok' ? 'text-green-600' : 'text-destructive'
                }`}
              >
                {uploadMsg.kind === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {uploadMsg.text}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save settings
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <Check className="w-4 h-4" />
                Saved
              </span>
            )}
          </div>
        </section>

        {}
        <section className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-medium">Expert sample interface</h2>
              <p className="text-sm text-muted-foreground mt-1">
                A standalone sample tree viewer served at{' '}
                <code className="px-1 py-0.5 bg-muted rounded text-xs">/expert</code>. This tree is
                stored independently of the study tree and example trees, so the expert interface can
                be developed on its own.
              </p>
            </div>
            <a
              href="/expert"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors flex-shrink-0"
            >
              <Eye className="w-4 h-4" />
              Open /expert
            </a>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Expert tree</label>
            {expertTreeMeta && !expertTreeMeta.error && (
              <p className="text-sm mb-3">
                Current tree: <span className="font-medium">{expertTreeMeta.nodeCount}</span> nodes (root{' '}
                <code className="px-1 py-0.5 bg-muted rounded text-xs">{expertTreeMeta.rootId}</code>)
              </p>
            )}
            {expertTreeMeta?.error && <p className="text-sm text-destructive mb-3">Stored tree is invalid.</p>}
            {!expertTreeMeta && <p className="text-sm text-muted-foreground mb-3">No expert tree configured yet.</p>}
            <button
              onClick={() => expertFileInput.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Upload className="w-4 h-4" />
              Upload tree JSON
            </button>
            <input ref={expertFileInput} type="file" accept=".json" className="hidden" onChange={handleExpertUpload} />
            {expertUploadMsg && (
              <div
                className={`mt-3 flex items-center gap-2 text-sm ${
                  expertUploadMsg.kind === 'ok' ? 'text-green-600' : 'text-destructive'
                }`}
              >
                {expertUploadMsg.kind === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {expertUploadMsg.text}
              </div>
            )}
          </div>
        </section>

        {}
        <QuestionEditor questions={questions} onChange={loadQuestions} />

        {}
        <section className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-medium">Participants</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{participants.length} total</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/api/admin/export/all"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity"
              >
                <Download className="w-3.5 h-3.5" />
                Download all data
              </a>
              <button
                onClick={loadParticipants}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </div>

          {participants.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No participants yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 font-medium">ID</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Condition</th>
                    <th className="py-2 pr-4 font-medium">Step</th>
                    <th className="py-2 pr-4 font-medium">Created</th>
                    <th className="py-2 pr-4 font-medium">Events</th>
                    <th className="py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map(p => (
                    <tr key={p.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-4 font-medium tabular-nums">{p.id}</td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            p.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                        {p.conditionLabel}
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                        {p.currentStep}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                        {new Date(p.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums">{p.eventCount}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`/api/admin/participants/${p.id}/export`}
                            className="p-1.5 rounded-md hover:bg-accent transition-colors"
                            title="Export data"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Delete participant"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

interface DraftQuestion {
  prompt: string;
  type: 'mcq' | 'text';
  optionsText: string;
}

function emptyDraft(): DraftQuestion {
  return { prompt: '', type: 'text', optionsText: '' };
}

function QuestionEditor({
  questions,
  onChange,
}: {
  questions: AdminQuestion[];
  onChange: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DraftQuestion>(emptyDraft);
  const [busy, setBusy] = useState(false);

  const startCreate = () => {
    setDraft(emptyDraft());
    setCreating(true);
    setEditingId(null);
  };

  const startEdit = (q: AdminQuestion) => {
    setDraft({ prompt: q.prompt, type: q.type, optionsText: (q.options || []).join('\n') });
    setEditingId(q.id);
    setCreating(false);
  };

  const cancel = () => {
    setCreating(false);
    setEditingId(null);
    setDraft(emptyDraft());
  };

  const buildInput = () => ({
    prompt: draft.prompt.trim(),
    type: draft.type,
    options:
      draft.type === 'mcq'
        ? draft.optionsText.split('\n').map(o => o.trim()).filter(Boolean)
        : null,
  });

  const save = async () => {
    const input = buildInput();
    if (!input.prompt) return;
    if (input.type === 'mcq' && (!input.options || input.options.length < 2)) {
      window.alert('Multiple-choice questions need at least two options (one per line).');
      return;
    }
    setBusy(true);
    try {
      if (creating) await api.adminCreateQuestion(input);
      else if (editingId) await api.adminUpdateQuestion(editingId, input);
      cancel();
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (q: AdminQuestion) => {
    await api.adminUpdateQuestion(q.id, { active: !q.active });
    onChange();
  };

  const remove = async (q: AdminQuestion) => {
    if (!window.confirm('Delete this question?')) return;
    await api.adminDeleteQuestion(q.id);
    onChange();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= questions.length) return;
    const ids = questions.map(q => q.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    await api.adminReorderQuestions(ids);
    onChange();
  };

  const renderForm = () => (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-background">
      <textarea
        value={draft.prompt}
        onChange={e => setDraft(d => ({ ...d, prompt: e.target.value }))}
        rows={2}
        placeholder="Question prompt"
        className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={draft.type === 'text'}
            onChange={() => setDraft(d => ({ ...d, type: 'text' }))}
            className="accent-primary"
          />
          Free text
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={draft.type === 'mcq'}
            onChange={() => setDraft(d => ({ ...d, type: 'mcq' }))}
            className="accent-primary"
          />
          Multiple choice
        </label>
      </div>
      {draft.type === 'mcq' && (
        <textarea
          value={draft.optionsText}
          onChange={e => setDraft(d => ({ ...d, optionsText: e.target.value }))}
          rows={4}
          placeholder="One option per line"
          className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Save question
        </button>
        <button
          onClick={cancel}
          className="px-4 py-1.5 border border-border rounded-lg text-sm hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <section className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium">Task questions</h2>
        {!creating && !editingId && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add question
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Shown one at a time in the in-task panel. Each participant sees the active questions in a
        randomised order.
      </p>

      <div className="space-y-3">
        {questions.length === 0 && !creating && (
          <p className="py-6 text-center text-sm text-muted-foreground">No questions yet.</p>
        )}

        {questions.map((q, i) => (
          <div key={q.id}>
            {editingId === q.id ? (
              renderForm()
            ) : (
              <div className="flex items-start gap-3 p-3 border border-border rounded-lg">
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-0.5 rounded hover:bg-accent disabled:opacity-30 transition-colors"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === questions.length - 1}
                    className="p-0.5 rounded hover:bg-accent disabled:opacity-30 transition-colors"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {q.type === 'mcq' ? 'Multiple choice' : 'Free text'}
                    </span>
                    {!q.active && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm">{q.prompt}</p>
                  {q.type === 'mcq' && q.options && (
                    <ul className="mt-1 text-xs text-muted-foreground list-disc list-inside">
                      {q.options.map(o => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(q)}
                    className="px-2 py-1 rounded-md text-xs border border-border hover:bg-accent transition-colors"
                    title={q.active ? 'Deactivate' : 'Activate'}
                  >
                    {q.active ? 'Active' : 'Off'}
                  </button>
                  <button
                    onClick={() => startEdit(q)}
                    className="p-1.5 rounded-md hover:bg-accent transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(q)}
                    className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {creating && renderForm()}
      </div>
    </section>
  );
}
