import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  executeMrVersion,
  MrPromotionError,
  type MrPromotionPrismaClient,
} from '@metamorph/mr-promotion';
import type { ExecuteMrVersionResultDto } from '../dtos/run.dto.js';
import { JobMessagePublisherPort } from '../../../sessions/application/ports/job-message-publisher.port.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class ExecuteMrVersionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobMessagePublisher: JobMessagePublisherPort,
  ) {}

  async execute(mrVersionId: string): Promise<ExecuteMrVersionResultDto> {
    try {
      return await executeMrVersion(
        {
          prisma: this.prisma as unknown as MrPromotionPrismaClient,
          publishExecutePairJob: (payload) =>
            this.jobMessagePublisher.publishExecutePairJob(payload),
        },
        mrVersionId,
      );
    } catch (error) {
      throw this.mapError(error, mrVersionId);
    }
  }

  private mapError(error: unknown, mrVersionId: string): Error {
    if (error instanceof MrPromotionError) {
      if (error.code === 'not_found') {
        return new NotFoundException(error.message);
      }
      return new BadRequestException(error.message);
    }

    if (error instanceof Error) {
      return error;
    }

    return new BadRequestException(`Failed to execute MR version ${mrVersionId}`);
  }
}
