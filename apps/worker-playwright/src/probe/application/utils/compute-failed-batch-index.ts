import type { SlotStep } from '@metamorph/core';

export function computeFailedBatchIndex(input: {
  allSteps: SlotStep[];
  rawSteps: SlotStep[];
  validatedPrefixLength: number;
  probeStepsLength: number;
  failedStepIndex: number;
}): number | undefined {
  const gotoPrefixAdded = input.allSteps.length > input.rawSteps.length;
  const batchStart = (gotoPrefixAdded ? 1 : 0) + input.validatedPrefixLength;
  const batchIndex = input.failedStepIndex - batchStart;

  if (batchIndex >= 0 && batchIndex < input.probeStepsLength) {
    return batchIndex;
  }

  return undefined;
}
