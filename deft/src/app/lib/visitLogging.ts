import { useCallback, useEffect, useRef } from 'react';
import { useParticipant } from '../contexts/ParticipantContext';
import type { FeatureNode } from '../components/TreeData';



export const VISIT_DWELL_MS = 300;

export type VisitType = 'hover' | 'click';

interface VisitRecord {
  visitType: VisitType;
  clientEventId: string | null;
}




export function useNodeVisitLogger() {
  const { participantId, logEvent, amendEvent } = useParticipant();
  const visitsRef = useRef<Map<string, VisitRecord>>(new Map());


  useEffect(() => {
    visitsRef.current = new Map();
  }, [participantId]);

  const recordNodeVisit = useCallback(
    (node: FeatureNode, visitType: VisitType) => {
      const existing = visitsRef.current.get(node.id);


      if (existing?.visitType === 'click') return;

      if (visitType === 'hover') {
        if (existing) return;
        const clientEventId = logEvent('node_visit', {
          id: node.id,
          name: node.name,
          visitType: 'hover',
        });
        visitsRef.current.set(node.id, { visitType: 'hover', clientEventId });
        return;
      }


      if (existing) {


        const amended = existing.clientEventId
          ? amendEvent(existing.clientEventId, { visitType: 'click' })
          : false;
        if (!amended) {
          logEvent('node_visit', { id: node.id, name: node.name, visitType: 'click' });
        }
        visitsRef.current.set(node.id, { visitType: 'click', clientEventId: null });
        return;
      }

      const clientEventId = logEvent('node_visit', {
        id: node.id,
        name: node.name,
        visitType: 'click',
      });
      visitsRef.current.set(node.id, { visitType: 'click', clientEventId });
    },
    [logEvent, amendEvent]
  );

  return { recordNodeVisit };
}
