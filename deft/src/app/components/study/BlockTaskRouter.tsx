import { Loader2 } from 'lucide-react';
import { useParticipant } from '../../contexts/ParticipantContext';
import StudyTreePage from './StudyTreePage';
import BaselineTreePage from '../baseline/BaselineTreePage';




export default function BlockTaskRouter() {
  const { hydrated, currentInterface } = useParticipant();

  if (!hydrated || !currentInterface) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  return currentInterface === 'baseline' ? <BaselineTreePage /> : <StudyTreePage />;
}
