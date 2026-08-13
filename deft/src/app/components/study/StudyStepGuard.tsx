import { type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useParticipant } from '../../contexts/ParticipantContext';
import type { StudyStep } from '../../api/client';


export const STEP_PATH: Record<StudyStep, string> = {
  instructions: '/instructions',
  info_sheet: '/info-sheet',
  consent: '/consent',
  demographics: '/demographics',
  tutorial: '/tutorial',
  task: '/task',
  surveys: '/surveys',
  complete: '/complete',
};



export default function StudyStepGuard({
  step,
  children,
}: {
  step: StudyStep;
  children: ReactNode;
}) {
  const { participantId, hydrated, currentStep } = useParticipant();

  if (!participantId) {
    return <Navigate to="/" replace />;
  }
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (currentStep !== step) {
    return <Navigate to={STEP_PATH[currentStep]} replace />;
  }
  return <>{children}</>;
}
