import { useParticipant } from '../../contexts/ParticipantContext';
import SessionControls from './SessionControls';



export default function StudyHeader() {
  const { participantId } = useParticipant();
  return (
    <header className="border-b border-border bg-card">
      <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Participant <span className="font-medium text-foreground tabular-nums">{participantId}</span>
        </span>
        <SessionControls />
      </div>
    </header>
  );
}
