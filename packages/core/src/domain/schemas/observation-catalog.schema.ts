import { z } from 'zod';
import type { ObservableDef, ObservableValueType } from './observable.schema.js';

export const OBSERVATION_CATALOG_FIELDS = [
  'applied_query',
  'results_url',
  'reported_total_results',
] as const;

export const ObservationCatalogFieldSchema = z.enum(OBSERVATION_CATALOG_FIELDS);

export type ObservationCatalogField = z.infer<typeof ObservationCatalogFieldSchema>;

const VALUE_TYPE_ZOD: Record<ObservableValueType, z.ZodType> = {
  string: z.string(),
  number: z.number(),
  boolean: z.boolean(),
  'string[]': z.array(z.string()),
};

export function buildObservationPayloadSchema(observables: ObservableDef[]) {
  const shape: Record<string, z.ZodType> = {};

  for (const observable of observables) {
    shape[observable.key] = VALUE_TYPE_ZOD[observable.valueType];
  }

  return z.object(shape).strict();
}

export function parseObservationCatalogFields(
  fields: string[],
): ObservationCatalogField[] {
  return fields.map((field) => ObservationCatalogFieldSchema.parse(field));
}
