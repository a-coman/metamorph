import { z } from 'zod';

export const llmDiscoverJobMessageSchema = z.object({
  job_id: z.uuid(),
  session_id: z.uuid(),
  type: z.literal('discover.llm'),
  page_snapshot_id: z.uuid(),
  payload: z.object({
    url: z.url(),
  }),
});

export type LlmDiscoverJobMessage = z.infer<typeof llmDiscoverJobMessageSchema>;
