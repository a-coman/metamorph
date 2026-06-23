import { z } from 'zod';
import {
  probeFailureContextSchema,
} from '../schemas/slot-step.schema.js';

export const exploreJobPayloadSchema = z.object({
  url: z.url(),
  transform_family: z
    .enum(['idempotence', 'inclusion', 'permutation', 'inverse'])
    .optional(),
});

export const llmExploreJobMessageSchema = z.object({
  job_id: z.uuid(),
  session_id: z.uuid(),
  type: z.literal('explore'),
  page_snapshot_id: z.uuid(),
  payload: exploreJobPayloadSchema,
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
    failure_context: probeFailureContextSchema.optional(),
  }),
});

export type LlmExploreResumeMessage = z.infer<
  typeof llmExploreResumeMessageSchema
>;

export const llmExploreUserResumeMessageSchema = z.object({
  job_id: z.uuid(),
  session_id: z.uuid(),
  type: z.literal('explore_user_resume'),
  explore_job_id: z.uuid(),
});

export type LlmExploreUserResumeMessage = z.infer<
  typeof llmExploreUserResumeMessageSchema
>;

export const llmJobMessageSchema = z.discriminatedUnion('type', [
  llmExploreJobMessageSchema,
  llmExploreResumeMessageSchema,
  llmExploreUserResumeMessageSchema,
]);

export type LlmJobMessage = z.infer<typeof llmJobMessageSchema>;

export const exploreJobDbPayloadSchema = z.object({
  page_snapshot_id: z.string().uuid(),
  parent_discover_job_id: z.string().uuid().optional(),
  transform_family: z.enum(['idempotence', 'inclusion', 'permutation', 'inverse']),
});

export type ExploreJobDbPayload = z.infer<typeof exploreJobDbPayloadSchema>;
