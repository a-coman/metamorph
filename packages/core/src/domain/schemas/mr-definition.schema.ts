import { z } from 'zod';
import { TRANSFORM_FAMILIES } from '../mr-family-profile.js';

export const ObservableCompareSchema = z.enum([
  'equal',
  'set_equal',
  'cardinality_lte',
]);

export const RelationTypeSchema = ObservableCompareSchema;

export const TransformFamilySchema = z.enum(TRANSFORM_FAMILIES);

export const MrDefinitionSchema = z.object({
  precondition: z.object({
    description: z.string().min(1),
  }),
  transformation: z.object({
    transform_family: TransformFamilySchema,
    description: z.string().min(1),
  }),
  relation: z.object({
    on: z.array(z.string().min(1)),
    description: z.string().min(1),
  }),
});

export type RelationType = z.infer<typeof RelationTypeSchema>;
export type TransformFamily = z.infer<typeof TransformFamilySchema>;
export type MrDefinition = z.infer<typeof MrDefinitionSchema>;
