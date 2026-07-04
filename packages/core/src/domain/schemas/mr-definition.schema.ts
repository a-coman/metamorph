import { z } from 'zod';
import { TRANSFORM_FAMILIES } from '../mr-family-profile.js';
import { ObservableCompareSchema } from './observable.schema.js';

export { ObservableCompareSchema };

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
