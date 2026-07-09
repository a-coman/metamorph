import { z } from 'zod';
import { SlotStepSchema, type SlotStep } from '@metamorph/core';

export const slotStepSchema = SlotStepSchema;

export type SlotStepMessage = SlotStep;

export const probeFailureContextSchema = z.object({
  failed_step: slotStepSchema,
  failed_step_index: z.number().int().nonnegative(),
  failed_batch_index: z.number().int().nonnegative().optional(),
  failed_batch_size: z.number().int().positive().optional(),
  url_before_failure: z.string(),
  screenshot_before_snapshot_id: z.uuid(),
});

export type ProbeFailureContextMessage = z.infer<typeof probeFailureContextSchema>;
