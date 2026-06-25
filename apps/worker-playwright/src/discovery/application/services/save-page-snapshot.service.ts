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
    const rawBuffer = dto.inventory.rawScreenshot ?? dto.inventory.screenshot;
    const annotatedBuffer = dto.inventory.screenshot;

    if (!rawBuffer) {
      throw new Error('Page snapshot requires rawScreenshot');
    }
    if (!annotatedBuffer) {
      throw new Error('Page snapshot requires screenshot');
    }

    const rawArtifactPath = `sessions/${dto.sessionId}/snapshots/${snapshotKey}/raw.png`;
    const annotatedArtifactPath = `sessions/${dto.sessionId}/snapshots/${snapshotKey}/annotated.png`;

    const uploads: Promise<void>[] = [
      this.artifactStorage.put(rawArtifactPath, rawBuffer, 'image/png'),
      this.artifactStorage.put(annotatedArtifactPath, annotatedBuffer, 'image/png'),
    ];

    await Promise.all(uploads);

    return this.pageSnapshots.save({
      sessionId: dto.sessionId,
      jobId: dto.jobId,
      url: payload.url,
      inventory: payload,
      rawArtifactPath,
      artifactPath: annotatedArtifactPath,
      rawScreenshot: rawBuffer,
      screenshot: annotatedBuffer,
    });
  }
}
