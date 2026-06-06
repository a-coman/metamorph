import { z } from 'zod';

export const RelationTypeSchema = z.enum([
  'equal',
  'set_equal',
  'subset',
  'superset',
  'cardinality_lte',
  'cardinality_gte',
  'monotone_decrease',
  'monotone_increase',
]);

export const MrDefinitionSchema = z.object({
  precondition: z.object({
    description: z.string().min(1),
  }),
  transformation: z.object({
    transform_family: z.literal('idempotence'),
    description: z.string().min(1),
  }),
  relation: z.object({
    type: RelationTypeSchema,
    on: z.array(z.string().min(1)).min(1),
    description: z.string().min(1),
  }),
});

export type RelationType = z.infer<typeof RelationTypeSchema>;
export type MrDefinition = z.infer<typeof MrDefinitionSchema>;
