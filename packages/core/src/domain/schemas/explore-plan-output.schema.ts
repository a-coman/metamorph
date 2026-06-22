import { z } from 'zod';
import { SlotStepSchema } from './generation-slots.schema.js';

export const ExplorePlanActionSchema = z.enum([
  'append_steps',
  'scenario_complete',
  'abort',
]);

const ExplorePlanRationaleSchema = z.object({
  rationale: z.string().min(1),
});

export const ExplorePlanOutputSchema = z.discriminatedUnion('action', [
  ExplorePlanRationaleSchema.extend({
    action: z.literal('append_steps'),
    steps: z.array(SlotStepSchema).min(1).max(3),
  }),
  ExplorePlanRationaleSchema.extend({
    action: z.literal('scenario_complete'),
    steps: z.array(SlotStepSchema).min(1).max(3).optional(),
  }),
  ExplorePlanRationaleSchema.extend({
    action: z.literal('abort'),
    steps: z.array(SlotStepSchema).min(1).max(3).optional(),
  }),
]);

export type ExplorePlanOutput = z.infer<typeof ExplorePlanOutputSchema>;

export const PLAN_EXPLORE_PROMPT_VERSION = 'plan-explore-v10';
