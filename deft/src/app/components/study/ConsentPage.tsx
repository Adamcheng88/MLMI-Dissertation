import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useParticipant } from '../../contexts/ParticipantContext';
import StudyHeader from './StudyHeader';

const CONSENT_ITEMS = [
  'I confirm that I have read and understood the Participant Information Sheet for this study, and have had the opportunity to consider the information and ask questions.',
  'I understand that my participation is voluntary and that I am free to withdraw at any time, without giving a reason and without any penalty.',
  'I understand that my anonymised responses and interaction data will be recorded and stored securely, and may be used for research purposes and in academic publications.',
  'I understand that no personally identifying information will be collected, and that the data cannot be linked back to me.',
  'I agree to take part in the above study.',
];

export default function ConsentPage() {
  const navigate = useNavigate();
  const { advanceStep } = useParticipant();
  const [checked, setChecked] = useState<boolean[]>(() => CONSENT_ITEMS.map(() => false));
  const [busy, setBusy] = useState(false);

  const allChecked = checked.every(Boolean);

  const toggle = (i: number) => {
    setChecked(prev => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  const handleNext = async () => {
    if (!allChecked) return;
    setBusy(true);
    try {
      await advanceStep('demographics', {
        consent: { items: CONSENT_ITEMS, agreed: checked, agreedAt: new Date().toISOString() },
      });
      navigate('/demographics');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StudyHeader />
      <main className="flex-1 flex items-start justify-center p-6">
        <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-medium mb-2">Consent Form</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Please read each statement and tick the box to confirm you agree. You must agree to all
            statements to take part.
          </p>
          <div className="space-y-4">
            {CONSENT_ITEMS.map((item, i) => (
              <label
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/40 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => toggle(i)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-sm text-foreground/90 leading-relaxed">{item}</span>
              </label>
            ))}
          </div>
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleNext}
              disabled={!allChecked || busy}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              I consent, continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
