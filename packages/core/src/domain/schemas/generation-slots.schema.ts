import { z } from 'zod';
import { ELEMENT_SHORT_ID_PATTERN } from '../element-short-id.js';
import { ObservationSpecSchema } from './observable.schema.js';

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
    .regex(ELEMENT_SHORT_ID_PATTERN)
    .optional(),
  value: z.string().optional(),
  url: z.string().optional(),
  key: z.string().optional(),
  scroll_y: z.number().optional(),
  timeout_ms: z.number().int().positive().optional(),
  resolved_locator: z.string().optional(),
  resolved_selector: z.string().optional(),
  fill_behavior: z.enum(['plain', 'autocomplete']).optional(),
});

export const ScenarioSlotsSchema = z.object({
  steps: z.array(SlotStepSchema).min(1),
});

export const GenerationSlotsSchema = z.object({
  source: ScenarioSlotsSchema,
  follow_up: ScenarioSlotsSchema,
  observation: ObservationSpecSchema,
});

export type SlotAction = z.infer<typeof SlotActionSchema>;
export type SlotStep = z.infer<typeof SlotStepSchema>;
export type ScenarioSlots = z.infer<typeof ScenarioSlotsSchema>;
export type GenerationSlots = z.infer<typeof GenerationSlotsSchema>;
