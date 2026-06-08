import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { RunQueryPort } from '../../application/ports/run-query.port.js';

@Controller('runs')
export class RunsController {
  constructor(private readonly runQuery: RunQueryPort) {}

  @Get(':id')
  async getById(@Param('id') id: string) {
    const run = await this.runQuery.findById(id);
    if (!run) {
      throw new NotFoundException(`Run ${id} not found`);
    }

    return run;
  }
}
