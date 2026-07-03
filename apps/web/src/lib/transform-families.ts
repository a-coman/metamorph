import type { TransformFamilyId } from '@/lib/mr-versions';

export const TRANSFORM_FAMILY_DESCRIPTIONS: Record<TransformFamilyId, string> = {
  idempotence: 'Repeating an action should not change the outcome',
  subset: 'Adding a filter should not increase reported results',
  permutation: 'Action order should not change the final state',
  inverse: 'Applying then undoing a change should restore the prior state',
};
