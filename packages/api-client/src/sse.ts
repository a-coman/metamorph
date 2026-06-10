import type { MrVersionEvent, SessionEvent } from './types/events.js';

export type SseClientConfig = {
  baseUrl: string;
};

function parseEventData<T>(event: MessageEvent): T {
  return JSON.parse(String(event.data)) as T;
}

export function subscribeSessionEvents(
  config: SseClientConfig,
  sessionId: string,
  onEvent: (event: SessionEvent) => void,
  callbacks?: { onOpen?: () => void; onError?: (error: Event) => void },
): EventSource {
  const source = new EventSource(
    `${config.baseUrl}/sessions/${sessionId}/events`,
  );

  source.onmessage = (message) => {
    onEvent(parseEventData<SessionEvent>(message));
  };

  if (callbacks?.onOpen) {
    source.onopen = callbacks.onOpen;
  }

  if (callbacks?.onError) {
    source.onerror = callbacks.onError;
  }

  return source;
}

export function subscribeMrVersionEvents(
  config: SseClientConfig,
  mrVersionId: string,
  onEvent: (event: MrVersionEvent) => void,
  callbacks?: { onOpen?: () => void; onError?: (error: Event) => void },
): EventSource {
  const source = new EventSource(
    `${config.baseUrl}/mr-versions/${mrVersionId}/events`,
  );

  source.onmessage = (message) => {
    onEvent(parseEventData<MrVersionEvent>(message));
  };

  if (callbacks?.onOpen) {
    source.onopen = callbacks.onOpen;
  }

  if (callbacks?.onError) {
    source.onerror = callbacks.onError;
  }

  return source;
}
