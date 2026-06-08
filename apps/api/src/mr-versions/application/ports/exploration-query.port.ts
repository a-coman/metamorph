import type { ExplorationTimelineDto } from '../dtos/mr-version.dto.js';

export abstract class ExplorationQueryPort {
  abstract findTimelineByMrVersionId(
    mrVersionId: string,
  ): Promise<ExplorationTimelineDto | null>;
}
