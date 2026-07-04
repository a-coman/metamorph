import { z } from 'zod';
import { MrDefinitionSchema } from './mr-definition.schema.js';

export const MrPlanOutputSchema = z.object({
  mr_definition: MrDefinitionSchema,
  exploration: z.object({
    source_phase_goal: z.string().min(1),
    follow_up_phase_goal: z.string().min(1),
  }),
  observation_intents: z.array(z.string().min(1)).optional(),
});

export type MrPlanOutput = z.infer<typeof MrPlanOutputSchema>;
export type MrIntent = MrPlanOutput;

export const MR_PLAN_PROMPT_VERSION = 'mr-plan-v8';
