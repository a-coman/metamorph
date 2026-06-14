import { z } from 'zod';

export const slotStepSchema = z.object({
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
    .regex(/^E[1-9]\d*$/)
    .optional(),
  value: z.string().optional(),
  url: z.string().optional(),
  key: z.string().optional(),
  scroll_y: z.number().optional(),
  timeout_ms: z.number().int().positive().optional(),
  resolved_locator: z.string().optional(),
  resolved_selector: z.string().optional(),
});

export type SlotStepMessage = z.infer<typeof slotStepSchema>;

export const probeFailureContextSchema = z.object({
  failed_step: slotStepSchema,
  failed_step_index: z.number().int().nonnegative(),
  failed_batch_index: z.number().int().nonnegative().optional(),
  failed_batch_size: z.number().int().positive().optional(),
  url_before_failure: z.string(),
  screenshot_before_snapshot_id: z.uuid(),
});

export type ProbeFailureContextMessage = z.infer<typeof probeFailureContextSchema>;
