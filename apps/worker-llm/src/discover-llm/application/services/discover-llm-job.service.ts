import {
  compilePlaybook,
  extractHostFromUrl,
  LLM_DISCOVER_PROMPT_VERSION,
  validateInventoryElementIds,
} from '@metamorph/core';
import type { DomainError, Either } from '@metamorph/utils';
import { left, right } from '@metamorph/utils';
import { S3ArtifactReaderAdapter } from '../../../shared/infrastructure/minio/s3-artifact-reader.adapter.js';
import {
  JobExecutionFailedError,
  JobNotFoundError,
  SnapshotNotFoundError,
} from '../../domain/errors/discover-llm.errors.js';
import { DiscoverLlmJobRepositoryPort } from '../../domain/repositories/discover-llm-job.repository.port.js';
import { DiscoverLlmJobPort } from '../ports/discover-llm-job.port.js';
import { OpenRouterPort } from '../ports/openrouter.port.js';
import { MrDraftPrismaRepository } from '../../infrastructure/persistence/repositories/mr-draft-prisma.repository.js';
import { PageSnapshotPrismaRepository } from '../../infrastructure/persistence/repositories/page-snapshot-prisma.repository.js';

export class DiscoverLlmJobService implements DiscoverLlmJobPort {
  constructor(
    private readonly jobRepository: DiscoverLlmJobRepositoryPort,
    private readonly pageSnapshotRepository: PageSnapshotPrismaRepository,
    private readonly artifactReader: S3ArtifactReaderAdapter,
    private readonly openRouter: OpenRouterPort,
    private readonly mrDraftRepository: MrDraftPrismaRepository,
  ) {}

  async run(jobId: string): Promise<Either<DomainError, { mrVersionId: string }>> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      return left(new JobNotFoundError(jobId));
    }

    const startOrError = job.start();
    if (startOrError.isLeft()) {
      return left(startOrError.value);
    }

    await this.jobRepository.save(job);

    try {
      const snapshot = await this.pageSnapshotRepository.findById(
        job.pageSnapshotId,
      );

      if (!snapshot) {
        throw new SnapshotNotFoundError(job.pageSnapshotId);
      }

      const screenshot = await this.artifactReader.get(snapshot.artifactPath);
      const screenshotBase64 = screenshot.toString('base64');

      const llmResult = await this.openRouter.proposeDiscoverMr({
        url: snapshot.url,
        inventory: snapshot.inventory,
        screenshotBase64,
      });

      const missingIds = validateInventoryElementIds(
        llmResult.output.generation_slots,
        snapshot.inventory,
      );

      if (missingIds.length > 0) {
        throw new Error(
          `LLM referenced unknown element_ids: ${missingIds.join(', ')}`,
        );
      }

      const compiled = compilePlaybook(
        llmResult.output.generation_slots,
        llmResult.output.mr_definition,
        snapshot.inventory,
      );

      const { mrVersionId } = await this.mrDraftRepository.saveDraft({
        sessionId: job.sessionId,
        pageSnapshotId: snapshot.id,
        jobId: job.id.value,
        host: extractHostFromUrl(snapshot.url),
        llmOutput: llmResult.output,
        compiled,
        llmAudit: {
          model: llmResult.model,
          promptVersion: LLM_DISCOVER_PROMPT_VERSION,
          tokensIn: llmResult.tokensIn,
          tokensOut: llmResult.tokensOut,
          latencyMs: llmResult.latencyMs,
        },
      });

      job.complete();
      await this.jobRepository.save(job);

      console.log(
        `Discover LLM job ${jobId} done — mr_version ${mrVersionId}`,
      );

      return right({ mrVersionId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown discover LLM job error';

      job.fail(message);
      await this.jobRepository.save(job);

      return left(new JobExecutionFailedError(jobId, message));
    }
  }
}
