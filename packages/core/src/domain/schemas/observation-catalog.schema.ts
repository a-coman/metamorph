import { z } from 'zod';

export const OBSERVATION_CATALOG_FIELDS = [
  'applied_query',
  'results_url',
  'visible_item_count',
] as const;

export const ObservationCatalogFieldSchema = z.enum(OBSERVATION_CATALOG_FIELDS);

export type ObservationCatalogField = z.infer<typeof ObservationCatalogFieldSchema>;

export const OBSERVATION_FIELD_TYPES: Record<
  ObservationCatalogField,
  'string' | 'number'
> = {
  applied_query: 'string',
  results_url: 'string',
  visible_item_count: 'number',
};

export function buildObservationPayloadSchema(fields: ObservationCatalogField[]) {
  const shape: Record<string, z.ZodType> = {};

  for (const field of fields) {
    shape[field] =
      OBSERVATION_FIELD_TYPES[field] === 'number' ? z.number() : z.string();
  }

  return z.object(shape).strict();
}

export function parseObservationCatalogFields(
  fields: string[],
): ObservationCatalogField[] {
  return fields.map((field) => ObservationCatalogFieldSchema.parse(field));
}
