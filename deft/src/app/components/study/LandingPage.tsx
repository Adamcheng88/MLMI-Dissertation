import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { UserPlus, Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import { useParticipant } from '../../contexts/ParticipantContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { createParticipant } = useParticipant();
  const [landingText, setLandingText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then(s => setLandingText(s.landingText))
      .catch(() => setLandingText('Welcome to the study.'));
  }, []);

  const handleNewUser = async () => {
    setBusy(true);
    setError(null);
    try {
      const prolificPid = new URLSearchParams(window.location.search).get('PROLIFIC_PID')?.trim();
      await createParticipant(prolificPid ? { prolificPid } : undefined);
      navigate('/instructions');
    } catch {
      setError('Could not create a new participant. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-medium mb-3">Welcome</h1>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line mb-8">
            {landingText}
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="w-full">
            <button
              onClick={handleNewUser}
              disabled={busy}
              className="w-full flex flex-col items-center gap-3 p-5 border border-border rounded-xl text-center hover:border-primary/50 hover:shadow-sm transition-all disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                {busy ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : (
                  <UserPlus className="w-5 h-5 text-primary" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">New User</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate a new participant ID and begin.
                </p>
              </div>
            </button>
            {}
          </div>
        </div>
      </div>
    </div>
  );
}
