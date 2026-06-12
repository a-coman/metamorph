import type { SlotStep } from '@metamorph/core';
import type { PageInventory } from '@metamorph/inventory';

export type ProbeFailureContext = {
  failedStep: SlotStep;
  failedStepIndex: number;
  urlBeforeFailure: string;
  screenshotBeforeFailure: Buffer;
};

export class ProbeInventoryCaptureError extends Error {
  readonly partialInventory: PageInventory | null;
  readonly failureContext: ProbeFailureContext | null;

  constructor(
    message: string,
    readonly traceZip: Buffer | null,
    options?: {
      cause?: unknown;
      partialInventory?: PageInventory | null;
      failureContext?: ProbeFailureContext | null;
    },
  ) {
    super(message, options);
    this.name = 'ProbeInventoryCaptureError';
    this.partialInventory = options?.partialInventory ?? null;
    this.failureContext = options?.failureContext ?? null;
  }
}
