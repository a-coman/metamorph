import { z } from 'zod';
import { ELEMENT_SHORT_ID_PATTERN } from '../element-short-id.js';

export const OBSERVABLE_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export const OBSERVE_SPEC_MAX_OBSERVABLES = 8;

export const ObservableKeySchema = z
  .string()
  .regex(OBSERVABLE_KEY_PATTERN, 'Observable key must be snake_case');

export const ObservableValueTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'string[]',
]);

export const ObservableCompareSchema = z.enum([
  'equal',
  'set_equal',
  'cardinality_lte',
]);

export type ObservableValueType = z.infer<typeof ObservableValueTypeSchema>;
export type ObservableCompare = z.infer<typeof ObservableCompareSchema>;

const CompositePartSchema = z.object({
  element_id: z.string().regex(ELEMENT_SHORT_ID_PATTERN),
  extract: z.enum(['input_value', 'text_content']),
  prefix: z.string().optional(),
  resolved_locator: z.string().optional(),
  resolved_selector: z.string().optional(),
});

export const ObservationBindingSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('input_value'),
    inventory_snapshot_id: z.string().uuid(),
    element_id: z.string().regex(ELEMENT_SHORT_ID_PATTERN),
    resolved_locator: z.string().optional(),
    resolved_selector: z.string().optional(),
  }),
  z.object({
    kind: z.literal('text_content'),
    inventory_snapshot_id: z.string().uuid(),
    element_id: z.string().regex(ELEMENT_SHORT_ID_PATTERN),
    resolved_locator: z.string().optional(),
    resolved_selector: z.string().optional(),
  }),
  z.object({
    kind: z.literal('number_from_label'),
    inventory_snapshot_id: z.string().uuid(),
    element_id: z.string().regex(ELEMENT_SHORT_ID_PATTERN),
    number_index: z.number().int().nonnegative(),
    resolved_locator: z.string().optional(),
    resolved_selector: z.string().optional(),
  }),
  z.object({
    kind: z.literal('url_pathname'),
    inventory_snapshot_id: z.string().uuid(),
  }),
  z.object({
    kind: z.literal('url_params'),
    inventory_snapshot_id: z.string().uuid(),
    param_keys: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    kind: z.literal('list_texts'),
    inventory_snapshot_id: z.string().uuid(),
    element_ids: z.array(z.string().regex(ELEMENT_SHORT_ID_PATTERN)).min(1),
    resolved_locators: z.array(z.string()).optional(),
  }),
  z.object({
    kind: z.literal('presence'),
    inventory_snapshot_id: z.string().uuid(),
    element_id: z.string().regex(ELEMENT_SHORT_ID_PATTERN),
    resolved_locator: z.string().optional(),
    resolved_selector: z.string().optional(),
  }),
  z.object({
    kind: z.literal('composite'),
    inventory_snapshot_id: z.string().uuid(),
    separator: z.string().default('|'),
    parts: z.array(CompositePartSchema).min(1),
  }),
]);

export const ObservableDefSchema = z.object({
  key: ObservableKeySchema,
  valueType: ObservableValueTypeSchema,
  compare: ObservableCompareSchema,
  binding: ObservationBindingSchema,
  rationale: z.string().min(1),
});

export const ObservationSpecSchema = z.object({
  schemaVersion: z.literal(2),
  observables: z.array(ObservableDefSchema).max(OBSERVE_SPEC_MAX_OBSERVABLES),
});

export type ObservationBinding = z.infer<typeof ObservationBindingSchema>;
export type ObservableDef = z.infer<typeof ObservableDefSchema>;
export type ObservationSpec = z.infer<typeof ObservationSpecSchema>;

export const OBSERVATION_SPEC_SCHEMA_VERSION = 2 as const;

/** Minimum bounding-box area (px²) for a valid result-count label element. */
export const MIN_RESULT_LABEL_ELEMENT_AREA_PX = 2000;
