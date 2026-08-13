import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Loader2, GraduationCap } from 'lucide-react';
import { useParticipant } from '../../contexts/ParticipantContext';
import StudyHeader from './StudyHeader';

export default function TutorialPage() {
  const navigate = useNavigate();
  const { condition, advanceStep } = useParticipant();
  const [busy, setBusy] = useState(false);

  const pdfUrl =
    condition === 'baseline'
      ? '/study-docs/b_interface_tutorial.pdf'
      : '/study-docs/e_interface_tutorial.pdf';

  const handleNext = async () => {
    setBusy(true);
    try {
      await advanceStep('task', { tutorialViewedAt: new Date().toISOString() });
      navigate('/task');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StudyHeader />
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-2xl font-medium">How to Use the Interface</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Please read this short tutorial. It explains how the interface you will use works. When you
          continue, the timed task will begin.
        </p>
        <div className="flex-1 min-h-[60vh] border border-border rounded-xl overflow-hidden bg-card">
          <iframe title="Interface tutorial" src={pdfUrl} className="w-full h-full min-h-[60vh]" />
        </div>
        <div className="mt-6 flex items-center justify-between">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Open in new tab
          </a>
          <button
            onClick={handleNext}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Start the task
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
