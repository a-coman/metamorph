'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useMrVersionEvents, type SseConnectionState } from '@/hooks/use-sse';
import type { MrVersionEvent } from '@metamorph/api-client';

type MrVersionEventHandler = (event: MrVersionEvent) => void;

type MrVersionEventsContextValue = {
  subscribe: (handler: MrVersionEventHandler) => () => void;
  connectionState: SseConnectionState;
};

const MrVersionEventsContext = createContext<MrVersionEventsContextValue | null>(null);

const MAX_BUFFERED_EVENTS = 100;

export function MrVersionEventsProvider({
  mrVersionId,
  children,
}: {
  mrVersionId: string | null;
  children: ReactNode;
}) {
  const subscribersRef = useRef(new Set<MrVersionEventHandler>());
  const bufferRef = useRef<MrVersionEvent[]>([]);
  const [connectionState, setConnectionState] =
    useState<SseConnectionState>('connecting');

  const broadcast = useCallback((event: MrVersionEvent) => {
    bufferRef.current.push(event);
    if (bufferRef.current.length > MAX_BUFFERED_EVENTS) {
      bufferRef.current.shift();
    }

    for (const handler of subscribersRef.current) {
      handler(event);
    }
  }, []);

  const subscribe = useCallback((handler: MrVersionEventHandler) => {
    subscribersRef.current.add(handler);
    for (const event of bufferRef.current) {
      handler(event);
    }
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    bufferRef.current = [];
    if (!mrVersionId) {
      setConnectionState('closed');
    }
  }, [mrVersionId]);

  useMrVersionEvents(mrVersionId, broadcast, {
    onConnectionChange: setConnectionState,
  });

  return (
    <MrVersionEventsContext.Provider value={{ subscribe, connectionState }}>
      {children}
    </MrVersionEventsContext.Provider>
  );
}

export function useSubscribeMrVersionEvents(handler: MrVersionEventHandler) {
  const ctx = useContext(MrVersionEventsContext);
  if (!ctx) {
    throw new Error('useSubscribeMrVersionEvents requires MrVersionEventsProvider');
  }

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return ctx.subscribe((event) => handlerRef.current(event));
  }, [ctx]);
}
