import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Loader2, FileText } from 'lucide-react';
import { useParticipant } from '../../contexts/ParticipantContext';
import StudyHeader from './StudyHeader';

const PDF_URL = '/study-docs/Participant_Information_Sheet.pdf';

export default function InfoSheetPage() {
  const navigate = useNavigate();
  const { advanceStep } = useParticipant();
  const [busy, setBusy] = useState(false);

  const handleNext = async () => {
    setBusy(true);
    try {
      await advanceStep('consent', { infoSheetAcknowledgedAt: new Date().toISOString() });
      navigate('/consent');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StudyHeader />
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-2xl font-medium">Participant Information Sheet</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Please read the information sheet below carefully before continuing. You can scroll within
          the document or open it in a new tab.
        </p>
        <div className="flex-1 min-h-[60vh] border border-border rounded-xl overflow-hidden bg-card">
          <iframe title="Participant Information Sheet" src={PDF_URL} className="w-full h-full min-h-[60vh]" />
        </div>
        <div className="mt-6 flex items-center justify-between">
          <a
            href={PDF_URL}
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
            I have read this
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
