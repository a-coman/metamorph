import type { PageInventory } from '@metamorph/inventory';

export class ProbeInventoryCaptureError extends Error {
  readonly partialInventory: PageInventory | null;

  constructor(
    message: string,
    readonly traceZip: Buffer | null,
    options?: { cause?: unknown; partialInventory?: PageInventory | null },
  ) {
    super(message, options);
    this.name = 'ProbeInventoryCaptureError';
    this.partialInventory = options?.partialInventory ?? null;
  }
}
