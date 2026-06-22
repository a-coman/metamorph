'use client';

import { useEffect, useRef } from 'react';
import { subscribeSessionEvents, subscribeMrVersionEvents } from '@metamorph/api-client/sse';
import type { SessionEvent, MrVersionEvent } from '@metamorph/api-client';
import { baseUrl } from '@/lib/api';

export type SseConnectionState = 'connecting' | 'connected' | 'error' | 'closed';

function closeEventSource(source: EventSource) {
  source.close();
}

export function useSessionEvents(
  sessionId: string | null,
  onEvent: (event: SessionEvent) => void,
  options?: {
    onConnectionChange?: (state: SseConnectionState) => void;
    reconnectKey?: number;
  },
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onConnectionChangeRef = useRef(options?.onConnectionChange);
  onConnectionChangeRef.current = options?.onConnectionChange;
  const reconnectKey = options?.reconnectKey ?? 0;

  useEffect(() => {
    if (!sessionId) return;

    onConnectionChangeRef.current?.('connecting');

    let receivedMessage = false;
    let closedIntentionally = false;

    const source = subscribeSessionEvents(
      { baseUrl },
      sessionId,
      (e) => {
        if (e.type === 'stream.end') {
          closedIntentionally = true;
          closeEventSource(source);
          onConnectionChangeRef.current?.('closed');
          return;
        }

        receivedMessage = true;
        onEventRef.current(e);
      },
      {
        onOpen: () => onConnectionChangeRef.current?.('connected'),
        onError: () => {
          if (closedIntentionally) return;
          if (receivedMessage) {
            closedIntentionally = true;
            closeEventSource(source);
            onConnectionChangeRef.current?.('closed');
            return;
          }
          onConnectionChangeRef.current?.('error');
        },
      },
    );

    return () => {
      closedIntentionally = true;
      closeEventSource(source);
      onConnectionChangeRef.current?.('closed');
    };
  }, [sessionId, reconnectKey]);
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

    let receivedMessage = false;
    let closedIntentionally = false;

    const source = subscribeMrVersionEvents(
      { baseUrl },
      mrVersionId,
      (e) => {
        if (e.type === 'stream.end') {
          closedIntentionally = true;
          closeEventSource(source);
          onConnectionChangeRef.current?.('closed');
          return;
        }

        receivedMessage = true;
        onEventRef.current(e);
      },
      {
        onOpen: () => onConnectionChangeRef.current?.('connected'),
        onError: () => {
          if (closedIntentionally) return;
          if (receivedMessage) {
            closedIntentionally = true;
            closeEventSource(source);
            onConnectionChangeRef.current?.('closed');
            return;
          }
          onConnectionChangeRef.current?.('error');
        },
      },
    );

    return () => {
      closedIntentionally = true;
      closeEventSource(source);
      onConnectionChangeRef.current?.('closed');
    };
  }, [mrVersionId]);
}
