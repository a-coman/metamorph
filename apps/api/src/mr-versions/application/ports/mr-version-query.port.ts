import type {
  MrVersionDetailsDto,
  MrVersionPlaybookDto,
} from '../dtos/mr-version.dto.js';

export abstract class MrVersionQueryPort {
  abstract findById(id: string): Promise<MrVersionDetailsDto | null>;

  abstract findPlaybookByMrVersionId(
    id: string,
  ): Promise<MrVersionPlaybookDto | null>;
}
