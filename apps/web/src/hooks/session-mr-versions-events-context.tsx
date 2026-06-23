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
import type { MrVersionEvent, SessionMrVersionSummaryDto } from '@metamorph/api-client';

export type SessionMrVersionEvent = MrVersionEvent & {
  mrVersionId: string;
};

type SessionMrVersionsEventHandler = (event: SessionMrVersionEvent) => void;

type SessionMrVersionsEventsContextValue = {
  subscribe: (handler: SessionMrVersionsEventHandler) => () => void;
  connectionState: SseConnectionState;
};

const SessionMrVersionsEventsContext =
  createContext<SessionMrVersionsEventsContextValue | null>(null);

const MAX_BUFFERED_EVENTS = 200;

const LIVE_MR_STATUSES = new Set(['exploring']);

function MrVersionStreamSubscriber({
  mrVersionId,
  onEvent,
}: {
  mrVersionId: string;
  onEvent: (event: MrVersionEvent, mrVersionId: string) => void;
}) {
  useMrVersionEvents(mrVersionId, (event) => onEvent(event, mrVersionId));
  return null;
}

export function SessionMrVersionsEventsProvider({
  mrVersions,
  children,
}: {
  mrVersions: SessionMrVersionSummaryDto[];
  children: ReactNode;
}) {
  const subscribersRef = useRef(new Set<SessionMrVersionsEventHandler>());
  const bufferRef = useRef<SessionMrVersionEvent[]>([]);
  const [connectionState, setConnectionState] =
    useState<SseConnectionState>('closed');

  const activeMrIds = mrVersions
    .filter((mr) => LIVE_MR_STATUSES.has(mr.status))
    .map((mr) => mr.id);

  const broadcast = useCallback((event: MrVersionEvent, mrVersionId: string) => {
    const tagged: SessionMrVersionEvent = { ...event, mrVersionId };
    bufferRef.current.push(tagged);
    if (bufferRef.current.length > MAX_BUFFERED_EVENTS) {
      bufferRef.current.shift();
    }

    for (const handler of subscribersRef.current) {
      handler(tagged);
    }
  }, []);

  const subscribe = useCallback((handler: SessionMrVersionsEventHandler) => {
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
    if (activeMrIds.length === 0) {
      setConnectionState('closed');
    }
  }, [activeMrIds.join(',')]);

  return (
    <SessionMrVersionsEventsContext.Provider
      value={{ subscribe, connectionState }}
    >
      {activeMrIds.map((mrVersionId) => (
        <MrVersionStreamSubscriber
          key={mrVersionId}
          mrVersionId={mrVersionId}
          onEvent={broadcast}
        />
      ))}
      {children}
    </SessionMrVersionsEventsContext.Provider>
  );
}

export function useSubscribeSessionMrVersionsEvents(
  handler: SessionMrVersionsEventHandler,
) {
  const ctx = useContext(SessionMrVersionsEventsContext);
  if (!ctx) {
    throw new Error(
      'useSubscribeSessionMrVersionsEvents requires SessionMrVersionsEventsProvider',
    );
  }

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return ctx.subscribe((event) => handlerRef.current(event));
  }, [ctx]);
}
