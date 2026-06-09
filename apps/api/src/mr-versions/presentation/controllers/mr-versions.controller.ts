import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { ApproveMrVersionService } from '../../application/services/approve-mr-version.service.js';
import { ExecuteMrVersionService } from '../../application/services/execute-mr-version.service.js';
import { RejectMrVersionService } from '../../application/services/reject-mr-version.service.js';
import { ApproveMrVersionRequest } from '../contracts/approve-mr-version.request.js';
import { RunQueryPort } from '../../application/ports/run-query.port.js';
import { ExplorationService } from '../../infrastructure/persistence/exploration-prisma.query.js';
import { MrVersionService } from '../../infrastructure/persistence/mr-version-prisma.query.js';

@Controller('mr-versions')
export class MrVersionsController {
  constructor(
    private readonly mrVersionService: MrVersionService,
    private readonly explorationService: ExplorationService,
    private readonly approveMrVersionService: ApproveMrVersionService,
    private readonly rejectMrVersionService: RejectMrVersionService,
    private readonly executeMrVersionService: ExecuteMrVersionService,
    private readonly runQuery: RunQueryPort,
  ) {}

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.mrVersionService.getById(id);
  }

  @Get(':id/exploration')
  getExploration(@Param('id') id: string) {
    return this.explorationService.getTimeline(id);
  }

  @Get(':id/playbook')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async getPlaybook(@Param('id') id: string) {
    const playbook = await this.mrVersionService.getPlaybook(id);
    return playbook.content;
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() body: ApproveMrVersionRequest) {
    return this.approveMrVersionService.approve(id, body.playbookContent);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string) {
    return this.rejectMrVersionService.reject(id);
  }

  @Post(':id/execute')
  execute(@Param('id') id: string) {
    return this.executeMrVersionService.execute(id);
  }

  @Get(':id/runs')
  listRuns(@Param('id') id: string) {
    return this.runQuery.findByMrVersionId(id);
  }
}
