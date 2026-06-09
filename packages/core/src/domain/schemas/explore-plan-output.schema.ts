import { z } from 'zod';
import { SlotStepSchema } from './generation-slots.schema.js';

export const ExplorePlanActionSchema = z.enum([
  'append_steps',
  'scenario_complete',
  'abort',
]);

export const ExplorePlanOutputSchema = z.object({
  action: ExplorePlanActionSchema,
  steps: z.array(SlotStepSchema).min(1).max(3).optional(),
  rationale: z.string().min(1),
});

export type ExplorePlanOutput = z.infer<typeof ExplorePlanOutputSchema>;

export const PLAN_EXPLORE_PROMPT_VERSION = 'plan-explore-v4';
