import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ApproveMrVersionResultDto } from '@metamorph/api-client';
import {
  approveMrVersion,
  MrPromotionError,
  type MrPromotionPrismaClient,
} from '@metamorph/mr-promotion';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class ApproveMrVersionService {
  constructor(private readonly prisma: PrismaService) {}

  async approve(
    mrVersionId: string,
    playbookContent?: string,
  ): Promise<ApproveMrVersionResultDto> {
    try {
      return await approveMrVersion(
        this.prisma as unknown as MrPromotionPrismaClient,
        mrVersionId,
        playbookContent,
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

    return new BadRequestException(`Failed to approve MR version ${mrVersionId}`);
  }
}
