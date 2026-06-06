import type { PageInventory } from '@metamorph/inventory';

export type SavePageSnapshotDto = {
  sessionId: string;
  jobId?: string;
  inventory: PageInventory;
};
