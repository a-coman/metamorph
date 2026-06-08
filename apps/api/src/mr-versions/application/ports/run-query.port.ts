import type { RunDetailsDto, RunSummaryDto } from '../dtos/run.dto.js';

export abstract class RunQueryPort {
  abstract findByMrVersionId(mrVersionId: string): Promise<RunSummaryDto[]>;
  abstract findById(runId: string): Promise<RunDetailsDto | null>;
}
