import { z } from 'zod';

export const llmExploreJobMessageSchema = z.object({
  job_id: z.uuid(),
  session_id: z.uuid(),
  type: z.literal('explore'),
  page_snapshot_id: z.uuid(),
  payload: z.object({
    url: z.url(),
  }),
});

export type LlmExploreJobMessage = z.infer<typeof llmExploreJobMessageSchema>;

export const llmExploreResumeMessageSchema = z.object({
  job_id: z.uuid(),
  session_id: z.uuid(),
  type: z.literal('explore_resume'),
  explore_job_id: z.uuid(),
  payload: z.object({
    probe_job_id: z.uuid(),
    snapshot_id: z.uuid().nullable(),
    probe_status: z.enum(['ok', 'failed']),
    error: z.string().optional(),
  }),
});

export type LlmExploreResumeMessage = z.infer<
  typeof llmExploreResumeMessageSchema
>;

export const llmJobMessageSchema = z.discriminatedUnion('type', [
  llmExploreJobMessageSchema,
  llmExploreResumeMessageSchema,
]);

export type LlmJobMessage = z.infer<typeof llmJobMessageSchema>;
