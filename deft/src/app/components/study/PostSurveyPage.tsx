import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, Send } from 'lucide-react';
import { useParticipant } from '../../contexts/ParticipantContext';

interface TlxItem {
  key: string;
  label: string;
  description: string;
  descriptionNote?: string;
  low: string;
  high: string;
}

const TLX_ITEMS: TlxItem[] = [
  {
    key: 'mental',
    label: 'Mental Demand',
    description:
      'How much mental and perceptual activity was required (e.g. thinking, deciding, calculating, remembering, looking, searching, etc)? Was the task easy or demanding, simple or complex, exacting or forgiving?',
    low: 'Low',
    high: 'High',
  },
  {
    key: 'physical',
    label: 'Physical Demand',
    description:
      'How much physical activity was required (e.g. pushing, pulling, turning, controlling, activating, etc)? Was the task easy or demanding, slow or brisk, slack or strenuous, restful or laborious?',
    low: 'Low',
    high: 'High',
  },
  {
    key: 'temporal',
    label: 'Temporal Demand',
    description:
      'How much time pressure did you feel due to the rate of pace at which the tasks or task elements occurred? Was the pace slow and leisurely or rapid and frantic?',
    low: 'Low',
    high: 'High',
  },
  {
    key: 'performance',
    label: 'Performance',
    description:
      'How successful do you think you were in accomplishing the goals of the task set by the experimenter (or yourself)? How satisfied were you with your performance in accomplishing these goals?',
    descriptionNote: 'Note that "Good" is on the left side of the scale.',
    low: 'Good',
    high: 'Poor',
  },
  {
    key: 'effort',
    label: 'Effort',
    description:
      'How hard did you have to work (mentally and physically) to accomplish your level of performance?',
    low: 'Low',
    high: 'High',
  },
  {
    key: 'frustration',
    label: 'Frustration',
    description:
      'How insecure, discouraged, irritated, stressed and annoyed versus secure, gratified, content, relaxed and complacent did you feel during the task?',
    low: 'Low',
    high: 'High',
  },
];

const TLX_SCALE = Array.from({ length: 20 }, (_, i) => i + 1);

function TlxScaleBar({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div className="relative border border-black bg-white h-7">
      <div className="grid h-full grid-cols-[repeat(20,minmax(0,1fr))]">
        {TLX_SCALE.map(segment => {
          const active = value === segment;
          return (
            <button
              key={segment}
              type="button"
              aria-label={`Rating ${segment} of 20`}
              onClick={() => onChange(segment)}
              className={`min-w-0 transition-colors ${
                active ? 'bg-neutral-400' : 'bg-transparent hover:bg-neutral-100'
              }`}
            />
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {Array.from({ length: 21 }, (_, i) => {
          if (i === 0 || i === 20) return null;
          const isMajor = i % 2 === 0;
          return (
            <div
              key={i}
              className={`absolute top-0 w-px bg-black ${
                isMajor ? 'h-full' : 'top-1/2 h-1/2 -translate-y-1/2'
              }`}
              style={{ left: `${(i / 20) * 100}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function PostSurveyPage() {
  const navigate = useNavigate();
  const { participantId, submitSurveys } = useParticipant();
  const [tlx, setTlx] = useState<Record<string, number>>({});
  const [qualFeedback, setQualFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = TLX_ITEMS.every(item => tlx[item.key] != null);

  const handleSubmit = async () => {
    if (!complete) return;
    setBusy(true);
    setError(null);
    try {
      await submitSurveys({ nasaTlx: tlx, qualitativeFeedback: qualFeedback.trim() });
      navigate('/complete');
    } catch {
      setError('Could not submit your responses. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <span className="text-sm text-muted-foreground">
            Participant <span className="font-medium text-foreground tabular-nums">{participantId}</span>
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        <p className="text-center italic mb-10">
          Click on each scale at the point that best indicates your experience of the task.
        </p>

        <div className="space-y-12">
          {TLX_ITEMS.map(item => (
            <section key={item.key}>
              <h2 className="text-center font-bold text-base mb-4">{item.label}</h2>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 md:gap-8 items-start">
                <div>
                  <TlxScaleBar
                    value={tlx[item.key] ?? null}
                    onChange={value => setTlx(prev => ({ ...prev, [item.key]: value }))}
                  />
                  <div className="flex justify-between text-sm mt-1">
                    <span>{item.low}</span>
                    <span>{item.high}</span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed">
                  {item.description}
                  {item.descriptionNote && (
                    <>
                      {' '}
                      <span className="text-red-600">{item.descriptionNote}</span>
                    </>
                  )}
                </p>
              </div>
            </section>
          ))}
        </div>

        <section className="mt-14">
          <h2 className="text-center font-bold text-base mb-4">Qualitative feedback</h2>
          <div className="max-w-3xl mx-auto space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Please provide any qualitative feedback you have on the task and interface. What aspects of the
              interface were easiest/hardest to use? Were you confused by any part of the interface? How would you
              improve the interface and/or task for the future?
            </p>
            <textarea
              value={qualFeedback}
              onChange={e => setQualFeedback(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring/40"
              placeholder="Type your feedback here…"
            />
          </div>
        </section>

        {error && <p className="text-sm text-destructive mt-8">{error}</p>}

        <div className="flex items-center justify-between mt-10 pb-8">
          {!complete && (
            <span className="text-sm text-muted-foreground">
              Please answer all questions to submit.
            </span>
          )}
          <button
            onClick={handleSubmit}
            disabled={!complete || busy}
            className="ml-auto flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit and finish
          </button>
        </div>
      </main>
    </div>
  );
}
