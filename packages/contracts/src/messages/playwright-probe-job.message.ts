import { z } from 'zod';

const slotStepSchema = z.object({
  id: z.number().int().positive(),
  action: z.enum([
    'goto',
    'click',
    'fill',
    'selectOption',
    'press',
    'scroll',
    'waitFor',
  ]),
  element_id: z
    .string()
    .regex(/^E\d{2,}$/)
    .optional(),
  value: z.string().optional(),
  url: z.string().optional(),
  key: z.string().optional(),
  scroll_y: z.number().optional(),
  timeout_ms: z.number().int().positive().optional(),
  resolved_locator: z.string().optional(),
  resolved_selector: z.string().optional(),
});

export const playwrightProbeJobMessageSchema = z.object({
  job_id: z.uuid(),
  session_id: z.uuid(),
  type: z.literal('probe'),
  mr_version_id: z.uuid(),
  payload: z.object({
    explore_job_id: z.uuid(),
    phase: z.enum(['source', 'follow_up']),
    inventory_snapshot_id: z.uuid(),
    validated_prefix: z.array(slotStepSchema),
    probe_steps: z.array(slotStepSchema).min(1).max(3),
    resume_url: z.url(),
  }),
});

export type PlaywrightProbeJobMessage = z.infer<
  typeof playwrightProbeJobMessageSchema
>;
