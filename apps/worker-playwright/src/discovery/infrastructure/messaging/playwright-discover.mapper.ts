import { playwrightDiscoverJobMessageSchema } from '@metamorph/contracts';

export type PlaywrightDiscoverCommand = {
  jobId: string;
  sessionId: string;
  url: string;
};

export function mapPlaywrightDiscoverMessage(
  raw: unknown,
): PlaywrightDiscoverCommand | null {
  const parsed = playwrightDiscoverJobMessageSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  return {
    jobId: parsed.data.job_id,
    sessionId: parsed.data.session_id,
    url: parsed.data.payload.url,
  };
}
