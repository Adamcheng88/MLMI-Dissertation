import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Clock, Flag } from 'lucide-react';
import { api } from '../../api/client';
import { useParticipant } from '../../contexts/ParticipantContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

interface SessionControlsProps {

  showFinishButton?: boolean;

  showTimer?: boolean;

  onTimeout?: () => void;
}

export default function SessionControls({
  showFinishButton = true,
  showTimer = false,
  onTimeout,
}: SessionControlsProps) {
  const navigate = useNavigate();
  const { participantId, completeSession, logEvent } = useParticipant();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const finishingRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;


  const handleWithdraw = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      await completeSession();
    } finally {
      navigate('/complete');
    }
  }, [completeSession, navigate]);

  const handleTimeout = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    logEvent('timer_expired');
    if (onTimeoutRef.current) onTimeoutRef.current();
  }, [logEvent]);


  useEffect(() => {
    if (!participantId || !showTimer) return;
    let cancelled = false;
    const poll = () => {
      api
        .getRemaining(participantId)
        .then(res => {
          if (cancelled) return;
          setRemaining(res.remainingSeconds);
          setStarted(res.started);
          if (res.expired && res.started && res.status !== 'completed') {
            handleTimeout();
          }
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [participantId, showTimer, handleTimeout]);


  useEffect(() => {
    if (!showTimer || remaining == null || !started) return;
    const id = setInterval(() => {
      setRemaining(prev => {
        if (prev == null) return prev;
        const next = prev - 1;
        if (next <= 0) handleTimeout();
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [showTimer, remaining == null, started, handleTimeout]);

  const lowTime = remaining != null && remaining <= 60;

  return (
    <div className="flex items-center gap-2">
      {showTimer && remaining != null && started && (
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium tabular-nums border ${
            lowTime
              ? 'bg-destructive/10 border-destructive/30 text-destructive'
              : 'bg-background border-border text-foreground'
          }`}
          title="Time remaining"
        >
          <Clock className="w-4 h-4" />
          {formatTime(remaining)}
        </div>
      )}

      {showFinishButton && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-1.5 bg-destructive text-white rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors">
              <Flag className="w-4 h-4" />
              Finish Task
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Withdraw from the study?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to finish now? Once you confirm, you will not be able to return
                and your participation will end.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleWithdraw}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Yes, finish
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
