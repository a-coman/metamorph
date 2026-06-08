import { z } from 'zod';
import { MrDefinitionSchema } from './mr-definition.schema.js';
import { ObservationCatalogFieldSchema } from './observation-catalog.schema.js';

const MrPlanMrDefinitionSchema = MrDefinitionSchema.extend({
  relation: MrDefinitionSchema.shape.relation.extend({
    on: z.array(ObservationCatalogFieldSchema).min(1),
  }),
});

export const MrPlanOutputSchema = z.object({
  mr_definition: MrPlanMrDefinitionSchema,
  exploration: z.object({
    source_phase_goal: z.string().min(1),
    follow_up_phase_goal: z.string().min(1),
  }),
});

export type MrPlanOutput = z.infer<typeof MrPlanOutputSchema>;
export type MrIntent = MrPlanOutput;

export const MR_PLAN_PROMPT_VERSION = 'mr-plan-v1';
