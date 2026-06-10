'use client';

import { useEffect, useRef } from 'react';
import { subscribeSessionEvents, subscribeMrVersionEvents } from '@metamorph/api-client/sse';
import type { SessionEvent, MrVersionEvent } from '@metamorph/api-client';
import { baseUrl } from '@/lib/api';

export type SseConnectionState = 'connecting' | 'connected' | 'error' | 'closed';

export function useSessionEvents(
  sessionId: string | null,
  onEvent: (event: SessionEvent) => void,
  options?: { onConnectionChange?: (state: SseConnectionState) => void },
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onConnectionChangeRef = useRef(options?.onConnectionChange);
  onConnectionChangeRef.current = options?.onConnectionChange;

  useEffect(() => {
    if (!sessionId) return;

    onConnectionChangeRef.current?.('connecting');

    const source = subscribeSessionEvents(
      { baseUrl },
      sessionId,
      (e) => onEventRef.current(e),
      {
        onOpen: () => onConnectionChangeRef.current?.('connected'),
        onError: () => onConnectionChangeRef.current?.('error'),
      },
    );

    return () => {
      source.close();
      onConnectionChangeRef.current?.('closed');
    };
  }, [sessionId]);
}

export function useMrVersionEvents(
  mrVersionId: string | null,
  onEvent: (event: MrVersionEvent) => void,
  options?: { onConnectionChange?: (state: SseConnectionState) => void },
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onConnectionChangeRef = useRef(options?.onConnectionChange);
  onConnectionChangeRef.current = options?.onConnectionChange;

  useEffect(() => {
    if (!mrVersionId) return;

    onConnectionChangeRef.current?.('connecting');

    const source = subscribeMrVersionEvents(
      { baseUrl },
      mrVersionId,
      (e) => onEventRef.current(e),
      {
        onOpen: () => onConnectionChangeRef.current?.('connected'),
        onError: () => onConnectionChangeRef.current?.('error'),
      },
    );

    return () => {
      source.close();
      onConnectionChangeRef.current?.('closed');
    };
  }, [mrVersionId]);
}
