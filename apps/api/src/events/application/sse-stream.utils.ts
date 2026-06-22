import type { MessageEvent } from '@nestjs/common';
import type { Subscriber } from 'rxjs';

export function closeSseStream(
  subscriber: Subscriber<MessageEvent>,
  timer?: ReturnType<typeof setInterval>,
): void {
  if (timer) clearInterval(timer);
  if (subscriber.closed) return;
  subscriber.next({ data: { type: 'stream.end' } });
}
