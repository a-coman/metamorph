'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMrVersionEvents } from '@/hooks/use-sse';
import type { MrVersionEvent } from '@metamorph/api-client';

interface RunLivePollerProps {
  runId: string;
  mrVersionId: string;
}

export function RunLivePoller({ runId, mrVersionId }: RunLivePollerProps) {
  const router = useRouter();

  useMrVersionEvents(mrVersionId, (event: MrVersionEvent) => {
    if (event.type === 'run.updated' && event.run.id === runId) {
      if (['completed', 'failed'].includes(event.run.status)) {
        router.refresh();
      }
    }
  });

  return null;
}
