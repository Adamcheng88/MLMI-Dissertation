import { HelpCircle } from 'lucide-react';
import { useRef, type ComponentProps } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useParticipant } from '../contexts/ParticipantContext';
import { VISIT_DWELL_MS } from '../lib/visitLogging';

type TooltipSide = ComponentProps<typeof TooltipContent>['side'];
type TooltipAlign = ComponentProps<typeof TooltipContent>['align'];



const visitedTooltips = new Set<string>();

export default function TooltipIcon({
  text,
  side = 'top',
  align = 'center',
  sideOffset = 8,
  contentClassName,
  tooltipId,
  location,
  onFirstVisit,
}: {
  text: string;
  side?: TooltipSide;
  align?: TooltipAlign;
  sideOffset?: number;
  contentClassName?: string;
  tooltipId?: string;
  location?: 'canvas' | 'sidebar';
  onFirstVisit?: (tooltipId: string) => void;
}) {
  const { participantId, logEvent } = useParticipant();
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startDwell = () => {
    if (!tooltipId) return;
    const key = `${participantId ?? 'anon'}:${tooltipId}`;
    if (visitedTooltips.has(key)) return;
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    dwellTimerRef.current = setTimeout(() => {
      dwellTimerRef.current = null;
      if (visitedTooltips.has(key)) return;
      visitedTooltips.add(key);
      if (onFirstVisit) {
        onFirstVisit(tooltipId);
      } else {
        logEvent('tooltip_visit', { tooltipId, location });
      }
    }, VISIT_DWELL_MS);
  };

  const cancelDwell = () => {
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          aria-label="Help"
          onPointerEnter={startDwell}
          onPointerLeave={cancelDwell}
          onBlur={cancelDwell}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={contentClassName}
      >
        <div className="max-w-64 leading-relaxed">{text}</div>
      </TooltipContent>
    </Tooltip>
  );
}
