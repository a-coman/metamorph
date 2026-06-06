import type { PageSnapshotInventory } from '@metamorph/core';

export type PersistPageSnapshotInput = {
  sessionId: string;
  jobId?: string;
  url: string;
  inventory: PageSnapshotInventory;
  artifactPath: string;
  screenshot: Buffer;
};

export type PersistPageSnapshotResult = {
  pageSnapshotId: string;
  artifactId: string;
  artifactPath: string;
};

export abstract class PageSnapshotRepositoryPort {
  abstract save(
    input: PersistPageSnapshotInput,
  ): Promise<PersistPageSnapshotResult>;
}
