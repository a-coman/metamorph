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
import { useSessionEvents, type SseConnectionState } from '@/hooks/use-sse';
import type { SessionEvent } from '@metamorph/api-client';

type SessionEventHandler = (event: SessionEvent) => void;

type SessionEventsContextValue = {
  subscribe: (handler: SessionEventHandler) => () => void;
  connectionState: SseConnectionState;
};

const SessionEventsContext = createContext<SessionEventsContextValue | null>(null);

export function SessionEventsProvider({
  sessionId,
  children,
}: {
  sessionId: string;
  children: ReactNode;
}) {
  const subscribersRef = useRef(new Set<SessionEventHandler>());
  const [connectionState, setConnectionState] =
    useState<SseConnectionState>('connecting');

  const broadcast = useCallback((event: SessionEvent) => {
    for (const handler of subscribersRef.current) {
      handler(event);
    }
  }, []);

  const subscribe = useCallback((handler: SessionEventHandler) => {
    subscribersRef.current.add(handler);
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);

  useSessionEvents(sessionId, broadcast, {
    onConnectionChange: setConnectionState,
  });

  return (
    <SessionEventsContext.Provider value={{ subscribe, connectionState }}>
      {children}
    </SessionEventsContext.Provider>
  );
}

export function useSubscribeSessionEvents(handler: SessionEventHandler) {
  const ctx = useContext(SessionEventsContext);
  if (!ctx) {
    throw new Error('useSubscribeSessionEvents requires SessionEventsProvider');
  }

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return ctx.subscribe((event) => handlerRef.current(event));
  }, [ctx]);
}

export function useSessionEventsConnection(): SseConnectionState {
  const ctx = useContext(SessionEventsContext);
  if (!ctx) {
    throw new Error('useSessionEventsConnection requires SessionEventsProvider');
  }
  return ctx.connectionState;
}
