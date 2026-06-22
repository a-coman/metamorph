'use client';

import { useState } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { useSubscribeSessionEvents } from '@/hooks/session-events-context';
import { resolveMrStatusBadge } from '@/hooks/use-session-hub-state';

interface MrVersionHeaderProps {
  mrId: string;
  initialMrStatus: string;
  initialControlStatus: string;
}

export function MrVersionHeader({
  mrId,
  initialMrStatus,
  initialControlStatus,
}: MrVersionHeaderProps) {
  const [mrStatus, setMrStatus] = useState(initialMrStatus);
  const [controlStatus, setControlStatus] = useState(initialControlStatus);

  useSubscribeSessionEvents((event) => {
    if (event.type === 'session.control_changed') {
      setControlStatus(event.controlStatus);
    } else if (event.type === 'mr.status_changed' && event.mrVersionId === mrId) {
      setMrStatus(event.status);
    }
  });

  return (
    <div className="flex items-start gap-4">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold tracking-tight">Metamorphic Relation</h1>
          <StatusBadge status={resolveMrStatusBadge(mrStatus, controlStatus)} />
        </div>
        <div className="text-xs text-muted-foreground font-mono">{mrId}</div>
      </div>
    </div>
  );
}
