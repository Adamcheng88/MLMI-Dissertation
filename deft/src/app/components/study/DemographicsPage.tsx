import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useParticipant } from '../../contexts/ParticipantContext';
import StudyHeader from './StudyHeader';

interface LikertItem {
  key: string;
  prompt: string;
  low: string;
  high: string;
}

const ITEMS: LikertItem[] = [
  {
    key: 'decisionTrees',
    prompt: 'How familiar are you with decision trees as a machine-learning method?',
    low: 'Not at all familiar',
    high: 'Extremely familiar',
  },
  {
    key: 'python',
    prompt: 'How would you rate your experience with the Python programming language?',
    low: 'No experience',
    high: 'Expert',
  },
  {
    key: 'aiTools',
    prompt: 'How often do you use AI tools (e.g. chatbots, assistants) in your work, studies, or personal life?',
    low: 'Never',
    high: 'Very frequently',
  },
  {
    key: 'nfc1_complexProblems',
    prompt: 'I would prefer complex to simple problems.',
    low: 'Very uncharacteristic',
    high: 'Very characteristic',
  },
  {
    key: 'nfc2_responsibilityThinking',
    prompt: 'I like to have the responsibility of handling a situation that requires a lot of thinking.',
    low: 'Very uncharacteristic',
    high: 'Very characteristic',
  },
  {
    key: 'nfc3_thinkingNotFun_rev',
    prompt: 'Thinking is not my idea of fun.',
    low: 'Very uncharacteristic',
    high: 'Very characteristic',
  },
  {
    key: 'nfc4_preferLittleThought_rev',
    prompt:
      'I would rather do something that requires little thought than something that is sure to challenge my thinking abilities.',
    low: 'Very uncharacteristic',
    high: 'Very characteristic',
  },
  {
    key: 'nfc5_enjoyNewSolutions',
    prompt: 'I really enjoy a task that involves coming up with new solutions to problems.',
    low: 'Very uncharacteristic',
    high: 'Very characteristic',
  },
  {
    key: 'nfc6_intellectualDifficultImportant',
    prompt:
      'I would prefer a task that is intellectual, difficult, and important to one that is somewhat important but does not require much thought.',
    low: 'Very uncharacteristic',
    high: 'Very characteristic',
  },
];

const SCALE = [1, 2, 3, 4, 5];

export default function DemographicsPage() {
  const navigate = useNavigate();
  const { advanceStep } = useParticipant();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const complete = ITEMS.every(item => answers[item.key] != null);

  const handleNext = async () => {
    if (!complete) return;
    setBusy(true);
    try {
      await advanceStep('tutorial', { demographics: answers });
      navigate('/tutorial');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StudyHeader />
      <main className="flex-1 flex items-start justify-center p-6">
        <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-medium mb-2">A Few Questions About You</h1>
          <p className="text-sm text-muted-foreground mb-8">
            These questions help us understand our participants. Please answer honestly; there are no right or
            wrong answers and answers will not be used to screen out participants.
          </p>

          <div className="space-y-8">
            {ITEMS.map(item => (
              <div key={item.key}>
                <p className="text-sm font-medium mb-3">{item.prompt}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-28 text-right shrink-0">
                    {item.low}
                  </span>
                  <div className="flex items-center gap-2">
                    {SCALE.map(value => {
                      const active = answers[item.key] === value;
                      return (
                        <button
                          key={value}
                          onClick={() => setAnswers(prev => ({ ...prev, [item.key]: value }))}
                          className={`w-10 h-10 rounded-lg border text-sm font-medium transition-colors ${
                            active
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-border hover:bg-accent'
                          }`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs text-muted-foreground w-28 shrink-0">{item.high}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex justify-end">
            <button
              onClick={handleNext}
              disabled={!complete || busy}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
