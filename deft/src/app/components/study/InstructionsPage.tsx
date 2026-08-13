import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import { useParticipant } from '../../contexts/ParticipantContext';
import SessionControls from './SessionControls';

export default function InstructionsPage() {
  const navigate = useNavigate();
  const { participantId, advanceStep } = useParticipant();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then(s => setText(s.instructionsText))
      .catch(() => setText('Please read the instructions and continue.'));
  }, []);

  const handleContinue = async () => {
    setBusy(true);
    try {
      await advanceStep('info_sheet');
      navigate('/info-sheet');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Participant <span className="font-medium text-foreground tabular-nums">{participantId}</span>
          </span>
          <SessionControls />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-medium mb-6">Task Instructions</h1>
          <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{text}</div>
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleContinue}
              disabled={busy}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
