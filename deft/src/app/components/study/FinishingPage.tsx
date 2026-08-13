import React, { useState, useEffect } from 'react';
import { CheckCircle2, LogOut } from 'lucide-react';
import { api } from '../../api/client';
import { useParticipant } from '../../contexts/ParticipantContext';

const PROLIFIC_COMPLETION_URL = 'https://app.prolific.com/submissions/complete?cc=C4TECGHK';

export default function FinishingPage() {
  const { clearParticipant } = useParticipant();
  const [text, setText] = useState('');

  useEffect(() => {
    api
      .getSettings()
      .then(s => setText(s.finishingText))
      .catch(() => setText('Thank you for completing this study.'));
  }, []);

  const handleExit = () => {
    clearParticipant();
    window.location.assign(PROLIFIC_COMPLETION_URL);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <h1 className="text-2xl font-medium mb-4">Study Complete</h1>
        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{text}</div>
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <LogOut className="w-4 h-4" />
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
