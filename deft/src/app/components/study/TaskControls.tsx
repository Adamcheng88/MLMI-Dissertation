import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useParticipant } from '../../contexts/ParticipantContext';
import SessionControls from './SessionControls';




export default function TaskControls() {
  const navigate = useNavigate();
  const { advanceStep } = useParticipant();

  const handleTimeout = useCallback(() => {
    advanceStep('surveys')
      .catch(() => {})
      .finally(() => navigate('/surveys'));
  }, [advanceStep, navigate]);

  return <SessionControls showFinishButton={false} showTimer onTimeout={handleTimeout} />;
}
