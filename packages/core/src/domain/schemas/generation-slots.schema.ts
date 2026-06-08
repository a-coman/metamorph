import { z } from 'zod';
import { ObservationCatalogFieldSchema } from './observation-catalog.schema.js';

export const SlotActionSchema = z.enum([
  'goto',
  'click',
  'fill',
  'selectOption',
  'press',
  'scroll',
  'waitFor',
]);

export const SlotStepSchema = z.object({
  id: z.number().int().positive(),
  action: SlotActionSchema,
  element_id: z
    .string()
    .regex(/^E\d{2,}$/)
    .optional(),
  value: z.string().optional(),
  url: z.string().optional(),
  key: z.string().optional(),
  scroll_y: z.number().optional(),
  timeout_ms: z.number().int().positive().optional(),
  // Target resolved against the inventory snapshot active when the step was
  // planned. Persisted so replays do not depend on later snapshots where
  // shortIds (element_id) are reassigned per page.
  resolved_locator: z.string().optional(),
  resolved_selector: z.string().optional(),
});

export const ScenarioSlotsSchema = z.object({
  steps: z.array(SlotStepSchema).min(1),
});

export const GenerationSlotsSchema = z.object({
  source: ScenarioSlotsSchema,
  follow_up: ScenarioSlotsSchema,
  observation: z.object({
    fields: z.array(ObservationCatalogFieldSchema).min(1),
  }),
});

export type SlotAction = z.infer<typeof SlotActionSchema>;
export type SlotStep = z.infer<typeof SlotStepSchema>;
export type ScenarioSlots = z.infer<typeof ScenarioSlotsSchema>;
export type GenerationSlots = z.infer<typeof GenerationSlotsSchema>;
