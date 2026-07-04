import { z } from 'zod';
import { ELEMENT_SHORT_ID_PATTERN } from '../element-short-id.js';
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
    .regex(ELEMENT_SHORT_ID_PATTERN)
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
  // Set at target-resolution time from planning inventory; not LLM-authored.
  fill_behavior: z.enum(['plain', 'autocomplete']).optional(),
});

export const ScenarioSlotsSchema = z.object({
  steps: z.array(SlotStepSchema).min(1),
});

export const ReportedTotalResultsAnchorSchema = z.object({
  label_element_id: z.string().regex(ELEMENT_SHORT_ID_PATTERN),
  inventory_snapshot_id: z.string().uuid(),
  number_index: z.number().int().nonnegative(),
});

export const ObservationAnchorsSchema = z.object({
  reported_total_results: ReportedTotalResultsAnchorSchema.optional(),
});

export const GenerationSlotsSchema = z.object({
  source: ScenarioSlotsSchema,
  follow_up: ScenarioSlotsSchema,
  observation: z.object({
    fields: z.array(ObservationCatalogFieldSchema).min(1),
    anchors: ObservationAnchorsSchema.optional(),
  }),
});

export type SlotAction = z.infer<typeof SlotActionSchema>;
export type SlotStep = z.infer<typeof SlotStepSchema>;
export type ScenarioSlots = z.infer<typeof ScenarioSlotsSchema>;
export type ReportedTotalResultsAnchor = z.infer<typeof ReportedTotalResultsAnchorSchema>;
export type ObservationAnchors = z.infer<typeof ObservationAnchorsSchema>;
export type GenerationSlots = z.infer<typeof GenerationSlotsSchema>;
