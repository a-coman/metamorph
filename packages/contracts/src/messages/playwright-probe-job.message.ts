import { z } from 'zod';
import { slotStepSchema } from '../schemas/slot-step.schema.js';

const probeJobPayloadSchema = z
  .object({
    explore_job_id: z.uuid(),
    phase: z.enum(['source', 'follow_up']),
    inventory_snapshot_id: z.uuid(),
    mode: z.enum(['incremental', 'smoke_replay']).default('incremental'),
    validated_prefix: z.array(slotStepSchema).default([]),
    probe_steps: z.array(slotStepSchema).min(1),
    resume_url: z.url(),
  })
  .superRefine((payload, ctx) => {
    if (payload.mode === 'incremental' && payload.probe_steps.length > 3) {
      ctx.addIssue({
        code: 'custom',
        message: 'incremental probe_steps must have at most 3 items',
        path: ['probe_steps'],
      });
    }

    if (payload.mode === 'smoke_replay' && payload.probe_steps.length > 50) {
      ctx.addIssue({
        code: 'custom',
        message: 'smoke_replay probe_steps must have at most 50 items',
        path: ['probe_steps'],
      });
    }

    if (payload.mode === 'smoke_replay' && payload.validated_prefix.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'smoke_replay validated_prefix must be empty',
        path: ['validated_prefix'],
      });
    }
  });

export const playwrightProbeJobMessageSchema = z.object({
  job_id: z.uuid(),
  session_id: z.uuid(),
  type: z.literal('probe'),
  mr_version_id: z.uuid(),
  payload: probeJobPayloadSchema,
});

export type PlaywrightProbeJobMessage = z.infer<
  typeof playwrightProbeJobMessageSchema
>;
