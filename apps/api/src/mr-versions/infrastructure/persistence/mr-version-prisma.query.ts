import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  MrVersionDetailsDto,
  MrVersionPlaybookDto,
} from '../../application/dtos/mr-version.dto.js';
import { MrVersionQueryPort } from '../../application/ports/mr-version-query.port.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class MrVersionPrismaQuery extends MrVersionQueryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<MrVersionDetailsDto | null> {
    const row = await this.prisma.mrVersion.findUnique({
      where: { id },
      include: {
        mrDefinition: true,
      },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      status: row.status,
      generationSlots: row.generationSlots,
      mrDefinition: row.mrDefinition.definition,
      pageSnapshotId: row.pageSnapshotId,
      locatorValidationScore: row.locatorValidationScore,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findPlaybookByMrVersionId(
    id: string,
  ): Promise<MrVersionPlaybookDto | null> {
    const row = await this.prisma.mrVersion.findUnique({
      where: { id },
      include: {
        playbookBlob: true,
      },
    });

    if (!row?.playbookBlob) {
      return null;
    }

    return {
      id: row.id,
      content: row.playbookBlob.content,
      contentHash: row.playbookBlob.contentHash,
      templateVersion: row.playbookBlob.templateVersion,
    };
  }
}

@Injectable()
export class MrVersionService {
  constructor(private readonly mrVersionQuery: MrVersionQueryPort) {}

  async getById(id: string): Promise<MrVersionDetailsDto> {
    const details = await this.mrVersionQuery.findById(id);
    if (!details) {
      throw new NotFoundException(`MR version ${id} not found`);
    }

    return details;
  }

  async getPlaybook(id: string): Promise<MrVersionPlaybookDto> {
    const playbook = await this.mrVersionQuery.findPlaybookByMrVersionId(id);
    if (!playbook) {
      throw new NotFoundException(`Playbook for MR version ${id} not found`);
    }

    return playbook;
  }
}
