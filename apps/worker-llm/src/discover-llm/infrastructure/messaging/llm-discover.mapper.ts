import { llmDiscoverJobMessageSchema } from '@metamorph/contracts';

export type LlmDiscoverCommand = {
  jobId: string;
  sessionId: string;
  pageSnapshotId: string;
  url: string;
};

export function mapLlmDiscoverMessage(raw: unknown): LlmDiscoverCommand | null {
  const parsed = llmDiscoverJobMessageSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  return {
    jobId: parsed.data.job_id,
    sessionId: parsed.data.session_id,
    pageSnapshotId: parsed.data.page_snapshot_id,
    url: parsed.data.payload.url,
  };
}
