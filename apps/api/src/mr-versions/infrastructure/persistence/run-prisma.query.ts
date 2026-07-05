import { Injectable } from '@nestjs/common';
import type { RunDetailsDto, RunInputBundleDto, RunSummaryDto } from '../../application/dtos/run.dto.js';
import { RunQueryPort } from '../../application/ports/run-query.port.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class RunPrismaQuery extends RunQueryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByMrVersionId(mrVersionId: string): Promise<RunSummaryDto[]> {
    const rows = await this.prisma.run.findMany({
      where: { mrVersionId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      verdictStrict: row.verdictStrict,
      attempt: row.attempt,
      createdAt: row.createdAt,
      finishedAt: row.finishedAt,
    }));
  }

  async findById(runId: string): Promise<RunDetailsDto | null> {
    const row = await this.prisma.run.findUnique({
      where: { id: runId },
      include: {
        observations: true,
        artifacts: true,
        violations: true,
      },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      mrVersionId: row.mrVersionId,
      jobId: row.jobId,
      status: row.status,
      verdictStrict: row.verdictStrict,
      attempt: row.attempt,
      sourceFinalUrl: row.sourceFinalUrl,
      followUpFinalUrl: row.followUpFinalUrl,
      inputBundle: normalizeInputBundle(row.inputBundle),
      createdAt: row.createdAt,
      finishedAt: row.finishedAt,
      observations: row.observations.map((observation) => ({
        id: observation.id,
        role: observation.role,
        payload: observation.payload,
        payloadHash: observation.payloadHash,
        createdAt: observation.createdAt,
      })),
      artifacts: row.artifacts.map((artifact) => ({
        id: artifact.id,
        kind: artifact.kind,
        path: artifact.path,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes,
        createdAt: artifact.createdAt,
      })),
      violations: row.violations.map((violation) => ({
        id: violation.id,
        verdictStrict: violation.verdictStrict,
        createdAt: violation.createdAt,
      })),
    };
  }
}

function normalizeInputBundle(value: unknown): RunInputBundleDto {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as RunInputBundleDto;
  }
  return {};
}
