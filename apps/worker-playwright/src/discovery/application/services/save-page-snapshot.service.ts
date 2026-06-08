import { randomUUID } from 'node:crypto';
import { toPageSnapshotPayload } from '@metamorph/inventory';
import { ArtifactStoragePort } from '../../domain/repositories/artifact-storage.port.js';
import { PageSnapshotRepositoryPort } from '../../domain/repositories/page-snapshot.repository.port.js';
import type { SavePageSnapshotDto } from '../dtos/save-page-snapshot.dto.js';

export class SavePageSnapshotService {
  constructor(
    private readonly pageSnapshots: PageSnapshotRepositoryPort,
    private readonly artifactStorage: ArtifactStoragePort,
  ) {}

  async execute(dto: SavePageSnapshotDto) {
    const payload = toPageSnapshotPayload(dto.inventory);
    const snapshotKey = randomUUID();
    const artifactPath = `sessions/${dto.sessionId}/snapshots/${snapshotKey}/annotated.png`;

    const uploads: Promise<void>[] = [
      this.artifactStorage.put(
        artifactPath,
        dto.inventory.screenshot,
        'image/png',
      ),
    ];

    let rawArtifactPath: string | undefined;
    if (dto.inventory.rawScreenshot) {
      rawArtifactPath = `sessions/${dto.sessionId}/snapshots/${snapshotKey}/raw.png`;
      uploads.push(
        this.artifactStorage.put(
          rawArtifactPath,
          dto.inventory.rawScreenshot,
          'image/png',
        ),
      );
    }

    await Promise.all(uploads);

    return this.pageSnapshots.save({
      sessionId: dto.sessionId,
      jobId: dto.jobId,
      url: payload.url,
      inventory: payload,
      rawArtifactPath,
      artifactPath,
      rawScreenshot: dto.inventory.rawScreenshot,
      screenshot: dto.inventory.screenshot,
    });
  }
}
