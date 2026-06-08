import type { PageSnapshotInventory } from '@metamorph/core';
import { ProbeJob } from '../entities/probe-job.entity.js';

export abstract class ProbeJobRepositoryPort {
  abstract findById(jobId: string): Promise<ProbeJob | null>;
  abstract save(job: ProbeJob): Promise<void>;
}

export abstract class ProbeSnapshotQueryPort {
  abstract findInventoryById(
    snapshotId: string,
  ): Promise<{ inventory: PageSnapshotInventory; url: string } | null>;
}
